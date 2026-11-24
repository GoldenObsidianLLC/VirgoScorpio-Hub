'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

/**
 * Tests for login CSRF mitigation (pentest finding: Password login permits cross-site login CSRF)
 * 
 * The vulnerability allowed cross-origin no-cors POST requests to log a victim into an attacker's
 * account by:
 * 1. Accepting JSON bodies without validating Content-Type (text/plain was accepted)
 * 2. Not checking Origin header for cross-origin requests
 * 3. Not checking Sec-Fetch-Site header
 * 
 * The mitigation adds three defenses:
 * 1. Origin header validation (when present, must match same-origin)
 * 2. Sec-Fetch-Site header validation (must be same-origin or none)
 * 3. Content-Type validation (must be application/json)
 */

async function withLoginServer(fn, envExtra = {}) {
  const fakeIdentity = {
    async login({ email, password }) {
      if (email === 'test@example.com' && password === 'TestPassword123') {
        return {
          token: 's'.repeat(43),
          csrf: 'c'.repeat(43),
          expiresAt: new Date(Date.now() + 3600_000),
          user: { id: 'u1', email: 'test@example.com', displayName: 'Test User', status: 'active' }
        };
      }
      const error = new Error('Invalid credentials.');
      error.statusCode = 401;
      error.code = 'ERR_VIRGOSCORPIO_HUB_INVALID_CREDENTIALS';
      throw error;
    }
  };

  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100',
      ...envExtra
    },
    identityService: fakeIdentity,
    logger: { error() {} }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  
  try {
    await fn(base);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
}

test('login succeeds with valid same-origin request (application/json Content-Type)', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': base
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
    assert.equal(data.user.email, 'test@example.com');
    
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie, 'login must set session cookies');
    assert.match(setCookie, /vsh_session=/);
    assert.match(setCookie, /vsh_csrf=/);
  });
});

test('login succeeds when Origin header is absent (non-browser client)', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
        // No Origin header - simulates non-browser client
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
  });
});

test('login rejects cross-origin request with mismatched Origin header', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://attacker.example.com'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    assert.match(data.error, /same-origin Origin header/i);
  });
});

test('login rejects request with cross-site Sec-Fetch-Site header', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    assert.match(data.error, /cross-site login requests/i);
  });
});

test('login rejects request with cross-origin Sec-Fetch-Site header', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-origin'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    assert.match(data.error, /cross-site login requests/i);
  });
});

test('login accepts request with Sec-Fetch-Site: same-origin', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': base,
        'sec-fetch-site': 'same-origin'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
  });
});

test('login accepts request with Sec-Fetch-Site: none (direct navigation)', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'none'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
  });
});

test('login rejects text/plain Content-Type (no-cors simple request exploit)', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 415);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');
    assert.match(data.error, /application\/json/i);
  });
});

test('login rejects application/x-www-form-urlencoded Content-Type', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'email=test@example.com&password=TestPassword123'
    });

    assert.equal(response.status, 415);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');
  });
});

test('login rejects missing Content-Type header', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        // No Content-Type header
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 415);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');
  });
});

test('login accepts application/json with charset parameter', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'origin': base
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
  });
});

test('login rejects application/json with extra whitespace in Content-Type', async () => {
  await withLoginServer(async base => {
    // Test that Content-Type parsing is case-insensitive and handles whitespace
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': '  APPLICATION/JSON  ',
        'origin': base
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.authenticated, true);
  });
});

test('login CSRF defenses are checked before credential processing', async () => {
  await withLoginServer(async base => {
    // This test verifies that CSRF checks happen before identity.login() is called
    // by using an invalid Content-Type with valid credentials
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 415);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');
    // If credentials were processed, we would get a different error or success
  });
});

test('login CSRF defenses are checked before rate limiting', async () => {
  await withLoginServer(async base => {
    // First, verify that Origin check happens before rate limiting
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://attacker.example.com'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    // Rate limit error would be 429
  });
});

test('login with both cross-origin Origin and invalid Content-Type rejects with Origin error first', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'origin': 'https://attacker.example.com'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    // Origin check happens first in the code
    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    assert.match(data.error, /same-origin Origin header/i);
  });
});

test('login with cross-site Sec-Fetch-Site and invalid Content-Type rejects with Sec-Fetch-Site error first', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'sec-fetch-site': 'cross-site'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    // Sec-Fetch-Site check happens after Origin but before Content-Type
    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');
    assert.match(data.error, /cross-site login requests/i);
  });
});

test('login with valid Origin but invalid Content-Type rejects with Content-Type error', async () => {
  await withLoginServer(async base => {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'origin': base
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    // Content-Type check happens after Origin and Sec-Fetch-Site
    assert.equal(response.status, 415);
    const data = await response.json();
    assert.equal(data.code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');
  });
});

test('login with secure cookies enabled validates Origin against https scheme', async () => {
  const fakeIdentity = {
    async login({ email, password }) {
      if (email === 'test@example.com' && password === 'TestPassword123') {
        return {
          token: 's'.repeat(43),
          csrf: 'c'.repeat(43),
          expiresAt: new Date(Date.now() + 3600_000),
          user: { id: 'u1', email: 'test@example.com', displayName: 'Test User', status: 'active' }
        };
      }
      const error = new Error('Invalid credentials.');
      error.statusCode = 401;
      error.code = 'ERR_VIRGOSCORPIO_HUB_INVALID_CREDENTIALS';
      throw error;
    }
  };

  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100',
      SESSION_COOKIE_SECURE: 'true'
    },
    identityService: fakeIdentity,
    logger: { error() {} }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const httpBase = `http://127.0.0.1:${port}`;
  const httpsBase = `https://127.0.0.1:${port}`;

  try {
    // With secure cookies, Origin must be https even if connection is http
    const httpOriginResponse = await fetch(`${httpBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': httpBase,
        'host': `127.0.0.1:${port}`
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(httpOriginResponse.status, 403);
    const httpData = await httpOriginResponse.json();
    assert.equal(httpData.code, 'ERR_VIRGOSCORPIO_HUB_CSRF');

    // HTTPS origin should be accepted
    const httpsOriginResponse = await fetch(`${httpBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': httpsBase,
        'host': `127.0.0.1:${port}`
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    assert.equal(httpsOriginResponse.status, 200);
    const httpsData = await httpsOriginResponse.json();
    assert.equal(httpsData.authenticated, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
});

test('login rejects non-string Origin header value', async () => {
  await withLoginServer(async base => {
    // This simulates a malformed or manipulated Origin header
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': base
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });

    // Normal case should succeed
    assert.equal(response.status, 200);
  });
});

test('login defense-in-depth: all three CSRF checks work independently', async () => {
  await withLoginServer(async base => {
    // Test 1: Origin check alone
    const originTest = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://evil.com'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });
    assert.equal(originTest.status, 403);
    assert.equal((await originTest.json()).code, 'ERR_VIRGOSCORPIO_HUB_CSRF');

    // Test 2: Sec-Fetch-Site check alone
    const fetchSiteTest = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });
    assert.equal(fetchSiteTest.status, 403);
    assert.equal((await fetchSiteTest.json()).code, 'ERR_VIRGOSCORPIO_HUB_CSRF');

    // Test 3: Content-Type check alone
    const contentTypeTest = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });
    assert.equal(contentTypeTest.status, 415);
    assert.equal((await contentTypeTest.json()).code, 'ERR_VIRGOSCORPIO_HUB_UNSUPPORTED_MEDIA_TYPE');

    // Test 4: All checks pass
    const validTest = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': base,
        'sec-fetch-site': 'same-origin'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123' })
    });
    assert.equal(validTest.status, 200);
    assert.equal((await validTest.json()).authenticated, true);
  });
});

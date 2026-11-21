'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

/**
 * Test suite for verifying that site-scoped firewall rules are enforced on routes
 * that resolve their tenant context from query parameters, request body, headers,
 * or public site slugs - not just from /sites/{UUID} path segments.
 *
 * This test suite validates the mitigation for the pentest finding:
 * "Site-scoped firewall rules are bypassed on routes without a /sites/{UUID} path segment"
 *
 * The vulnerability allowed requests to bypass site-specific firewall rules because
 * the firewall evaluation occurred before site resolution on routes that used:
 * - Public site slugs (e.g., /public/{siteSlug}/pages/{slug})
 * - Query parameters (e.g., ?siteId=...)
 * - Request headers (e.g., x-virgoscorpio-hub-site-id)
 * - Request body (e.g., { siteId: "..." })
 *
 * The fix adds a second firewall evaluation after site resolution via enforceSiteFirewall().
 */

const SITE_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SITE_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SITE_A_SLUG = 'site-a-test';
const SITE_B_SLUG = 'site-b-test';
const BLOCKED_USER_AGENT = 'BadBot/1.0';
const ALLOWED_USER_AGENT = 'GoodBot/1.0';

/**
 * Create a test server with a mock database that includes:
 * - Two sites (A and B) with slugs
 * - Site-scoped firewall rules for each site
 * - Published pages for testing public routes
 */
async function withTestServer(fn, { uppercaseSiteAId = false } = {}) {
  const sites = new Map([
    [SITE_A_ID, { id: uppercaseSiteAId ? SITE_A_ID.toUpperCase() : SITE_A_ID, slug: SITE_A_SLUG, name: 'Site A', default_locale: 'en' }],
    [SITE_B_ID, { id: SITE_B_ID, slug: SITE_B_SLUG, name: 'Site B', default_locale: 'en' }],
  ]);

  const firewallRules = [
    // Site A: Block specific user agent
    { id: 'rule-a-ua', site_id: SITE_A_ID, action: 'deny', scope: 'user_agent', pattern: BLOCKED_USER_AGENT, reason: 'Site A UA block', enabled: true },

    { id: 'rule-global-ua', site_id: null, action: 'deny', scope: 'user_agent', pattern: 'GlobalBlockedBot/1.0', reason: 'Global user-agent block', enabled: true },
    { id: 'rule-a-challenge', site_id: SITE_A_ID, action: 'challenge', scope: 'user_agent', pattern: 'ChallengeBot/1.0', reason: 'Additional verification required', enabled: true },
    { id: 'rule-a-rate-limit', site_id: SITE_A_ID, action: 'rate_limit', scope: 'user_agent', pattern: 'RateLimitBot/1.0', reason: 'Firewall rate limit exceeded', enabled: true },
    { id: 'rule-a-path', site_id: SITE_A_ID, action: 'deny', scope: 'path', pattern: '/public/site-a-test/pages/path-blocked', reason: 'Site A path block', enabled: true },
  ];

  const pages = new Map([
    [`${SITE_A_ID}:test-page:en`, {
      id: 'page-a-1',
      site_id: SITE_A_ID,
      slug: 'test-page',
      locale: 'en',
      title: 'Test Page A',
      body: { type: 'page', children: [{ type: 'paragraph', children: [{ text: 'Content A' }] }] },
    }],
    [`${SITE_B_ID}:test-page:en`, {
      id: 'page-b-1',
      site_id: SITE_B_ID,
      slug: 'test-page',
      locale: 'en',
      title: 'Test Page B',
      body: { type: 'page', children: [{ type: 'paragraph', children: [{ text: 'Content B' }] }] },
    }],
  ]);

  const mockPool = {
    async query(sql, params = []) {
      // Firewall rules query
      if (sql.includes('FROM firewall_rules WHERE enabled=true')) {
        return { rows: firewallRules };
      }
      // Site by slug query
      if (sql.includes('FROM sites WHERE slug=')) {
        const slug = params[0];
        const site = Array.from(sites.values()).find(s => s.slug === slug);
        return { rows: site ? [site] : [] };
      }
      // Published page query
      if (sql.includes('FROM content_items') && sql.includes('published_snapshot')) {
        const [siteId, slug, locale] = params;
        const key = `${siteId}:${slug}:${locale}`;
        const page = pages.get(key);
        return { rows: page ? [page] : [] };
      }
      // Search query
      if (sql.includes('ts_rank')) {
        return { rows: [] };
      }
      // Products query
      if (sql.includes('FROM commerce_products')) {
        return { rows: [] };
      }
      // Membership plans query
      if (sql.includes('FROM membership_plans')) {
        return { rows: [] };
      }
      // Design system query
      if (sql.includes('FROM site_design_systems')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  let publishedPageReads = 0;
  const mockStore = {
    async getSiteBySlug(slug) {
      return Array.from(sites.values()).find(s => s.slug === slug) || null;
    },
    async getPublishedBySlug({ siteId, slug, locale }) {
      publishedPageReads += 1;
      const key = `${siteId}:${slug}:${locale}`;
      return pages.get(key) || null;
    },
    async listPublished() {
      return [];
    },
    async search() {
      return [];
    },
  };

  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_API_TOKEN: 'test-token',
      AI_PROVIDER: 'mock',
      VIRGOSCORPIO_HUB_FIREWALL_CACHE_MS: '500', // Short cache for testing
    },
    logger: { error() {} },
    pool: mockPool,
    contentStore: mockStore,
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(base, {
      getPublishedPageReads: () => publishedPageReads,
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
}

test('site-scoped firewall rule blocks public page request by site slug when user-agent matches', async () => {
  await withTestServer(async base => {
    // Request to Site A's public page with blocked user-agent
    const res = await fetch(`${base}/public/${SITE_A_SLUG}/pages/test-page`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT,
      },
    });

    assert.equal(res.status, 403, 'Request should be blocked by site-scoped firewall rule');
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
    assert.match(body.error, /firewall policy/i);
  });
});

test('site-scoped firewall rule allows public page request by site slug when user-agent does not match', async () => {
  await withTestServer(async base => {
    // Request to Site A's public page with allowed user-agent
    const res = await fetch(`${base}/public/${SITE_A_SLUG}/pages/test-page`, {
      headers: {
        'user-agent': ALLOWED_USER_AGENT,
      },
    });

    // Should succeed (200) or fail for other reasons, but NOT be blocked by firewall
    assert.notEqual(res.status, 403, 'Request should not be blocked by firewall');
    if (res.status === 403) {
      const body = await res.json();
      assert.notEqual(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY', 'Should not be firewall denial');
    }
  });
});

test('site-scoped firewall rules are tenant-isolated: Site A rule does not block Site B', async () => {
  await withTestServer(async base => {
    // Request to Site B's public page from IP blocked only on Site A
    const res = await fetch(`${base}/public/${SITE_B_SLUG}/pages/test-page`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT, // This IP is blocked on Site A, not Site B
      },
    });

    // Should NOT be blocked by Site A's firewall rule
    assert.notEqual(res.status, 403, 'Site B should not be affected by Site A firewall rules');
    if (res.status === 403) {
      const body = await res.json();
      assert.notEqual(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY', 'Should not be firewall denial');
    }
  });
});

test('site-scoped firewall rule blocks public search request by site slug', async () => {
  await withTestServer(async base => {
    // Request to Site A's public search with blocked user-agent
    const res = await fetch(`${base}/api/v1/public/${SITE_A_SLUG}/search?q=test`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT,
      },
    });

    assert.equal(res.status, 403, 'Search request should be blocked by site-scoped firewall rule');
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
  });
});

test('site-scoped firewall rule blocks public products request by site slug', async () => {
  await withTestServer(async base => {
    // Request to Site A's public products with blocked user-agent
    const res = await fetch(`${base}/api/v1/public/${SITE_A_SLUG}/products`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT,
      },
    });

    assert.equal(res.status, 403, 'Products request should be blocked by site-scoped firewall rule');
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
  });
});

test('site-scoped firewall rule blocks public membership plans request by site slug', async () => {
  await withTestServer(async base => {
    // Request to Site A's public membership plans with blocked user-agent
    const res = await fetch(`${base}/api/v1/public/${SITE_A_SLUG}/membership-plans`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT,
      },
    });

    assert.equal(res.status, 403, 'Membership plans request should be blocked by site-scoped firewall rule');
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
  });
});

test('site-scoped firewall enforcement occurs after site resolution, not just at request entry', async () => {
  await withTestServer(async base => {
    // This test verifies the core fix: enforceSiteFirewall is called AFTER site resolution
    // The initial firewall check at request entry has siteId=null for slug-based routes
    // The second check after getSiteBySlug() has the correct siteId

    // Request to Site A with blocked user-agent - should be denied
    const resA = await fetch(`${base}/public/${SITE_A_SLUG}/pages/test-page`, {
      headers: { 'user-agent': BLOCKED_USER_AGENT },
    });
    assert.equal(resA.status, 403, 'Site A should block the user-agent');

    // Request to Site B from same user-agent - should NOT be denied (different site)
    const resB = await fetch(`${base}/public/${SITE_B_SLUG}/pages/test-page`, {
      headers: { 'user-agent': BLOCKED_USER_AGENT },
    });
    assert.notEqual(resB.status, 403, 'Site B should not block this user-agent');

    // This proves that site-scoped rules are being evaluated with the correct siteId
    // after site resolution, not just with siteId=null at request entry
  });
});

test('global firewall rules apply to all resolved sites', async () => {
  await withTestServer(async base => {
    for (const slug of [SITE_A_SLUG, SITE_B_SLUG]) {
      const res = await fetch(base + '/public/' + slug + '/pages/test-page', {
        headers: { 'user-agent': 'GlobalBlockedBot/1.0' },
      });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
    }
  });
});

test('resolved uppercase tenant IDs are normalized before site-scoped firewall matching', async () => {
  await withTestServer(async base => {
    const res = await fetch(base + '/public/' + SITE_A_SLUG + '/pages/test-page', {
      headers: { 'user-agent': BLOCKED_USER_AGENT },
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
  }, { uppercaseSiteAId: true });
});

test('firewall blocks requests before content is served', async () => {
  await withTestServer(async (base, metrics) =>{
    // Verify that firewall denial happens before expensive operations like rendering
    const res = await fetch(`${base}/public/${SITE_A_SLUG}/pages/test-page`, {
      headers: {
        'user-agent': BLOCKED_USER_AGENT,
      },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
    assert.equal(metrics.getPublishedPageReads(), 0, 'denied requests must not read published page content');

    // Response should be JSON error, not HTML content
    assert.ok(body.error, 'Should return error object');
    assert.ok(body.requestId, 'Should include request ID');
  });
});

test('firewall challenge action blocks matching public page requests', async () => {
  await withTestServer(async base => {
    const res = await fetch(base + '/public/' + SITE_A_SLUG + '/pages/test-page', {
      headers: { 'user-agent': 'ChallengeBot/1.0' },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_CHALLENGE');
    assert.match(body.error, /verification/i);
  });
});

test('firewall rate-limit action blocks matching public page requests', async () => {
  await withTestServer(async base => {
    const res = await fetch(base + '/public/' + SITE_A_SLUG + '/pages/test-page', {
      headers: { 'user-agent': 'RateLimitBot/1.0' },
    });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_RATE_LIMIT');
    assert.match(body.error, /rate limit/i);
  });
});

test('site-scoped path rules block matching public routes after site resolution', async () => {
  await withTestServer(async base => {
    const res = await fetch(base + '/public/' + SITE_A_SLUG + '/pages/path-blocked', {
      headers: { 'user-agent': ALLOWED_USER_AGENT },
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, 'ERR_VIRGOSCORPIO_HUB_FIREWALL_DENY');
  });
});

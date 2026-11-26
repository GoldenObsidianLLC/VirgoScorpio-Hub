'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

const siteId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

/**
 * Security test suite for AI classification bypass mitigation.
 * 
 * Pentest finding: Caller-controlled AI classification bypasses the external-processing data policy
 * 
 * Root cause: reserveAIUsage accepted caller-supplied dataClassification without server-side
 * verification, allowing members to label confidential input as "public" and bypass policy gates.
 * 
 * Mitigation: When provider !== 'mock', classification is forced to 'confidential' regardless
 * of the caller-declared value, ensuring external providers are subject to the strictest policy.
 */

async function withServer(fn, { env = {}, identityService, aiService, pool } = {}) {
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_API_TOKEN: 'test-secret-token',
      AI_PROVIDER: 'mock',
      AI_ALLOWED_PROVIDERS: 'mock,openai-responses,openai-compatible,anthropic,gemini',
      MAX_REQUEST_BYTES: '16384',
      RATE_LIMIT_MAX_REQUESTS: '100',
      ...env
    },
    logger: { error() {} },
    identityService,
    aiService,
    pool
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
}

function createIdentityService(capabilities = []) {
  const grants = new Set(capabilities);
  return {
    async authenticate(token) {
      if (token !== 'member-session-token') return null;
      return {
        sessionId: '44444444-4444-4444-8444-444444444444',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { id: userId, email: 'member@example.test', displayName: 'Member', status: 'active' },
        memberships: [{ siteId, capabilities: [...grants] }]
      };
    },
    async audit() {},
    async authorizeSite(actorId, requestedSiteId, capability) {
      return actorId === userId && requestedSiteId === siteId && grants.has(capability);
    }
  };
}

function createPolicyPool({ maxDataClassification = 'confidential', allowExternalContent = false } = {}) {
  const policy = {
    site_id: siteId,
    enabled: true,
    allow_external_content: allowExternalContent,
    allowed_providers: ['mock', 'openai-responses', 'openai-compatible', 'anthropic', 'gemini'],
    max_data_classification: maxDataClassification,
    daily_request_limit: 100,
    daily_input_chars_limit: 100_000,
    require_human_review: true
  };
  return {
    async query(sql) {
      if (sql.startsWith('SELECT id,site_id,action,scope,pattern,reason,enabled FROM firewall_rules')) return { rows: [] };
      if (sql.startsWith('INSERT INTO site_ai_policies')) return { rows: [] };
      if (sql.startsWith('SELECT site_id,enabled,allow_external_content')) return { rows: [policy] };
      if (sql.startsWith('INSERT INTO ai_usage_daily')) return { rows: [{ requests: 1, input_chars: 100 }] };
      if (sql.startsWith('INSERT INTO ai_run_audit')) return { rows: [] };
      throw new Error('Unexpected test database query: ' + sql);
    }
  };
}

function createAIService(provider = 'mock', model = 'test-model') {
  return {
    providerInfo() {
      return { provider, model, mock: provider === 'mock', publishToolsEnabled: false };
    },
    async generatePageDraft() {
      return { status: 'draft-proposal', saved: false, published: false, document: { type: 'page', children: [] } };
    },
    async assistContent({ text }) {
      return { text, saved: false };
    },
    async generateSeo() {
      return { title: 'Generated Title', description: 'Generated description', saved: false };
    },
    async translate({ text }) {
      return { text, saved: false };
    }
  };
}

async function postAI(base, endpoint, body) {
  return fetch(`${base}/api/v1/ai/${endpoint}`, {
    method: 'POST',
    headers: { authorization: 'Bearer member-session-token', 'content-type': 'application/json' },
    body: JSON.stringify({ siteId, ...body })
  });
}

// ============================================================================
// SECURITY TESTS: Verify mitigation of caller-controlled classification bypass
// ============================================================================

test('mock provider accepts caller-declared public classification when policy allows public', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'content-assist', {
      text: 'Test content',
      operation: 'make-clearer',
      dataClassification: 'public'
    });
    assert.equal(response.status, 200, 'Mock provider with public classification should succeed');
    const result = await response.json();
    assert.equal(result.text, 'Test content');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: false })
  });
});

test('mock provider accepts caller-declared internal classification when policy allows internal', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'translate', {
      text: 'Internal document',
      targetLanguage: 'es',
      dataClassification: 'internal'
    });
    assert.equal(response.status, 200, 'Mock provider with internal classification should succeed');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'internal', allowExternalContent: false })
  });
});

test('mock provider accepts caller-declared confidential classification when policy allows confidential', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'seo', {
      title: 'Confidential Page',
      content: 'Confidential content',
      dataClassification: 'confidential'
    });
    assert.equal(response.status, 200, 'Mock provider with confidential classification should succeed');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'confidential', allowExternalContent: false })
  });
});

test('external provider blocks request when policy max is public, even if caller declares public', async () => {
  // This is the key security test: external providers are forced to 'confidential' classification
  // regardless of what the caller declares, so a public-only policy will block them.
  await withServer(async base => {
    const response = await postAI(base, 'content-assist', {
      text: 'Sensitive internal data that caller tries to label as public',
      operation: 'make-clearer',
      dataClassification: 'public'  // Caller attempts to bypass by declaring public
    });
    assert.equal(response.status, 403, 'External provider must be blocked by public-only policy');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
    assert.match(result.error, /confidential/i, 'Error should mention confidential classification');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
  });
});

test('external provider blocks request when policy max is internal, even if caller declares public', async () => {
  // Verify that declaring 'public' doesn't bypass an internal-max policy for external providers
  await withServer(async base => {
    const response = await postAI(base, 'translate', {
      text: 'Confidential data disguised as public',
      targetLanguage: 'fr',
      dataClassification: 'public'  // Attempted bypass
    });
    assert.equal(response.status, 403, 'External provider must be blocked by internal-max policy');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'anthropic', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('anthropic', 'claude-3'),
    pool: createPolicyPool({ maxDataClassification: 'internal', allowExternalContent: true })
  });
});

test('external provider blocks request when policy max is internal, even if caller declares internal', async () => {
  // Verify that declaring 'internal' doesn't bypass an internal-max policy for external providers
  await withServer(async base => {
    const response = await postAI(base, 'seo', {
      title: 'Secret project',
      content: 'Confidential details',
      dataClassification: 'internal'  // Attempted bypass with internal label
    });
    assert.equal(response.status, 403, 'External provider must be blocked by internal-max policy');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'internal', allowExternalContent: true })
  });
});

test('external provider succeeds when policy max is confidential and external content is allowed', async () => {
  // When policy explicitly allows confidential data to external providers, requests succeed
  await withServer(async base => {
    const response = await postAI(base, 'page-draft', {
      prompt: 'Create a landing page',
      dataClassification: 'public'  // Caller declares public, but server forces confidential
    });
    assert.equal(response.status, 200, 'External provider should succeed with confidential-max policy');
    const result = await response.json();
    assert.equal(result.status, 'draft-proposal');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'confidential', allowExternalContent: true })
  });
});

test('external provider blocks when external content is disabled, regardless of classification', async () => {
  // Even with confidential-max policy, external content must be explicitly enabled
  await withServer(async base => {
    const response = await postAI(base, 'content-assist', {
      text: 'Test content',
      operation: 'make-clearer',
      dataClassification: 'public'
    });
    assert.equal(response.status, 403, 'External provider must be blocked when external content disabled');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_EXTERNAL_CONTENT_DISABLED');
  }, {
    env: { AI_PROVIDER: 'anthropic', AI_ALLOW_EXTERNAL_CONTENT: 'false' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('anthropic', 'claude-3'),
    pool: createPolicyPool({ maxDataClassification: 'confidential', allowExternalContent: false })
  });
});

test('invalid dataClassification is rejected before provider check', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'content-assist', {
      text: 'Test content',
      operation: 'make-clearer',
      dataClassification: 'invalid-level'
    });
    assert.equal(response.status, 400, 'Invalid classification should be rejected');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_INVALID');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'confidential', allowExternalContent: false })
  });
});

test('omitted dataClassification defaults to public for mock provider', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'translate', {
      text: 'Test content',
      targetLanguage: 'de'
      // dataClassification omitted
    });
    assert.equal(response.status, 200, 'Mock provider should accept omitted classification (defaults to public)');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: false })
  });
});

test('omitted dataClassification is forced to confidential for external provider', async () => {
  // Even when caller omits classification (which defaults to 'public' in declaration),
  // external providers are forced to 'confidential' for policy enforcement
  await withServer(async base => {
    const response = await postAI(base, 'seo', {
      title: 'Test Page',
      content: 'Test content'
      // dataClassification omitted - would default to 'public' but forced to 'confidential'
    });
    assert.equal(response.status, 403, 'External provider must be blocked even with omitted classification');
    const result = await response.json();
    assert.equal(result.code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
  });
});

// ============================================================================
// REGRESSION TESTS: Verify all AI endpoints apply the mitigation
// ============================================================================

test('content-assist endpoint applies classification enforcement for external providers', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'content-assist', {
      text: 'Confidential business strategy',
      operation: 'make-clearer',
      dataClassification: 'public'  // Bypass attempt
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'anthropic', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('anthropic', 'claude-3'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
  });
});

test('seo endpoint applies classification enforcement for external providers', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'seo', {
      title: 'Internal Product Launch',
      content: 'Confidential launch details',
      dataClassification: 'public'  // Bypass attempt
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'internal', allowExternalContent: true })
  });
});

test('translate endpoint applies classification enforcement for external providers', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'translate', {
      text: 'Confidential contract terms',
      targetLanguage: 'es',
      dataClassification: 'public'  // Bypass attempt
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'anthropic', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('anthropic', 'claude-3'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
  });
});

test('page-draft endpoint applies classification enforcement for external providers', async () => {
  await withServer(async base => {
    const response = await postAI(base, 'page-draft', {
      prompt: 'Create a page about our confidential product roadmap',
      dataClassification: 'public'  // Bypass attempt
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('openai-responses', 'gpt-4'),
    pool: createPolicyPool({ maxDataClassification: 'internal', allowExternalContent: true })
  });
});

// ============================================================================
// EDGE CASES: Verify behavior with various provider configurations
// ============================================================================

test('multiple external providers all enforce confidential classification', async () => {
  const providers = [
    { name: 'openai-responses', model: 'gpt-4' },
    { name: 'anthropic', model: 'claude-3' },
    { name: 'gemini', model: 'gemini-pro' }
  ];

  for (const provider of providers) {
    await withServer(async base => {
      const response = await postAI(base, 'content-assist', {
        text: 'Test content',
        operation: 'make-clearer',
        dataClassification: 'public'
      });
      assert.equal(response.status, 403, `Provider ${provider.name} must enforce confidential classification`);
      assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
    }, {
      env: { AI_PROVIDER: provider.name, AI_ALLOW_EXTERNAL_CONTENT: 'true' },
      identityService: createIdentityService(['ai:use']),
      aiService: createAIService(provider.name, provider.model),
      pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
    });
  }
});

test('mock provider respects caller classification and does not force confidential', async () => {
  // Verify that the mitigation only applies to external providers, not mock
  await withServer(async base => {
    const publicResponse = await postAI(base, 'content-assist', {
      text: 'Public content',
      operation: 'make-clearer',
      dataClassification: 'public'
    });
    assert.equal(publicResponse.status, 200, 'Mock provider should accept public with public-max policy');

    const internalResponse = await postAI(base, 'translate', {
      text: 'Internal content',
      targetLanguage: 'es',
      dataClassification: 'internal'
    });
    assert.equal(internalResponse.status, 403, 'Mock provider should reject internal with public-max policy');
    assert.equal((await internalResponse.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
  }, {
    env: { AI_PROVIDER: 'mock' },
    identityService: createIdentityService(['ai:use']),
    aiService: createAIService('mock'),
    pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: false })
  });
});

test('classification enforcement is consistent across all request types', async () => {
  // Verify that the mitigation applies uniformly to all AI endpoints
  const endpoints = [
    { path: 'content-assist', body: { text: 'Test', operation: 'make-clearer' } },
    { path: 'seo', body: { title: 'Test', content: 'Test' } },
    { path: 'translate', body: { text: 'Test', targetLanguage: 'es' } },
    { path: 'page-draft', body: { prompt: 'Test' } }
  ];

  for (const endpoint of endpoints) {
    await withServer(async base => {
      const response = await postAI(base, endpoint.path, {
        ...endpoint.body,
        dataClassification: 'public'
      });
      assert.equal(response.status, 403, `Endpoint ${endpoint.path} must enforce classification`);
      assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_CLASSIFICATION_BLOCKED');
    }, {
      env: { AI_PROVIDER: 'openai-responses', AI_ALLOW_EXTERNAL_CONTENT: 'true' },
      identityService: createIdentityService(['ai:use']),
      aiService: createAIService('openai-responses', 'gpt-4'),
      pool: createPolicyPool({ maxDataClassification: 'public', allowExternalContent: true })
    });
  }
});

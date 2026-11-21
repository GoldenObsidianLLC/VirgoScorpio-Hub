'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createOpenAIResponsesProvider } = require('../packages/ai/src/providers/openai-responses');
const { createOpenAICompatibleProvider } = require('../packages/ai/src/providers/openai-compatible');
const { createAnthropicProvider } = require('../packages/ai/src/providers/anthropic');
const { createGeminiProvider } = require('../packages/ai/src/providers/gemini');
const { postJson } = require('../packages/ai/src/providers/utils');

const schema = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } };

test('OpenAI Responses adapter uses bearer auth and structured output format', async () => {
  let captured;
  const provider = createOpenAIResponsesProvider({
    apiKey: 'secret-key', baseUrl: 'https://example.invalid/v1', model: 'test-model', strictJsonSchema: true,
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return { ok: true, async json() { return { output_text: '{"text":"ok"}' }; } };
    }
  });
  const output = await provider.generate({ system: 'trusted task rules', input: 'hello', schemaName: 'test_schema', schema, maxOutputTokens: 123 });
  assert.equal(output, '{"text":"ok"}');
  assert.equal(captured.url, 'https://example.invalid/v1/responses');
  assert.equal(captured.options.headers.authorization, 'Bearer secret-key');
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(captured.body.text.format.strict, true);
  assert.equal(captured.body.max_output_tokens, 123);
  assert.equal(captured.body.store, false);
});

test('OpenAI-compatible adapter uses configured base URL and JSON output mode', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"text":"local"}' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const provider = createOpenAICompatibleProvider({ baseUrl: 'http://127.0.0.1:11434/v1/', model: 'local-model', timeoutMs: 1000 });
    const output = await provider.generate({ system: 'Return JSON', input: 'hi', schemaName: 'text', schema });
    assert.equal(output, '{"text":"local"}');
    assert.equal(captured.url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.deepEqual(captured.body.response_format, { type: 'json_object' });
  } finally { global.fetch = originalFetch; }
});

test('OpenAI-compatible provider rejects plaintext HTTP with API key to remote hosts', () => {
  // Pentest reproduction: remote HTTP URL with API key should be rejected
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'http://evil.example.com/v1', apiKey: 'secret-key', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
  
  // Various remote HTTP hosts should all be rejected when API key is present
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'http://192.168.1.100:8080/v1', apiKey: 'secret', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
  
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'http://10.0.0.1/v1', apiKey: 'secret', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
  
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'http://attacker.local/v1', apiKey: 'secret', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
});

test('OpenAI-compatible provider permits plaintext HTTP to loopback hosts with API key', () => {
  // localhost variants should be allowed with API key
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://localhost:11434/v1', 
    apiKey: 'local-key', 
    model: 'test' 
  }));
  
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://LOCALHOST:11434/v1', 
    apiKey: 'local-key', 
    model: 'test' 
  }));
  
  // 127.x.x.x addresses should be allowed with API key
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://127.0.0.1:11434/v1', 
    apiKey: 'local-key', 
    model: 'test' 
  }));
  
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://127.1.2.3:8080/v1', 
    apiKey: 'local-key', 
    model: 'test' 
  }));
  
  // IPv6 loopback should be allowed with API key
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://[::1]:11434/v1', 
    apiKey: 'local-key', 
    model: 'test' 
  }));
});

test('OpenAI-compatible provider permits plaintext HTTP to remote hosts without API key', () => {
  // Remote HTTP without API key is allowed (no credential exposure risk)
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://public-gateway.example.com/v1', 
    apiKey: '', 
    model: 'test' 
  }));
  
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://192.168.1.100:8080/v1', 
    model: 'test' 
  }));
});

test('OpenAI-compatible provider requires HTTPS for remote hosts with API key', () => {
  // HTTPS with API key to remote host should work
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'https://api.example.com/v1', 
    apiKey: 'secret-key', 
    model: 'test' 
  }));
  
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'https://secure-gateway.example.com:8443/v1', 
    apiKey: 'secret-key', 
    model: 'test' 
  }));
});

test('OpenAI-compatible provider validates URL format and protocol', () => {
  // Invalid URL should be rejected
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'not-a-url', apiKey: 'key', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must be an absolute HTTP\(S\) URL/ }
  );
  
  // Relative URL should be rejected
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: '/relative/path', apiKey: 'key', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must be an absolute HTTP\(S\) URL/ }
  );
  
  // Unsupported protocol should be rejected
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'ftp://example.com/v1', apiKey: 'key', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: or http:/ }
  );
  
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: 'file:///tmp/model', apiKey: 'key', model: 'test' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: or http:/ }
  );
});

test('OpenAI-compatible provider loopback detection handles edge cases', () => {
  // Trailing dots in hostname should be normalized
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://localhost.:11434/v1', 
    apiKey: 'key', 
    model: 'test' 
  }));
  
  // IPv6 with brackets should be handled
  assert.doesNotThrow(() => createOpenAICompatibleProvider({ 
    baseUrl: 'http://[::1]:11434/v1', 
    apiKey: 'key', 
    model: 'test' 
  }));
  
  // Non-loopback IPv6 should be rejected with API key
  assert.throws(
    () => createOpenAICompatibleProvider({ 
      baseUrl: 'http://[2001:db8::1]:8080/v1', 
      apiKey: 'key', 
      model: 'test' 
    }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
  
  // localhost.localdomain should NOT be treated as loopback (only exact 'localhost')
  assert.throws(
    () => createOpenAICompatibleProvider({ 
      baseUrl: 'http://localhost.localdomain:8080/v1', 
      apiKey: 'key', 
      model: 'test' 
    }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
  
  // 128.0.0.1 is NOT in 127.0.0.0/8 range
  assert.throws(
    () => createOpenAICompatibleProvider({ 
      baseUrl: 'http://128.0.0.1:8080/v1', 
      apiKey: 'key', 
      model: 'test' 
    }),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', message: /must use https: when AI_API_KEY is configured/ }
  );
});


test('Anthropic and Gemini adapters use headers rather than logging provider keys in URLs', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    const body = String(url).includes('/interactions')
      ? { steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"text":"gemini"}' }] }] }
      : { content: [{ type: 'text', text: '{"text":"claude"}' }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const anthropic = createAnthropicProvider({ apiKey: '****cret', baseUrl: 'https://example.invalid/v1', model: 'test', timeoutMs: 1000 });
    assert.equal(await anthropic.generate({ system: 'Return JSON', input: 'hello', schemaName: 'test', schema }), '{"text":"claude"}');
    const gemini = createGeminiProvider({ apiKey: 'gemini-secret', baseUrl: 'https://example.invalid/v1beta', model: 'test', timeoutMs: 1000 });
    assert.equal(await gemini.generate({ system: 'Return JSON', input: 'hello', schemaName: 'test', schema }), '{"text":"gemini"}');
    assert.equal(calls[0].headers['x-api-key'], '****cret');
    assert.equal(calls[1].headers['x-goog-api-key'], 'gemini-secret');
    assert.equal(calls[1].url, 'https://example.invalid/v1beta/interactions');
    assert.equal(calls[1].body.store, false);
    assert.deepEqual(calls[1].body.response_format, { type: 'text', mime_type: 'application/json', schema });
    assert.equal(calls[1].body.generation_config.max_output_tokens, 6000);
    assert.ok(!calls[1].url.includes('gemini-secret'));
  } finally { global.fetch = originalFetch; }
});


test('provider transport distinguishes caller cancellation from its own timeout', async () => {
  const controller = new AbortController();
  let startedResolve;
  const started = new Promise(resolve => { startedResolve = resolve; });
  let transportSignal;

  const pending = postJson(
    'https://example.invalid/v1/generate',
    {},
    { prompt: 'test' },
    5_000,
    {
      signal: controller.signal,
      fetchImpl: async (_url, options) => {
        transportSignal = options.signal;
        startedResolve();
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      }
    }
  );
  await started;
  controller.abort(new Error('test client disconnect'));

  await assert.rejects(pending, { code: 'ERR_VIRGOSCORPIO_HUB_AI_CANCELLED', statusCode: 499 });
  assert.equal(transportSignal.aborted, true);

  await assert.rejects(
    postJson(
      'https://example.invalid/v1/generate',
      {},
      { prompt: 'timeout test' },
      10,
      {
        fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        })
      }
    ),
    { code: 'ERR_VIRGOSCORPIO_HUB_AI_TIMEOUT' }
  );
});

test('OpenAI Responses provider forwards caller cancellation into its HTTP request', async () => {
  const controller = new AbortController();
  let startedResolve;
  const started = new Promise(resolve => { startedResolve = resolve; });
  let transportSignal;
  const provider = createOpenAIResponsesProvider({
    apiKey: 'test-key',
    baseUrl: 'https://example.invalid/v1',
    model: 'test-model',
    fetchImpl: async (_url, options) => {
      transportSignal = options.signal;
      startedResolve();
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    }
  });

  const pending = provider.generate({
    system: 'Return JSON',
    input: 'cancel this request',
    schemaName: 'test_schema',
    schema,
    signal: controller.signal
  });
  await started;
  controller.abort(new Error('caller disconnected'));

  await assert.rejects(pending, { code: 'ERR_VIRGOSCORPIO_HUB_AI_CANCELLED', statusCode: 499 });
  assert.equal(transportSignal.aborted, true);
});

'use strict';

const { postJson, trimBaseUrl } = require('./utils');

function isLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function assertSafeBaseUrl(baseUrl, apiKey) {
  const invalid = message => Object.assign(new Error(message), { code: 'ERR_VIRGOSCORPIO_HUB_AI_CONFIG', statusCode: 500 });
  let parsed;
  try { parsed = new URL(String(baseUrl)); } catch { throw invalid('AI_BASE_URL must be an absolute HTTP(S) URL.'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw invalid('AI_BASE_URL must use https: or http:.');
  // Never transmit the provider credential in cleartext to a non-loopback host.
  if (apiKey && parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname)) {
    throw invalid('AI_BASE_URL must use https: when AI_API_KEY is configured; plaintext http: is permitted only for loopback hosts.');
  }
}

function createOpenAICompatibleProvider({ apiKey = '', baseUrl, model, timeoutMs = 30_000, useStrictJsonSchema = false } = {}) {
  if (!baseUrl || !model) throw Object.assign(new Error('AI_BASE_URL and AI_MODEL are required for openai-compatible.'), { code: 'ERR_VIRGOSCORPIO_HUB_AI_NOT_CONFIGURED' });
  assertSafeBaseUrl(baseUrl, apiKey);
  return Object.freeze({
    name: 'openai-compatible', model,
    async generate({ system, input, schemaName, schema, maxOutputTokens = 6000, signal }) {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input }
        ],
        max_tokens: maxOutputTokens,
        temperature: 0.2
      };
      if (schema) {
        body.response_format = useStrictJsonSchema
          ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
          : { type: 'json_object' };
      }
      const result = await postJson(`${trimBaseUrl(baseUrl)}/chat/completions`, apiKey ? { authorization: `Bearer ${apiKey}` } : {}, body, timeoutMs, { signal });
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) return content.map(part => typeof part.text === 'string' ? part.text : '').join('\n');
      throw Object.assign(new Error('OpenAI-compatible endpoint returned no text output.'), { code: 'ERR_VIRGOSCORPIO_HUB_AI_EMPTY_OUTPUT' });
    }
  });
}

module.exports = { createOpenAICompatibleProvider };

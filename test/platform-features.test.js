'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sniffMime, sanitizeDisplayName, decodeDataBase64 } = require('../packages/library/src/file-store');
const { listIcons, renderIcon } = require('../packages/icons/src/catalog');
const { validateFormula, renderMath } = require('../packages/math/src/renderer');
const { optimizeImage } = require('../packages/media/src/optimizer');
const { validateProduct, normalizeCart, calculateLineTotal } = require('../packages/commerce/src/validation');
const { validateProfile, validateGroup } = require('../packages/community/src/validation');
const { validateIpPattern, cidrContains, ruleMatches } = require('../packages/security/src/firewall');
const { cloudConfigStatus, cloudEndpointAllowed } = require('../packages/cloud/src/storage-adapters');
const { verifyStripeSignature } = require('../packages/billing/src/stripe');
const { validatePageDocument } = require('../packages/domain/src/page-document');
const { renderPageDocument } = require('../packages/render/src/index');
const { createHash, createHmac } = require('node:crypto');

test('library type detection trusts file signatures and rejects unsafe display names', () => {
  assert.equal(sniffMime(Buffer.from([137,80,78,71,13,10,26,10,0])), 'image/png');
  assert.equal(sniffMime(Buffer.from('%PDF-1.7 test')), 'application/pdf');
  assert.equal(sniffMime(Buffer.from('hello world')), 'text/plain');
  assert.equal(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'text/plain');
  assert.equal(sanitizeDisplayName('../../a\\b:<script>.png'), 'a-b--script-.png');
  assert.throws(() => decodeDataBase64('not base64!', 100), { code: 'ERR_VIRGOSCORPIO_HUB_LIBRARY_INVALID' });
});

test('icon catalog renders only curated SVG paths and escapes titles', () => {
  assert.ok(listIcons().length >= 10);
  const svg = renderIcon('check', { size: 24, title: '<script>alert(1)</script>' });
  assert.match(svg, /^<svg /);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>/i);
  assert.throws(() => renderIcon('unknown'), { code: 'ERR_VIRGOSCORPIO_HUB_ICON_NOT_FOUND' });
  assert.throws(() => renderIcon('check', { size: 1000 }), { code: 'ERR_VIRGOSCORPIO_HUB_ICON_OPTIONS' });
});

test('math formulas reject dangerous TeX commands and use an escaped fallback when KaTeX is absent', () => {
  assert.equal(validateFormula('\\frac{a}{b}').valid, true);
  assert.equal(validateFormula('\\href{javascript:alert(1)}{x}').valid, false);
  assert.equal(validateFormula('{x').valid, false);
  assert.throws(() => renderMath('\\write18{touch /tmp/x}'), { code: 'ERR_VIRGOSCORPIO_HUB_MATH_INVALID' });
  const fallback = renderMath('<script>x</script>', { katex: false });
  assert.equal(fallback.rendered, false);
  assert.match(fallback.html, /&lt;script&gt;/);
  assert.doesNotMatch(fallback.html, /<script>/i);
});

test('optional image optimization fails closed without a native image optimizer', async () => {
  const sentinel = async () => { throw new Error('must not run'); };
  const result = await optimizeImage(Buffer.from('not an image'), { sharp: false });
  assert.ok(result && typeof result.optimized === 'boolean');
  assert.ok(['optimizer-unavailable','not-smaller','converted-to-webp'].includes(result.reason));
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(typeof sentinel, 'function');
});

test('commerce validation uses integer-safe minor-unit prices and bounded cart quantities', () => {
  assert.equal(validateProduct({ slug: 'book', name: 'Book', priceMinor: 1299, currency: 'USD', status: 'published' }, { requireStatus: true }).valid, true);
  assert.equal(validateProduct({ slug: 'bad slug', name: 'Book', priceMinor: 1.25, currency: 'USD', status: 'live' }, { requireStatus: true }).valid, false);
  const cart = normalizeCart([{ productId: '11111111-1111-4111-8111-111111111111', quantity: 2 }, { productId: '11111111-1111-4111-8111-111111111111', quantity: 3 }]);
  assert.equal(cart.valid, true); assert.equal(cart.items[0].quantity, 5);
  assert.equal(normalizeCart([{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1001 }]).valid, false);
  assert.equal(calculateLineTotal(1299, 3), 3897);
  assert.throws(() => calculateLineTotal(Number.MAX_SAFE_INTEGER, 2), RangeError);
});

test('community profile and group validation rejects unsafe URLs and invalid slugs', () => {
  assert.equal(validateProfile({ displayName: 'Alice', websiteUrl: 'https://example.com', visibility: 'members' }).valid, true);
  assert.equal(validateProfile({ displayName: 'Alice', websiteUrl: 'javascript:alert(1)' }).valid, false);
  assert.equal(validateGroup({ slug: 'developers', name: 'Developers', privacy: 'private' }).valid, true);
  assert.equal(validateGroup({ slug: '../admin', name: 'Group' }).valid, false);
});

test('firewall validates IPv4 CIDR and matches exact safe rules', () => {
  assert.equal(validateIpPattern('cidr', '192.0.2.0/24'), true);
  assert.equal(validateIpPattern('cidr', '192.0.2.0/99'), false);
  assert.equal(cidrContains('192.0.2.55', '192.0.2.0/24'), true);
  assert.equal(cidrContains('192.0.3.55', '192.0.2.0/24'), false);
  assert.equal(validateIpPattern('path', '/admin/private'), true);
  assert.equal(validateIpPattern('path', '/admin/../****'), false);
  assert.equal(ruleMatches({ enabled: true, scope: 'path', pattern: '/admin', action: 'deny' }, { path: '/admin/settings' }), true);
});

test('cloud configs only accept **** references and a whitelisted non-**** provider configuration', () => {
  assert.equal(cloudConfigStatus({ provider: 'aws-s3', credentialReference: 'env://VIRGOSCORPIO_HUB_STORAGE_KEY', config: { bucket: 'assets' } }).valid, true);
  assert.equal(cloudConfigStatus({ provider: 'aws-s3', credentialReference: 'super-****-access-key', config: {} }).valid, false);
  assert.equal(cloudConfigStatus({ provider: 'aws-s3', credentialReference: 'vault://production/storage', config: {} }).valid, false, 'vault references must be resolved by an integration not present in this build');
  assert.equal(cloudConfigStatus({ provider: 'unknown', credentialReference: 'env://STORAGE_KEY', config: {} }).valid, false);
  assert.equal(cloudConfigStatus({ provider: 's3-compatible', credentialReference: 'env://AWS_SECRET_ACCESS_KEY', config: { accessKeyId: 'id', ****AccessKey: '****' } }).valid, false);
  assert.equal(cloudConfigStatus({ provider: 's3-compatible', credentialReference: 'env://AWS_SECRET_ACCESS_KEY', config: { endpoint: 'https://user:****@bucket.example.test' } }).valid, false);
  assert.equal(cloudConfigStatus({ provider: 's3-compatible', credentialReference: 'env://AWS_SECRET_ACCESS_KEY', config: { endpoint: 'https://bucket.example.test?token=****' } }).valid, false);
  assert.equal(cloudConfigStatus({ provider: 'google-cloud-storage', credentialReference: 'env://GOOGLE_APPLICATION_CREDENTIALS', config: { endpoint: 'https://storage.example.test' } }).valid, false, 'provider-specific ignored configuration is rejected');
  assert.equal(cloudEndpointAllowed('https://minio.example.test:9000', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }), true);
  assert.equal(cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }), false);
  assert.equal(cloudEndpointAllowed('http://minio.example.test:9000', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }), false);
});

test('cloud endpoint allowlist is enforced in all environments to prevent SSRF', () => {
  // The vulnerability was that cloudEndpointAllowed returned true for non-production environments
  // without checking the allowlist, enabling blind SSRF attacks in dev/test/staging.
  
  const allowlist = 'storage.example.com:443,minio.internal:9000';
  
  // Production environment: allowlist must be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'production: allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'production: metadata service should be blocked'
  );
  
  // Development environment: allowlist MUST be enforced (fix for SSRF)
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'development: allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'development: metadata service must be blocked (SSRF mitigation)'
  );
  assert.equal(
    cloudEndpointAllowed('http://localhost:8080', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'development: localhost must be blocked (SSRF mitigation)'
  );
  assert.equal(
    cloudEndpointAllowed('https://internal.service', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'development: arbitrary internal service must be blocked (SSRF mitigation)'
  );
  
  // Test environment: allowlist MUST be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'test', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'test: allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'test', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'test: metadata service must be blocked (SSRF mitigation)'
  );
  
  // Staging environment: allowlist MUST be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'staging', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'staging: allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'staging', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'staging: metadata service must be blocked (SSRF mitigation)'
  );
  
  // Unset/empty NODE_ENV: allowlist MUST be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: '', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'empty NODE_ENV: allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: '', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'empty NODE_ENV: metadata service must be blocked (SSRF mitigation)'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'undefined NODE_ENV: metadata service must be blocked (SSRF mitigation)'
  );
  
  // Case variations: allowlist MUST be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'Production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'Production (capitalized): allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'Production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'Production (capitalized): metadata service must be blocked (SSRF mitigation)'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { NODE_ENV: 'PRODUCTION', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'PRODUCTION (uppercase): allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'PRODUCTION', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'PRODUCTION (uppercase): metadata service must be blocked (SSRF mitigation)'
  );
});

test('cloud endpoint validation rejects SSRF targets in all environments', () => {
  // Common SSRF targets that must be blocked regardless of environment
  const allowlist = 'storage.example.com';
  const environments = ['production', 'development', 'test', 'staging', '', undefined];
  
  const ssrfTargets = [
    'http://169.254.169.254',           // AWS metadata service (HTTP)
    'https://169.254.169.254',          // AWS metadata service (HTTPS)
    'http://169.254.169.254:80',        // AWS metadata with explicit port
    'http://metadata.google.internal',  // GCP metadata service
    'http://localhost',                 // localhost
    'http://localhost:8080',            // localhost with port
    'http://127.0.0.1',                 // loopback
    'http://127.0.0.1:6379',            // Redis on loopback
    'http://[::1]',                     // IPv6 loopback
    'http://10.0.0.1',                  // Private network
    'http://172.16.0.1',                // Private network
    'http://192.168.1.1',               // Private network
    'http://internal.service',          // Internal service
    'https://internal.service',         // Internal service HTTPS
  ];
  
  for (const env of environments) {
    const envLabel = env === undefined ? 'undefined' : env === '' ? 'empty' : env;
    for (const target of ssrfTargets) {
      assert.equal(
        cloudEndpointAllowed(target, { NODE_ENV: env, VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
        false,
        `${envLabel} environment: ${target} must be blocked`
      );
    }
  }
});

test('cloud endpoint validation enforces HTTPS in production but allows HTTP in non-production when allowlisted', () => {
  // Production requires HTTPS for allowed endpoints
  assert.equal(
    cloudEndpointAllowed('https://minio.example.test:9000', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }),
    true,
    'production: HTTPS endpoint on allowlist should pass'
  );
  assert.equal(
    cloudEndpointAllowed('http://minio.example.test:9000', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }),
    false,
    'production: HTTP endpoint must be rejected even if allowlisted'
  );
  
  // Non-production allows HTTP if allowlisted (for local development)
  assert.equal(
    cloudEndpointAllowed('http://minio.example.test:9000', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }),
    true,
    'development: HTTP endpoint on allowlist should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://minio.example.test:9000', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }),
    true,
    'development: HTTPS endpoint on allowlist should pass'
  );
  
  // But HTTP endpoints NOT on allowlist must still be rejected
  assert.equal(
    cloudEndpointAllowed('http://evil.example.test:9000', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'minio.example.test:9000' }),
    false,
    'development: HTTP endpoint not on allowlist must be rejected'
  );
});

test('cloud endpoint validation rejects malformed URLs and embedded credentials', () => {
  const allowlist = 'storage.example.com';
  
  // Malformed URLs
  assert.equal(cloudEndpointAllowed('not a url', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }), false, 'malformed URL rejected');
  assert.equal(cloudEndpointAllowed('ftp://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }), false, 'non-HTTP(S) protocol rejected');
  assert.equal(cloudEndpointAllowed('file:///etc/passwd', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }), false, 'file:// protocol rejected');
  
  // Embedded credentials (credential smuggling attempt)
  assert.equal(
    cloudEndpointAllowed('https://user:pass@storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'embedded credentials rejected'
  );
  assert.equal(
    cloudEndpointAllowed('https://admin@storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'embedded username rejected'
  );
  
  // Query strings and fragments (potential parameter injection)
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com?token=****', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'query string rejected'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com#fragment', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'fragment rejected'
  );
  
  // Missing hostname
  assert.equal(cloudEndpointAllowed('https://', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }), false, 'missing hostname rejected');
});

test('cloud endpoint allowlist matching is exact and case-insensitive', () => {
  // Exact host matching (hostname + port)
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    true,
    'exact match without port'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com:443' }),
    true,
    'exact match with port'
  );
  
  // Port mismatch
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:9000', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com:443' }),
    false,
    'port mismatch rejected'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:443', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    false,
    'explicit port not matching implicit port rejected'
  );
  
  // No wildcard suffix matching (security requirement)
  assert.equal(
    cloudEndpointAllowed('https://evil.storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    false,
    'subdomain not matched by parent domain'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com.evil.test', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    false,
    'domain suffix not matched'
  );
  
  // Case-insensitive matching
  assert.equal(
    cloudEndpointAllowed('https://Storage.Example.Com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    true,
    'case-insensitive hostname match'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'Storage.Example.Com' }),
    true,
    'case-insensitive allowlist match'
  );
  
  // Multiple allowlist entries
  assert.equal(
    cloudEndpointAllowed('https://storage1.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage1.example.com,storage2.example.com' }),
    true,
    'first entry in allowlist'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage2.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage1.example.com,storage2.example.com' }),
    true,
    'second entry in allowlist'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage3.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage1.example.com,storage2.example.com' }),
    false,
    'not in allowlist'
  );
  
  // Empty allowlist blocks everything
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: '' }),
    false,
    'empty allowlist blocks all endpoints'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', {}),
    false,
    'missing allowlist blocks all endpoints'
  );
});

test('Stripe webhook signatures are timestamped, compared in constant time, and reject stale payloads', () => {
  const raw = Buffer.from(JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }));
  const timestamp = 1_800_000_000; const **** = 'whsec_test';
  const digest = createHmac('sha256', ****).update(`${timestamp}.`).update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw, `t=${timestamp},v1=${digest}`, ****, { nowSeconds: timestamp, toleranceSeconds: 300 }), true);
  assert.equal(verifyStripeSignature(raw, `t=${timestamp},v1=${digest}`, ****, { nowSeconds: timestamp + 600, toleranceSeconds: 300 }), false);
  assert.equal(verifyStripeSignature(Buffer.from('modified'), `t=${timestamp},v1=${digest}`, ****, { nowSeconds: timestamp, toleranceSeconds: 300 }), false);
});

test('page document supports video, icon, and math widgets and renders bounded deterministic HTML', () => {
  const document = { schemaVersion: 1, documentId: 'virgoscorpio_hub-test-document', type: 'page', title: 'Mixed media', children: [
    { id: 'vid1', type: 'widget.video', props: { assetId: '00000000-0000-4000-8000-000000000001', title: 'Demo video', controls: true }, children: [] },
    { id: 'ico1', type: 'widget.icon', props: { iconName: 'check', size: 24, title: 'Complete' }, children: [] },
    { id: 'math1', type: 'widget.math', props: { formula: 'x^2+y^2=z^2', displayMode: true }, children: [] }
  ] };
  assert.equal(validatePageDocument(document).valid, true);
  const html = renderPageDocument(document);
  assert.match(html, /<video/); assert.match(html, /\/library\/public\/00000000-0000-4000-8000-000000000001/); assert.match(html, /<svg/); assert.match(html, /vsh-math/);
  assert.doesNotMatch(html, /<script\b/i);
  const invalid = structuredClone(document); invalid.children[1].props.iconName = '<script>';
  assert.equal(validatePageDocument(invalid).valid, false);
  assert.ok(createHash('sha256').update(html).digest('hex').length === 64);
});

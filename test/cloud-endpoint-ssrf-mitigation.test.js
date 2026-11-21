'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cloudEndpointAllowed } = require('../packages/cloud/src/storage-adapters');

test('cloud endpoint allowlist is enforced in all environments to prevent SSRF', () => {
  // The vulnerability was that cloudEndpointAllowed returned true for non-production environments
  // without checking the allowlist, enabling blind SSRF attacks in dev/test/staging.
  
  // Note: URL.host includes the port, so allowlist must match exactly
  const allowlist = 'storage.example.com,minio.internal:9000';
  
  // Production environment: allowlist must be enforced
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'development', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'test', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'staging', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: '', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'Production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    true,
    'Production (capitalized): allowed endpoint should pass'
  );
  assert.equal(
    cloudEndpointAllowed('https://169.254.169.254', { NODE_ENV: 'Production', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
    false,
    'Production (capitalized): metadata service must be blocked (SSRF mitigation)'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { NODE_ENV: 'PRODUCTION', VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
    cloudEndpointAllowed('https://storage.example.com?token=secret', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: allowlist }),
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
  // Note: URL.host includes port only when it's non-default
  // For HTTPS, default port 443 is omitted from URL.host
  // For HTTP, default port 80 is omitted from URL.host
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    true,
    'exact match without port'
  );
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:9000', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com:9000' }),
    true,
    'exact match with explicit non-default port in both URL and allowlist'
  );
  
  // Port mismatch
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:9000', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com:8000' }),
    false,
    'port mismatch rejected'
  );
  // When URL has explicit non-default port but allowlist doesn't, they don't match
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com:9000', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com' }),
    false,
    'explicit port in URL not matching allowlist without port'
  );
  // When URL has no explicit port but allowlist has one, they don't match
  assert.equal(
    cloudEndpointAllowed('https://storage.example.com', { VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'storage.example.com:9000' }),
    false,
    'URL without explicit port not matching allowlist with port'
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

test('cloud endpoint validation prevents fail-open bypass in non-production environments', () => {
  // This test specifically validates the fix for the pentest finding:
  // Before the fix, cloudEndpointAllowed returned true for any valid URL in non-production
  // After the fix, it must check the allowlist in ALL environments
  
  const maliciousEndpoints = [
    'http://169.254.169.254/latest/meta-data/',  // AWS EC2 metadata
    'http://metadata.google.internal/computeMetadata/v1/',  // GCP metadata
    'http://169.254.169.254/metadata/instance',  // Azure metadata
    'http://localhost:8080',  // Internal service
    'http://127.0.0.1:6379',  // Redis
    'http://10.0.0.1',  // Private network
    'http://172.16.0.1',  // Private network
    'http://192.168.1.1',  // Private network
  ];
  
  const nonProductionEnvs = ['development', 'test', 'staging', 'dev', 'local', ''];
  
  for (const env of nonProductionEnvs) {
    for (const endpoint of maliciousEndpoints) {
      assert.equal(
        cloudEndpointAllowed(endpoint, { 
          NODE_ENV: env, 
          VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'safe-storage.example.com' 
        }),
        false,
        `SSRF target ${endpoint} must be blocked in ${env || 'empty'} environment`
      );
    }
  }
});

test('cloud endpoint validation blocks metadata services across all environment configurations', () => {
  // Test the specific SSRF targets mentioned in the pentest finding
  const metadataServices = [
    'http://169.254.169.254',
    'https://169.254.169.254',
    'http://169.254.169.254:80',
    'http://metadata.google.internal',
    'http://169.254.169.254/latest/meta-data/',
  ];
  
  const allEnvConfigs = [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'Production' },
    { NODE_ENV: 'PRODUCTION' },
    { NODE_ENV: 'development' },
    { NODE_ENV: 'Development' },
    { NODE_ENV: 'test' },
    { NODE_ENV: 'staging' },
    { NODE_ENV: 'Staging' },
    { NODE_ENV: '' },
    { NODE_ENV: 'custom-env' },
    {},  // undefined NODE_ENV
  ];
  
  for (const envConfig of allEnvConfigs) {
    for (const endpoint of metadataServices) {
      const env = { ...envConfig, VIRGOSCORPIO_HUB_CLOUD_ENDPOINT_ALLOWLIST: 'allowed.example.com' };
      assert.equal(
        cloudEndpointAllowed(endpoint, env),
        false,
        `Metadata service ${endpoint} must be blocked with NODE_ENV=${envConfig.NODE_ENV || 'undefined'}`
      );
    }
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePluginManifest } = require('../packages/plugins/src/manifest');

// Security test: verify that the pentest finding "Unbounded plugin manifest metadata
// and registry output enable site-scoped resource exhaustion" is mitigated.
//
// The vulnerability had three components:
// 1. Manifest validator accepted oversized nested widget metadata (name/title fields)
// 2. Registration persisted full manifests without cumulative site quota
// 3. Registry list returned all manifests without pagination
//
// Mitigations:
// 1. Manifest validator now enforces 1-120 character limits on widget name/title
// 2. Manifest validator enforces 16,000 character JSON serialization limit
// 3. Optional field length limits (homepage, license, publisher)
// 4. Registration enforces 100-plugin per-site quota
// 5. Registry list endpoint now supports pagination (limit/offset)

test('manifest validator rejects oversized widget name fields', () => {
  const validManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget'],
    widgets: [
      { name: 'valid-name', title: 'Valid Title' }
    ]
  };

  // Valid manifest should pass
  const validResult = validatePluginManifest(validManifest);
  assert.equal(validResult.valid, true, 'Valid manifest should be accepted');

  // Widget name exceeding 120 characters should be rejected
  const oversizedName = {
    ...validManifest,
    widgets: [
      { name: 'x'.repeat(121), title: 'Valid Title' }
    ]
  };
  const nameResult = validatePluginManifest(oversizedName);
  assert.equal(nameResult.valid, false, 'Oversized widget name should be rejected');
  assert.ok(
    nameResult.errors.some(e => e.includes('1–120 characters')),
    'Error should mention character limit'
  );
});

test('manifest validator rejects oversized widget title fields', () => {
  const validManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget'],
    widgets: [
      { name: 'valid-name', title: 'Valid Title' }
    ]
  };

  // Widget title exceeding 120 characters should be rejected
  const oversizedTitle = {
    ...validManifest,
    widgets: [
      { name: 'valid-name', title: 'x'.repeat(121) }
    ]
  };
  const titleResult = validatePluginManifest(oversizedTitle);
  assert.equal(titleResult.valid, false, 'Oversized widget title should be rejected');
  assert.ok(
    titleResult.errors.some(e => e.includes('1–120 characters')),
    'Error should mention character limit'
  );
});

test('manifest validator rejects empty widget name or title', () => {
  const baseManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget']
  };

  // Empty name should be rejected
  const emptyName = {
    ...baseManifest,
    widgets: [{ name: '', title: 'Valid Title' }]
  };
  assert.equal(validatePluginManifest(emptyName).valid, false, 'Empty widget name should be rejected');

  // Whitespace-only name should be rejected
  const whitespaceName = {
    ...baseManifest,
    widgets: [{ name: '   ', title: 'Valid Title' }]
  };
  assert.equal(validatePluginManifest(whitespaceName).valid, false, 'Whitespace-only widget name should be rejected');

  // Empty title should be rejected
  const emptyTitle = {
    ...baseManifest,
    widgets: [{ name: 'valid-name', title: '' }]
  };
  assert.equal(validatePluginManifest(emptyTitle).valid, false, 'Empty widget title should be rejected');

  // Whitespace-only title should be rejected
  const whitespaceTitle = {
    ...baseManifest,
    widgets: [{ name: 'valid-name', title: '   ' }]
  };
  assert.equal(validatePluginManifest(whitespaceTitle).valid, false, 'Whitespace-only widget title should be rejected');
});

test('manifest validator enforces maximum serialized JSON size', () => {
  const baseManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget'],
    widgets: []
  };

  // Create a manifest that serializes to just under 16,000 characters
  // Each widget with 120-char name and title adds roughly 250 chars
  const validLargeManifest = {
    ...baseManifest,
    widgets: Array.from({ length: 50 }, (_, i) => ({
      name: `widget-${i}-${'x'.repeat(100)}`,
      title: `Title ${i} ${'y'.repeat(100)}`
    }))
  };

  const validLargeSize = JSON.stringify(validLargeManifest).length;
  assert.ok(validLargeSize < 16_000, `Valid large manifest should be under 16k (was ${validLargeSize})`);

  const validLargeResult = validatePluginManifest(validLargeManifest);
  assert.equal(validLargeResult.valid, true, 'Large but valid manifest should be accepted');

  // Create a manifest that exceeds 16,000 characters
  // Use a large description to push it over the limit
  const oversizedManifest = {
    ...baseManifest,
    description: 'x'.repeat(16_500), // Definitely over the limit
    widgets: []
  };

  const oversizedSize = JSON.stringify(oversizedManifest).length;
  assert.ok(oversizedSize > 16_000, `Oversized manifest should exceed 16k (was ${oversizedSize})`);

  const oversizedResult = validatePluginManifest(oversizedManifest);
  assert.equal(oversizedResult.valid, false, 'Oversized manifest should be rejected');
  assert.ok(
    oversizedResult.errors.some(e => e.includes('16000 characters')),
    'Error should mention 16000 character limit'
  );
});

test('manifest validator enforces optional field length limits', () => {
  const baseManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget']
  };

  // Valid optional fields
  const validOptional = {
    ...baseManifest,
    homepage: 'https://example.com/' + 'x'.repeat(2000),
    license: 'MIT',
    publisher: 'Example Corp'
  };
  assert.equal(validatePluginManifest(validOptional).valid, true, 'Valid optional fields should be accepted');

  // Homepage exceeding 2048 characters
  const oversizedHomepage = {
    ...baseManifest,
    homepage: 'https://example.com/' + 'x'.repeat(2049)
  };
  const homepageResult = validatePluginManifest(oversizedHomepage);
  assert.equal(homepageResult.valid, false, 'Oversized homepage should be rejected');
  assert.ok(
    homepageResult.errors.some(e => e.includes('homepage') && e.includes('2048')),
    'Error should mention homepage 2048 character limit'
  );

  // License exceeding 200 characters
  const oversizedLicense = {
    ...baseManifest,
    license: 'x'.repeat(201)
  };
  const licenseResult = validatePluginManifest(oversizedLicense);
  assert.equal(licenseResult.valid, false, 'Oversized license should be rejected');
  assert.ok(
    licenseResult.errors.some(e => e.includes('license') && e.includes('200')),
    'Error should mention license 200 character limit'
  );

  // Publisher exceeding 200 characters
  const oversizedPublisher = {
    ...baseManifest,
    publisher: 'x'.repeat(201)
  };
  const publisherResult = validatePluginManifest(oversizedPublisher);
  assert.equal(publisherResult.valid, false, 'Oversized publisher should be rejected');
  assert.ok(
    publisherResult.errors.some(e => e.includes('publisher') && e.includes('200')),
    'Error should mention publisher 200 character limit'
  );
});

test('manifest validator rejects manifests designed for resource exhaustion', () => {
  // This test simulates the pentest attack scenario:
  // Attempting to create a manifest with maximum allowed widgets,
  // each with maximum allowed field sizes, to exhaust resources

  const attackManifest = {
    apiVersion: 1,
    name: 'vendor.attack-widget',
    version: '1.0.0',
    title: 'x'.repeat(120), // Max title length
    description: 'x'.repeat(2000), // Max description length
    capabilities: ['render:widget'],
    homepage: 'https://example.com/' + 'x'.repeat(2000), // Near max homepage
    license: 'x'.repeat(200), // Max license length
    publisher: 'x'.repeat(200), // Max publisher length
    widgets: Array.from({ length: 100 }, (_, i) => ({
      name: `widget-${i}-${'x'.repeat(100)}`, // 120 chars
      title: `Title-${i}-${'y'.repeat(100)}` // 120 chars
    }))
  };

  const attackSize = JSON.stringify(attackManifest).length;

  // The manifest should be rejected because it exceeds 16,000 characters
  assert.ok(attackSize > 16_000, `Attack manifest should exceed 16k (was ${attackSize})`);

  const attackResult = validatePluginManifest(attackManifest);
  assert.equal(attackResult.valid, false, 'Resource exhaustion manifest should be rejected');
  assert.ok(
    attackResult.errors.some(e => e.includes('16000 characters')),
    'Error should indicate serialization size limit exceeded'
  );
});

test('manifest validator accepts reasonable multi-widget manifests', () => {
  // Verify that legitimate use cases with multiple widgets still work
  const legitimateManifest = {
    apiVersion: 1,
    name: 'vendor.dashboard-widgets',
    version: '1.0.0',
    title: 'Dashboard Widgets',
    description: 'A collection of useful dashboard widgets',
    capabilities: ['render:widget'],
    homepage: 'https://example.com/widgets',
    license: 'MIT',
    publisher: 'Example Corp',
    widgets: [
      { name: 'stats-card', title: 'Statistics Card' },
      { name: 'chart-widget', title: 'Chart Widget' },
      { name: 'table-widget', title: 'Data Table' },
      { name: 'calendar-widget', title: 'Calendar View' },
      { name: 'map-widget', title: 'Map Display' }
    ]
  };

  const legitimateSize = JSON.stringify(legitimateManifest).length;
  assert.ok(legitimateSize < 16_000, `Legitimate manifest should be under 16k (was ${legitimateSize})`);

  const legitimateResult = validatePluginManifest(legitimateManifest);
  assert.equal(legitimateResult.valid, true, 'Legitimate multi-widget manifest should be accepted');
  assert.equal(legitimateResult.errors.length, 0, 'Should have no validation errors');
});

test('manifest validator boundary conditions for widget count', () => {
  const baseManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget']
  };

  // Exactly 100 widgets should be accepted (if under size limit)
  const exactly100 = {
    ...baseManifest,
    widgets: Array.from({ length: 100 }, (_, i) => ({
      name: `w${i}`,
      title: `Widget ${i}`
    }))
  };
  const result100 = validatePluginManifest(exactly100);
  assert.equal(result100.valid, true, 'Exactly 100 widgets should be accepted');

  // 101 widgets should be rejected
  const over100 = {
    ...baseManifest,
    widgets: Array.from({ length: 101 }, (_, i) => ({
      name: `w${i}`,
      title: `Widget ${i}`
    }))
  };
  const result101 = validatePluginManifest(over100);
  assert.equal(result101.valid, false, '101 widgets should be rejected');
  assert.ok(
    result101.errors.some(e => e.includes('100')),
    'Error should mention 100 widget limit'
  );
});

test('manifest validator enforces type safety for widget fields', () => {
  const baseManifest = {
    apiVersion: 1,
    name: 'vendor.test-widget',
    version: '1.0.0',
    title: 'Test Widget',
    description: 'A test widget',
    capabilities: ['render:widget']
  };

  // Widget name must be a string
  const nonStringName = {
    ...baseManifest,
    widgets: [{ name: 123, title: 'Valid Title' }]
  };
  assert.equal(validatePluginManifest(nonStringName).valid, false, 'Non-string widget name should be rejected');

  // Widget title must be a string
  const nonStringTitle = {
    ...baseManifest,
    widgets: [{ name: 'valid-name', title: 123 }]
  };
  assert.equal(validatePluginManifest(nonStringTitle).valid, false, 'Non-string widget title should be rejected');

  // Widget must be an object
  const nonObjectWidget = {
    ...baseManifest,
    widgets: ['not-an-object']
  };
  assert.equal(validatePluginManifest(nonObjectWidget).valid, false, 'Non-object widget should be rejected');

  // Widget cannot be an array
  const arrayWidget = {
    ...baseManifest,
    widgets: [['name', 'title']]
  };
  assert.equal(validatePluginManifest(arrayWidget).valid, false, 'Array widget should be rejected');
});

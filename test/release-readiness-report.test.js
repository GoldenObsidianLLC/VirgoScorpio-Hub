'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderReleaseReadinessMarkdown } = require('../scripts/release-readiness-report');

test('renders preliminary and finalized readiness snapshots through one safe Markdown renderer', () => {
  const report = {
    version: '0.6.2',
    generatedAt: '2026-11-13T01:00:00.000Z',
    host: { node: 'v22.23.4', platform: 'linux', arch: 'x64' },
    sourceRevision: 'a'.repeat(40),
    readyForProduction: false,
    releaseClassification: 'NOT_PRODUCTION_CERTIFIED',
    summary: { pass: 5, partial: 1, blocked: 0, missingEvidence: 2, notRun: 0 },
    checks: [
      { id: 'unit-tests', title: 'Unit tests', status: 'PASS', details: 'All passed.' },
      { id: 'unsafe', title: 'Unsafe row', status: 'BLOCKED', details: 'bad\n| forged | <script>x</script> `' },
    ],
    evidenceGates: [
      { id: 'tenant-isolation-review', title: 'Independent review', status: 'MISSING_EVIDENCE', details: 'Still open.' },
    ],
    supplementalEvidence: [],
    ciFinalization: {
      status: 'FINALIZED_AFTER_PRODUCER_VALIDATION',
      generatedAt: '2026-11-13T01:00:00.000Z',
      workflow: { workflow: 'VirgoScorpio Hub CI', runId: '123456789', runAttempt: 2, sourceRevision: 'a'.repeat(40) },
      preliminaryReports: [{ runtime: 'v22.23.4' }, { runtime: 'v24.22.1' }],
    },
  };

  const markdown = renderReleaseReadinessMarkdown(report);
  assert.ok(markdown.startsWith('# VirgoScorpio Hub 0.6.2 — Release Readiness Report'));
  assert.ok(markdown.includes('Finalized after exact-source producer validation'));
  assert.ok(markdown.includes('**NO**'));
  assert.ok(markdown.includes('`' + 'a'.repeat(40) + '`'));
  assert.ok(markdown.includes('bad &#124; forged &#124; &lt;script&gt;x&lt;/script&gt; &#96;'));
  assert.ok(markdown.includes('**MISSING_EVIDENCE**'));
  assert.ok(!markdown.includes('\\n| forged |'));
});

test('rejects an incomplete readiness report rather than emitting a partial Markdown artifact', () => {
  assert.throws(() => renderReleaseReadinessMarkdown({ checks: [] }), /missing required collections/i);
});

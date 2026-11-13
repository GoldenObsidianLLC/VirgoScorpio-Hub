'use strict';

function escapeMarkdownTableCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '&#124;')
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

/**
 * Render the canonical release-readiness report.
 *
 * The same pure renderer is used by the local release-readiness command and
 * the post-aggregation CI finalizer so the human-readable artifact cannot
 * drift between preliminary and final snapshots.
 *
 * @param {object} report A schema-versioned release-readiness object.
 * @returns {string}
 */
function renderReleaseReadinessMarkdown(report) {
  if (!report || !Array.isArray(report.checks) || !Array.isArray(report.evidenceGates) ||
      !report.summary || !Array.isArray(report.supplementalEvidence)) {
    throw new TypeError('Release-readiness report is missing required collections or summary metadata.');
  }

  const rows = [...report.checks, ...report.evidenceGates]
    .map(item => '| ' + escapeMarkdownTableCell(item.title || item.id) +
      ' | **' + escapeMarkdownTableCell(item.status) + '** | ' +
      escapeMarkdownTableCell(item.details) + ' |')
    .join('\n');
  const supplementalRows = report.supplementalEvidence
    .map(item => '| ' + escapeMarkdownTableCell(item.title || item.id) +
      ' | **' + escapeMarkdownTableCell(item.status) + '** | ' +
      escapeMarkdownTableCell(item.details) + ' |')
    .join('\n');

  const lines = [
    '# VirgoScorpio Hub ' + escapeMarkdownTableCell(report.version) + ' — Release Readiness Report',
    '',
    '- Generated: ' + escapeMarkdownTableCell(report.generatedAt),
    '- Node.js: ' + escapeMarkdownTableCell(report.host?.node || 'unknown') +
      (report.host?.platform ? ' (' + escapeMarkdownTableCell(report.host.platform) +
        (report.host.arch ? '/' + escapeMarkdownTableCell(report.host.arch) : '') + ')' : ''),
    '- Source revision: `' + escapeMarkdownTableCell(report.sourceRevision || 'unavailable') + '`',
    '- Production-ready: **' + (report.readyForProduction ? 'YES' : 'NO') + '**',
    '- Release classification: `' + escapeMarkdownTableCell(report.releaseClassification) + '`',
    '- Summary: ' + report.summary.pass + ' pass; ' + report.summary.partial + ' partial; ' +
      report.summary.blocked + ' blocked; ' + report.summary.missingEvidence +
      ' missing evidence; ' + report.summary.notRun + ' not run.',
    '',
    '> A successful source test suite does not substitute for live integrations, independent review, deployment drills, or parity acceptance. Missing or skipped evidence is not a pass.',
    '',
  ];

  if (report.ciFinalization) {
    lines.push(
      '## Finalized after exact-source producer validation',
      '',
      '- Status: **' + escapeMarkdownTableCell(report.ciFinalization.status) + '**',
      '- Finalized: ' + escapeMarkdownTableCell(report.ciFinalization.generatedAt),
      '- Workflow: ' + escapeMarkdownTableCell(report.ciFinalization.workflow?.workflow) +
        ' / run ' + escapeMarkdownTableCell(report.ciFinalization.workflow?.runId) +
        ' (attempt ' + escapeMarkdownTableCell(report.ciFinalization.workflow?.runAttempt) + ')',
      '- Source revision: `' + escapeMarkdownTableCell(report.ciFinalization.workflow?.sourceRevision) + '`',
      '- Preliminary Node reports retained separately: ' +
        (report.ciFinalization.preliminaryReports?.length || 0),
      '',
      '> This is the post-producer evidence snapshot while the aggregate workflow job is running. It does not assert the final workflow conclusion or production certification.',
      '',
    );
  }

  lines.push(
    '| Gate | Status | Details |',
    '|---|---|---|',
    rows,
    '',
    '## Supplemental local evidence (not included in the formal gate count)',
    '',
    'These additional local checks passed. They do not replace the independent/external acceptance gates above.',
    '',
    '| Local check | Status | Details |',
    '|---|---|---|',
    supplementalRows,
    '',
    'JSON source of truth: `artifacts/release-readiness.json`. See `docs/RELEASE-EVIDENCE.md` for evidence format.',
    '',
  );
  return lines.join('\n');
}

module.exports = { escapeMarkdownTableCell, renderReleaseReadinessMarkdown };

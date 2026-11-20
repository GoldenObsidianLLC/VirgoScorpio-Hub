'use strict';

// Evidence-gate inventory that every release-readiness report must contain.
// This must stay aligned with the gates emitted by scripts/release-readiness.js.
const REQUIRED_EVIDENCE_GATE_IDS = Object.freeze([
  'postgres-memgraph-live',
  'tenant-isolation-review',
  'identity-provider-e2e',
  'clamav-corpus',
  'cloud-live-providers',
  'stripe-live-lifecycle',
  'browser-accessibility',
  'commerce-parity-acceptance',
  'community-parity-acceptance',
  'plugin-container-isolation',
  'dependency-sbom-codeql',
  'load-backup-restore',
  'independent-security-review',
  'operations-release-approval',
  'observability-production',
]);

module.exports = { REQUIRED_EVIDENCE_GATE_IDS };

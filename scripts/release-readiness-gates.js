'use strict';

// Canonical evidence-gate registry shared by release report generation and CI.
// Keep each gate's identity, display label, and evidence filename together so
// the generated report cannot silently drift from the validator's required set.
const REQUIRED_EVIDENCE_GATES = Object.freeze([
  Object.freeze({
    id: 'postgres-memgraph-live',
    title: 'Fresh/upgrade migrations, PostgreSQL transactions and Memgraph outage/replay',
    evidenceFile: 'postgres-memgraph-live.json',
  }),
  Object.freeze({
    id: 'tenant-isolation-review',
    title: 'Independent tenant-isolation and authorization review',
    evidenceFile: 'tenant-isolation-review.json',
  }),
  Object.freeze({
    id: 'identity-provider-e2e',
    title: 'OIDC/SAML/email delivery/MFA recovery end-to-end evidence',
    evidenceFile: 'identity-provider-e2e.json',
  }),
  Object.freeze({
    id: 'clamav-corpus',
    title: 'Live ClamAV, malicious-file corpus and legacy-asset quarantine',
    evidenceFile: 'clamav-corpus.json',
  }),
  Object.freeze({
    id: 'cloud-live-providers',
    title: 'Live S3/GCS/Azure/S3-compatible credentials and least-privilege operations',
    evidenceFile: 'cloud-live-providers.json',
  }),
  Object.freeze({
    id: 'stripe-live-lifecycle',
    title: 'Stripe webhook replay, ambiguous-outcome recovery and inventory lifecycle',
    evidenceFile: 'stripe-live-lifecycle.json',
  }),
  Object.freeze({
    id: 'browser-accessibility',
    title: 'Playwright editor journeys and WCAG-focused accessibility acceptance',
    evidenceFile: 'browser-accessibility.json',
  }),
  Object.freeze({
    id: 'commerce-parity-acceptance',
    title: 'Tax/shipping/coupons/refunds/fulfilment/downloads/subscription acceptance',
    evidenceFile: 'commerce-parity-acceptance.json',
  }),
  Object.freeze({
    id: 'community-parity-acceptance',
    title: 'Group privacy, spam/abuse, search, export/deletion and forum acceptance',
    evidenceFile: 'community-parity-acceptance.json',
  }),
  Object.freeze({
    id: 'plugin-container-isolation',
    title: 'Signed plugin pipeline and adversarial container isolation',
    evidenceFile: 'plugin-container-isolation.json',
  }),
  Object.freeze({
    id: 'dependency-sbom-codeql',
    title: 'Reviewed dependency audit, SBOM/provenance and CodeQL evidence',
    evidenceFile: 'dependency-sbom-codeql.json',
  }),
  Object.freeze({
    id: 'load-backup-restore',
    title: 'Load/soak, fault injection, backup/restore and recovery drills',
    evidenceFile: 'load-backup-restore.json',
  }),
  Object.freeze({
    id: 'independent-security-review',
    title: 'Independent security assessment and severe-finding remediation',
    evidenceFile: 'independent-security-review.json',
  }),
  Object.freeze({
    id: 'operations-release-approval',
    title: 'Deployment runbooks, secrets/rollback plan, monitoring and release approval',
    evidenceFile: 'operations-release-approval.json',
  }),
  Object.freeze({
    id: 'observability-production',
    title: 'Production OTLP backend, security, governance, ownership and delivery evidence',
    evidenceFile: 'observability-production.json',
  }),
]);

const REQUIRED_EVIDENCE_GATE_IDS = Object.freeze(
  REQUIRED_EVIDENCE_GATES.map(({ id }) => id)
);

module.exports = {
  REQUIRED_EVIDENCE_GATES,
  REQUIRED_EVIDENCE_GATE_IDS,
};

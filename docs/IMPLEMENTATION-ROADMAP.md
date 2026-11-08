# VirgoScorpio Hub Implementation Roadmap — 0.6.0

> **Historical validation snapshot — 1 November 2026:** the evidence below records the state at that date and is not evidence for the 0.6.0 candidate or its current commit. The latest 0.6.0 source snapshot upgrades the vendored renderer to EnginEx 7.0.0 and removes legacy JavaScript template execution. Current release approval, supported-runtime, security and deployment evidence remains governed by [Release readiness](RELEASE_READINESS.md). The archived [0.5.1 project status report](reports/2026-11-01-VirgoScorpio-Hub-0.5.1-Project-Status-Report.md) is a historical record.

## Completed foundations in this source snapshot

- Node.js modular core, PostgreSQL source of truth, Memgraph graph projection, versioned transactional outbox.
- EnginEx 7.0.0 safe rendering adapter (legacy JavaScript template execution removed) and versioned page-document model.
- AI provider adapters, content/page drafting, schema validation and constrained MCP tools.
- Identity/session and publication workflow foundations; browser editor baseline.
- File/Document/Media libraries, curated icons, video widgets, math formula validation/rendering, optional optimization.
- Product/order/membership domain foundations; 0.5.1 adds finite-stock reservation lifecycle helpers, provider-aware reconciliation of expired Stripe Checkout Sessions, and ambiguous create-session recovery with exact request snapshots. It fails closed and retains holds when the session ID/provider state is unknown. Live Stripe/DB tests remain gated.
- 0.5.1 adds partial site-scoped direct-conversation/message, notifications/read markers, blocks, reports and moderation routes with rate limiting; group privacy, forums, export/deletion and full browser workflows remain open.
- Release-readiness tooling records syntax/unit/vendor/integration results separately from required deployment evidence and produces a fail-closed gate report.
- F1.7 completes a documented CRDT-versus-semantic-OT assessment for the current page-document/editor model and records a provisional server-authoritative OT direction in ADR-019; implementation remains a separate milestone.
- Optional ClamAV scanner adapter, fail-closed production upload policy, non-production quarantine, local disk object reconciliation tool.
- Read-only cloud-storage probe methods (live provider operations require provider credentials and were not tested here).
- PostgreSQL outbox concurrency/dead-letter test definition, Memgraph monotonic projection integration test, and CI definitions for supported Node, database services, Playwright and CodeQL.

## Milestone C — Runtime and integration validation

1. Generate and commit a reviewed lockfile; run a clean install on Node.js 22.23.4 and a supported Node 24 release.
2. Execute CI and retain artifact evidence for npm audit, SBOM, integration, browser/accessibility and CodeQL jobs.
3. Run migrations 0001–0008 on real fresh/upgrade PostgreSQL fixtures; run Memgraph outage/replay/reconciliation and concurrent-worker suites.
4. Run ClamAV using a managed scanner and a known safe/infected test corpus; plan legacy asset rescanning/quarantine; test uploads and replacements across supported stores.
5. Rehearse the local library-object reconciler with reference fixtures, old orphan fixtures, symlinks and apply/backup recovery.
6. Verify actual cloud credential resolution and live S3/GCS/Azure/R2/MinIO operations under least-privilege policies.
7. Complete password reset/email delivery, MFA recovery, OIDC/SAML end-to-end tests and tenant isolation.

## Milestone D — Product workflows and feature completeness

1. Complete visual-editor browser and accessibility acceptance: drag/drop, keyboard operation, undo/redo, autosave, conflicts, responsive preview, media, reusable templates and publishing preview.
2. Add theme/template builder, global styles/design system, forms, popups, dynamic content/query loops and export/import acceptance before Elementor parity claims.
3. Finish commerce lifecycle: tax/shipping rules, coupon application/redemption policy, refunds, invoices/receipts, fulfilment, downloadable entitlements, disputes and full subscription lifecycle; validate the new stock-reservation state machine with live database/provider failure-injection tests.
4. Complete community workflows: group conversation/privacy policy, spam/abuse controls, search, privacy/export/deletion, browser UI and live tenant-isolation/rate-limit tests.
5. Complete recurring membership portal, renewal/cancellation/plan change/proration/dunning and access reconciliation.
6. Complete plugin archive-to-OCI builds, malware/dependency scan, SBOM/provenance/signature verification and adversarial isolation.

## Milestone E — Production readiness

1. Complete performance, load/soak, fault-injection, fuzzing and resource-exhaustion test plans.
2. Verify backup/restore and graph projection rebuild from canonical PostgreSQL data.
3. Complete dependency and container-image review, independent security assessment and severe-finding remediation.
4. Establish deployment modules, secret rotation, managed edge/WAF protection, monitoring/alerting and incident runbooks.
5. Define feature acceptance criteria against the chosen WordPress, WooCommerce, BuddyPress and Elementor subset; publish a parity claim only after all required acceptance tests pass.

## Release policy

The CI workflow is a test definition, not evidence that a job passed. Each milestone needs retained acceptance logs/results. Capability files, UI surfaces and database tables alone do not imply user-facing parity. VirgoScorpio Hub must not claim production certification until all release-gate requirements are satisfied.

## Addendum — 7 November 2026

This dated addendum records engineering progress after the historical 1 November 2026 roadmap snapshot; it does not rewrite or supersede the evidence frozen above. The provider-neutral Public Asset Delivery Deployment Contract, implementation plan, source-bound validator, evidence template and tests are already applied and merged to `main` through PR #100. The validator remains an evidence-structure check and does not configure or certify a cloud provider.

F1.12 adds a limited Studio browser client over the existing F1.9–F1.11 draft-only semantic-OT service. The client sends supported typed operations, applies contiguous server-accepted changes and recovers through the existing REST sync endpoint. Whole-document save and editorial workflow actions are blocked during an active session. Studio client tests passed 6/6; semantic-OT unit tests passed 12/12; the Studio editor Playwright smoke passed 2/2; and `npm run check` passed with 565 tests (562 pass, 0 fail, 3 platform skips), 230 required artifact paths and 235 JavaScript syntax checks. The verifier includes the pinned EnginEx submodule. The two-session collaboration Playwright acceptance spec passed 1/1 using an isolated config and an in-memory collaboration store. It covers remote delivery, lost-ack replay/idempotency, concurrent property convergence and canonical reload but is not a PostgreSQL integration. The cross-instance/multi-node Playwright suite passed **4/4** locally with two API instances, loopback Redis and an in-memory collaboration store; it includes the 2/5/10-editor matrix (153 delivery samples, p50 **1,329 ms**, p95 **2,548 ms**, p99 **2,577 ms**), dropped-hint heartbeat repair and a ten-editor reconnect storm after two-node loss. The **420 ms** survivor-node recovery is a local harness observation, not a production benchmark or SLO, and the fixture does not prove PostgreSQL reconciliation. Hosted CI was still pending when this 7 November entry was recorded; the follow-up closure is documented in the 8 November addendum below. Shared undo/redo, cursors/roster, comments, offline-first editing and complete production qualification remain roadmap work.

No SemVer increment, release tag, package publication or deployment is authorized by this addendum. Production remains NO-GO until the complete release and deployment gates are satisfied.

## Addendum — 8 November 2026 (F1.12 hosted CI and merge closure)

F1.12 was merged to `main` through [PR #101](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/101) on 8 November 2026 at merge commit `5339de89e4c1d86d78291f348d03bfb4876b13a5`. Hosted push CI run #42480014817 and PR CI run #42480292203 both passed. The hosted browser editor/accessibility smoke passed, but full manual keyboard, screen-reader, focus, zoom/reflow and supported-assistive-technology acceptance remains open.

The cross-instance/multi-node Playwright suite remains a local correctness harness backed by an in-memory collaboration store; it does not prove PostgreSQL-backed multi-node real-browser reconciliation. F1.13 is the next qualification increment: exercise real browser clients against two API instances with independent PostgreSQL pools, shared test-database persistence and Redis notification/recovery. This is developer-preview correctness work, not production load certification.

Independent tenant/site authorization and security reviews, production Redis Cluster/failover, sustained-load/soak, backup/restore, deployment rehearsals and operations/runbook approvals remain open. Production remains NO-GO. F1.12 does not change SemVer `0.6.2`, authorize a release/tag/publication or authorize deployment.

## Addendum — 8 November 2026 (F1.13 local PostgreSQL multi-node proof)

F1.13 implements the previously identified PostgreSQL-backed multi-node browser qualification. A new isolated Playwright spec connects real browser clients to two independent API instances with separate PostgreSQL pools/stores against the dedicated test database and separate Redis bridge clients. It passed **1/1 locally** on the Windows development host. The test confirms durable cross-node sequence/history, recovery after a deliberately dropped Redis hint through PostgreSQL-backed heartbeat reconciliation, ordered replay after node A and its pool are closed, a subsequent write on node B, and document/site delivery isolation.

The repository check also passed locally: 230 required artifact paths, 237 JavaScript files syntax-checked, and 565 unit tests (562 passed, 0 failed, 3 platform skips). This does not validate the CI workflow or certify production. The fixture uses a fake test identity service with database-backed fixture user IDs and site-scoped capabilities; it does not qualify the identity provider. Hosted PR CI run #435 (`42494704337`) passed all jobs, including the PostgreSQL-backed multi-node browser scenario, live PostgreSQL/Memgraph integration, Memgraph outage/recovery and canonical graph rebuild, CodeQL, browser smoke, Node 22/24 unit/security/dependency checks and consolidated revision-bound evidence. PR #104 remains open pending review and merge to `main`. The test makes no claim about production load, Redis Cluster/failover, PostgreSQL failover, independent authorization/security review, or manual accessibility acceptance.

No migration, runtime dependency, protocol, route, SemVer, release or deployment change is included. SemVer remains `0.6.2`; issues #14, #19, #24, #25, #26 and #32 retain their independent acceptance requirements. Production remains NO-GO.

## Addendum — 8 November 2026 (F1.14 collaboration authorization regressions)

F1.14 adds a deterministic API regression in `test/realtime-tenant-isolation.test.js` using the real REST router and WebSocket gateway. A Site A-only editor can sync/write/join a Site A draft but is denied Site B REST sync/write before content lookup or persistence, cannot join a Site B document over the Site A socket, and cannot upgrade a WebSocket against Site B. The test then revokes Site A `content:edit` while the presence session remains active and proves the next collaboration WebSocket operation and REST write are denied before persistence; the document subscription closes while the presence subscription remains.

The focused collaboration/tenant/WebSocket test command passed **28/28**. The full repository check passed on Node.js 26.12.1: **566 tests, 563 passed, 0 failed and 3 platform skips**, 230 required artifact paths and 237 JavaScript files syntax-checked. The source-anchored tenant-isolation inventory was regenerated and its capability-map digest refreshed (27 route/flow families, 78 declared route patterns, 19 source files, 41 test files).

This is maintainer-authored application regression coverage, not the independent assessment required by issues #14 and #25. Hosted F1.14 CI and review are pending. No application runtime behavior, dependency, migration, route, protocol, SemVer or release state changed. SemVer remains `0.6.2`; production remains NO-GO.

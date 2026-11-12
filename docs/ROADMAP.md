# VirgoScorpio Hub Roadmap

This roadmap is evidence-oriented rather than a promise of dates. Items should move to complete only when linked evidence exists for the target commit and environment. The roadmap now covers two complementary tracks: completing the current secure, reliable platform foundation and developing toward a real-time collaborative AI-native platform.

Priorities: **P0** = critical reliability/security/release work; **P1** = foundational next capabilities; **P2** = major product capabilities; **P3** = strategic advanced capabilities. These labels indicate sequencing, not delivery dates or guarantees.

## Current 0.6.2 continuity — 11 November 2026

Main advanced to `3c5df47f7a397f76a5368ef7bc036579e5406835` through merge of F1.22 PR #127. Exact-main workflow [#563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056) passed all seven jobs: Node 22/24 matrices 590/590 each, live PostgreSQL/Memgraph integration 85/85 with zero failures/skips, fresh migration validation, collaboration Playwright 3/3, browser/accessibility smoke 9/9, CodeQL, main-only provenance/SBOM attestation and evidence aggregation. The PR review history contained no formal review submission; merge plus CI is maintainer/automation evidence, not independent assessment.

PR #125 addresses a race in site membership administration by serializing removals on the owning site row before owner-count checks. It includes an auth unit assertion and a live disposable-PostgreSQL concurrency regression. No formal review submission was recorded for PR #125; maintainer-controlled merge plus passing CI is not an independent security assessment. The code change adds no schema, migration, API, dependency, provider, architecture or SemVer change.

Qualified independent tenant and platform security assessors remain unavailable. At the owner's direction, internal development continues under the [maintainer-led security assurance policy](security/MAINTAINER-LED-SECURITY-ASSURANCE.md). Issues #14 and #25 remain OPEN / NOT PERFORMED as production gates but are not prerequisites for ordinary private developer-preview engineering. Do not describe internal tests as independent assessment, populate independent evidence contracts, or waive these gates. Issue #23 remains OPEN / PARTIAL pending qualified human dependency/maintenance/license/distribution and CodeQL acceptance. Package 0.6.2 remains private/unreleased; no SemVer increment, tag, publication or deployment is authorized.

Current-main workflow #563 supply-chain evidence: lockfile SHA-256 `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; signed CycloneDX 1.5 SBOM SHA-256 `47193754a73795346ba1ac2dd473c865c22aeaf7019a83ae0ef8b1379d550273` (200 components / 201 dependency records; 15 GPL/LGPL-bearing components); attestation artifact `13909802032` with archive digest `sha256:4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d`. Qualified human dependency/license/distribution acceptance remains outstanding under #23.

F1.22 merged in PR #127 at main commit `3c5df47f7a397f76a5368ef7bc036579e5406835`, tracked under [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). It adds the owner/editor/author/viewer capability matrix, disabled-account/cross-site denials, membership add/remove authorization lifecycle and authenticated SSE revocation. Hosted #559/#560 passed 85/85 live PostgreSQL/Memgraph tests on the exact PR head; current-main workflow #563 also passed 85/85 with zero failures/skips. The PR review history has no formal review submission; this is maintainer/automation evidence, not independent assessment. The generated route catalog is a navigation and drift-detection aid, not proof of exhaustive discovery.

F1.23 is the active candidate on branch `security/tenant-owner-transfer-invitation-acceptance-2026-11-11`, tracked under [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). It adds transactional, request-correlated `site.invitation_accepted` audit recording, new and existing-account invitation acceptance, disabled/expired/replayed/concurrent redemption coverage, Site A/B membership-preservation assertions, token-hash/audit secrecy checks, rollback/no-invalidation unit coverage for audit persistence failure, and guards against granting `site-owner` through ordinary add/invite APIs. Local `npm run check` passed 594 tests (591 passed, 0 failed, 3 Windows-specific skips); live PostgreSQL integration is skipped locally without a disposable database, so exact-head hosted PostgreSQL/Memgraph validation remains pending. This branch does not add an owner-transfer endpoint: a privileged transfer feature requires separately authorized product/API semantics under #13 and security review.

## Historical 0.6.2 continuity — 10 November 2026

For historical 10 November context, see the [tenant-isolation and release continuation report](reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md), [maintainer supply-chain review](reports/2026-11-10-SUPPLY-CHAIN-REVIEW.md), [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md), [Release Scope](RELEASE-SCOPE.md), and [Release Readiness](RELEASE_READINESS.md). Older dated reports remain historical snapshots bound to their stated source revisions.

Historical main on 10 November included PR #118 at SHA c7653bb433ae8b363925d13babf239e64b2b5125. Exact-mainline workflow #522 passed all six jobs on that historical revision; use the 11 November continuity section above for current status.

The maintainer-generated tenant inventory contains 27 flow families, 78 route patterns, 21 implementation/source files and 41 test references. The merged PR #116 regression verifies same-slug custom-content-type definitions and records remain isolated across two sites. The inventory is a review/navigation aid, not proof of complete route discovery or an independent assessment.

PR #118 merged the cloud-connection regression into the 10 November main baseline: Site B list isolation, foreign Site A ID non-disclosure on test/disable, selector-conflict rejection and unchanged-row oracles under a Site B-only cloud:manage actor. Exact-mainline workflow #522 passed all six jobs on the historical merge SHA. The targeted regression is maintainer evidence only; independent tenant review #14 and broader security review #25 remain open.

The active issue #23 maintainer slice is on unmerged branch `security/dependency-supply-chain-review-2026-11-10` at code/lockfile SHA `17ba575114e1ee9576e49c7ae456a1af0280b6fc`. It remediates LOW GHSA-474x-hrwr-fgx4 / CVE-2026-126066 by updating optional transitive `fast-xml-parser` from 5.11.2 to fixed 5.12.0 and `is-unsafe` from 2.0.2 to 2.0.3; `package.json` and direct dependencies are unchanged. The lockfile has 205 non-root entries and integrity metadata on all 203 remote resolutions. Hosted workflow [#524](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42950578389) passed both supported Node jobs (zero npm audit vulnerabilities; CycloneDX 1.5: 200 components / 201 dependency records), live integration (**82/82**), fresh migration idempotency (**18/18** applied and **18/18** skipped), PostgreSQL-backed Playwright (**3/3**), browser smoke, CodeQL and consolidated checksum-bound evidence. The candidate SBOM generator uses lockfile-only input, a shared frozen CLI argument list, centralized root normalization and identity validation before hashing. The main-only attestation job was skipped by design on this feature branch; successful signed provenance/SBOM verification on main remains outstanding. Formal issue #23 review remains OPEN / PARTIAL pending qualified human dependency/license/distribution review, exact-SHA CodeQL alert disposition and attestation/artifact review. See the [full 10 November release-gate report](reports/2026-11-10-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md). No runtime/API/schema/migration change or SemVer increment is proposed; production remains NO-GO.

Next engineering priorities are (1) validate and review the F1.23 invitation-acceptance audit/lifecycle candidate on branch `security/tenant-owner-transfer-invitation-acceptance-2026-11-11`, tracked under #124; (2) continue #124 follow-on coverage for WebSocket/collaboration revocation, Redis cross-instance invalidation and transaction/recovery paths; (3) complete qualified human dependency/license/provenance acceptance (#23) when available; and (4) prepare safe internal resilience and operations work for #24/#26 under an approved non-production topology. There is no current owner-transfer API. Any future owner-transfer capability requires explicit authorized product/API scope (#13), last-owner/atomicity semantics and independent security review before implementation. Reviews #14/#25 and governance decisions #13/#32 remain production blockers, not prerequisites for ordinary private non-production engineering. Package 0.6.2 remains private/unreleased; production remains NO-GO.

## Human-AI agency — cross-cutting product and engineering gate

The [VirgoScorpio Hub Manifesto](../VIRGOSCORPIO-HUB-MANIFESTO.md) is the project's north star for human-AI collaboration. It frames the goal as amplifying human capability, preserving creative dignity and productive relevance, and resisting designs that treat human obsolescence or concentrated control as inevitable. This roadmap translates those values into engineering work; it does not claim that software alone can guarantee employment, income or broader economic outcomes.

Apply these checks to every AI-enabled product track:

- [ ] Identify the human goal, user benefit and decision owner before automating a workflow.
- [ ] Make AI participation and generated or materially transformed content identifiable to the user.
- [ ] Provide user controls to enable, limit or disable AI assistance where feasible, with clear data-use and context boundaries.
- [ ] Define action risk tiers. Permit only explicitly authorized, bounded and reversible automation without additional approval; require appropriate human review for consequential, privileged, externally visible or hard-to-reverse actions.
- [ ] Preserve inspection, correction, rejection, undo, appeal or escalation paths appropriate to the action.
- [ ] Attribute human and AI contributions where useful and consented, without presenting attribution as a legal determination of authorship or ownership.
- [ ] Design for accessibility, skill development and meaningful participation; do not use presence or activity telemetry for covert productivity scoring.
- [ ] Test for over-automation, biased outcomes, deskilling risks, deceptive AI presentation, prompt injection and authority escalation.

**Exit condition:** each AI-enabled feature has documented user control, data-use boundaries, delegated permissions, action-risk classification, recourse and validation criteria. High-impact actions cannot bypass required approval or audit controls.

## Track A — Stabilize the pre-1.0 platform baseline (P0)

### Reliability and release process

- [x] Remove the legacy EnginEx arbitrary-JavaScript renderer and fail closed on the retired compatibility flags. Review [EnginEx 7.0 Migration](ENGINEX-7-MIGRATION.md); this breaking renderer upgrade merged as Hub 0.6.0 / EnginEx 7.0.0. It does not constitute release approval.
- [x] Extract commerce and membership HTTP route handling into `apps/api/src/commerce-routes.js`, preserve the API server's authentication/site/capability dispatch, and reuse bounded JSON-object and canonical UUID helpers. This internal route-seam refactor merged in the unreleased 0.6.1 mainline.
- [x] Extract site membership administration and invitation creation into `apps/api/src/site-membership-routes.js`; preserve `site:manage` policy order, bounded body parsing, audit-before-response sequencing, and invitation secret minimization. PR #69 merged this route family into main at `d50e56801ea77a811ec809be1574e769917fff78`. The route-family unit suite and the existing tenant-membership integration suite remain the acceptance boundary.
- [x] Extract site-scoped library/media HTTP handling into `apps/api/src/library-routes.js` as the unreleased 0.6.2 candidate. Preserve authentication, site resolution, capability checks, upload bounds, metadata/version semantics, audit events, private-download headers, optimization status and explicit object-storage reconciliation. The route extraction and evidence/toolchain follow-up passed both hosted PR run [#270](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42026945926) and push run [#269](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42026938931): both Node runtimes passed 476 Hub tests and 94 EnginEx tests, live PostgreSQL/Memgraph passed 65/65, migrations and the supported v0008-to-v0009 upgrade passed, browser smoke passed 9/9, CodeQL and consolidated evidence passed. npm 11.19.1 SBOMs match at the normalized component/dependency graph level. PR #68 merged into main as commit `be1441e216c20358e8506389915a676209808e37`; formal production readiness remains NO-GO. See [the 0.6.2 release-gate report](reports/2026-11-05-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).
- [x] Extract the custom content-type registry and record HTTP family into `apps/api/src/content-type-routes.js` as a follow-on 0.6.2 patch candidate. Preserve the composition-layer authentication/site/capability boundary, Git-managed definition precedence, site-scoped record reads/writes, `content:read:own` SQL owner filters, field validation and existing response contracts. Admin definition version replacement uses the shared PostgreSQL transaction helper with a site/slug advisory lock; no schema migration is introduced. Focused module and API-composition tests cover authorization order, version/rollback behavior, record validation and site scoping. Both hosted push and PR workflows passed all six jobs on corrected head `7c8549382faa7e39445e8f443f1006d63a1488bc` (runs [#42107807577](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42107807577) and [#42102228955](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42102228955)); human review and production-readiness evidence remain separate gates.
- [ ] Restore a fully green mainline CI evidence aggregation on Hub 0.6.2. Run [#278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42067882403) attempt 2 passed all five producer jobs on exact main SHA `d50e56801ea77a811ec809be1574e769917fff78` (Node 22/24, live PostgreSQL/Memgraph 65/65, 18/18 migrations plus idempotent re-entry, browser smoke 9/9, CodeQL and SBOM parity), but the aggregate remained blocked because the workflow-run API exposed the prior attempt's failed conclusion during the current attempt's aggregate job. PR #70's attempt-bound correction passed all six hosted checks on both push and PR events; human review and merge to main remain pending, so the mainline CI gate remains open. This is engineering CI evidence only; [production readiness](RELEASE_READINESS.md) remains NO-GO.
- [x] Retain exact-revision evidence for a fresh PostgreSQL database applying migrations 0001–0018, idempotent re-entry, and the supported v0008-to-v0009 upgrade fixture. Mainline run #278 attempt 2 passed the dedicated live suite (65/65, zero skips), generated version- and source-bound migration evidence (18/18 apply and 18/18 second-pass skips), and exercised Memgraph outage/replay and graph rebuild. The separate formal PostgreSQL/Memgraph release record still requires its own accepted current-source evidence contract; see [release readiness](RELEASE_READINESS.md).
- [x] Validate concurrent outbox claims, independent consumer-group delivery, transient graph-projection retry/replay, dead-letter ordering and expired-lease recovery against live services. Mainline run #278 attempt 2 passed the live PostgreSQL/Memgraph suite and explicit Memgraph outage/replay plus canonical graph rebuild. This remains engineering CI evidence, not production recovery certification.
- [ ] Run representative sustained load/soak and fault-injection tests; publish measured throughput, resource bounds, recovery latency and production capacity limits. The existing bounded integration tests are correctness evidence, not a production load certificate.
- [ ] Perform backup/restore drills and document RPO/RTO results.
- [ ] Require an explicit release-readiness review and approval record.

### Security and identity

- [ ] Complete an independent security review and track remediation.
- [ ] Review tenant/site isolation across all API routes and background work.
- [ ] Validate OIDC/SAML/email delivery/MFA flows with real test infrastructure where applicable.
- [ ] Verify production malware-scanning integration and quarantine behavior.
- [ ] Validate plugin isolation, immutable images, resource limits, and egress policy in the intended deployment environment.
- [ ] Verify SBOM, provenance, dependency scan, CodeQL, and release artifact retention.

### Provider and product parity

- [ ] Validate cloud storage providers using supported integration accounts and failure-mode tests.
- [ ] Validate Stripe flows with test-mode accounts, idempotency, reconciliation, webhook verification, and ambiguous transport outcomes.
- [ ] Add acceptance evidence for commerce and community workflows that spans application, database, and user-facing behavior.
- [ ] Complete keyboard, screen-reader, contrast, focus, and browser acceptance testing.
- [ ] Define explicit WordPress, Elementor, WooCommerce and BuddyPress acceptance subsets; do not claim parity until their selected tests pass.

### Documentation and developer experience

- [x] Centralize PostgreSQL transaction lifecycle handling and adopt it in the community workflow and Stripe checkout reconciliation modules. Keep adoption incremental; auth, content persistence, API routes, and cross-system object-storage workflows still require separate contract review.
- [x] Extract the authenticated AI task status/history/detail read routes into a dedicated handler while retaining authentication, site selection, and `ai:use` enforcement in the API composition pipeline.
- [ ] Keep feature descriptions and badges aligned with CI evidence.
- [ ] Keep setup commands, environment examples, and module responsibilities synchronized with the source.
- [ ] Track recurring onboarding friction from contributor feedback and simplify the most common paths.

**Exit condition:** the applicable 0.6.x release gates have current evidence for the exact target commit. A green unit suite or configured CI workflow alone is insufficient.

## Track B — Build the real-time platform foundation (P1)

This track establishes reusable infrastructure before individual screens and features independently implement real-time behavior.

**Foundation 1 progress (developer preview):** the Foundation 1 implementation lineage (`feat/f1-10-cross-instance-collaboration` and follow-on `feat/f1-11-collaboration-resilience`) contains the event hub, lease-based presence, authenticated SSE/WebSocket transport, Redis/Memurai shared presence and ephemeral Pub/Sub, session-bound authorization invalidation, bounded realtime metrics, and F1.9/F1.10 collaborative-document proofs. **F1.7** records the provisional server-authoritative semantic-OT direction in [Collaborative Editing Spike](COLLABORATIVE-EDITING-SPIKE.md) and ADR-019. **F1.8** adds authenticated presence WebSockets, shared global/site/principal connection quotas and bounded snapshot-refresh guidance. **F1.9** adds draft-only semantic OT and PostgreSQL operation sequencing. **F1.10** adds bounded cross-instance Redis document hints and PostgreSQL gap/heartbeat repair; live loopback Redis and two-API-instance browser tests prove A↔B delivery, dropped/reordered/duplicate hint recovery, reconnect after node loss and 2/5/10 editor convergence. Pub/Sub is still ephemeral and PostgreSQL remains authoritative. F1.11 adds a loopback-Redis transient-publish recovery check, a 10-subscriber × 2,000-operation sustained relay check, and a 10-session reconnect storm after local API-node loss; these are bounded local-harness observations, not production capacity certification. This remains a developer-preview correctness/load baseline, not durable client-event replay or production certification. See [Real-Time Foundation 1](REALTIME-FOUNDATION-F1.md) and migrations `0010`–`0014`.

- [x] Publish and review the real-time event contract: v1 event identity/schema, site scope, actor, correlation, classification, aggregate-version idempotency and payload bounds. See [Real-Time Foundation 1](REALTIME-FOUNDATION-F1.md). A distinct tenantId is not yet modeled.
- [x] Implement an authenticated, same-origin presence WebSocket preview with the existing SSE fallback, site capability checks, command allow-list and periodic reauthorization. Durable collaboration operations and durable event replay remain separate work.
- [x] Implement PostgreSQL consumer-group delivery records, explicit event-type subscriptions, at-least-once claims, lease recovery, per-aggregate ordering, retry/dead-letter and bounded replay by event ID; migrate the Memgraph projector to `graph.projection.v1` and validate content workflow projection ordering.
- [ ] Select and validate durable event fan-out beyond the PostgreSQL delivery ledger only after measuring deployment topology, throughput, ordering and operational cost; F1.4/F1.10 Redis Pub/Sub carries only ephemeral presence/authorization/document hints and is not a durable delivery log.
- [x] Implement a Redis-protocol-compatible shared presence lease adapter with TTL expiry, multi-session aggregation, hidden-state filtering, per-site capacity and expiry callbacks. Live tests verify two independent clients share the same site snapshot.
- [x] Add Redis Pub/Sub expiry and presence-refresh invalidation propagation to SSE and WebSocket presence subscribers, with site-scoped channels and authorization rechecks. Relay failure preserves local presence refresh; remote delivery remains best-effort and no Pub/Sub replay is claimed.
- [x] Add bounded backpressure, shared global/site/principal connection quota leases for SSE and WebSocket, connection-rate controls, and local-first presence degradation when Redis relay publication fails. Redis quotas fail closed when the shared store is unavailable.
- [x] Add bounded low-cardinality realtime metrics for connections, fan-out, authorization, presence and Redis operations; define production scrape/alert ownership separately.
- [x] Document real-time subsystem operating boundaries, current metrics, privacy rules, triage and recovery procedures in the [Real-Time Operations Runbook](REALTIME-OPERATIONS.md). This is a developer-preview operating baseline, not deployment approval.
- [x] Add request-scoped W3C Trace Context v00, AsyncLocalStorage correlation, trusted-ingress guard, internal plugin-runner propagation, and the initial allow-listed API/plugin-runner structured JSON logs. At this milestone logs were local only; the later F1.16 OTLP Logs transport is tracked below. See [Observability and Trace Correlation](OBSERVABILITY.md).
- [x] Add opt-in OpenTelemetry manual span instrumentation and OTLP/HTTP export for API, authenticated plugin runner, PostgreSQL, Redis, outbox/worker, graph projection and scheduler. See [Observability and Trace Correlation](OBSERVABILITY.md); tracing is disabled by default.
- [x] Add an authenticated, loopback-only local OTLP/HTTP Collector development profile with bounded memory, batch processing, a pinned contrib image, and ephemeral debug pipelines for traces and logs. See [Observability and Trace Correlation](OBSERVABILITY.md); this is not a production backend.
- [x] Add an opt-in, vendor-neutral OTLP/HTTP Logs transport for allow-listed structured events, bounded batched export, trace/span correlation, and an authenticated ephemeral local trace+logs Collector smoke test. This is transport plumbing only; no production log backend or retention/access policy is implied.
- [x] Define a vendor-neutral production observability deployment-evidence contract, strict fail-closed validator, and release-readiness gate covering backend selection, TLS/authentication, access, retention/deletion, named ownership, durable delivery, measured capacity and outage recovery. This does not select a provider or attest to external evidence; see [Production Observability Deployment Contract](OBSERVABILITY-DEPLOYMENT.md).
- [ ] Select, deploy, secure and load-test a production OTLP collector/backend against an approved manifest; independently verify evidence, TLS, durable queueing, retries, retention and access policy on the target topology.
- [ ] Centralize redacted logs with approved transport, access controls, retention/deletion, audit and named ownership; do not collect prompt/content/token payloads.
- [x] Validate cross-site/document subscription and delivery isolation with adversarial integration tests; no separate tenantId is modeled yet.

**Exit condition:** a reproducible multi-instance test demonstrates authenticated, tenant-isolated delivery, reconnect, duplicate handling, stale-presence expiry and recovery from relay or broker interruption.

## Track C — Establish AI governance and orchestration (P1)

- [x] Define the initial durable AI queue storage/worker contract: AES-256-GCM task/result payload encryption with site/task/purpose AAD; 128 KiB ciphertext bounds; atomic queue claim + metadata transition; random claim tokens, expiring leases and heartbeat renewal; stale-claim-safe completion/failure; bounded attempts, transient retry delay, exhausted-lease reaping; actor/site-scoped result reads; and input-ciphertext clearing on terminal/cancel paths. Migration `0018_ai_task_durable_queue.sql`; implementation: [encrypted payload cipher](../packages/security/src/ai-task-payload.js), [queue store](../packages/db/src/ai-task-queue.js), [worker contract](../packages/ai/src/queue-worker.js); regression tests cover crypto, queue-state SQL contracts and worker behavior. This is an infrastructure foundation only: API enqueue dispatch, production worker composition, idempotency, policy revalidation, retention/key rotation, quotas and provider fallback remain incomplete.
- [x] Add the first authorization-aware saved-page context path for `POST /api/v1/ai/page-draft`: up to five explicit page IDs, site-scoped retrieval, database-enforced owner-only reads, fail-closed denied/missing/cross-site handling, visible text/alt extraction, untrusted context capped at 3,000 characters, and server-forced `confidential` classification before site-policy enforcement. Implementation: [context assembler](../packages/ai/src/context-assembler.js) and [owner-scoped store query](../packages/db/src/postgres-store.js); regression coverage: [API authorization tests](../test/ai-context-api.test.js), [assembler tests](../test/ai-context-assembler.test.js), and [store query test](../test/content-owner-store.test.js); commit `e7fe2d05af91c8bb807b494e836fef77c7f5c3a2`. This first slice is page-draft only; other AI operations still need explicit context integration.
- [ ] Wire the queue foundation into an authorized enqueue API and independently deployed worker; revalidate caller/site policy at execution time, reserve budgets atomically, add idempotency keys, safe cancellation of queued/running work, result retrieval, retention/deletion and encryption-key rotation. Add bounded provider fallback only after policy and idempotency semantics are defined.
- [x] Propagate HTTP client cancellation through the governed AI service and all provider adapters, abort in-flight provider fetches on disconnect, and distinguish caller cancellation from provider timeout in sanitized audit outcomes.
- [x] Persist metadata-only AI task lifecycle states (`queued`, `running`, `succeeded`, `failed`, `cancelled`, `blocked`) and expose actor- and site-scoped status retrieval. Prompt/context/model output are not stored. This is synchronous request tracking, not a durable worker queue: leases, crash recovery, retries, resumability, task retention/deletion controls, quotas and provider fallback remain open.
- [x] Add an actor/site-scoped AI task collection endpoint with status/type filters, bounded page sizes, deterministic keyset pagination, and query-bound cursors. The cursor is only a pagination bookmark; database actor/site predicates remain the authorization boundary.
- [ ] Add structured output validation, prompt/tool versioning, correlation IDs, traceability and safe error handling.
- [ ] Define an explicit human-approval contract for publishing, role changes, firewall/security changes, moderation actions and workflow execution.
- [ ] Define risk tiers so low-risk, reversible and explicitly delegated tasks can be automated proportionately, while consequential or privileged actions require authorized human review.
- [ ] Provide user-visible AI status, explanation, source/context disclosure where appropriate, and accept/reject/revise/undo controls.
- [ ] Capture human/AI contribution provenance in version history when relevant, respecting user preferences and retention rules.
- [ ] Define consent and preference controls for AI assistance, contextual data access and model-provider processing.
- [ ] Evaluate whether assistance increases user capability and understanding rather than simply optimizing task throughput; do not turn presence metrics into covert worker scoring.
- [ ] Prevent AI tools from changing their own permissions, policy, credentials, approval requirements or audit records.
- [ ] Establish redaction, retention, consent and data-use controls for prompts, context, model responses and diagnostic traces.
- [ ] Build a representative evaluation set for accuracy, refusal behavior, prompt injection, data leakage, bias and cost/latency.

**Exit condition:** an AI-assisted action can be traced from request through authorized context, model/provider call, validation, human approval (when required), execution and audit record, with tests proving denied access and provider failure are safe.

## Track D — Deliver the first collaborative AI experiences (P1–P2)

### Collaborative CMS and writing assistant (P1)

- [x] Evaluate CRDT and operational-transformation approaches against VirgoScorpio Hub's structured document model; record the provisional semantic-OT direction and trade-offs in [Collaborative Editing Spike](COLLABORATIVE-EDITING-SPIKE.md) and ADR-019.
- [x] Implement a two-client semantic-OT proof with durable PostgreSQL operation sequencing, typed conflict handling, authenticated document REST/WebSocket transport, reconnect/replay, persisted revision/workflow/outbox integration and a two-context Playwright convergence proof (F1.9; production gates remain open).
- [ ] Implement collaborative document sessions, presence, cursors/selections, conflict handling, recovery and integration with persisted revisions.
- [ ] Add comments and review threads with tenant-scoped authorization and immutable audit context.
- [ ] Integrate the writing assistant for grammar, spelling, clarity, coherence, rewriting, autocomplete and context-aware suggestions.
- [ ] Stream suggestions without silently changing saved content; support accept, reject, undo, attribution and user preferences.
- [x] Validate collaboration across multiple users and API instances, including reconnect, concurrent edits, cross-scope isolation and 2/5/10 editor sequence convergence (F1.10 local correctness proof; production load/failover gates remain open).

### Collaborative administration and user environments (P2)

- [ ] Add shared admin presence and safe collaborative configuration review.
- [ ] Add versioned change previews, conflict handling, approvals and audit trails for administrative changes.
- [ ] Introduce personalized user workspaces with configurable activity, assistance and notification controls.
- [ ] Provide contextual AI help that only uses data the current user is allowed to access.

**Exit condition:** the first CMS workflow passes browser, accessibility, authorization, conflict/recovery and privacy acceptance tests. Admin and user experiences remain separate scoped milestones.

## Track E — Intelligent platform services (P2)

- [ ] Implement AI-assisted error triage and debugging over redacted, access-controlled telemetry.
- [ ] Provide live observability presence for service health, queue status, latency and incident indicators.
- [ ] Provide security presence for privileged security events, suspicious activity and incident state without exposing sensitive details to unauthorized roles.
- [ ] Add AI moderation recommendations with evidence, moderator review, appeal/reversal and policy versioning.
- [ ] Add AI search with tenant/ACL-aware indexing, deletion/freshness propagation and relevance evaluation.
- [ ] Add contextual documentation/help and translation workflows with source links, terminology guidance and human editorial review.
- [ ] Add UI semantics assistance for accessible names, descriptions, interaction hints and consistency checks, backed by manual accessibility acceptance.
- [ ] Complete live notification/badge presence, chat/forum presence and AI task presence on the shared event foundation.
- [ ] Add operational controls for provider availability, spend, latency, user feedback and model-quality regressions.

**Exit condition:** each service has a defined data boundary, measurable acceptance criteria, privacy/retention policy, failure behavior and user-visible review path.

## Track F — Workflow Studio and collaborative automation (P3)

- [ ] Research a versioned, typed workflow graph schema and node contract.
- [ ] Prototype a collaborative canvas for plans, decision trees, automation graphs and approval paths.
- [ ] Support AI-generated workflow drafts from natural-language requirements, with explanations and explicit validation results.
- [ ] Add static validation, dependency checks and sandboxed simulation before enabling execution.
- [ ] Define durable execution state, retries, cancellation, compensation, pause/resume and recovery.
- [ ] Require the initiating actor's capabilities and policy approval for every privileged node; never let AI-generated plans bypass authorization.
- [ ] Add workflow versioning, diff/rollback, run history, live execution presence and traceable node-level outcomes.
- [ ] Conduct threat modeling and adversarial tests for untrusted workflow definitions, plugins, tool calls, data exfiltration and resource exhaustion.

**Exit condition:** a bounded, non-production prototype supports collaborative editing, deterministic validation, safe simulation, version history and an independently reviewed execution threat model. Production execution is a later gate.

## Cross-track research questions

- What consistency guarantees should apply to collaborative documents, presence and durable events?
- Which event transport and fan-out design fits the expected single-node and multi-node deployments?
- Does the provisional semantic-OT model pass the two-client conflict/recovery prototype, or do offline-first requirements justify reopening the CRDT evaluation?
- How should AI context be assembled so that permissions are enforced before retrieval and again before actions?
- Which model/provider evaluation methods are appropriate for writing, moderation, search, security triage and workflow generation?
- How should live presence and operational telemetry be minimized, retained, exported and deleted?
- What workflow execution isolation is required for actions, plugins and third-party integrations?

Research should produce reproducible experiments, measured trade-offs and documented negative results where an approach is unsuitable.

## Documentation and developer experience

- [ ] Add real screenshots or short screen recordings only after obtaining current, reviewed assets.
- [ ] Keep setup commands, environment examples, architecture diagrams and module responsibilities synchronized with the source.
- [ ] Maintain the [feature coverage matrix](FEATURE-PARITY.md) as the source for distinguishing current code from planned capabilities.
- [ ] Maintain the [real-time and AI architecture](REALTIME-AI-ARCHITECTURE.md) as the design reference for collaborative platform work.

## Human participation, transparency and capability growth (cross-track)

These items are product-quality requirements to be implemented alongside the relevant feature tracks, not a separate promise of economic outcomes.

- [ ] Add clear indicators for AI-generated, AI-transformed and human-authored contributions where attribution is useful to the user.
- [ ] Build user-facing controls for AI assistance preferences, context use and non-AI alternatives where feasible.
- [ ] Add contextual explanation and learning affordances so users can understand suggested changes and develop their own skills.
- [ ] Establish recourse patterns for AI-assisted moderation, access recommendations and other decisions affecting people: explain, appeal, review and reverse where appropriate.
- [ ] Conduct usability research with administrators, creators, workers and community participants to assess agency, workload, accessibility and unintended effects.
- [ ] Document privacy-preserving limits for presence and activity data; prohibit covert individual productivity scoring as a default product capability.

## Completion rule

A roadmap checkbox is not a release gate by itself. Link each completed item to a commit, test report, reviewed artifact, benchmark, threat model or operational record. The authoritative release gate list is [Release readiness](RELEASE_READINESS.md). Never convert a planned capability into an implemented claim solely because its interfaces, documentation or test definitions exist.

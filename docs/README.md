# VirgoScorpio Hub Documentation

## Current status and repository assurance

- [Current 0.6.2 release-gate report — updated 12 November 2026](reports/2026-11-11-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) — current main 7b3fe3f / exact-main workflow #570, signed provenance/SBOM verification, F1.24 source-tree hosted test evidence (#571), clean PR #129 exact-head validation pending, and production gate matrix.
- [Maintainer-led security assurance](security/MAINTAINER-LED-SECURITY-ASSURANCE.md) — internal controls that allow private developer-preview engineering to continue without claiming independent assessment or production certification.
- [11 November post-PR #122 mainline and license inventory — historical pre-PR #123/#125 snapshot](reports/2026-11-11-POST-PR122-MAINLINE-AND-LICENSE-INVENTORY.md) — workflow #541 source-bound evidence and preliminary GPL/LGPL component inventory. Superseded as current-main evidence by workflow #570 (with #563, #558 and #555 retained as historical source-bound snapshots); issue #23 remains OPEN / PARTIAL.
- [11 November supply-chain attestation and CodeQL remediation](reports/2026-11-11-SUPPLY-CHAIN-ATTESTATION-REMEDIATION.md) — workflow #527 failure analysis, CLI flag correction, CodeQL alert #38 remediation and exact-main attestation repair through workflow #538. Later #541, #555 and current-main #558 evidence is retained in the dated post-PR inventory and current release-gate report.

- [Full 0.6.2 release-gate report â€” 10 November 2026](reports/2026-11-10-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) â€” historical 10 November main/candidate evidence, advisory remediation, SBOM digests and the release-gate decision. Current mainline follow-up is recorded in the 11 November remediation report and current status section below. Production remains NO-GO.

- [Tenant-isolation route and data-access inventory â€” 10 November 2026](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md) â€” current maintainer-generated route-family, capability, data-boundary, source-anchor and test-reference catalog; 27 families, 78 route patterns, 21 implementation files and 41 test files. Review preparation only, not independent assessment evidence.

- [Tenant isolation internal pre-review â€” 6 November 2026](reports/2026-11-06-TENANT-ISOLATION-PRE-REVIEW.md) â€” relationship-route site-context validation, bidirectional cross-site endpoint tests, site-private relationship outbox envelopes, outage/replay results, coverage inventory and independent-review gaps. This is not an independent assessment or release approval.
- [Taxonomy outbox and site-context internal pre-review â€” 6 November 2026](reports/2026-11-06-TAXONOMY-OUTBOX-PRE-REVIEW.md) â€” taxonomy GET/POST/PUT/DELETE selector reconciliation, canonical site-private upsert/delete envelopes, live integration and outage/replay results. This is not independent security evidence.
- [Production outbox producer audit - 6 November 2026](reports/2026-11-06-OUTBOX-PRODUCER-AUDIT.md) - exact-mainline inventory of content, relationship and taxonomy event writers, envelope fields, registry alignment and test-only direct inserts.

- [VirgoScorpio Hub 0.5.1 project status report â€” 1 November 2026](reports/2026-11-01-VirgoScorpio-Hub-0.5.1-Project-Status-Report.md) â€” full engineering, security, release-readiness, governance and funding snapshot. Historical candidate evidence; not production approval.
- [Repository coherence and continuity review â€” 1 November 2026](REPOSITORY-COHERENCE-AND-CONTINUITY-REVIEW-2026-11-01.md) â€” repository inventory, documentation drift, CI/readiness gaps, branch reconciliation, safe corrections and backlog.
- [Local Docker resource migration report â€” 5 November 2026](reports/2026-11-05-LOCAL-DOCKER-RESOURCE-MIGRATION.md) â€” checksummed cold backups, isolated Compose restore, current 18-migration PostgreSQL schemas, live integration, Memgraph outage/replay and graph rebuild, and 9/9 local Playwright smoke; legacy-resource retirement remains pending.

- [Maintainer supply-chain review â€” 10 November 2026](reports/2026-11-10-SUPPLY-CHAIN-REVIEW.md) â€” lockfile/clean-install inventory, CycloneDX/license metadata, npm advisory remediation and main-only signed-attestation workflow. Candidate workflow #524 passed; the signer job was successfully verified on main by workflow #533; qualified human license/distribution review remains open. Partial maintainer review only; legal clearance and formal gate acceptance remain open.

## Current mainline status — 12 November 2026 (post PR #129 merge)

Current main is `5929a53a1c551a2fe43bc38e61cb63dbecec52f5` after F1.24 PR #129. Exact-main workflow [#574](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43170211973) passed all seven jobs, including live PostgreSQL/Memgraph integration 91/91 with zero failures/skips, Node 22/24 matrices 594/594 each, fresh migrations, collaboration Playwright 3/3, browser/accessibility 9/9, CodeQL, main-only signed provenance/SBOM and evidence consolidation. PR #129 had no formal review submission; passing CI/merge is maintainer/automation evidence, not independent approval. Current-main lockfile/SBOM digests and attestation artifact are recorded in the [release-gate report](reports/2026-11-11-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

PR #125 added maintainer-led per-site serialization of membership removals before final-owner checks. PR #127 then merged the F1.22 role-capability matrix and authenticated SSE membership-revocation regression; exact-main workflow #563 passed the merged source. No formal review submissions were recorded for PR #125 or PR #127; merge and CI success are not independent security approval. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED because qualified assessors are unavailable. These are production gates, but do not block continued private, non-production developer-preview work under the [maintainer-led security assurance policy](security/MAINTAINER-LED-SECURITY-ASSURANCE.md). This policy is not a waiver or independent assessment. Issue #23 remains OPEN / PARTIAL pending qualified human dependency/license/distribution review, exact-SHA CodeQL disposition and formal acceptance. No SemVer increment, release tag, publication or production deployment is authorized. Workflow #555 is the PR #125 code baseline; workflow #552 is the preceding pre-PR #125 mainline result and #541 is an earlier historical snapshot.

F1.22 merged in PR #127 at main commit `3c5df47f7a397f76a5368ef7bc036579e5406835`. The role-capability matrix, disabled-user/cross-site denials, membership add/remove lifecycle and authenticated SSE revocation passed on the exact PR head in #559/#560 and again on exact main in #563 (85/85 live integration, zero failures/skips). GitHub records no formal review submission for #127; this remains maintainer/automation evidence, not independent review. See the [implementation roadmap](IMPLEMENTATION-ROADMAP.md) and [generated tenant route map](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md).

F1.23 merged in PR [#128](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/128) at main 7b3fe3f; exact PR-head workflows #566/#567 and docs-final #568/#569 passed 90/90 live PostgreSQL/Memgraph tests each, and exact-main #570 passed. It adds request-correlated transactional invitation-acceptance audit, invitee authentication metadata correctness, and invitation lifecycle/owner-role boundary coverage. No formal review submission was recorded.

F1.24 merged in PR [#129](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/129) at current main 5929a53. PR-head #572/#573 and exact-main #574 passed 91/91 live PostgreSQL/Memgraph tests with zero failures/skips, including trigger-injected audit failure, rollback, retained token digest, no authorization invalidation, and successful same-token retry. This is maintainer/automation evidence; no formal review submission was recorded.

F1.25 is in draft [PR #130](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/130). Test-bearing #575/#576 and final docs-head #577/#578 passed 92/92 live PostgreSQL/Memgraph integration tests each, zero failures/skips, plus Node 22/24 594/594, CodeQL, browser/accessibility 9/9 and collaboration Playwright 3/3. Human review remains pending.

F1.26 is a test-only Redis Pub/Sub subscriber re-subscription candidate on branch `security/redis-pubsub-resubscribe-2026-11-12`, tracked under [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). The gated Playwright scenario stops/restores only the exact prevalidated disposable Redis 7.4 CI container, verifies both API bridges recover, then proves a new membership-revocation event reaches the remote subscriber and closes only the revoked Site A socket before the test-only heartbeat. Exact-head hosted validation is pending. Pub/Sub is ephemeral; no durable replay is claimed. See the [F1.26 design](superpowers/specs/2026-11-12-f1-26-redis-pubsub-resubscription-design.md) and [plan](superpowers/plans/2026-11-12-f1-26-redis-pubsub-resubscription.md).

F1.24 is a test-only fault-recovery follow-up on branch security/invitation-audit-fault-recovery-2026-11-11, tracked under issue #124 in draft PR #129. A uniquely named PostgreSQL trigger fails only one Site A invitation-acceptance audit insert. The live regression verifies failed acceptance leaves no user, membership or audit, preserves accepted_at = NULL and the original SHA-256 token digest, emits no authorization invalidation, and permits the same token to succeed after trigger removal with exactly one audit and one post-commit invalidation. Source-test revision 23cb91382473d66bb9affe49e4ec1876f18a5724 passed hosted push workflow #571: PostgreSQL/Memgraph 91/91 with zero failures/skips, Node 22/24 594/594 each, CodeQL, browser/accessibility 9/9 and consolidated evidence passed. The final PR-head push/PR CI and human review remain pending. Local npm run check passed 594 tests (591 passed, 0 failed, 3 Windows-specific skips); the live database fixture is skipped locally without a disposable PostgreSQL service. This is maintainer/automation evidence, not independent review. The test-only change adds no runtime/API/schema/migration/dependency/provider/SemVer change.



## Historical mainline status â€” 10 November 2026 (after PR #118)

Historical 10 November main baseline: c7653bb433ae8b363925d13babf239e64b2b5125. Exact-mainline workflow #522 passed all six jobs after PR #118. PR #118 closes issue #117 and adds targeted Site A/B cloud-connection isolation coverage. Independent tenant-isolation review #14 and broader security review #25 remain open.

### Historical mainline status â€” before PR #118 merge

Current `main` includes PR #116 at merge commit `eb156b7620929ae94421caf69b4ddb92ed679812`. Exact-mainline [workflow #517](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42855470069) passed all six required jobs on that exact SHA: Node.js 22.23.4, Node.js 24.22.1, PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL and consolidated evidence. The live database/graph suite passed **81/81, zero failures, zero skips**, including the same-slug two-site custom-content-type regression. F1.20 issue #113 remains CLOSED / ACCEPTED for the restricted developer-preview reliability scope. Earlier PR #115 and workflow #42771040503 details are retained only as historical snapshots in their dated sections.

### Current tenant-isolation status

The current mainline inventory includes PR #118's cloud-connection Site A/B tests. Those are targeted maintainer regression tests; issue #14 remains OPEN / NOT PERFORMED, and issue #25 remains open. The independent reviewer must perform their own route discovery and adversarial test execution.

### Historical tenant-isolation pre-review progress â€” before PR #118 merge

The current generated [10 November tenant-isolation inventory](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md) contains 27 flow families, 78 declared route patterns, 21 implementation/source files and 41 referenced test files. PR #116 is merged; its schema/query anchors and focused two-site same-slug custom-content-type registry/record regression are included in workflow #517's 81/81 live result. The inventory generator's freshness check remains the source for validating the curated catalog and generated JSON/Markdown outputs.

A separate maintainer worktree, `security/cloud-connection-tenant-isolation-2026-11-10`, implements the next cloud-connection regression: Site B-only `cloud:manage` authorization, Site A/B list isolation, foreign Site A IDs for `test`/`disable`, selector-conflict rejection and unchanged row-state checks. Its focused live PostgreSQL integration test passed **2/2** with zero skips. The full local PostgreSQL/Memgraph/Redis integration runner passed **81/81, zero failures and zero skips**, including the eight Redis cases, on a dedicated `virgoscorpio_hub_cloud_test` database with loopback Memgraph and temporary loopback-only Redis (stopped after testing). Local `npm run check` passed **583/586**, zero failures, three Windows-specific skips. These are Node.js 26.12.1 dirty-worktree results. Open PR [#118](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/118) is at exact head `3aa47fad5bfaa417e72e4be2b46d3a91895c1c84`; hosted [workflow #42875103949](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42875103949) passed all six required jobs, and the live integration step enforced zero skips. The branch remains unmerged and outside main/workflow #517. The fixtures use unresolved `vault://` credential references and do not contact a provider.

The inventory and tests are maintainer-prepared review evidence only. They do not establish complete route discovery, independent security assessment, or production tenant-isolation acceptance. Issue #14 remains OPEN / NOT PERFORMED; #25 remains open for independent security assessment. Other current blockers: #13, #23, #24, #26 and #32. Package 0.6.2 remains private/unreleased and production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. See the [independent tenant-isolation review matrix](security/TENANT-ISOLATION-INDEPENDENT-REVIEW-MATRIX-2026-11-10.md), [release blocker triage](reports/RELEASE-BLOCKER-TRIAGE-2026-11-10.md), [10 November continuation report](reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md), [release readiness](RELEASE_READINESS.md) and [release evidence](RELEASE-EVIDENCE.md).
**Historical snapshot â€” 7 November 2026 (PRs #84â€“#92):** The then-current mainline was `c6026f137bbdc48dca13faa17f9d8f9e02d3f037`. The mega-menu A/B route suite exercised two concurrent optimistic updates using one expected version; one succeeded, one received the established version conflict, and the losing write could not alter Site B. PR workflow [run 42348356762](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348356762) and post-merge mainline workflow [run 42348591975](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348591975) passed all six hosted jobs. The generated route inventory at that snapshot referenced 38 test files.

This directory contains task-oriented documentation. The root [README](../README.md) is the project overview and quickest entry point; the pages below contain detail so that the README can stay scannable.

## Start here

| If you need toâ€¦ | Read |
|---|---|
| Review the breaking project identity change and migration requirements | [Change record](../change.md) |
| Make your first contribution from a fresh clone | [Contributor Quickstart](CONTRIBUTOR-QUICKSTART.md) |
| Understand the platform layout, API composition, renderer boundary, authentication, and commerce route seams | [Architecture](ARCHITECTURE.md) |
| Migrate templates from EnginEx 6.x to 7.0.0 after legacy JavaScript execution removal | [EnginEx 7.0.0 Migration Guide](ENGINEX-7-MIGRATION.md) |
| Review current exact-SHA CI evidence and production disposition | [Release Evidence](RELEASE-EVIDENCE.md) |
| Review the historical 0.6.2 gate and mainline CI snapshot as of 9 November | [0.6.2 Release Gate Report â€” 9 November 2026](reports/2026-11-09-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) |
| Review the current F1.20 merge and tenant-isolation pre-review continuation | [Tenant-Isolation and Release Continuation â€” 10 November 2026](reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md) |
| Review the previous mainline production release gate | [0.6.1 Release Gate Report â€” 4 November 2026](reports/2026-11-04-VirgoScorpio-Hub-0.6.1-Release-Gate-Report.md) |
| Review repository-wide reuse patterns, refactoring changes, and optimization priorities | [Codebase Optimization Review â€” 4 November 2026](CODEBASE-OPTIMIZATION-REVIEW-2026-11-04.md) |
| Understand the project mission and human-AI symbiosis vision | [VirgoScorpio Hub Manifesto](../VIRGOSCORPIO-HUB-MANIFESTO.md) |
| Apply the manifesto to product and engineering decisions | [Engineering Principles](VIRGOSCORPIO-HUB-PRINCIPLES.md) |
| Understand the proposed real-time, collaboration and AI architecture | [Real-Time and AI Architecture](REALTIME-AI-ARCHITECTURE.md) |
| Review the implemented developer-preview presence foundation and its limits | [Real-Time Foundation 1](REALTIME-FOUNDATION-F1.md) |
| Operate and troubleshoot the real-time preview without overstating its guarantees | [Real-Time Operations Runbook](REALTIME-OPERATIONS.md) |
| Configure trace correlation, the secured local OTLP collector profile, trust boundaries and safe attributes | [Observability and Trace Correlation](OBSERVABILITY.md) |
| Define and validate the production OTLP backend/security/governance/ownership evidence before deployment | [Production Observability Deployment Contract](OBSERVABILITY-DEPLOYMENT.md) |
| Review the CRDT/OT evaluation and collaborative editing recommendation | [Collaborative Editing Spike](COLLABORATIVE-EDITING-SPIKE.md) |
| Review existing AI provider adapters and integration boundaries | [AI Integration](AI-INTEGRATION.md) |
| Review recorded architecture trade-offs | [Architecture Decisions](ARCHITECTURE-DECISIONS.md) |
| Compare current feature coverage with planned capabilities | [Feature Coverage Matrix](FEATURE-PARITY.md) |
| Set up a local checkout | [Development](DEVELOPMENT.md) |
| Run tests or interpret validation | [Testing](TESTING.md) |
| Report a security issue or understand risk boundaries | [Security](SECURITY.md) and root [SECURITY.md](../SECURITY.md) |
| Understand project decisions, contribution stewardship, and funding transparency | [Governance](../GOVERNANCE.md) |
| Review the proposed zero-reserve operating and capital controls (**draft; not adopted**) | [Zero-Reserve Operating and Capital Resolution Draft](governance/ZERO-RESERVE-OPERATING-AND-CAPITAL-RESOLUTION-DRAFT.md) |
| Community behavior, reporting, and enforcement. | [Code of Conduct](../CODE_OF_CONDUCT.md) |
| How project contributions and collaborators are credited. | [Contributor Recognition](../CONTRIBUTOR_RECOGNITION.md) |
| Explore research topics or collaborate on technical investigations | [Research & Collaboration](../RESEARCH_COLLABORATION.md) |
| Review the reconciled 0.6.2 preview defaults, provider boundaries and explicit exclusions | [0.6.2 Release Scope](RELEASE-SCOPE.md) |
| Compare current, partial and future platform capabilities | [Feature Coverage Matrix](FEATURE-PARITY.md) |
| Decide whether a release can ship | [Release readiness](RELEASE_READINESS.md) |
| Plan work without making unsupported promises | [Roadmap](ROADMAP.md) |
| Update docs consistently | [Documentation standards](DOCUMENTATION_STANDARDS.md) |

## Documentation principles

- State the tested Node version, dependencies, command, and expected outcome when documenting a procedure.
- Mark requirements separately from optional integrations.
- Distinguish code availability from verified behavior, and tested behavior from production certification.
- Prefer copy/paste commands that work from the repository root.
- Never include live secrets, unredacted logs, customer data, or production identifiers.
- Keep feature tables, badges, architecture diagrams, screenshots, and examples synchronized with the current code.
- Keep proposed architecture and planned features visibly separate from implemented and validated capabilities.
- Apply the Human-AI agency principles to AI-enabled features, real-time collaboration, data use, attribution and approval design.

## Evidence and freshness

CI and local checks are snapshots. A release owner should rerun relevant checks against the exact release commit and record the evidence in the release process. For the last known certification state and remaining evidence, see [Release readiness](RELEASE_READINESS.md).

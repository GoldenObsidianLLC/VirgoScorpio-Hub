# VirgoScorpio Hub Documentation

## Current status and repository assurance

- [Tenant-isolation route and data-access inventory — 10 November 2026](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md) — current maintainer-generated route-family, capability, data-boundary, source-anchor and test-reference catalog; 27 families, 78 route patterns, 21 implementation files and 41 test files. Review preparation only, not independent assessment evidence.

- [Tenant isolation internal pre-review — 6 November 2026](reports/2026-11-06-TENANT-ISOLATION-PRE-REVIEW.md) — relationship-route site-context validation, bidirectional cross-site endpoint tests, site-private relationship outbox envelopes, outage/replay results, coverage inventory and independent-review gaps. This is not an independent assessment or release approval.
- [Taxonomy outbox and site-context internal pre-review — 6 November 2026](reports/2026-11-06-TAXONOMY-OUTBOX-PRE-REVIEW.md) — taxonomy GET/POST/PUT/DELETE selector reconciliation, canonical site-private upsert/delete envelopes, live integration and outage/replay results. This is not independent security evidence.
- [Production outbox producer audit - 6 November 2026](reports/2026-11-06-OUTBOX-PRODUCER-AUDIT.md) - exact-mainline inventory of content, relationship and taxonomy event writers, envelope fields, registry alignment and test-only direct inserts.

- [VirgoScorpio Hub 0.5.1 project status report — 1 November 2026](reports/2026-11-01-VirgoScorpio-Hub-0.5.1-Project-Status-Report.md) — full engineering, security, release-readiness, governance and funding snapshot. Historical candidate evidence; not production approval.
- [Repository coherence and continuity review — 1 November 2026](REPOSITORY-COHERENCE-AND-CONTINUITY-REVIEW-2026-11-01.md) — repository inventory, documentation drift, CI/readiness gaps, branch reconciliation, safe corrections and backlog.
- [Local Docker resource migration report — 5 November 2026](reports/2026-11-05-LOCAL-DOCKER-RESOURCE-MIGRATION.md) — checksummed cold backups, isolated Compose restore, current 18-migration PostgreSQL schemas, live integration, Memgraph outage/replay and graph rebuild, and 9/9 local Playwright smoke; legacy-resource retirement remains pending.

## Current mainline status — 10 November 2026

Current `main` includes PR #115 at merge commit `df1bf2b90d6eba96ec571a1ccab96f8d4354353f`. PR #115 adds a shared bounded Redis-client shutdown helper and normalizes generated inventory comparisons across Windows CRLF/LF checkouts without changing runtime retry policy, Pub/Sub semantics, public APIs, schema, dependencies or SemVer. Hosted PR-head [workflow run #509](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42767917251) passed all six required jobs on pre-merge revision `44b087a7265c013cd75768f08c6828f6991d9113` (Node 22/24, PostgreSQL/Memgraph, browser smoke, CodeQL and consolidated evidence). The pre-merge PR workflow was followed by exact post-merge push [workflow #42771040503](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42771040503) on main SHA `df1bf2b90d6eba96ec571a1ccab96f8d4354353f`; all six required jobs and source-bound evidence passed. F1.20 issue #113 is CLOSED / ACCEPTED for the restricted developer-preview reliability scope.

### Tenant-isolation pre-review progress

The current generated [10 November tenant-isolation inventory](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md) contains 27 flow families, 78 declared route patterns, 21 implementation files and 41 test references. Open [PR #116](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/116) adds database schema/query anchors and a focused two-site same-slug custom content-type registry/record scenario. The route unit suite passed 19/19 and the full `npm run check` passed 583/586 with zero failures and three Windows-specific skips (235 required artifacts, 243 JavaScript files syntax-checked). The local live parent was skipped without a dedicated disposable test database; hosted [run #42775446603](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42775446603) executed the new A/B scenario and passed 81/81 with zero skips. The subsequent docs-only reconciliation set current PR head `492bd4e7b14228a12b7f8ad818370ad1e1dec6b8`; exact-head [workflow #42781938171](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42781938171) passed all six jobs, including the live suite and evidence consolidation.

The inventory and test changes are maintainer-prepared review evidence only. They do not establish complete route discovery, independent security assessment, or production tenant-isolation acceptance. Issue #14 remains OPEN / NOT PERFORMED; #25 remains open for independent security assessment. Other current blockers: #13, #23, #24, #26 and #32. Package 0.6.2 remains private/unreleased and production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. See the [10 November continuation report](reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md), [release readiness](RELEASE_READINESS.md) and [release evidence](RELEASE-EVIDENCE.md).
**Historical snapshot — 7 November 2026 (PRs #84–#92):** The then-current mainline was `c6026f137bbdc48dca13faa17f9d8f9e02d3f037`. The mega-menu A/B route suite exercised two concurrent optimistic updates using one expected version; one succeeded, one received the established version conflict, and the losing write could not alter Site B. PR workflow [run 42348356762](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348356762) and post-merge mainline workflow [run 42348591975](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348591975) passed all six hosted jobs. The generated route inventory at that snapshot referenced 38 test files.

This directory contains task-oriented documentation. The root [README](../README.md) is the project overview and quickest entry point; the pages below contain detail so that the README can stay scannable.

## Start here

| If you need to… | Read |
|---|---|
| Review the breaking project identity change and migration requirements | [Change record](../change.md) |
| Make your first contribution from a fresh clone | [Contributor Quickstart](CONTRIBUTOR-QUICKSTART.md) |
| Understand the platform layout, API composition, renderer boundary, authentication, and commerce route seams | [Architecture](ARCHITECTURE.md) |
| Migrate templates from EnginEx 6.x to 7.0.0 after legacy JavaScript execution removal | [EnginEx 7.0.0 Migration Guide](ENGINEX-7-MIGRATION.md) |
| Review current exact-SHA CI evidence and production disposition | [Release Evidence](RELEASE-EVIDENCE.md) |
| Review the historical 0.6.2 gate and mainline CI snapshot as of 9 November | [0.6.2 Release Gate Report — 9 November 2026](reports/2026-11-09-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) |
| Review the current F1.20 merge and tenant-isolation pre-review continuation | [Tenant-Isolation and Release Continuation — 10 November 2026](reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md) |
| Review the previous mainline production release gate | [0.6.1 Release Gate Report — 4 November 2026](reports/2026-11-04-VirgoScorpio-Hub-0.6.1-Release-Gate-Report.md) |
| Review repository-wide reuse patterns, refactoring changes, and optimization priorities | [Codebase Optimization Review — 4 November 2026](CODEBASE-OPTIMIZATION-REVIEW-2026-11-04.md) |
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

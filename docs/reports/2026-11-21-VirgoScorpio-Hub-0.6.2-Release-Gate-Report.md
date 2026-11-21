# VirgoScorpio Hub 0.6.2 — Release Gate Repor

**Report date:** 21 November 2026 (America/Chicago)
**Product version:** 0.6.2 (private, unreleased patch candidate)
**Current mainline:** F1.59 — `70e800ad33a6d376388576ce76a608f35c595b64`
**Current exact-main CI:** [VirgoScorpio Hub CI #44809875826](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44809875826) — completed successfully, 7/7 jobs
**Canonical evidence artifact:** GitHub Actions artifact `14666785760` (`virgoscorpio_hub-release-readiness-ci`)
**Canonical readiness file:** `release-readiness.json`, generated 20 November 2026 at 20:20:06.482Z, SHA-256 `7d327cc49a4837f1fb40aedd6ec9cf35ac4e91f95d9347849ed8343c795e8931`
**Release classification:** `NOT_PRODUCTION_CERTIFIED`
**Decision:** **NO-GO — do not tag, publish, deploy or promote this package to production.**

---

## 1. Executive decision

The latest merged runtime increment is F1.59, graph-projection envelope scope, merged through [PR #232](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/232), closing issue #231. The exact-main workflow validated commit `70e800ad33a6d376388576ce76a608f35c595b64`, including supported Node.js jobs, live PostgreSQL/Memgraph integration, migration idempotency, browser smoke, CodeQL, mainline-only signed supply-chain attestation and source-bound evidence consolidation.

The authoritative release-readiness artifact records:

| Canonical readiness status | Count |
|---|---:|
| PASS | **8** |
| PARTIAL | **2** |
| BLOCKED | **0** |
| MISSING_EVIDENCE | **14** |
| NOT_RUN | **0** |

The two PARTIAL results are the human dependency/lockfile review and the service-less integration diagnostic. The service-less suite recorded 47 tests, 1 passed and 46 skipped; skipped tests are not production evidence. Separately, the exact-source hosted PostgreSQL/Memgraph producer passed 180/180 integration tests with zero skips.

The readiness artifact explicitly records `readyForProduction: false` and `releaseClassification: NOT_PRODUCTION_CERTIFIED`. The zero BLOCKED count does not mean all release requirements are satisfied: fourteen distinct production evidence gates are still missing. Independent tenant review, independent security assessment, dependency/license review and repository merge governance remain open. CI success does not override these gates.

This report supersedes the 20 November release-gate snapshot for current-main status only. It does not rewrite that historical report or promote candidate-branch test results into mainline evidence.

## 2. Exact-source mainline baseline

### 2.1 Git and package identity

| Item | Verified value |
|---|---|
| Repository | `GoldenObsidianLLC/VirgoScorpio-Hub` |
| Default branch | `main` |
| Main commit | `70e800ad33a6d376388576ce76a608f35c595b64` |
| Runtime increment | F1.59 |
| Merge | [PR #232](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/232), merged; issue #231 closed |
| Package version | `0.6.2` |
| Package state | Private and unreleased |
| GitHub Release / npm publication | None authorized or recorded in this release gate |
| Source-tree evidence | Clean at the exact main revision |
| EnginEx submodule | Clean at pinned commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |
| Schema/migrations | 18 existing migrations; no F1.59 schema change |
| Dependencies/lockfile | No F1.59 dependency or lockfile change |

The exact-source readiness JSON and PostgreSQL/Memgraph manifest both identify the same source revision. The final Actions run completed successfully after the readiness producer had materialized its canonical evidence. The readiness artifact's own workflow metadata is generated during the aggregate workflow; final run conclusion is verified separately from GitHub Actions run #44809875826.

### 2.2 CI and verification evidence

| Gate | Exact-main result | Notes |
|---|---|---|
| Node.js 22.23.4 | PASS | Hub unit/security suite: 677/677; EnginEx: 94/94 |
| Node.js 24.22.1 | PASS | Hub unit/security suite: 677/677; EnginEx: 94/94 |
| Live PostgreSQL 18 + Memgraph | PASS | 180/180 tests; 0 failures, 0 skips |
| Fresh migrations | PASS | 18/18 applied to a disposable database |
| Migration idempotency | PASS | 18/18 safely skipped on second application |
| Memgraph outage/recovery | PASS | Durable event remained pending through outage, replayed after recovery |
| Graph rebuild | PASS | Canonical PostgreSQL snapshot rebuild completed with deterministic checks |
| Browser smoke | PASS | Configured Chromium smoke suite passed 9/9; this is not full WCAG acceptance |
| CodeQL | PASS | Exact-main static analysis job succeeded |
| npm audit | PASS | High-severity threshold reported zero vulnerabilities; human review remains open |
| SBOM/runtime parity | PASS | CycloneDX 1.5; 200 components and 201 dependency records; Node 22/24 inventories aligned |
| Signed lockfile/SBOM attestation | PASS | Mainline-only attestation job succeeded |
| Evidence consolidation | PASS | Source-bound manifests and checksums validated |

The exact-source PostgreSQL/Memgraph producer manifest SHA-256 is:

`8e826ac6a6be38d37daa910054f3cf2f67e68e96e1a19d63fbdb6dc0a3cc1f9d`

The live integration artifact reports 180 tests, 180 passed, zero failed and zero skipped. Migration evidence reports 18/18 first-pass applications, 18/18 idempotent second-pass skips and disposable database cleanup. This is hosted CI against an isolated test environment, not production credentials or production data.

The canonical readiness checks are 8 PASS / 2 PARTIAL / 0 BLOCKED. The mainline CI run is successful, but production certification is explicitly separate.

## 3. Partial readiness gates

### 3.1 Human dependency and lockfile review — PARTIAL

The committed `package-lock.json` is present and tracked, and a clean isolated `npm ci` completed. Node 22/24 CI, audit, SBOM generation and signed mainline attestation provide technical evidence. The human dependency/license review is not complete.

[Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) remains open. The reviewer still needs to inspect direct/transitive dependency changes, pinned versions, optional/native packages, install scripts, licenses, advisories, the committed lockfile, SBOM completeness and provenance, and record a source-specific disposition.

### 3.2 Service-less integration diagnostic — PARTIAL

The source-bound service-less integration diagnostic recorded:

- 47 tests per supported Node runtime;
- 1 passing test;
- 46 skipped tests;
- 0 failures.

Skipped cases do not count as passed integrations. The separate live PostgreSQL/Memgraph producer is PASS at 180/180, but service-less gaps for other optional integration paths remain. The configured browser smoke suite is also only smoke coverage; broader accessibility acceptance remains missing.

## 4. Missing production evidence — fourteen open gates

The canonical readiness artifact has fourteen `MISSING_EVIDENCE` entries:

| # | Evidence gate | Current requirement |
|---:|---|---|
| 1 | Independent tenant-isolation and authorization review | Independent route-to-capability/data-access assessment, adversarial two-site tests, exact commit scope, findings and retest evidence. [Issue #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) remains P0/open. |
| 2 | Identity-provider end-to-end | OIDC/SAML, email delivery, MFA and recovery flows tested end to end. |
| 3 | Malware scanning and legacy-asset quarantine | Live ClamAV configuration, malicious-file corpus and legacy asset scan/quarantine reconciliation. |
| 4 | Live cloud providers | Authorized S3/GCS/Azure provider credentials, IAM least privilege and lifecycle verification. |
| 5 | Stripe lifecycle | Webhook replay, ambiguous-outcome recovery, inventory and lifecycle qualification. |
| 6 | Browser/accessibility acceptance | Real editor journeys and documented WCAG-focused/manual accessibility acceptance. Browser smoke 9/9 does not close this. |
| 7 | Commerce parity | Tax, shipping, coupons, refunds, fulfillment, downloads and subscriptions acceptance. |
| 8 | Community parity | Group privacy, spam/abuse, search, export/deletion and forum acceptance. |
| 9 | Plugin isolation | Signed plugin pipeline and adversarial container isolation evidence. |
| 10 | Human-reviewed dependency/SBOM/CodeQL | Review and reconcile dependency scan, SBOM, provenance, attestation and CodeQL findings; related to open issue #23. |
| 11 | Load and recovery | Load/soak, fault injection, backup/restore and recovery drills. |
| 12 | Independent platform security assessment | Independent application/platform security assessment, severity disposition and critical/high remediation/retest. [Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remains P0/open. |
| 13 | Operations and release approval | Deployment runbooks, secrets handling, rollback, monitoring, ownership and authorized release approval. |
| 14 | Production observability | Approved production OTLP backend, security, governance, ownership and delivery evidence. |

No maintainer-generated test report, CI workflow, route inventory, threat model or local checklist should be relabeled as an independent assessment. The missing evidence must be produced by the appropriate independent reviewer, provider owner, accessibility reviewer or operations owner and linked to the exact release candidate.

## 5. Security, governance and open-work inventory

| Tracking item | Current status | Release implication |
|---|---|---|
| [#14 — independent tenant-isolation review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | P0, open / not performed | Hard production gate |
| [#25 — independent security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | P0, open / not performed | Hard production gate |
| [#23 — dependency/SBOM/provenance review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | P1, open / partial | Human review still required |
| [#230 — independent review and CI merge policy](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230) | P1, open | Main remains unprotected; zero active rulesets were reported |
| [#233 — outbox consumer identity authority](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233) | P2, open | F1.60 candidate is being implemented separately; not mainline evidence yet |
| [#234 — Aikido SAST and secret-history triage](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234) | P1, open | Scanner findings require individual evidence-based triage; the 20 Nov snapshot lists 12 SAST and 1 secret-history item |
| [#235 — Aikido domain scan freshness](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235) | P2, open | The reported 1970-01-01 last-occurrence value must be reconciled with actual scan history; it is not itself proof of a vulnerability |
| [#277 — Aikido autofix PR batch](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277) | P1, open | Treat all generated PRs as untrusted individual proposals; the 21 Nov issue snapshot records 10 green, 28 failing, 1 pending (#257), 1 cancelled (#276), with no review decision |
| [#257 — firewall/cache security consolidation](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257) | Open; listed pending in #277 snapshot | Do not merge without exact-head checks, finding reconciliation and independent approval |

### Merge governance

Issue #230 records that `main` is not protected and has zero active rulesets. The repository is user-owned; the owner account has no organization memberships, and the direct collaborator listing showed only the owner. A trusted, distinct direct collaborator with write permission is required before ordinary pull requests can enforce a non-author approval. Do not substitute an alternate owner identity, a bot, an automated reviewer or maintainer self-review for independent approval.

Mainline-only signed SBOM/lockfile attestation is a post-merge gate, not a PR-required check. PR-required CI must cover supported Node versions, live PostgreSQL/Memgraph/Redis integration, browser/accessibility checks, CodeQL and candidate evidence consolidation. Even a green candidate PR cannot be merged until the repository's review-policy prerequisite is satisfied.

## 6. Current F1.60 development candidate — issue #233

This work is separate from the exact-main F1.59 evidence and must not be counted in the mainline readiness score before it is reviewed, merged and revalidated.

### Scope

Issue #233 asks that the validated PostgreSQL outbox envelope remain the authority for identity at every durable delivery handler. The only active `createOutboxDeliveryWorker` registration on F1.59 main is the graph projection worker, already protected by F1.59. The generic handler boundary is being hardened to prevent future consumers from treating raw row payload identity as a peer source of truth. This is a forward-compatibility/security-boundary improvement, not evidence of a second currently exploited vulnerability.

### Implementation in the isolated worktree

Candidate branch: `fix/outbox-delivery-envelope-identity-contract-2026-11-21`

The implementation:

- introduces a single declarative immutable event-definition registry for registered content, taxonomy and relationship event families;
- derives classification and identity-binding maps from that registry rather than maintaining duplicate event-family rules;
- binds content and taxonomy payload `id`, relationship payload `relationshipId`, and top-level payload `siteId` to canonical envelope identity;
- compares UUID values case-insensitively and provides a shallow-frozen payload copy normalized to the envelope values without mutating the original;
- leaves nested IDs and relationship `sourceId`/`targetId` opaque domain fields, and leaves internal/unregistered event payload semantics unchanged;
- preserves the durable handler shape `{ type, payload, envelope, delivery }`, with `type` and `payload` sourced from the validated envelope;
- reuses the same binding helper at the graph projector's direct-call boundary while retaining its existing graph-specific error codes;
- leaves SQL, schema, migrations, HTTP/API contracts, event schema, dependencies, lockfile, package version, at-least-once delivery, aggregate ordering, consumer-group leases, retry, dead-letter, replay and acknowledgement semantics unchanged.

The candidate includes focused unit regressions for the three event families, mixed-case UUID normalization, missing/mismatched site and aggregate identity, resource-family mismatch, immutability, endpoint/nested identifier preservation, internal messages, handler-side-effect suppression and graph defense in depth. The generated tenant-isolation inventory was refreshed from the changed source/test anchors at 28 route families, 80 patterns, 22 implementation source files and 59 test files; the inventory freshness and independent-review-boundary tests pass.

### Candidate verification status

| Verification | Result |
|---|---|
| Red/green focused test cycle | RED confirmed before implementation; then **29/29 passed** |
| Outbox contract tests | Included in 29/29 focused pass |
| Durable delivery worker tests | Included in 29/29 focused pass |
| Memgraph projector tests | Included in 29/29 focused pass |
| Graph projection worker tests | Included in 29/29 focused pass |
| New live PostgreSQL regression | PASS in hosted PR CI: subtest 24 executed in the live producer; part of **181/181 passed, 0 failed, 0 skipped** |
| Local PostgreSQL integration file | **9 skipped / 0 failures**, because the Windows worktree did not have the configured PostgreSQL integration environment/flag; the local skip is not a pass |
| Hosted PR validation | [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) remains open. Push [#44892418675](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44892418675) and PR [#44892475091](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44892475091) both completed successfully; the PR workflow completed 6/6 applicable jobs successfully, with the post-merge-only signed SBOM/lockfile attestation skipped by design |
| Hosted Node 22.23.4 / 24.22.1 | PASS — each runtime passed 683/683 Hub tests and 94/94 EnginEx tests; zero failures/skips in the unit/security test suites |
| Hosted PostgreSQL 18 / Memgraph | PASS — 181/181 integration tests, 18/18 fresh migrations and 18/18 idempotent second-pass skips |
| Browser / CodeQL / evidence consolidation | PASS — configured browser/accessibility smoke, CodeQL analysis and exact-source candidate evidence consolidation completed successfully |
| Candidate readiness / integration artifacts | PASS — final readiness artifact #14716825582; live integration artifact #14716138790; producer manifest SHA-256 `ef71a9165f2a7dd2745e7b7d572c51bafc699fdfb873ec03ba777a795baf41e3`; PR readiness is bound to synthetic merge SHA `600ec70a28e8c6f712e4828eef15f0084f07ce54` and records 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE |
| Full local `npm run check` | PASS — 683 tests total: 680 passed, 0 failed, 3 conditional Windows skips on Node.js 26.12.1; artifact verification passed 238 required paths and 270 JavaScript syntax checks |
| GitHub merge | Not authorized; issue #230 remains open |

The live PostgreSQL test inserts two isolated sites and a real outbox row whose canonical `site_id` conflicts with the JSON payload's duplicated `siteId`. It exercises the actual durable worker with a single-attempt policy and asserts the handler is never called and the delivery is dead-lettered with the expected scope-mismatch error. A local skip is not a pass; the hosted PostgreSQL job must execute this regression with zero skips.

See [Outbox Consumer Identity Boundary](../security/OUTBOX-CONSUMER-IDENTITY-BOUNDARY.md), [implementation plan](../superpowers/plans/2026-11-21-outbox-envelope-identity-contract.md), and [issue #233](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233).

## 7. Release boundary and SemVer

- The package remains `0.6.2`, private and unreleased.
- No SemVer increment is justified by this report or the F1.60 candidate.
- No release tag, GitHub Release, npm publication, production-data access or deployment is authorized.
- F1.60 is a candidate workstream. Its tests do not alter the source-bound F1.59 mainline readiness artifact.
- A future candidate must be re-run through the required PR CI, have a distinct non-author approval after merge governance is configured, and then receive exact-main checks and a newly consolidated evidence artifact.
- The fourteen missing evidence gates and human dependency/lockfile review must close before production certification can be reconsidered.

## 8. Recommended next actions

1. Complete candidate review and run the full local `npm run check`, `git diff --check`, source-anchored tenant-inventory freshness and Markdown link validation; resolve any unintended postinstall/submodule changes before staging.
2. Run the PostgreSQL integration regression on a configured PostgreSQL 18 environment and confirm it fails closed before handler side effects. Keep aggregate ordering, consumer-group isolation, retry, dead-letter and replay tests green.
3. Push F1.60 as a PR linked to issue #233. Require Node 22/24, live PostgreSQL/Memgraph/Redis, browser/accessibility, CodeQL and evidence consolidation. Do not claim live evidence from a skipped local test.
4. Resolve issue #230 by adding a trusted distinct collaborator and enforcing required non-author approval plus applicable CI contexts. Do not bypass the policy.
5. Obtain independent reviews #14 and #25, complete human dependency/license review #23, reconcile issues #234/#235 and review each Aikido autofix PR individually through #277.
6. Close all fourteen missing production evidence gates with exact-revision evidence, then produce a new source-bound release readiness artifact and receive explicit release-owner approval.

---

## 9. Evidence integrity and limitations

This report is grounded in canonical GitHub Actions readiness artifact `14666785760`, exact-source workflow #44809875826 and its PostgreSQL/Memgraph evidence manifest. The readiness JSON SHA-256 is recorded at the top. Its source revision is `70e800ad33a6d376388576ce76a608f35c595b64`; the PostgreSQL/Memgraph producer manifest is tied to that same revision.

The F1.60 candidate is isolated on its own branch/worktree and is deliberately excluded from the exact-main F1.59 readiness artifact. For final PR head `f32936e6943397c6573bccfc7512c7d3e1f1f81e`, push workflow [#44927650089](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44927650089) and PR workflow [#44927654855](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44927654855) both completed successfully; the latter validated synthetic merge revision `600ec70a28e8c6f712e4828eef15f0084f07ce54`. Candidate readiness artifact #14716825582 is source-bound to that synthetic merge SHA; `release-readiness.json` SHA-256 is `0b898f6286a41faf6288edd2118342904816b67647b768bb9e8ad76f551347bf`. Live PostgreSQL/Memgraph artifact #14716138790 reports 181/181 passed, 0 failures and 0 skips; producer manifest SHA-256 is `ef71a9165f2a7dd2745e7b7d572c51bafc699fdfb873ec03ba777a795baf41e3`. The PostgreSQL identity regression executed successfully as subtest 24. The Windows local integration skip is separately reported and was not counted as a pass. No independent security or tenant-isolation review was conducted as part of this development session.

**Final release decision: NO-GO.** Maintain 0.6.2 as a private developer-preview candidate. Do not publish, tag, deploy or represent it as production-certified.

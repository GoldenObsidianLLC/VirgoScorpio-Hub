# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Assessment snapshot:** 18 November 2026 America/Chicago / 19 November 2026 UTC (post F1.54 merge and exact-main workflow #779)
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
**Current repository main HEAD:** `c247e1cb1daa5683c3a74aa6856e9718d92b4557` (F1.54 / PR #213 merged 18 November 2026 America/Chicago)
**Latest merged runtime source / readiness baseline:** `c247e1cb1daa5683c3a74aa6856e9718d92b4557` (F1.54 / PR #213; issue #212 CLOSED)
**Latest runtime merge:** F1.54 / [PR #213 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/213), implementation commit `a2198c4b0cf3ead80bd47718db7b68e666642e3d`, merge SHA `c247e1cb1daa5683c3a74aa6856e9718d92b4557`; issue #212 CLOSED
**Latest current-main CI:** [workflow #44467525998 / run #779](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44467525998) — SUCCESS, 7/7 jobs, exact-source main SHA `c247e1cb1daa5683c3a74aa6856e9718d92b4557`
**Latest exact-main runtime/readiness CI:** workflow #779 / run 44467525998; Node 22/24 each 670/670 Hub and 94/94 EnginEx; live PostgreSQL/Memgraph 153/153 zero skips; 18 fresh and 18 idempotent migrations; browser smoke 9/9; CodeQL; signed mainline attestations; evidence consolidation
**Latest consolidated readiness artifact:** `14502244347`, archive SHA-256 `a86a098067351d02d489ce14d835c85f0c28e320a305afbb0a27337cdb3a2b86`; readiness JSON SHA-256 `e5d50ccf175bb70c373b7455750958ceb2fd287ac34fe946719008d51acdda3`
**Decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**

> This report distinguishes maintainer engineering work and exact-source CI evidence from independent, provider, product, legal, governance, and operational acceptance. Passing CI, database regressions, CodeQL, or signed attestations do not constitute independent security approval or production authorization.

## 1. Executive decision

VirgoScorpio Hub `0.6.2` remains a **private, unreleased expanded developer-preview candidate**. The authoritative current-main readiness artifact records:

| Readiness classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction=false`; release classification is `NOT_PRODUCTION_CERTIFIED`; production certification is **NO**.

No SemVer increment, release tag, GitHub Release, npm publication, production deployment, assessor engagement, spending, risk acceptance, or claim of production certification is authorized. The developer-preview recommendation remains isolated and non-production, pending a named authorized release-owner decision under issue #13.

## 2. Current mainline and exact-source engineering evidence

Repository main is `c247e1cb1daa5683c3a74aa6856e9718d92b4557` after F1.54 / PR #213 merged; issue #212 is CLOSED. Implementation commit and validated PR head: `a2198c4b0cf3ead80bd47718db7b68e666642e3d`; base main before merge: `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1`. Candidate push/PR workflows #777/#778 passed their six applicable functional jobs. Exact-main [workflow #44467525998 / run #779](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44467525998) completed all seven jobs successfully on the exact merge SHA.

| Workflow #779 producer | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; zero failures/skips; npm audit scopes report zero vulnerabilities. |
| Node.js 24.22.1 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; zero failures/skips; npm audit scopes report zero vulnerabilities. |
| PostgreSQL / Memgraph integration | PASS | 153/153 live integration tests; zero failures, skips or TODOs. |
| Fresh migrations | PASS | All 18 migrations applied to a disposable fresh PostgreSQL database. |
| Idempotent migrations | PASS | Second pass verified all 18 migrations as already applied. |
| Browser editor/accessibility smoke | PASS | Playwright smoke 9/9; this is not full manual WCAG or assistive-technology acceptance. |
| CodeQL | PASS | Static analysis completed; this is not an independent application-security review. |
| Signed supply-chain attestations | PASS | Mainline SLSA provenance and CycloneDX 1.5 SBOM were created and verified against package-lock.json and the generated SBOM; 200 components / 201 dependency records. |
| Exact-source evidence consolidation | PASS | Run/attempt identities, producer manifests, checksums, live database results, migrations and final readiness JSON/Markdown were validated. |

The exact-source readiness artifact **14502244347** is bound to main `c247e1cb1daa5683c3a74aa6856e9718d92b4557`. Archive SHA-256: `a86a098067351d02d489ce14d835c85f0c28e320a305afbb0a27337cdb3a2b86`; finalized readiness JSON SHA-256: `e5d50ccf175bb70c373b7455750958ceb2fd287ac34fe946719008d51acdda3`. It reports CI EVIDENCE: PASS; FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED; PRODUCTION CERTIFICATION: NO; **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; `readyForProduction=false`.

The two PARTIAL rows are the qualified human dependency/license review and the service-less integration diagnostic (47 tests, 1 pass / 46 skipped in each runtime). These skipped cases are not live integration results; the separate live PostgreSQL/Memgraph producer passed 153/153 with zero skips. The 14 missing production gates and independent-review boundary remain unchanged from the preceding snapshot.

The source-bound lockfile SHA-256 is `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`. CycloneDX 1.5 SBOM SHA-256 is `bf85ecc52573f2ded781c385801b8f669f38401b451053babf9bdd78b77848eb` (200 components / 201 dependency records); the signed verification summary confirms package-lock.json and the generated SBOM as attestation subjects.

The tenant-isolation navigation inventory remains 28 route/flow families, 80 declared route patterns, 21 implementation source files and 57 referenced test files. F1.54 adds no new route family or route pattern. This maintainer-authored navigation and drift-detection evidence does not prove exhaustive route discovery or satisfy independent review #14.

## 3. Production evidence matrix — 14 missing gates

The 14 MISSING_EVIDENCE categories remain open. Their absence is not a failure of the current CI jobs; they are separate acceptance obligations.

| # | Gate | Tracking / accountable role | Required evidence to close |
|---:|---|---|---|
| 1 | Tenant isolation and authorization review | Issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14); independent assessor and security owner | Independent route discovery and adversarial review of tenant boundaries, capabilities, recipient lifecycle, workers, storage, events, caches, and realtime delivery against a clean exact-SHA checkout. Only the independent reviewer may provide the formal evidence. |
| 2 | Identity provider E2E and recovery | Issue #15; identity/SSO owner | Live isolated OIDC/SAML/email provider tests, issuer/audience/redirect/key rotation, MFA recovery, session lifecycle, and provider outage behavior. |
| 3 | Malware scanner corpus and legacy clearance | Issue #16; file-security/media owner | Live ClamAV daemon/version, safe and malicious corpus, timeout/unavailable behavior, quarantine procedure, and accepted disposition of legacy `not_scanned` assets. |
| 4 | Live cloud-storage providers | Issue #17; cloud-storage owner | Provider-specific credentials/workload identity, least-privilege CRUD, multipart, encryption, retention, lifecycle, recovery, and tenant-isolation evidence for every provider claimed. |
| 5 | Stripe live lifecycle | Issue #18; payments/billing owner | Dedicated Stripe test-mode lifecycle: checkout, webhooks, duplicate/out-of-order events, reservations, refunds, subscription transitions, and recovery. Stubs and loopback protocol tests do not satisfy this gate. |
| 6 | Manual browser/accessibility acceptance | Issue #19; QA/accessibility owner | Approved browser/OS/assistive-technology matrix, manual keyboard/focus/screen-reader and WCAG review, responsive/reflow checks, and retained findings. Automated 9/9 smoke is only smoke evidence. |
| 7 | Commerce parity acceptance | Issue #20; product owner and commerce feature owner | Explicit product scope and accepted synthetic scenarios for checkout, taxes/shipping, coupons, fulfilment, refunds, downloads, billing and membership entitlements. No parity claim before acceptance. |
| 8 | Community parity acceptance | Issue #21; product owner and community feature owner | Accepted scenario matrix for privacy, group membership, profiles/feed, moderation, abuse/appeal, search, export/deletion, and supported browser flows. Maintainer regressions are not product acceptance. |
| 9 | Plugin container isolation | Issue #22; plugin security/runtime owner | Signed build and provenance chain plus adversarial runtime isolation: denied egress, filesystem, secret, capability, CPU/memory/PID/time/output, and host-boundary controls. Plugin execution remains disabled by default. |
| 10 | Human dependency/SBOM/CodeQL review | Issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23); qualified supply-chain reviewer | Human lockfile/dependency and license-distribution review, including LGPL/GPL obligations, retained SBOM/provenance subject/digest verification, and a qualified CodeQL disposition. CI audit and signatures are inputs, not legal clearance. |
| 11 | Load, fault, backup and restore | Issue [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24); database/platform operations and SRE/DR owners | Approved topology/workload, load/soak/fault tests, PostgreSQL/graph/object backups, restore integrity, rollback rehearsal, and measured RPO/RTO. Do not invent service objectives. |
| 12 | Independent platform security assessment | Issue [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25); independent assessor and security owner | Separate platform-wide assessment, severity-ranked findings, authorized risk dispositions, and independent retesting. CodeQL and maintainer testing do not satisfy this gate. |
| 13 | Operations and release approval | Issue [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26); named operations/release owners | Named accountable owners, approved topology, runbooks, deploy/migrate/rollback/secret-rotation/incident rehearsals, recovery evidence, and explicit release-owner approval. |
| 14 | Production observability | Production observability owner; coordinated with issues #26 and #32 | Approved production telemetry backend, ownership, data classification/residency, retention/deletion, access control, alerting, capacity, and outage/recovery evidence. Local OTLP fixtures are not production observability. |

Related release controls remain separate from the 14 evidence rows: the authorized 0.6.2 scope/provider decision under issue [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) is pending; zero-reserve governance and authority under issue [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) remain open; and no paid assessor engagement or spending may be inferred or authorized by engineering activity.

## 4. Developer-preview boundary and default posture

The technical recommendation remains an isolated, self-hosted, non-production developer preview using synthetic or non-sensitive test data. The recommended default posture remains:

- PostgreSQL is the authoritative transactional store; Memgraph is an optional rebuildable projection; Redis Pub/Sub is ephemeral and cannot replace database-backed authorization or recovery.
- Media and library storage remain local. Remote object-storage adapters are not provider certification.
- AI remains mock-only; external content/provider use is disabled; prompt logging remains disabled.
- Email delivery is disabled; OIDC/SAML are unconfigured; local identity only.
- Realtime/Memgraph and plugin execution remain disabled by default; Stripe credentials remain unset; ClamAV is not configured.
- Do not use production secrets or customer data, claim a managed/hosted service, or imply full WooCommerce/BuddyPress/Elementor parity.
- Unscanned uploads must remain quarantined/non-public. Do not accept untrusted uploads without the required scanner controls and accepted scanner evidence.

The scope recommendation is recorded in [RELEASE-SCOPE.md](../RELEASE-SCOPE.md), but named authorized release-owner approval is still pending under issue #13. Excluded preview features remain production evidence obligations; exclusions are not passes or waivers.

## 5. Independent assurance, governance, and release boundary

- Independent tenant/site review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): **OPEN / NOT PERFORMED**.
- Independent platform security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): **OPEN / NOT PERFORMED**.
- Qualified dependency/license review [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23): **OPEN / PARTIAL**.
- Authorized product/release scope [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13), load/restore [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24), operations ownership [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26), and governance/authority [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32): **OPEN**.

The exact-main CI and maintainer-authored regressions are not independent review, legal approval, provider qualification, risk acceptance, or production authorization. No SemVer increment is warranted by the F1.51/F1.52 merged work or the F1.53 unmerged candidate described here. Package 0.6.2 remains private and unreleased.

## 6. F1.52 merged maintainer increment — [PR #208 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/208); issue #207 CLOSED

F1.52 closes the requester-lifecycle regression in `PUT /api/v1/sites/{siteId}/community/friends/{requesterId}`. The existing friendship-acceptance UPDATE now revalidates that the pending requester still has an active user account and same-site membership at transition time. It adds one `EXISTS` predicate joining `site_memberships` and `users`; the existing generic non-disclosing 404 `ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND`, route, HTTP method, and response contract remain unchanged.

The two-site PostgreSQL fixture verifies successful active same-site acceptance, requester disablement after request creation, the generic 404 with no requester identity disclosure, and unchanged Site A/Site B community snapshots after denial. The pre-fix disposable PostgreSQL run reproduced HTTP 200 for the now-disabled requester; the fixed focused live integration passed 10/10 with zero skips.

Local validation on Windows / Node.js 26.12.1:
- `npm run check`: 670 tests, 667 passed, 0 failed, 3 Windows-specific skips; artifact verification 238 required paths / 268 JavaScript files.
- Focused live PostgreSQL 18 two-site community integration: 10/10 passed, 0 failures, 0 skips; all 18 migrations applied fresh and 18/18 idempotent repeat verified.
- Tenant inventory: 28 families / 80 declared route patterns / 21 source files / 57 test references.
- Changed source and integration test syntax checks passed; `git diff --check` passed.

PR #208 merged to main at `ccd454c0fa8bc49a91526756819af451c1a390d2`; implementation commit `99886cc4d8db22109bd036b80091fa4054387d93`, PR head `8230b9946d2edaf91039cdb878c2eb9e8d08d867`; issue #207 is CLOSED. Exact-head push #763 and PR #764 both passed all six applicable jobs; their 143/143 hosted PostgreSQL/Memgraph/Redis suites had zero skips. The mainline-only attestation job was skipped by design on candidate events. Exact-main workflow #44407304492 / run #765 then passed 7/7 jobs on the merge SHA; its 143/143 live database results, Node 22/24 tests, migrations, browser 9/9, CodeQL, signed attestations and evidence consolidation are detailed in Section 2.

PR #208 recorded zero formal review submissions and zero inline review threads. This merged work remains maintainer-led regression hardening, not independent security/legal approval. It does not complete reviews #14/#25 or any other release gate. No schema, migration, endpoint, response-contract, dependency, lockfile, package-version, or SemVer change was made.

## 7. F1.53 merged maintainer increment — [PR #211 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211); issue #210 CLOSED

F1.53 fixes a write-boundary time-of-check/time-of-use race in POST /api/v1/sites/{siteId}/community/friends/{userId}. The former route checked the target participant's active account and same-site membership in a preflight SELECT, then inserted the friendship separately; requester eligibility could also change between request authorization and persistence. The merged fix retains the early preflight and changes the final friendship write to a parameterized INSERT ... SELECT.

The write materializes and locks both participant user rows in deterministic UUID order, then all matching requested-site membership rows in deterministic user-ID / role-ID order. It requires both accounts to remain active and both same-site memberships to remain present. Membership EXISTS predicates prevent multiple role rows from multiplying the INSERT source. Existing blocked-state conflict behavior, generic non-disclosing 404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND, route, HTTP status and response shape remain unchanged. No helper/API, schema, migration, dependency, lockfile, package-version or SemVer change was introduced.

The regression fixture covers addressee/requester disablement after preflight/authorization, revocation of either participant's same-site membership, actual row-lock waits for concurrent disablement and membership deletion, multiple-role membership, blocked-state preservation, ID/display-name non-disclosure, and unchanged Site A/Site B snapshots. Focused local PostgreSQL integration passed 20/20 with zero failures/skips/TODOs. Local npm run check passed 667/670 with zero failures and three Windows-specific skips on Node.js 26.12.1; artifact verification passed 238 required paths / 268 JavaScript files; tenant inventory is current at 28 families / 80 route patterns / 21 source files / 57 test files.

Candidate branch security/f1-53-community-friendship-create-race-2026-11-18 contains runtime implementation commit 5ddae486ff39635f33b0594475626542643d18fb. Code-bearing candidate head 62b14371ca430f9d7723bf816924b74568060af8 passed exact-head workflows #771/#772; documentation-only follow-up head f4193675fc729cc5d1648a7054f2443ff4378f08 passed #773/#774, six applicable jobs each. PR #211 merged at main SHA e8913fa812304e80dc4c8846f7ea637a2fa4e4d1, closing issue #210. Exact-main workflow #776 passed 7/7 jobs on that SHA, including Node 22/24 (670/670 Hub and 94/94 EnginEx tests each), 153/153 live PostgreSQL/Memgraph tests, 18/18 fresh and idempotent migrations, browser smoke, CodeQL, signed mainline provenance/SBOM and exact-source evidence consolidation. Canonical readiness artifact #14493590005 is bound to the merge SHA and reports 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false.

GitHub records zero formal review submissions and zero inline review threads on PR #211. These CI and regression results are maintainer/automation evidence only. They do not satisfy independent tenant/site review #14 or broader platform security assessment #25; both remain OPEN / NOT PERFORMED. Package 0.6.2 remains private/unreleased and production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## 8. F1.54 merged maintainer increment — [PR #213 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/213); issue #212 CLOSED

F1.54 closes a reproduced write-boundary race in community group join. The pre-fix handler performed site authorization, read the group, and then issued a separate membership INSERT; revoking the actor's site membership between the authorization check and INSERT still persisted a group membership. The existing two-site PostgreSQL regression reproduced the failure against the original route.

The merged route uses one parameterized INSERT ... SELECT. Materialized CTEs lock the actor user row, all matching requested-site membership rows in deterministic user/role order, and then the requested site-scoped group row. The write requires the account to remain active and at least one same-site membership to remain present; it reads current group privacy while holding the group lock. The route still preserves active and banned conflict states, public-active/private-pending first-join behavior, the banned-member 403, the generic group-not-found 404, and the existing response shape. No helper, endpoint, schema, migration, dependency, lockfile, package-version, API contract or SemVer change was introduced.

Focused local PostgreSQL regressions cover membership revocation after authorization, account disablement after authorization, actual lock contention with a competing membership delete, active/pending/banned retries, public/private join status, cross-site denial and Site A/Site B snapshots. The focused suite passed 20/20 with zero skips. Local `npm run check` passed 667/670 with zero failures and three Windows-specific skips; artifact verification passed 238 paths / 268 JavaScript files; generated inventory is current at 28 families / 80 patterns / 21 source files / 57 test references.

Candidate push/PR workflows #777/#778 passed all six applicable functional jobs. PR #213 merged on 18 November 2026 America/Chicago at main SHA `c247e1cb1daa5683c3a74aa6856e9718d92b4557`, closing issue #212. Exact-main [workflow #44467525998 / run #779](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44467525998) completed all seven jobs successfully on that exact SHA: Node 22/24 each passed 670/670 Hub and 94/94 EnginEx tests; live PostgreSQL/Memgraph passed 153/153 with zero skips; 18 fresh and 18 idempotent migrations; browser smoke 9/9; CodeQL; signed provenance/SBOM; exact-source readiness consolidation. Readiness artifact #14502244347 is bound to the merge SHA (archive SHA-256 `a86a098067351d02d489ce14d835c85f0c28e320a305afbb0a27337cdb3a2b86`; readiness JSON SHA-256 `e5d50ccf175bb70c373b7455750958ceb2fd287ac34fe946719008d51acdda3`) and remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction=false`.

PR #213 has zero formal review submissions and zero inline review threads; all evidence is maintainer/automation evidence only. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; qualified dependency/license review #23 remains OPEN / PARTIAL. Package 0.6.2 remains private/unreleased; production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## 9. Release decision

**NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not publish, tag, deploy, or represent VirgoScorpio Hub 0.6.2 as production-ready. F1.54 / [PR #213](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/213) is the latest merged runtime increment at exact main SHA `c247e1cb1daa5683c3a74aa6856e9718d92b4557`; exact-main workflow #779 passed 7/7 jobs, and post-producer readiness artifact #14502244347 records 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE. PR #213 has zero formal review submissions or inline threads. All results are maintainer/automation evidence only. Independent assurance, dependency/license review, provider, product, operations, governance, and authorized release-owner obligations remain open; production remains NO-GO.

**NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not publish, tag, deploy, or represent VirgoScorpio Hub 0.6.2 as production-ready. F1.53 / [PR #211](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211) is the latest merged runtime increment at exact main SHA e8913fa812304e80dc4c8846f7ea637a2fa4e4d1; exact-main workflow #776 passed 7/7 jobs, and post-producer readiness artifact #14493590005 records 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE. PR #211 has zero formal review submissions or inline threads. All results are maintainer/automation evidence only. Independent assurance, dependency/license review, provider, product, operations, governance, and authorized release-owner obligations remain open; production remains NO-GO.

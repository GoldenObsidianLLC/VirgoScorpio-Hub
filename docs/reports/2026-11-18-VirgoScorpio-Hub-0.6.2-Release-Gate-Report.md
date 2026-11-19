# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Assessment snapshot:** 18 November 2026 UTC / 18 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
**Current repository main HEAD:** `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1` (F1.53 / PR #211 merged 18 November 2026 America/Chicago)
**Latest merged runtime source / readiness baseline:** `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1` (F1.53 / PR #211; issue #210 CLOSED)
**Latest runtime merge:** F1.53 / [PR #211 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211), implementation commit `5ddae486ff39635f33b0594475626542643d18fb`, merge SHA `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1`; issue #210 CLOSED
**Latest current-main CI:** [workflow #44445082339 / run #776](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44445082339) — SUCCESS, 7/7 jobs, exact-source main SHA `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1`
**Latest exact-main runtime/readiness CI:** workflow #776 / run 44445082339; Node 22/24 each 670/670 Hub and 94/94 EnginEx; live PostgreSQL/Memgraph 153/153 zero skips; 18 fresh and 18 idempotent migrations; browser smoke; CodeQL; signed mainline attestations; evidence consolidation
**Latest consolidated readiness artifact:** `14493590005`, archive SHA-256 `38a8d9b4c479cff4ac6145cbe31afd715e04f9c69c661762addd6bf2a90ed7b9`; readiness JSON SHA-256 `d9d0ed95c4fe60d50ccb4054d0c7b6d75aa67ea88e13bad1c8043e13633987a0`
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

Repository main is e8913fa812304e80dc4c8846f7ea637a2fa4e4d1 after F1.53 / PR #211 merged. Issue #210 is CLOSED. The implementation commit is 5ddae486ff39635f33b0594475626542643d18fb; the code-bearing candidate head validated by workflows #771/#772 was 62b14371ca430f9d7723bf816924b74568060af8. Documentation-only follow-up workflows #773/#774 passed on PR head f4193675fc729cc5d1648a7054f2443ff4378f08.

Exact-main [workflow #44445082339 / run #776](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44445082339) completed all seven required jobs successfully on the exact merge SHA:

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; npm audit scopes reported zero vulnerabilities. |
| Node.js 24.22.1 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; npm audit scopes reported zero vulnerabilities. |
| PostgreSQL / Memgraph | PASS | 153/153 live integration tests; zero failures, skips, or TODOs. |
| Fresh migrations | PASS | All 18 migrations applied to a disposable fresh PostgreSQL database. |
| Idempotent migrations | PASS | Second pass verified all 18 migrations as already applied. |
| Browser editor/accessibility smoke | PASS | Hosted browser smoke completed successfully; this is not full manual WCAG or assistive-technology acceptance. |
| CodeQL | PASS | Static analysis completed; this is not an independent application-security review. |
| Signed supply-chain attestations | PASS | Mainline SLSA provenance and CycloneDX SBOM were created and verified against the lockfile and generated SBOM subjects. |
| Evidence consolidation | PASS | Exact-source producer evidence and checksums validated; CI evidence is PASS. |

The exact-source readiness artifact 14493590005 is bound to main e8913fa812304e80dc4c8846f7ea637a2fa4e4d1. Its archive SHA-256 is 38a8d9b4c479cff4ac6145cbe31afd715e04f9c69c661762addd6bf2a90ed7b9; final readiness JSON SHA-256 is d9d0ed95c4fe60d50ccb4054d0c7b6d75aa67ea88e13bad1c8043e13633987a0. It reports CI EVIDENCE: PASS; FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED; PRODUCTION CERTIFICATION: NO; **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; readyForProduction=false.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Consolidated readiness / CI evidence | 14493590005 | 38a8d9b4c479cff4ac6145cbe31afd715e04f9c69c661762addd6bf2a90ed7b9 |
| Node.js 22.23.4 CI evidence | 14492758685 | e06e4d3cf97fa402e0d67f6d77e8b971bdfa71279562dceccaa784822d49f221 |
| Node.js 24.22.1 CI evidence | 14492004699 | 0dab246990a47573d1d4c2a9f558bf95b0966e48c456fb319e778296b03e8d77 |
| PostgreSQL/Memgraph integration CI evidence | 14492579021 | 9786d3d23e092512d29fe49346004c6e6199a0585828ac324aa01c85d49e9c4c |
| Live PostgreSQL/Memgraph integration producer | 14493420448 | 658319f1ea631f1628535325f047dd129a0d6d334516a39843959a370099411b |
| Browser editor/accessibility smoke | 14492643732 | 27713cea8484fe6eeaf2250c71ebb5f7d85e96692da7d725c20e3ee1364cfd00 |
| CodeQL static analysis | 14492368071 | 876cdd04f5c3ce78c82a1c81a53247195abc7cc74d3d6a786796f5be2ed4b058 |
| Signed supply-chain evidence | 14492644016 | 9eb838845b9543918e724b6e9d016eabf4cec731586ef6a1ff2c37c06e9fd71d |
| Node.js 22.23.4 dependency evidence | 14492269418 | 364f7ace15e7107d4cca12bf4bddf4a35bc7047daf956a910604887328342497 |
| Node.js 24.22.1 dependency evidence | 14492079686 | f942a3dba0affceb2e0c46349821730641b0dccd0883c413bce8d5bb5f50c783 |

The source-bound lockfile SHA-256 is 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086. CycloneDX 1.5 SBOM SHA-256 is f19ed6da7d2f19bffb012aba566bb13eb0d75f1537cf3500262f3829cc12aac8 (200 components / 201 dependency records). The signed verification summary confirms package-lock.json and the SBOM are the verified attestation subjects.

The tenant-isolation navigation inventory remains 28 route/flow families, 80 declared route patterns, 21 implementation source files and 57 referenced test files. F1.53 adds no new route family or route pattern. This maintainer-authored navigation and drift-detection evidence does not prove exhaustive route discovery or satisfy independent review #14.

### 2.1 Interpretation of the two PARTIAL classifications

The two PARTIAL rows are (1) incomplete qualified human dependency, lockfile and license review, and (2) the service-less integration diagnostic. Skipped service-less cases are not live integration passes. They remain distinct from workflow #776's separate 153/153 live PostgreSQL/Memgraph result with zero skips. Do not promote either PARTIAL item based on successful CI, live producer, or automated attestations.

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

F1.54 / issue #212 is a separate local maintainer candidate addressing a reproduced community group-join membership race. It is not merged, has no hosted candidate workflow result yet, and is not included in the canonical mainline readiness assessment.

## 8. Release decision

**NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not publish, tag, deploy, or represent VirgoScorpio Hub 0.6.2 as production-ready. F1.53 / [PR #211](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211) is the latest merged runtime increment at exact main SHA e8913fa812304e80dc4c8846f7ea637a2fa4e4d1; exact-main workflow #776 passed 7/7 jobs, and post-producer readiness artifact #14493590005 records 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE. PR #211 has zero formal review submissions or inline threads. All results are maintainer/automation evidence only. Independent assurance, dependency/license review, provider, product, operations, governance, and authorized release-owner obligations remain open; production remains NO-GO.

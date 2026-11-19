# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Assessment snapshot:** 18 November 2026 UTC / 18 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
**Current repository main HEAD:** `c07c10763f0660c3d0d60b755de0429211f75b14` (documentation-only PR #209 merged)
**Latest merged runtime source / readiness baseline:** `ccd454c0fa8bc49a91526756819af451c1a390d2` (F1.52 runtime PR #208 merged)
**Latest runtime merge:** F1.52 / [PR #208](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/208), implementation commit `99886cc4d8db22109bd036b80091fa4054387d93`, PR head `8230b9946d2edaf91039cdb878c2eb9e8d08d867`, merge SHA `ccd454c0fa8bc49a91526756819af451c1a390d2`; issue #207 CLOSED
**Latest current-main CI:** [workflow #44421404827 / run #768](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44421404827) — SUCCESS, 7/7 jobs, bound to documentation-only main HEAD `c07c10763f0660c3d0d60b755de0429211f75b14`
**Latest exact-main runtime/readiness CI:** [workflow #44407304492 / run #765](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44407304492) — SUCCESS, 7/7 jobs, bound to F1.52 runtime source `ccd454c0fa8bc49a91526756819af451c1a390d2`
**Latest consolidated readiness artifact:** `14476181217`, archive SHA-256 `36aadc37cea1c9684f9572d7ad9574d80e904a6ab782d4d4bf3644786779c3ae`; readiness JSON SHA-256 `733972ee378321ebb34072b0789ca76a49c5951680cf863f9e5ddd90d79ffa22`
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

Repository `main` is currently `c07c10763f0660c3d0d60b755de0429211f75b14` after documentation-only PR #209. Current-main workflow #768 passed all 7/7 jobs on that exact docs-only HEAD. The source-bound readiness artifact and detailed runtime qualification below remain bound to the latest merged runtime source, F1.52 SHA `ccd454c0fa8bc49a91526756819af451c1a390d2`; the documentation-only run does not replace or rebind that artifact.

F1.52 is the latest merged runtime increment. It closes a requester-lifecycle gap in the friendship acceptance route: the existing UPDATE now revalidates that the pending requester still has an active user account and membership in the same site at transition time. The existing generic non-disclosing 404 remains unchanged. Runtime PR #208 merged at `ccd454c0fa8bc49a91526756819af451c1a390d2` (implementation commit `99886cc4d8db22109bd036b80091fa4054387d93`; PR head `8230b9946d2edaf91039cdb878c2eb9e8d08d867`); issue #207 is CLOSED. No endpoint, response contract, schema, migration, dependency, lockfile or package-version change was made.

Exact-main workflow [#44407304492](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44407304492) / run #765 completed all seven required jobs successfully on the exact current main SHA:

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; npm audit scopes reported zero vulnerabilities. |
| Node.js 24.22.1 | PASS | 670/670 Hub tests and 94/94 EnginEx 7.0.0 tests; npm audit scopes reported zero vulnerabilities. |
| PostgreSQL / Memgraph / Redis | PASS | 143/143 live integration tests; zero failures, skips, or TODOs. |
| Fresh migrations | PASS | All 18 migrations applied to a disposable fresh PostgreSQL database. |
| Idempotent migrations | PASS | Second pass verified all 18 migrations as already applied. |
| Browser editor/accessibility smoke | PASS | 9/9 Playwright smoke tests; this is not full manual WCAG or assistive-technology acceptance. |
| CodeQL | PASS | Static analysis completed; this is not an independent application-security review. |
| Signed supply-chain attestations | PASS | Mainline SLSA provenance and CycloneDX SBOM were created and verified. |
| Evidence consolidation | PASS | Exact-source producer evidence and checksums validated; CI evidence is PASS. |

The exact-source readiness artifact `14476181217` is bound to main `ccd454c0fa8bc49a91526756819af451c1a390d2`. Its archive SHA-256 is `36aadc37cea1c9684f9572d7ad9574d80e904a6ab782d4d4bf3644786779c3ae`; final readiness JSON SHA-256 is `733972ee378321ebb34072b0789ca76a49c5951680cf863f9e5ddd90d79ffa22`. Related retained workflow artifacts are:

| Evidence | Artifact ID | SHA-256 |
|---|---:|---|
| Consolidated readiness | 14476181217 | `36aadc37cea1c9684f9572d7ad9574d80e904a6ab782d4d4bf3644786779c3ae` |
| Live PostgreSQL/Memgraph/Redis integration | 14475826269 | `8eb01d834906ad02199cd994d7fe61ba8d034fc2ed304556ee322f47564e55ac` |
| Database CI evidence | 14475941150 | `3f456a9828134eec8bd8e22b94fca1eaf4505113c2baa297dc258ad3c568e852` |
| Signed supply-chain evidence | 14476260899 | `7585a18b5d962a6c04a89f5b55b33615797a883bebf644187bf8e72efaf7ee8b` |

The tenant-isolation navigation inventory at the F1.52 baseline contains 28 route/flow families, 80 declared route patterns, 21 implementation source files, and 57 referenced test files. F1.52 adds no new route family or route pattern. This maintainer-authored navigation and drift-detection evidence does not prove exhaustive route discovery or satisfy independent review #14.

### 2.1 Interpretation of the two PARTIAL classifications

The two PARTIAL rows are (1) incomplete qualified human dependency, lockfile, and license review, and (2) the service-less integration diagnostic. Skipped service-less cases are not live integration passes. They remain distinct from exact-main workflow #765's separate 143/143 live PostgreSQL/Memgraph/Redis result with zero skips. Do not promote either PARTIAL item based on the successful live producer or automated checks.

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

## 7. F1.53 current maintainer candidate — [PR #211 OPEN](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211); issue #210 OPEN

F1.53 addresses a write-boundary time-of-check/time-of-use race in `POST /api/v1/sites/{siteId}/community/friends/{userId}`. The former route checked the addressee's active account and same-site membership in a preflight SELECT, then inserted the friendship separately; requester eligibility could also change between request authorization and persistence. The candidate retains the early preflight and changes only the final friendship write to a parameterized `INSERT ... SELECT`.

The write materializes and locks both participant user rows in deterministic UUID order, then materializes and locks all matching requested-site membership rows in deterministic user-ID / role-ID order. It requires both accounts to remain active and both same-site memberships to remain present. Membership `EXISTS` predicates prevent multiple role rows from multiplying the insert source. The existing blocked-state conflict behavior, generic non-disclosing `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND`, route, HTTP status and response shape remain unchanged. No helper/API, schema, migration, dependency, lockfile, package-version or SemVer change is introduced.

The regression fixture covers addressee/requester disablement after preflight/authorization, revocation of either participant's same-site membership, actual row-lock waits for concurrent disablement and membership deletion, multiple-role membership, blocked-state preservation, ID/display-name non-disclosure, and unchanged Site A/Site B snapshots. Local focused PostgreSQL integration passed **20/20** with zero failures/skips/TODOs. Local `npm run check` passed **667/670** with zero failures and three Windows-specific skips (Node.js 26.12.1 with a 4 GiB V8 heap); artifact verification passed **238 required paths / 268 JavaScript files**; the tenant inventory is current at **28 families / 80 route patterns / 21 source files / 57 test files**; the updated Markdown link audit checked **241 relative links across all 9 Markdown files in the PR diff with zero broken links**; and `git diff --check` passed. All 18 migrations were already applied in the disposable local database; no fresh-migration claim is made.

Candidate branch `security/f1-53-community-friendship-create-race-2026-11-18` contains runtime implementation commit `5ddae486ff39635f33b0594475626542643d18fb`; current PR head is `62b14371ca430f9d7723bf816924b74568060af8`. Exact-head push workflow [#44434648866 / run #771](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44434648866) and PR workflow [#44434656869 / run #772](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44434656869) both completed successfully. In each run, all six applicable candidate jobs passed: Node.js 22.23.4, Node.js 24.22.1, PostgreSQL/Memgraph integration, browser editor/accessibility smoke, CodeQL, and candidate evidence consolidation. The mainline-only dependency/SBOM attestation job was skipped by design for candidate events; no candidate attestation or exact-main readiness result is claimed. The current mainline readiness artifact remains the F1.52 source-bound record described above until F1.53 is merged and independently revalidated on main.

GitHub records **zero formal review submissions and zero inline review threads** on PR #211. These CI and regression results are maintainer/automation evidence only. They do not satisfy independent tenant/site review #14 or broader platform security assessment #25; both remain OPEN / NOT PERFORMED. Issue #210 remains OPEN until the PR is merged. F1.53 is not yet merged or included in canonical release readiness. Package 0.6.2 remains private/unreleased and production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

## 8. Release decision

**NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not publish, tag, deploy, or represent VirgoScorpio Hub 0.6.2 as production-ready. F1.52 / [PR #208](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/208) remains the latest merged runtime increment; exact-main workflow #765 passed 7/7 jobs on its runtime merge SHA, and current-main docs-only workflow #768 passed 7/7 jobs on `c07c10763f0660c3d0d60b755de0429211f75b14`. F1.53 / [PR #211](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211) has passing exact-head candidate workflows #771/#772 but remains unmerged, with zero formal review submissions or inline threads. All are maintainer/automation evidence only. Independent assurance, dependency/license review, provider, product, operations, governance, and authorized release-owner obligations remain open; production remains NO-GO.

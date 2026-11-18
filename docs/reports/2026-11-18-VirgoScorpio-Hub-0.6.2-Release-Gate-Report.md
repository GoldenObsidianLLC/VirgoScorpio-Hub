# VirgoScorpio Hub 0.6.2 — Full Release-Gate Repor

**Assessment snapshot:** 18 November 2026 UTC / 18 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
**Current mainline source:** `584831648b7e96d00ccec77bb4565d4bfb4730a6` (documentation reconciliation PR #206)
**Latest runtime merge:** F1.51 / [PR #205](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/205), implementation commit `b91c972d22c366c37d8d49d223ba399442fb073f`, merge SHA `a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a`; issue #204 CLOSED
**Latest exact-main CI:** [workflow #44361023104 / run #762](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44361023104) — SUCCESS, 7/7 jobs, bound to current main `584831648b7e96d00ccec77bb4565d4bfb4730a6`
**Latest consolidated readiness artifact:** `14456350424`, SHA-256 `64a9805f9b70f16d5f55eb8f77d5ff621db9ba59cb991ccab31ad34bb65296ed`
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

F1.51 remains the latest merged runtime increment. It corrected a reproducible private-group join retry regression: an existing active group member was downgraded to pending. The existing upsert now preserves stored active and banned states while retaining requested-status behavior for other states. Runtime PR #205 merged at `a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a`; documentation-only PR #206 reconciled the reports and release documents and merged at current main `584831648b7e96d00ccec77bb4565d4bfb4730a6`.

Exact-main workflow [#44361023104](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44361023104) / run #762 completed all seven required jobs successfully on the exact current main SHA:

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

The exact-source readiness artifact `14456350424` is bound to main `584831648b7e96d00ccec77bb4565d4bfb4730a6`. Related retained workflow artifacts are:

| Evidence | Artifact ID | SHA-256 |
|---|---:|---|
| Consolidated readiness | 14456350424 | `64a9805f9b70f16d5f55eb8f77d5ff621db9ba59cb991ccab31ad34bb65296ed` |
| Live PostgreSQL/Memgraph/Redis integration | 14454905774 | `137e1967340fe6aca1cb37849cc108ef1609aff836daeb7a0fb47cfe4e49fda5` |
| Database CI evidence | 14456640215 | `fefd1b94ed4fece7c8459e615cad7ee69d0ab40a9fee8489621360ecf4deea86` |
| Signed supply-chain evidence | 14455045762 | `3388745fb6b40e023be846cd1e310042787be1c6f1d1be481d43f14c8a26e02c` |

The tenant-isolation navigation inventory at the F1.51 baseline contains 28 route/flow families, 80 declared route patterns, 21 implementation source files, and 57 referenced test files. This is maintainer-authored navigation and drift-detection evidence; it does not prove exhaustive route discovery or satisfy independent review #14.

### 2.1 Interpretation of the two PARTIAL classifications

The two PARTIAL rows are (1) incomplete qualified human dependency, lockfile, and license review, and (2) the service-less integration diagnostic. Skipped service-less cases are not live integration passes. They remain distinct from workflow #762's separate 143/143 live PostgreSQL/Memgraph/Redis result with zero skips. Do not promote either PARTIAL item based on the successful live producer or automated checks.

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

The exact-main CI and maintainer-authored regressions are not independent review, legal approval, provider qualification, risk acceptance, or production authorization. No SemVer increment is warranted by the F1.51 or F1.52 work described here. Package 0.6.2 remains private and unreleased.

## 6. Current maintainer continuation — F1.52 candidate (not mainline)

Issue [#207](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/207) tracks a narrow community-friendship requester-lifecycle regression. The candidate branch `security/f1-52-friendship-acceptance-active-requester-2026-11-18` is based directly on current main `584831648b7e96d00ccec77bb4565d4bfb4730a6`.

The current friendship-acceptance `PUT /api/v1/sites/{siteId}/community/friends/{requesterId}` update previously required only a site-scoped pending friendship. Friendship creation checks that the recipient is active, but acceptance did not revalidate that the requester remained an active same-site member. The candidate adds one `EXISTS` predicate to the existing UPDATE, joining `site_memberships` and `users` and requiring the requester's account status to be `active`. The existing generic non-disclosing 404 `ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND` response, route, HTTP method, and response contract are preserved.

The existing two-site PostgreSQL fixture now verifies (a) successful acceptance of an active same-site request, (b) creation of a request while the requester is active followed by requester disablement before acceptance, (c) generic 404 with no requester ID/display-name disclosure, and (d) unchanged Site A and Site B community snapshots after the denied acceptance. A pre-fix disposable PostgreSQL run reproduced the defect: the disabled requester's acceptance returned HTTP 200 where the regression expects 404. After the SQL predicate was applied, the focused live integration passed 10/10 with zero skips.

Candidate local validation on Windows / Node.js 26.12.1:
- `npm run check`: 670 tests, 667 passed, 0 failed, 3 Windows-specific skips; artifact verification 238 required paths / 268 JavaScript files.
- Focused live PostgreSQL 18 two-site community integration: 10/10 passed, 0 failures, 0 skips; all 18 migrations applied fresh to the disposable database.
- Tenant inventory regeneration: 28 families / 80 declared route patterns / 21 source files / 57 test references.
- Changed source and integration test syntax checks passed; `git diff --check` passed before documentation reconciliation.
- Candidate hosted CI has not yet been run at this snapshot. Issue #207 is OPEN; the candidate is not merged or current mainline evidence.

This work is maintainer-led hardening only. It does not complete independent reviews #14/#25 or any release gate. No schema, migration, endpoint, response-contract, dependency, lockfile, package-version, or SemVer change is planned.

## 7. Release decision

**NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not publish, tag, deploy, or represent VirgoScorpio Hub 0.6.2 as production-ready. The next engineering step is to finish candidate documentation/inventory coherence, run exact-head hosted CI, and submit the bounded F1.52 pull request for review. Independent assurance, provider, product, operations, governance, and authorized release-owner obligations remain separate.

# F1.50 — Community friendship active-recipient isolation report

- **Date:** 18 November 2026 UTC / 18 November America/Chicago
- **Issue:** [#201](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/201) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Platform security-review gate:** [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-50-community-friendship-recipient-state-2026-11-18`
- **Baseline main SHA:** `1c9b9c8b23e5e3cffe8f8a67aca4f55cbb8d1623`
- **Implementation commit:** `a8f549d29da8d56a9fe8300b19bd23921ee97bba`
- **Merged main SHA:** `c6853c29e9ca71fc3fab472cbf95dfdcb5ac0741`
- **Pull request:** [#202](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/202) — MERGED
- **Issue:** [#201](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/201) — CLOSED
- **Status:** Merged and exact-main CI validated; maintainer-authored regression only. No formal review submissions or inline review threads were recorded.

> **Assurance boundary:** This is maintainer-authored route hardening and regression coverage. It is not an independent security assessment, risk acceptance, waiver, or production-certification evidence.

## Executive summary

F1.50 closes a reproduced recipient-eligibility gap in friendship creation:

`POST /api/v1/sites/{siteId}/community/friends/{userId}`.

The route previously treated any `site_memberships` row as sufficient recipient eligibility. Site membership rows can remain when the associated user account is `invited` or `disabled`; the community direct-message and block recipient paths already require the account to be active.

The disposable PostgreSQL regression reproduced this difference before the route change: both an invited and a disabled Site B account that retained Site B membership were accepted with **201 Created**. The route now requires an active user joined to the membership for the requested site. It preserves the existing generic, non-disclosing `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND` response for foreign-site and inactive recipients.

## Scope and implementation

Updated the existing two-site fixture in `test/integration/tenant-community-object-isolation.integration.test.js`. No new test framework, fixture helper, authorization abstraction, or endpoint was introduced.

The fixture now gives Site B membership rows to:
- an active actor and an active positive-control recipient;
- an invited recipient;
- a disabled recipient.

The regression proves:
- a foreign Site A recipient remains non-disclosing and rejected;
- invited and disabled recipients are rejected even though they deliberately retain Site B membership rows;
- the existing active same-site recipient path still creates exactly one pending friendship;
- before/after community snapshots for both sites remain unchanged across the denied inactive-recipient requests, including friendship state;
- the response does not disclose the inactive recipient ID or display name.

The runtime change is intentionally small: the friendship target lookup now joins `users` by ID, constrains the membership by the route `site_id`, and requires `users.status` to equal the bound `active` parameter. Existing route path, HTTP method, generic 404 code/message, active-recipient behavior, and site scope remain unchanged.

No database schema, migration, public API contract, dependency, lockfile or package-version change is included.

## Local validation

A newly created disposable PostgreSQL 18 container and isolated test database were used. All 18 migrations applied successfully to that fresh database.

| Check | Result | Qualification |
|---|---|---|
| Pre-fix regression reproduction | **FAIL as expected** | Both invited and disabled recipients returned 201, proving the prior eligibility gap. |
| Changed source syntax | PASS | `node --check apps/api/src/platform-routes.js`. |
| Changed integration-test syntax | PASS | `node --check test/integration/tenant-community-object-isolation.integration.test.js`. |
| Focused live PostgreSQL integration | **PASS — 9/9, 0 failures, 0 skips, 0 TODOs** | Existing two-site community object-isolation suite, including inactive-recipient denials and active same-site positive control. |
| Fresh migrations | PASS — 18/18 | Applied to the isolated PostgreSQL 18 database. |
| Tenant inventory generation | PASS | 28 route/flow families, 80 declared route patterns, 21 implementation source files, 57 referenced test files. |
| Inventory freshness check | PASS | `node scripts/generate-tenant-isolation-route-inventory.js --check` confirmed 28 families / 80 route patterns. |
| Full `npm run check` | PASS — 670 tests, 667 passed, 0 failed, 3 Windows-specific skips | Windows / Node.js 26.12.1; artifact verification passed 238 required paths and 268 JavaScript syntax checks. |
| Candidate exact-head workflows | PASS | Push #44255755533 and PR #44255883671 passed all six applicable jobs each; mainline-only signing job skipped by design on candidate runs. |
| Exact-main validation | PASS — 7/7 jobs | [Workflow #44256828598](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44256828598) on merge SHA; details below. |

The pre-fix failure is recorded as regression evidence, not a final test failure. The post-fix live test passes on the same disposable database and route/API setup.

## Inventory and documentation

The source-anchored `community-conversations-moderation-notifications` catalog family now includes the friendship route source anchor in `apps/api/src/platform-routes.js` and describes the active-recipient eligibility and two-site no-side-effect regression. The existing generator refreshed:

- `artifacts/security/tenant-isolation-route-inventory.json`
- `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`

The generated inventory currently records **28 route/flow families, 80 route patterns, 21 implementation source files and 57 referenced tests**.

The changelog, project/implementation roadmaps, maintainer assurance notes and assessor hand-off materials now record PR #202 merged at main `c6853c29e9ca71fc3fab472cbf95dfdcb5ac0741` and exact-main workflow #44256828598. Historical baselines remain historical. F1.50 is explicitly identified as maintainer-authored hardening, not independent review or production approval.

## Hosted exact-head and mainline validation

Candidate source `a8f549d29da8d56a9fe8300b19bd23921ee97bba` was validated by both push [workflow #44255755533](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44255755533) and pull-request [workflow #44255883671](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44255883671). All six applicable jobs passed in each run; the mainline-only signing/attestation job was skipped on candidate runs by design. The live PostgreSQL/Memgraph/Redis integration passed **142/142, 0 failed, 0 skipped** in each run, and the friendship inactive-recipient subtest passed.

After PR #202 merged at `c6853c29e9ca71fc3fab472cbf95dfdcb5ac0741`, exact-main [workflow #44256828598](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44256828598) passed **7/7 jobs**:

| Validation | Mainline result |
|---|---|
| Node.js 22.23.4 | 670/670 Hub tests; 94/94 EnginEx tests; 0 dependency-audit vulnerabilities. |
| Node.js 24.22.1 | 670/670 Hub tests; 94/94 EnginEx tests; 0 dependency-audit vulnerabilities. |
| PostgreSQL/Memgraph/Redis | 142/142 live integration tests, 0 failures, 0 skips; 18/18 fresh migrations and 18/18 idempotent second pass. |
| Browser editor/accessibility smoke | 9/9 passed. |
| CodeQL | Passed. |
| Supply-chain attestations | Signed provenance and CycloneDX SBOM created and verified against the exact source revision, lockfile and generated SBOM bytes. |
| Exact-source evidence consolidation | Passed. |

The mainline readiness artifact `14405414387` (SHA-256 `ddea9ac215b8be004cc745660df5e62cc6b6f181dbea4485c989c73c7fef18a8`) reports `CI EVIDENCE: PASS`, `FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED`, and `PRODUCTION CERTIFICATION: NO`. This successful CI run does not satisfy independent reviews #14 or #25 or other missing release gates.

## Assurance and release boundaries

F1.50 covers one recipient-state predicate in friendship creation. It does not establish exhaustive friendship lifecycle authorization, role combinations, membership teardown/revocation races, every notification or event fan-out path, realtime delivery security, provider security, or independent adversarial coverage.

Independent tenant/site review #14 remains OPEN / NOT PERFORMED. Platform security assessment #25 remains OPEN / NOT PERFORMED. F1.50 does not populate `artifacts/evidence/tenant-isolation-review.json` or satisfy either independent-review evidence contract.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, npm publication, deployment, provider qualification, spending, assessor engagement, risk acceptance, or SemVer increment is authorized.

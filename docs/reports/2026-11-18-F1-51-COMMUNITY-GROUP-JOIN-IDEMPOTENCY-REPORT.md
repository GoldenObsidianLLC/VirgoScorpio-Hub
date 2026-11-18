# F1.51 - Private-group membership join idempotency report

- **Date:** 18 November 2026
- **Issue:** [#204](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/204) - CLOSED
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent assurance gates:** [tenant review #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and [platform security review #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) - OPEN / NOT PERFORMED
- **Implementation branch:** `security/f1-51-community-group-join-idempotency-2026-11-18`
- **Implementation commit:** `b91c972d22c366c37d8d49d223ba399442fb073f`
- **Merged main commit:** `a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a` via [PR #205](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/205)
- **Pre-fix baseline:** `f24734330be289f89f19057049d4df5287e94bd3`
- **Status:** Merged and exact-main CI validated; documentation and issue-tracker reconciliation complete.

> **Assurance boundary:** This is maintainer-authored bug-fix and regression evidence. It is not an independent application-security assessment, a waiver, risk acceptance, or production certification.

## Executive summary

F1.51 fixes an idempotency defect in `POST /api/v1/sites/{siteId}/community/groups/{groupId}/join`. Before the change, retrying the join operation for an existing active member of a private group changed their stored membership status from `active` to `pending`. That silently removed active group access even though the actor already belonged to the group.

The existing membership upsert now preserves stored `active` and `banned` states. Otherwise it applies the requested status. No new abstraction or schema change was needed.

## Reproduction and correction

The pre-fix behavior was reproduced against unmodified mainline implementation using a fresh disposable PostgreSQL 18 database after all 18 migrations were applied. The regression observed `pending` where the existing private-group owner was expected to remain `active`; the corresponding Site B snapshot also changed.

The existing upsert conflict predicate preserved only `banned` and otherwise applied `EXCLUDED.status`. F1.51 now preserves the existing status when it is either `active` or `banned`; otherwise it applies the requested status. This retains the established behavior for first-time private joins, existing pending requests, and public-group joins. Route path, authentication and site-resolution order, HTTP response contract, group role, and database schema remain unchanged.

## Regression coverage

Extended `test/integration/tenant-community-object-isolation.integration.test.js`, reusing its synthetic two-site fixture and shared deep snapshot helper. The snapshot includes group records and memberships, conversations and members, messages, blocks, reports, friendships, activities, notifications, outbox events, and moderation actions.

The live regression verifies:

- An existing private-group owner can retry twice and remains `active` with the existing `owner` role.
- An existing pending private-group member can retry twice and remains `pending` with the existing `member` role.
- A banned member retry preserves `banned` and the existing generic 403 / `ERR_VIRGOSCORPIO_HUB_GROUP_BANNED` contract.
- A first-time private-group join creates a `pending` member; retry remains pending.
- A first-time public-group join creates an `active` member; retry remains active.
- Full before/after snapshots prove repeated active, pending, fresh-private, and public joins add no duplicate notifications, outbox events, or unrelated community side effects.
- Synthetic control memberships are removed at the end so both sites return to their baseline fixture snapshots.

No new fixture framework, helper abstraction, dependency, public endpoint, migration, or runtime data model was introduced.

## Local validation

| Check | Result | Qualification |
|---|---|---|
| Pre-fix live regression | Reproduced | Disposable PostgreSQL 18; active private-group owner retry returned `pending` and changed Site B membership snapshot. |
| Focused live PostgreSQL integration | **PASS - 10/10, 0 failures, 0 skips, 0 TODOs** | Disposable PostgreSQL 18 database; all 18 migrations applied fresh. Re-run after outbox snapshots were added. |
| Full local `npm run check` | **PASS - 670 tests, 667 passed, 0 failed, 3 Windows-specific skips** | Windows / Node.js 26.12.1; `NODE_OPTIONS=--max-old-space-size=4096`. |
| Artifact verifier | **PASS** | 238 required paths and 268 JavaScript files syntax-checked. |
| Tenant inventory generation and freshness | **PASS** | 28 families / 80 route patterns / 21 implementation sources / 57 referenced tests; generator `--check` reports current. |
| Syntax and dependency consistency | **PASS** | Runtime and integration test `node --check`; `npm ls --depth=0` clean. No package or lockfile change. |
| Markdown relative links | **PASS** | Final reconciliation checked 184 relative links across 11 changed Markdown documents; zero broken targets. |
| `git diff --check` | **PASS** | Final post-merge reconciliation diff checked with no whitespace errors. |
| Candidate exact-head CI | **PASS** | Push #44324380682 and PR #44324468402; each live PostgreSQL/Memgraph/Redis suite 143/143 with zero skips; Node 22/24, CodeQL, browser smoke and evidence consolidation passed. |

The focused integration suite also retains its conversation, friendship, report, moderation, notification, and cross-site community isolation controls in the same live PostgreSQL fixture.

## Hosted validation and mainline evidence

The implementation merged through [PR #205](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/205) at main commit a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a. The PR recorded no formal review submission or inline review thread; this is maintainer/repository-account work and automation evidence, not independent security approval.

Exact-main [workflow #44342489370](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44342489370) completed with **7/7 jobs passing** on the exact merge commit:

- Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub tests and 94/94 EnginEx tests; npm audits reported zero vulnerabilities.
- PostgreSQL/Memgraph/Redis integration passed **143/143 with zero failures, skips or TODOs**, including the F1.51 private-group join retry regression.
- Fresh migration pass applied all 18 migrations; idempotent re-entry verified the full 18-migration set.
- Browser/editor smoke passed 9/9; CodeQL passed.
- Signed SLSA provenance and CycloneDX SBOM attestations were created and verified. Lockfile SHA-256 remains `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; SBOM SHA-256 is `553b9bf190a4fd75aaa750f0014f3f31b04fe0466ce186233e39267e4b7873ae` (200 components / 201 dependency records). Provenance and SBOM attestations are recorded at [69220003](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/69220003) and [69220027](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/69220027).
- Exact-source evidence consolidation passed. Mainline artifacts: readiness `14445280897` (SHA-256 `a7e64f309cfc9cd953303ef6d7f9f3fbfb8bc11766e5974e9803603ffb27d23b`); live integration `14443973032` (SHA-256 `c3c0b7edba84d858e60a5a2d5df16e8d1ba439c1abb50920420395e80a3919e3`); DB CI evidence `14443434296` (SHA-256 `12a8e694354c8d13cb6b53fb002cc730da09a7b049bf36972693cccc4f69ab1e`); signed supply-chain evidence `14443912964` (SHA-256 `e08795489f7a58bce71a452759e5a2cfd6937176a999b7b9ad58e87d2ba426f4`).

The canonical readiness JSON in artifact `14445280897` is bound to source revision `a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a`: `releaseClassification=NOT_PRODUCTION_CERTIFIED`, `readyForProduction=false`, and **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**. CI evidence is PASS; this does not constitute production certification. Issues #14/#25 and the other independent release/governance gates remain open.

## Inventory and release boundary

The source-anchored community route family in `docs/security/tenant-isolation-route-inventory.catalog.json` records F1.51 active, pending, banned, fresh-private, and public join-state controls, including notification and outbox side-effect snapshots. The generated inventory and capability map were refreshed through the existing generator.

This is one maintainer regression for one route behavior. It does not establish exhaustive group-membership lifecycle security, every role combination, concurrency/revocation race behavior, provider/realtime isolation, or independent adversarial review.

Issues #14 and #25 remain OPEN / NOT PERFORMED. F1.51 does not populate independent-review evidence. Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, publication, deployment, spending, assessor engagement, risk acceptance, or SemVer increment is authorized.

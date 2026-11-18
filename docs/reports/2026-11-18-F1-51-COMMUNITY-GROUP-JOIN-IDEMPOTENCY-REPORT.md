# F1.51 - Private-group membership join idempotency report

- **Date:** 18 November 2026
- **Issue:** [#204](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/204) - OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent assurance gates:** [tenant review #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and [platform security review #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) - OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-51-community-group-join-idempotency-2026-11-18`
- **Baseline main SHA:** `f24734330be289f89f19057049d4df5287e94bd3`
- **Status:** Runtime fix, focused live PostgreSQL validation, full local project check, tenant inventory freshness, dependency consistency, Markdown links, and syntax checks complete; hosted exact-head verification remains pending.

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
| Markdown relative links | **PASS** | 94 relative links across eight changed Markdown files; zero broken targets. |
| `git diff --check` | **PASS** | Re-run after final documentation reconciliation; no whitespace errors. |
| Hosted exact-head CI | PENDING | Required before merge; no hosted validation is claimed here. |

The focused integration suite also retains its conversation, friendship, report, moderation, notification, and cross-site community isolation controls in the same live PostgreSQL fixture.

## Inventory and release boundary

The source-anchored community route family in `docs/security/tenant-isolation-route-inventory.catalog.json` records F1.51 active, pending, banned, fresh-private, and public join-state controls, including notification and outbox side-effect snapshots. The generated inventory and capability map were refreshed through the existing generator.

This is one maintainer regression for one route behavior. It does not establish exhaustive group-membership lifecycle security, every role combination, concurrency/revocation race behavior, provider/realtime isolation, or independent adversarial review.

Issues #14 and #25 remain OPEN / NOT PERFORMED. F1.51 does not populate independent-review evidence. Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, publication, deployment, spending, assessor engagement, risk acceptance, or SemVer increment is authorized.

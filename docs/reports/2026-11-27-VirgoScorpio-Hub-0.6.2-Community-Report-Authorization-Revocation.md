# VirgoScorpio Hub 0.6.2 — Community Report-Write Authorization Follow-up

**Tracking issue:** [#310](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/310)
**Base:** `main` at `caee3665c94ecf5ddaebf9e0ec4ec81053afa070`
**Status:** unmerged development candidate; hosted exact-head CI and review pending
**Implementation branch:** `security/community-report-write-authorization-2026-11-27`

## Finding

A source review following F1.75 found two community report write paths that checked authorization before entering their PostgreSQL mutation transaction but did not revalidate it at the write boundary.

1. `POST /api/v1/sites/:siteId/community/reports` performed site-membership preflight, parsed the body, then entered a transaction to insert a report and notify moderators without checking the reporter's current active site membership.
2. `PATCH /api/v1/sites/:siteId/community/reports/:reportId` checked `community:moderate` before entering its transaction, then updated report status and could insert a moderation action without rechecking current membership/capability inside the transaction.

If site membership, account activity, or the moderator role changes after preflight but before the write transaction, the request could still persist a report or change its status after authorization was removed. This is the same preflight-to-mutation class addressed by F1.75 for message creation and hide/restore moderation, but these report paths were not covered by that increment.

## Implementation

The candidate reuses the existing transaction-scoped helpers in `packages/community/src/workflows.js`; it introduces no new authorization SQL abstraction.

- Report submission calls `assertActiveSiteMembership(client, ctx, siteId, ctx.actor.user.id)` at the start of the report transaction, before rate-limit accounting, target validation and writes.
- Report status mutation calls `assertSiteCapabilityInTransaction(client, ctx, siteId, ctx.actor.user.id, 'community:moderate')` before updating the report or inserting a dismissal action.
- The existing site-first lock order and capability semantics are retained. No schema, migration, API response-shape, dependency, lockfile or package-version changes are included.

## Regression coverage

The PostgreSQL integration test uses explicit barriers to control the request sequence:

- Membership revocation: allow site-membership preflight, pause after body parsing, commit reporter membership removal, resume the request, and assert a 403 with no report row or `community.report.created` notification.
- Account disablement: restore the membership, allow preflight, pause after body parsing, disable the reporter account, resume the request, and assert the same denial/no-side-effect contract.
- Moderator role revocation: allow the `community:moderate` preflight, pause, remove that capability from the role, resume, and assert a 403 with the report still `open` and the moderation-action count unchanged.

These tests use the real route handler, PostgreSQL transactions and shared authorization helpers. They are gated by the existing hosted PostgreSQL integration configuration.

## Local validation

- `node --test test/community-workflows.test.js`: **13/13 passed**.
- Project unit-test command equivalent, `node --test --test-concurrency=1 test/*.test.js`: **1,140 total; 1,137 passed; 0 failed; 3 Windows-specific skips**.
- `node scripts/verify.js`: passed; 241 required paths / 316 JavaScript files syntax-checked.
- `node scripts/generate-tenant-isolation-route-inventory.js --check`: passed; 28 route families, 80 route patterns, 22 source files and 61 test files.
- `node --check packages/community/src/workflows.js`, `node --check test/integration/community-workflows.integration.test.js` and `git diff --check`: passed.
- `node --test test/integration/community-workflows.integration.test.js`: process passed with the integration test skipped because this workstation has no dedicated `TEST_DATABASE_URL` and `VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true` configuration. The three new race scenarios therefore remain for hosted PostgreSQL execution; no local live-database pass is claimed.

## Acceptance and release boundary

Hosted push and PR-context workflows must pass on the exact final head, including the PostgreSQL report-revocation races with zero skips, Node 22/24, browser/accessibility smoke, CodeQL and evidence consolidation. The full diff and resulting CI evidence require maintainer review before merge.

This candidate does not change the exact-main readiness artifact or readiness classification because it is not merged. Package 0.6.2 remains private/unreleased; no SemVer increment, tag, publication, deployment or production promotion is authorized. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED** under the existing fourteen missing production-evidence gates.

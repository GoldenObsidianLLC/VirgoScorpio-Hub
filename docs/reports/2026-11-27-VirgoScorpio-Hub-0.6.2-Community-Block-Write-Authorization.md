# VirgoScorpio Hub 0.6.2 — F1.77 Community Block-Write Authorization Candidate

**Tracking issue:** [#312](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/312)
**Branch:** `security/f1-77-community-block-write-authorization`
**Base:** `main` at `f823dca404ce38d66aeab170b7f889503adba6f4`
**Status:** exact-head hosted CI passed; single-maintainer review completed; merge decision pending
**Package:** `virgoscorpio-hub@0.6.2` — private, unreleased

## Finding

The community block create/delete endpoints checked site membership at request entry, but their final writes used direct pool queries rather than transaction-scoped authorization:

- `POST /api/v1/sites/:siteId/community/blocks` parsed the request, queried target active membership through the pool, and then inserted/upserted `social_blocks` through a separate pool query. The actor's membership/account status and the target's membership/account status could become stale between preflight and the write.
- `DELETE /api/v1/sites/:siteId/community/blocks/:userId` deleted a block through a direct pool query without revalidating the blocker's current active membership/account status in the mutation transaction.

This is the same preflight-to-mutation authorization gap closed in F1.75 / PR #308 and F1.76 / PR #311 for adjacent community workflows.

## Implementation

The candidate reuses the existing site-first authorization helpers and `withTransaction`; no second authorization SQL implementation is introduced.

- Added `lockActiveSiteParticipants`, which locks the site first, then participant users and site memberships in deterministic UUID order. It can use shared locks for community block writes and retains the stronger `FOR UPDATE` mode for direct-conversation creation.
- Block creation revalidates both the actor and target inside one PostgreSQL transaction before the `social_blocks` upsert. Actor revocation returns the existing 403 tenant-forbidden contract; target revocation keeps the generic 404 community-user-not-found contract.
- Unblock executes in one PostgreSQL transaction and calls the existing `assertActiveSiteMembership` before the delete.
- Existing non-production developer bypass behavior is preserved for the actor; target membership/account validation remains required.
- The direct-conversation path now calls the shared deterministic participant-lock helper, preserving its prior advisory lock and stronger row-lock mode.

The new integration-fixture callbacks are test-only synchronization seams. They pause after request-time site or target preflight so hosted PostgreSQL can commit revocation before the mutation transaction proceeds.

## Regression coverage

Five focused unit tests cover block create success/lock order, actor membership revocation rollback, generic target-not-found rollback, unblock authorization rollback, and successful site-scoped unblock.

Four hosted PostgreSQL race scenarios plus a reciprocal-request lock-order test are added:

1. Actor membership removal after POST body parsing: expect 403 and no block row.
2. Actor account disablement after POST body parsing: expect 403 and no block row.
3. Target membership removal after target preflight but before the transaction: expect generic 404 and no block row.
4. Actor membership removal after DELETE route preflight: expect 403 and the existing block row remains.
5. Concurrent reciprocal block requests acquire participants in deterministic order and both complete without deadlock.

The test restores fixture membership and the original reverse-block reason after the concurrency probe, so later community race tests retain their baseline state.

## Local validation

| Check | Result |
|---|---|
| `node --check packages/community/src/workflows.js` | Pass |
| `node --check test/integration/community-workflows.integration.test.js` | Pass |
| `node --test test/community-workflows.test.js` | **18/18 passed; zero failures/skips** |
| Full top-level unit suite | **1,145 total; 1,142 passed; 0 failed; 3 Windows-specific skips** |
| `node scripts/verify.js` | Pass; 241 required paths / 316 JavaScript files syntax-checked |
| Tenant inventory generator/check | Pass; 28 families / 80 route patterns / 22 source files / 61 test references |
| `git diff --check origin/main` | Pass |
| Hosted PostgreSQL revocation races | Passed on exact final head in push and PR-context workflows: 203/203, zero failures/skips in both; local PostgreSQL is not configured |

The full top-level unit suite passed on Windows/Node 26.12.1 after initializing the pinned EnginEx submodule at `d99e021f55664f006b5e65b4a58202f9c7bc4f4b`. The three skips are existing platform-conditional tests. The live PostgreSQL races in the nested integration fixture have not been run on the workstation; hosted CI remains the acceptance source for those tests.

## Compatibility and release boundary

No database schema/migration, public API response shape, dependency, lockfile, package-version or SemVer change is intended. No SemVer increment is warranted. The work covers only community block create/delete mutation authorization and deterministic participant locking; it does not certify all community workflows.

Package 0.6.2 remains private/unreleased and production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. Final candidate head passed both push [#46049493631](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46049493631) and PR-context [#46049550731](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46049550731): Node 22/24 (1,145/1,145 each), PostgreSQL/Memgraph (203/203 with zero failures/skips), browser smoke (9/9), CodeQL and evidence consolidation. Feature-event signed lockfile/SBOM attestation was skipped by design; exact-main attestation remains a post-merge gate. Independent reviews #14/#25 and parent issue #124 remain separate open obligations.

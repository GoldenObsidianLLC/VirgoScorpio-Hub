# VirgoScorpio Hub 0.6.2 — F1.75 Community Message Membership-Revalidation Implementation Report

**Review date:** 27 November 2026
**Parent tracking:** [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), still OPEN
**Merged implementation:** [PR #308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/308), merged 27 November 2026
**Main merge commit:** `4389d05864b0113e7198bbd86eed23d192ec224c`
**Final PR head:** `18e9ff2be151c70feb2fa06b57f4890f4df98893`
**Exact-main validation:** [workflow #45962276960](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45962276960)
**Base:** `main` at `5eb906efdd3413cfd8851506f6863daa8afa0dfc` (PR #307 merged)
**Rebased implementation commit:** `c9b52f4b805891715359a485cf79df196a892d10`
**Implementation branch:** `security/community-message-membership-revocation-race-2026-11-27`

## Executive summary

A source-level review identified a time-of-check/time-of-use authorization gap in community message creation. The request-level site-membership preflight could succeed, then a concurrent administrator could revoke that membership before the route entered its mutation transaction. The message mutation relied on conversation membership but did not revalidate that the actor remained an active member of the selected site.

F1.75 adds transaction-scoped authorization revalidation before message and notification writes. The existing moderation path now reuses the same authorization helper, reducing duplicated lock/query logic while preserving its capability policy.

## Implementation

- Adds `loadActiveSiteAuthorization`, `assertActiveSiteMembership` and `assertSiteCapabilityInTransaction` in `packages/community/src/workflows.js`.
- Acquires locks in site-first order: site `FOR KEY SHARE`, then active user/site-membership/role rows `FOR SHARE`, then conversation and conversation membership locks.
- Makes message creation recheck active site membership in its PostgreSQL mutation transaction, before message or notification insertion.
- Replaces moderation's duplicated inline membership/capability query with the shared helper and retains the `community:moderate`, `site:manage` and wildcard capability semantics.
- Preserves the existing non-production developer bypass.
- Adds unit tests for the lock sequence, allowed member, revoked member rollback and developer bypass.
- Adds a PostgreSQL lock-contention regression that proves a revocation committed after preflight prevents message and notification persistence.
- Regenerates the source-anchored tenant-isolation inventory and capability map.

The removal path in `packages/auth/src/service.js` locks the site row `FOR UPDATE` before deleting the site membership. A message attempt waiting for that removal then reads membership after the removal commit and fails closed with 403. See the [F1.75 threat model](../security/F1.75-COMMUNITY-MESSAGE-MEMBERSHIP-REVOCATION-THREAT-MODEL.md).

## Validation status

- Focused `test/community-workflows.test.js`: **13/13 passed**.
- Workflow and integration-test JavaScript syntax checks: passed.
- `node scripts/verify.js`: passed.
- Tenant route inventory regenerated and `node scripts/generate-tenant-isolation-route-inventory.js --check`: passed.
- Full top-level unit test glob on the final local implementation worktree: **1,140 total; 1,137 passed; 0 failed; 3 Windows-specific skips**. Exact-main CI passed all 1,140 Hub unit/security tests with zero skips on Node.js 22.23.4 and 24.22.1.
- `git diff --check`: passed.
- The local PostgreSQL environment was not configured. The new lock-contention integration regression was therefore not executed locally; post-merge exact-main workflow #45962276960 passed the live PostgreSQL/Memgraph suite 203/203 with zero skips, including this regression.

## Scope and release boundary

This merged increment covers community message creation and the existing moderation write path only. It does not close issue #124, certify all community mutations, or satisfy independent tenant review #14 or independent platform security assessment #25.

No migration, database schema, API response contract, dependency, lockfile, package version or SemVer change is included. Package 0.6.2 remains private and unreleased. Production readiness remains NO-GO / NOT_PRODUCTION_CERTIFIED. No tag, publication, deployment or promotion is authorized.

PR #308 merged from final PR head `18e9ff2be151c70feb2fa06b57f4890f4df98893` to main commit `4389d05864b0113e7198bbd86eed23d192ec224c`. Earlier exact-head runs #45941295364/#45941331264 validated the original pre-rebase source SHA `239d26270e6c58d3a50ea2d87dd192c400a629f4` and remain historical. After the rebase, push workflow [#45960983827](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45960983827) passed on code-bearing SHA `bd6ff39`; final push [#45961720288](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45961720288) and PR-context [#45961729096](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45961729096) both passed on `18e9ff2`. Post-merge exact-main workflow [#45962276960](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45962276960) passed 203/203 live PostgreSQL/Memgraph tests with zero skips, including the forced membership-revocation race, plus 22/22 fresh/idempotent migrations, Node 22/24, browser 9/9, CodeQL, signed supply-chain attestations and evidence consolidation. Maintainer review is recorded in the repository; issue #124 and independent assessments #14/#25 remain open.

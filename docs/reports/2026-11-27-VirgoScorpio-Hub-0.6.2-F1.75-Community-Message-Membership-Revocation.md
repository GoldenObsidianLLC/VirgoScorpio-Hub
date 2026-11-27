# VirgoScorpio Hub 0.6.2 — F1.75 Community Message Membership-Revalidation Candidate

**Review date:** 27 November 2026
**Parent tracking:** [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), still OPEN
**Candidate:** [PR #308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/308), open and ready for review
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
- Full top-level unit test glob completed with exit code 0 on the pre-rebase candidate. The code-only rebase changes its parent/base, not the F1.75 implementation; fresh exact-head hosted CI is still required on the rebased SHA.
- `git diff --check`: passed.
- The local PostgreSQL environment was not configured. The new lock-contention integration regression was therefore not executed locally; hosted PostgreSQL CI must run it with zero skips before review/merge.

## Scope and release boundary

This candidate covers community message creation and the existing moderation write path only. It does not close issue #124, certify all community mutations, or satisfy independent tenant review #14 or independent platform security assessment #25.

No migration, database schema, API response contract, dependency, lockfile, package version or SemVer change is included. Package 0.6.2 remains private and unreleased. Production readiness remains NO-GO / NOT_PRODUCTION_CERTIFIED. No tag, publication, deployment or promotion is authorized.

PR #308 is open and ready for review, based directly on `main` after PR #307 merged. The rebased code commit is `c9b52f4b805891715359a485cf79df196a892d10`; the remote branch and PR base update are the next synchronization step. Earlier exact-head runs #45941295364 and #45941331264 validated the old source SHA `239d26270e6c58d3a50ea2d87dd192c400a629f4` and are historical after rebase. New push and PR workflows must pass, including the forced PostgreSQL revocation-race regression with zero skips, before merge. The complete rebased diff, lock ordering, integration evidence and remaining route-review scope require maintainer review.

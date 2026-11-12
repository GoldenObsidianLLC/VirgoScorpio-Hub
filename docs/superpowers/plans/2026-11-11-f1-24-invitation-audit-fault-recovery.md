# F1.24 Invitation-Acceptance Audit Failure and Retry — Plan

**Date:** 11 November 2026

**Status:** Test implementation and local validation complete; exact-head hosted PostgreSQL/Memgraph validation pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), draft [PR #128](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/128).

**Design:** [F1.24 design](../specs/2026-11-11-f1-24-invitation-audit-fault-recovery-design.md).

## Objective

Prove that PostgreSQL failure while inserting the invitation-acceptance audit event rolls back new-account creation, membership insertion and invitation consumption, emits no authorization invalidation, and leaves the same invitation token safe to retry after the fault is removed.

## Work

- [x] Reuse the existing Site A invitation creation/redeem helpers and disposable PostgreSQL fixture.
- [x] Add a uniquely named test-only PostgreSQL trigger scoped to one Site A `site.invitation_accepted` event.
- [x] Assert that the injected audit failure causes the acceptance HTTP request to fail.
- [x] Assert user, membership, accepted timestamp and acceptance audit are rolled back, the original SHA-256 token digest is preserved, and no authorization invalidation is emitted.
- [x] Remove the trigger/function in cleanup.
- [x] Retry the same still-valid invitation token and assert exactly one user, membership, accepted timestamp, request-correlated audit event, and exactly one post-commit authorization invalidation.
- [x] Run JavaScript syntax validation and focused auth unit tests.
- [x] Regenerate the source-anchored tenant-isolation inventory.
- [x] Run `npm run check`: 594 tests, 591 passed, 0 failed, 3 Windows-specific skips; inventory freshness passed.
- [ ] Execute the new database-backed fault-injection case on the exact PR head in hosted PostgreSQL/Memgraph CI with zero skips.
- [ ] Reconcile exact-head workflow IDs and results in this plan, design, implementation/release roadmaps, release readiness, release-gate report, assurance policy, and generated inventory.
- [ ] Human review of draft PR #128; no formal review submission is currently recorded.

## Local validation boundary

The Windows maintainer host has no disposable PostgreSQL `DATABASE_URL`; the live integration fixture is skipped locally and is not counted as passed. Local syntax, auth unit, full repository, and inventory-freshness checks do not replace the hosted database execution.

## Boundaries

This is maintainer-led non-production reliability testing. It does not authorize an owner-transfer API, production deployment, provider qualification, paid assessor engagement, release tag, package publication or SemVer change. Independent reviews #14/#25 remain open/not performed; issue #23 remains open/partial; production remains **NO-GO**.

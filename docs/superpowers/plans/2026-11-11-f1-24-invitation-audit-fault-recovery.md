# F1.24 Invitation-Acceptance Audit Failure and Retry — Plan

**Date:** 11 November 2026

**Status:** Test implementation and local validation complete. Source-test commit 23cb913 passed hosted push workflow #571 (91/91 live PostgreSQL/Memgraph tests, zero failures/skips), including the injected audit failure/retry case. Final PR-head push/PR validation and human review are pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), draft [PR #129](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/129), branch security/invitation-audit-fault-recovery-2026-11-11.

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
- [x] Execute the fault-injection test on the F1.24 source tree in hosted push workflow [#571](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43162508545): 91/91 PostgreSQL/Memgraph tests, zero failures/skips, including the injected audit failure/retry case.
- [ ] Execute exact-head push and PR workflows after docs reconciliation; require zero integration skips.
- [ ] Reconcile exact-head workflow IDs and results in this plan, design, implementation/release roadmaps, release readiness, release-gate report, assurance policy, and generated inventory.
- [ ] Human review of draft PR #129; no formal review submission is currently recorded.

## Local validation boundary

The Windows maintainer host has no disposable PostgreSQL `DATABASE_URL`; the live integration fixture is skipped locally and is not counted as passed. Local syntax, auth unit, full repository, and inventory-freshness checks do not replace the hosted database execution.

## Boundaries

This is maintainer-led non-production reliability testing. It does not authorize an owner-transfer API, production deployment, provider qualification, paid assessor engagement, release tag, package publication or SemVer change. Independent reviews #14/#25 remain open/not performed; issue #23 remains open/partial; production remains **NO-GO**.

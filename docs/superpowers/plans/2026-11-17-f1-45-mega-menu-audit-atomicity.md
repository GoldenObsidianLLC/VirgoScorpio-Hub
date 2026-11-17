# F1.45 — Mega-menu configuration audit atomicity implementation plan

**Date:** 17 November 2026
**Issue:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/188
**Design:** ../specs/2026-11-17-f1-45-mega-menu-audit-atomicity-design.md

## Starting conditions

- Work from an isolated Git worktree based on exact origin/main SHA 68cfd2f0e05e5c43ccb617770124a39c9226db9c.
- Keep the primary checkout and unrelated worktrees untouched.
- Reconfirm the mega-menu source and existing route tests before changing code.
- Keep PR #187 documentation reconciliation and its human review independent from this runtime candidate.

## Implementation steps

1. **Share only the established transaction primitive.** Add a generic identity-audited transaction helper in platform-routes.js; retain the cloud-specific audit availability wrapper for compatibility.
2. **Make all three mega-menu mutations atomic.** Move POST/PUT/DELETE SQL to the checked-out queryable and await metadata-only identity audit on that same client. Keep GET unchanged.
3. **Unit/route regression coverage.** Add focused coverage for event shape, transaction queryable, fail-closed identity availability, stale version/no-event, and per-mutation failure rollback/retry. Re-run the existing cloud audit suite to protect the helper refactor.
4. **Live PostgreSQL failure injection.** Add trigger-backed create/update/delete rollback and retry tests to the normal live integration glob. Confirm the existing two-site isolation and expected-version race suite remains unchanged.
5. **Curated security inventory.** Add the new unit and live integration files to the mega-menu family, record audit side effects and failure-injection scope, then regenerate the checked JSON/Markdown inventory and run its --check mode.
6. **Documentation.** Add the F1.45 design, plan and implementation report; update relevant architecture and 0.6.2 candidate changelog/roadmap evidence. Do not refresh or claim a readiness artifact unless it is bound to the exact tested SHA.
7. **Validation.** Run focused route/cloud tests, the integration test (or record why local DB execution is unavailable), npm run check, inventory freshness, git diff --check, and a relative-link check for changed Markdown. Hosted PR CI must pass Node 22/24, PostgreSQL/Memgraph/Redis with zero skips, browser/accessibility smoke, CodeQL, and candidate evidence consolidation.
8. **Review and merge.** Push only the isolated branch, open a draft PR with full evidence, wait for independent human review, then mark ready only after candidate CI. Do not self-approve or merge without the authorized maintainer review step. After an approved merge, verify exact-main CI on the merge SHA and reconcile evidence before closing issue #188.

## Acceptance checklist

- [ ] Create/update/delete each persist exactly one corresponding identity audit event on the mutation transaction queryable.
- [ ] Trigger-injected audit failure rolls back each mutation and leaves no correlated audit row.
- [ ] Safe retry after trigger removal commits the state and exactly one audit event.
- [ ] Missing audit service fails closed before transaction acquisition.
- [ ] Stale update and missing delete preserve their existing status/error contract and emit no audit.
- [ ] Audit details contain only bounded slug and version values.
- [ ] Existing cloud connection audit tests pass unchanged.
- [ ] Existing two-site mega-menu isolation and optimistic-concurrency tests pass.
- [ ] All local and hosted checks are reported with exact counts, skips, source SHA, and workflow links.
- [ ] No schema, migration, API, dependency, lockfile, release, tag, publication, deployment, or SemVer change.
- [ ] Independent security and release gates remain explicitly separate.

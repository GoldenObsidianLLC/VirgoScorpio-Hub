# F1.45 — Mega-menu configuration audit atomicity implementation plan

**Date:** 17 November 2026
**Issue:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/188
**Design:** ../specs/2026-11-17-f1-45-mega-menu-audit-atomicity-design.md

## Starting conditions

- The source gap was first verified against main SHA 68cfd2f0e05e5c43ccb617770124a39c9226db9c; base the implementation branch on the subsequent current origin/main SHA 0f5d12c1e5da98551c43690959201af21c0fe6cc, which contains documentation-only PR #187 and no intervening runtime changes.
- Keep the primary checkout and unrelated worktrees untouched.
- Reconfirm the mega-menu source and existing route tests before changing code.
- Keep PR #187 documentation reconciliation and its human review independent from this runtime candidate.

## Implementation steps

1. [x] **Share only the established transaction primitive.** Add a generic identity-audited transaction helper in platform-routes.js; retain the cloud-specific audit availability wrapper for compatibility.
2. [x] **Make all three mega-menu mutations atomic.** Move POST/PUT/DELETE SQL to the checked-out queryable and await metadata-only identity audit on that same client. Keep GET unchanged.
3. [x] **Unit/route regression coverage.** Add focused coverage for event shape, transaction queryable, fail-closed identity availability, stale version/no-event, and per-mutation failure rollback/retry. Re-run the existing cloud audit suite to protect the helper refactor.
4. [x] **Live PostgreSQL failure injection.** Add trigger-backed create/update/delete rollback and retry tests to the normal live integration glob. Confirm the existing two-site isolation and expected-version race suite remains unchanged.
5. [x] **Curated security inventory.** Add the new unit and live integration files to the mega-menu family, record audit side effects and failure-injection scope, then regenerate the checked JSON/Markdown inventory and run its --check mode.
6. [x] **Documentation.** Add the F1.45 design, plan and implementation report; update relevant architecture and 0.6.2 candidate changelog/roadmap evidence. Do not refresh or claim a readiness artifact unless it is bound to the exact tested SHA.
7. [x] **Local validation.** Focused tests, live disposable PostgreSQL 18 rollback/retry and tenant isolation, fresh/idempotent migrations, npm run check, inventory freshness, git diff --check and relative Markdown links all passed locally. Hosted PR CI (Node 22/24, PostgreSQL/Memgraph/Redis, browser/accessibility, CodeQL and evidence consolidation) remains pending.
8. **Review and merge.** Push only the isolated branch, open a draft PR with full evidence, wait for independent human review, then mark ready only after candidate CI. Do not self-approve or merge without the authorized maintainer review step. After an approved merge, verify exact-main CI on the merge SHA and reconcile evidence before closing issue #188.

## Acceptance checklist

- [x] Create/update/delete each persist exactly one corresponding identity audit event on the mutation transaction queryable.
- [x] Trigger-injected audit failure rolls back each mutation and leaves no correlated audit row.
- [x] Safe retry after trigger removal commits the state and exactly one audit event.
- [x] Missing audit service fails closed before transaction acquisition.
- [x] Stale update and missing delete preserve their existing status/error contract and emit no audit.
- [x] Audit details contain only bounded slug and version values.
- [x] Existing cloud connection audit tests pass unchanged.
- [x] Existing two-site mega-menu isolation and optimistic-concurrency tests pass.
- [ ] All local and hosted checks are reported with exact counts, skips, source SHA, and workflow links.
- [x] No schema, migration, API, dependency, lockfile, release, tag, publication, deployment, or SemVer change.
- [x] Independent security and release gates remain explicitly separate.

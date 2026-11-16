# F1.37 Page-Draft Save and Audit Atomicity Implementation Plan

> Execute sequentially test-first. Preserve the existing transaction boundary; do not introduce parallel transaction abstractions.

**Goal:** Commit the site-scoped draft mutation and its correlated content.draft_saved audit event atomically.

**Issue:** #162 (child of #124)
**Baseline:** ead1760b71d747dad3100a568ac403ce6a59a08f
**Merged main:** `212df05a2c2af5b222eb6a06a798f2ce5ba6cabc` via PR #163; exact-main workflow #667 passed
**Version boundary:** private/unreleased 0.6.2; no SemVer change.

## Tasks

- [x] Add store contract tests for onDraftSaved: callback queryable identity and order, create/update context, callback omission, failure rollback and original error preservation.
- [x] Narrow 23505 route-conflict mapping in saveDraft to the content row insert/update only; keep callback/audit errors intact.
- [x] Add a route test proving POST /api/v1/pages/drafts supplies the callback, writes exactly one correlated content.draft_saved event through the callback queryable, and does not audit after commit.
- [x] Add a live PostgreSQL fault-injection test with a temporary target-scoped trigger on audit_events; verify rollback of content, collaboration checkpoint, revision, workflow and outbox records; remove the trigger and verify a safe retry writes one audit.
- [x] Implement the optional onDraftSaved callback in createPostgresStore.saveDraft.
- [x] Wire the API route to identity.audit(event, { queryable }) and remove the post-commit audit call.
- [x] Run focused tests, full npm run check, inventory freshness and live PostgreSQL/Memgraph suite with zero skips.
- [x] Reconcile architecture, implementation roadmap, feature roadmap, README/doc index, release evidence and current release/readiness report without overstating independent assurance.
- [x] Push exact-head branch, verify hosted Node/database/browser/CodeQL/evidence workflows, then open a PR. Do not merge without the repository's existing authorization/review boundary.

## Constraints

Preserve request validation, site selector reconciliation, actor/site scoping, content:create/edit authorization, optimistic version behavior, content-route conflict mapping, request correlation, response status/body and existing direct store callers. Do not broaden scope to restore, media/library, AI provider activity or other audit routes. No schema/migration/dependency/API/lockfile/package-version change.
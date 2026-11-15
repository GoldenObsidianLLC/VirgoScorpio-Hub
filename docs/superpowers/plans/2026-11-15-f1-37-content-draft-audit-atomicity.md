# F1.37 Page-Draft Save and Audit Atomicity Implementation Plan

> Execute sequentially test-first. Preserve the existing transaction boundary; do not introduce parallel transaction abstractions.

**Goal:** Commit the site-scoped draft mutation and its correlated content.draft_saved audit event atomically.

**Issue:** #162 (child of #124)
**Baseline:** ead1760b71d747dad3100a568ac403ce6a59a08f
**Version boundary:** private/unreleased 0.6.2; no SemVer change.

## Tasks

- [ ] Add store contract tests for onDraftSaved: callback queryable identity and order, create/update context, callback omission, failure rollback and original error preservation.
- [ ] Narrow 23505 route-conflict mapping in saveDraft to the content row insert/update only; keep callback/audit errors intact.
- [ ] Add a route test proving POST /api/v1/pages/drafts supplies the callback, writes exactly one correlated content.draft_saved event through the callback queryable, and does not audit after commit.
- [ ] Add a live PostgreSQL fault-injection test with a temporary target-scoped trigger on audit_events; verify rollback of content, collaboration checkpoint, revision, workflow and outbox records; remove the trigger and verify a safe retry writes one audit.
- [ ] Implement the optional onDraftSaved callback in createPostgresStore.saveDraft.
- [ ] Wire the API route to identity.audit(event, { queryable }) and remove the post-commit audit call.
- [ ] Run focused tests, full npm run check, inventory freshness and live PostgreSQL/Memgraph suite with zero skips.
- [ ] Reconcile architecture, implementation roadmap, feature roadmap, README/doc index, release evidence and current release/readiness report without overstating independent assurance.
- [ ] Push exact-head branch, verify hosted Node/database/browser/CodeQL/evidence workflows, then open a PR. Do not merge without the repository's existing authorization/review boundary.

## Constraints

Preserve request validation, site selector reconciliation, actor/site scoping, content:create/edit authorization, optimistic version behavior, content-route conflict mapping, request correlation, response status/body and existing direct store callers. Do not broaden scope to restore, media/library, AI provider activity or other audit routes. No schema/migration/dependency/API/lockfile/package-version change.
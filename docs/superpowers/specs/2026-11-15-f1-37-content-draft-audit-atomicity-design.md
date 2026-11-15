# F1.37 Page-Draft Save and Audit Atomicity Design

**Date:** 15 November 2026
**Status:** Approved implementation design for maintainer issue #162
**Baseline:** ead1760b71d747dad3100a568ac403ce6a59a08f
**Parent:** #124

## Problem

The POST /api/v1/pages/drafts handler in apps/api/src/server.js calls store.saveDraft, which owns and commits a PostgreSQL transaction containing the content_items mutation, collaboration checkpoint, revision, workflow event and content.upsert outbox row. After that promise resolves, the handler calls identity.audit without a queryable override, which writes to the pool's default query path.

If audit persistence fails, the API can report a failed request even though the draft and its related records are already committed. A retry may create another revision/version and another outbox event. The audit event belongs in the same transaction as the mutation.

## Existing architecture to reuse

- packages/db/src/postgres-store.js owns the saveDraft transaction.
- Editorial transitions in the same store already accept an optional onTransition callback, invoked with { queryable, result, previous, action } before COMMIT.
- packages/auth/src/service.js implements identity.audit(input, { queryable = pool } = {}); the callback can therefore insert into audit_events with the active transaction client.
- The audit_events schema is already present in migration 0001_initial.sql. No schema or migration change is required.

## Design

Add an optional, backwards-compatible onDraftSaved callback to saveDraft. After the content row, collaboration checkpoint, revision, workflow row and outbox event have been written, invoke:

    await onDraftSaved({ queryable: client, result: committedRow, previous: old || null })

when the callback is a function. The callback must complete before the existing COMMIT. Existing callers that omit the callback retain the current behavior.

The POST /api/v1/pages/drafts handler supplies the callback when both identity and an authenticated actor ID exist. The callback writes exactly one content.draft_saved audit row with site, actor, target type content, saved content ID, request ID and bounded version detail through identity.audit(event, { queryable }). Remove the existing post-commit audit call. This preserves developer-token/no-actor behavior.

The store currently maps any 23505 thrown anywhere inside saveDraft to a content route conflict. Once the audit callback runs inside this transaction, a 23505 from audit_events must not be mislabeled as a slug conflict. Restrict route-conflict mapping to the content row INSERT/UPDATE; preserve all other database errors unchanged. Continue mapping content-route uniqueness failures to ERR_VIRGOSCORPIO_HUB_ROUTE_CONFLICT.

## Invariants

1. Content row, collaboration checkpoint, revision, workflow event, outbox event and content.draft_saved audit either all commit or all roll back.
2. The audit callback receives the exact same checked-out PostgreSQL client used for mutation.
3. The callback is awaited before COMMIT; there is no post-commit duplicate audit.
4. Authorization, site resolution, ownership checks, validation order, optimistic version checks, HTTP method/path, success status and response shape remain unchanged.
5. Pool-backed audit defaults and all direct saveDraft callers remain backwards compatible.
6. No content, document, note, free-form text or sensitive payload is copied into audit details; only the existing bounded target/version fields are recorded.

## Explicit non-goals

Do not change revision restore, media/library storage, AI provider activity logs, other audit routes, global transaction behavior, migrations, dependencies, lockfiles, package version or SemVer. Do not introduce a generic second transaction helper or move HTTP response logic into the database package.

## Verification strategy

- Store unit tests: callback order, transaction-client identity, create/update previous-row context, omitted-callback compatibility, failure rollback, original 23505 preservation and content-route conflict mapping.
- API route tests: authenticate a site-scoped actor, POST a draft, assert exactly one audit event with request/site/actor/target/version and the queryable supplied by the store callback; callback failure must fail the request without an after-commit audit.
- Live PostgreSQL test: use a narrowly scoped temporary trigger on audit_events for one explicit draft ID to force audit insertion failure. Assert zero persisted content, collaboration checkpoint, revision, workflow, outbox and audit rows. Remove the trigger, retry the same draft ID, then assert one row in each expected table and one correlated audit.
- Exact-head hosted CI: supported Node matrices, zero-skip PostgreSQL/Memgraph integration, migrations, browser/editor checks, CodeQL and evidence consolidation.

## Release boundary

Issue #162 is a maintainer-led implementation increment under #124. It does not constitute independent tenant or platform security review. Issues #14 and #25 remain open/not performed; issue #23 remains open/partial. Package 0.6.2 remains private and unreleased; no production deployment, release, publication or SemVer increment is authorized.
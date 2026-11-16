# F1.38 Library Asset Mutation and Audit Atomicity Design

**Date:** 16 November 2026
**Status:** Implementation in progress on `security/f1-38-library-audit-atomicity-2026-11-16`
**Baseline:** `af0e6504e8c7994e6b886c63a8e445b4931de4c1` (F1.37 documentation reconciliation merged through PR #164)
**Parent:** #124
**Child issue:** [#165](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/165), linked to parent #124.

## Problem

The site-scoped library upload route calls `libraryStore.upload`, which writes the asset row and first version row in its own PostgreSQL transaction. After that transaction commits, the route writes `library.asset_uploaded` through `identity.audit` using the service's default pool path. If the audit insert fails, the request can fail after the asset and version have committed.

Version replacement has the same split: `libraryStore.replaceVersion` commits the current asset row and version-history rows, then the route writes `library.asset_version_replaced` using the pool. An audit failure can therefore report failure after advancing the asset version.

Both operations already have transaction-owning store methods. The correct seam is an optional callback invoked by the store after its mutation rows are ready and before COMMIT.

## Goals

- Make the asset mutation, version-history rows and correlated audit event commit or roll back together.
- Preserve existing store callers by making callbacks optional.
- Pass the exact checked-out PostgreSQL queryable to the callback so `identity.audit(event, { queryable })` cannot escape to the pool.
- Preserve upload and replacement object compensation when transaction work fails.
- Preserve site authorization, capability checks, malware scanning/quarantine, MIME validation, optimistic version behavior, HTTP response contracts and metadata-only audit details.
- Prove rollback and retry using a live PostgreSQL audit trigger for both audit actions.

## Non-goals

- Do not wrap PostgreSQL and object storage in a fictitious distributed transaction.
- Do not introduce a new transaction helper or duplicate the store's transaction ownership in the route.
- Do not change asset metadata semantics, public/private visibility, malware policy, version numbering, routes, schemas, migrations, dependencies, package version or SemVer.
- Do not treat local filesystem integration as proof of S3/GCS/Azure provider cleanup semantics.

## Interface

Extend the existing store methods with optional callback arguments:

```js
upload({
  ...existingArguments,
  onAssetUploaded?: async ({ queryable, result }) => void,
})

replaceVersion({
  ...existingArguments,
  onVersionReplaced?: async ({ queryable, result }) => void,
})
```

The callback object follows the established `onDraftSaved({ queryable, result })` store pattern. `queryable` is the same checked-out transaction client that executed the asset mutation and version inserts. `result` is the corresponding returned asset row. The store awaits the callback before COMMIT. Existing callers that omit the callback retain their current behavior.

The route supplies the callback only when `identity.audit` is available. The callback writes the existing event and metadata through `identity.audit(event, { queryable })`. Uploaded bytes, base64, object keys and raw file content must never enter audit details.

## Transaction and compensation behavior

### Upload

1. Validate category, bytes, MIME signature, metadata and scanner result.
2. Write the new object.
3. Acquire a PostgreSQL client and begin the transaction.
4. Insert the asset row and initial version row.
5. Await `onAssetUploaded({ queryable: client, result: asset })` when supplied.
6. Commit, then return the asset.

Storage write, connection acquisition, SQL and callback work stay in one compensation scope. On failure before successful COMMIT, roll back when a client was acquired, remove the newly written object best-effort, preserve the original error, and release the client.

### Version replacement

1. Validate bytes and malware scan before database mutation.
2. Begin the existing store-owned transaction and lock the site-scoped active asset row.
3. Preserve the current version snapshot, write the new object, update the asset and insert the next version snapshot.
4. Await `onVersionReplaced({ queryable: client, result: updatedAsset })` when supplied.
5. Commit and return the updated asset.

If SQL or audit callback work fails, roll back and remove only the newly written replacement object. The prior asset row, version history and previous object remain intact.

Object storage remains outside PostgreSQL's atomicity guarantee. Compensation is best-effort and follows the existing store/provider adapter contract; production provider failure recovery and reconciliation remain separate operational concerns.

## Security and compatibility invariants

- Site resolution and `library:manage` capability checks still happen before invoking the store or writing objects.
- The existing site predicate and row lock remain unchanged.
- Existing MIME signature validation and malware scanning/quarantine behavior remain unchanged.
- Stale `expectedVersion` remains a conflict and cannot create an audit row.
- The route response and audit action names remain unchanged.
- Audit details remain bounded metadata only: upload kind, MIME, byte size and SHA-256; replacement version, MIME and SHA-256.
- Existing direct callers do not need to provide callbacks.

## Validation

- Store unit tests: same transaction client, callback-before-COMMIT ordering, error identity, rollback, upload cleanup on callback and connection failure, replacement cleanup and prior-object preservation.
- Route tests: callbacks are handed to the store and identity audit receives the identical queryable; no post-store audit remains.
- Live PostgreSQL integration: trigger-injected `23505` for both audit actions, database row/version rollback, object compensation, trigger removal and successful retry with exactly one correlated audit event.
- Existing library, media, tenant-isolation and full project tests.
- Exact-head hosted CI: supported Node matrices, PostgreSQL/Memgraph with zero skips, migrations, Playwright, CodeQL and evidence consolidation. Mainline attestation remains a post-merge check, not a candidate-branch claim.

## Assurance boundary

This is maintainer implementation and automation evidence only. It does not satisfy independent tenant review #14, platform security assessment #25 or dependency/license review #23. VirgoScorpio Hub 0.6.2 remains private/unreleased, `NOT_PRODUCTION_CERTIFIED`, and production NO-GO.

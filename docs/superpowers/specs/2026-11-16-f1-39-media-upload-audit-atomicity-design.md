# F1.39 — Legacy media upload and audit atomicity

- Issue: [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167)
- Parent: [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- Baseline: `529bb43ca11ce06f67a4e8a7cfdb6401f0852c09` (main, 16 November 2026)
- Status: implementation in progress; no release authorization implied.

## Problem

The site-scoped `POST /api/v1/media/uploads` route writes a `media_assets` row through the configured local or S3 media store, waits for that write to finish, and then persists `media.uploaded` through a separate identity audit operation. The store therefore commits its SQL mutation before the audit write. A failed audit can return an API error while leaving the new row and object behind.

The local and S3 media stores are independent backends. The F1.38 library fix does not cover either of them.

## Decision

Use the existing `withTransaction(pool, work)` helper from `packages/db/src/transaction.js` in both backends. This helper already owns client acquisition, BEGIN/COMMIT, best-effort ROLLBACK, client release, and preservation of the original operation/commit error if rollback fails. This avoids another transaction abstraction and keeps SQL lifecycle behavior identical across local and S3 implementations.

Each store accepts a backward-compatible optional `onAssetUploaded({ queryable, result })` callback. It invokes the callback on the active transaction client after the `media_assets` insert and before COMMIT. The callback result is awaited. A callback failure rejects the upload and rolls back the row.

The route constructs the callback only when identity auditing is available for the authenticated actor. It emits the existing `media.uploaded` event using `identity.audit(event, { queryable })`. Event action, target type, target ID, request ID, and metadata-only details remain unchanged.

## External object lifecycle

Object bytes are written before PostgreSQL transaction acquisition. If connection acquisition, BEGIN, insert, callback/audit, or COMMIT fails, the store performs best-effort compensation of the newly created object and rethrows the original failure. Local files use the existing safe, site-scoped path and exclusive create mode. S3 uses the existing generated site-scoped key and DeleteObject compensation. The PutObject call itself is inside the compensation scope: transport failures have ambiguous outcomes, so the store also attempts deletion if the upload request rejects.

PostgreSQL and the object provider do not share a distributed transaction. Cleanup is best effort: an unavailable filesystem/provider can leave an orphan for operational reconciliation, and a network failure during COMMIT can leave database commit outcome ambiguous. This increment does not claim distributed atomicity or change the existing object reconciliation process.

## Preserved contracts

- Request route, HTTP status/body, URL generation, authentication and `media:manage` authorization.
- Site ID derived by the existing route/site selector; SQL row includes that site ID.
- Base64 validation, 10 MiB size bound, MIME signature checks, supported image types, alt-text limit, and existing error codes.
- Local root/path containment, exclusive file creation, owner-only file permissions.
- S3 bucket/region/endpoint validation, HTTPS production endpoint requirement, private/no-store object cache behavior, provider metadata, disabled public CDN behavior, and per-request public-read database check.
- Direct store callers may omit `onAssetUploaded`; no caller must adopt a callback.

A narrow optional `mediaStore` injection on `createApiServer` supports route-level tests, matching existing dependency-injection patterns. Production construction continues to use the configured local or S3 backend.

## Validation

Unit coverage will establish callback/queryable identity and ordering, rollback on callback/insert/commit failures, object compensation after connection acquisition and transaction failures, cleanup failure not masking the original error, backwards-compatible callback omission, and local/S3 request metadata preservation. Route coverage will verify the audit is invoked inside the store transaction and not after the upload resolves. The live PostgreSQL integration test will inject an audit_events trigger failure, verify row/audit rollback and local-object cleanup, then remove the trigger and verify one safe retry with one metadata-only audit event.

## Explicit non-goals

No schema/migration, new helper, dependency, public REST contract, storage-provider change, lockfile/package.json change, package version change, SemVer increment, release tag, publication, or deployment.

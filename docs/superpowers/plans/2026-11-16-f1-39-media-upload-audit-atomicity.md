# F1.39 — Implementation plan: legacy media upload/audit atomicity

- Issue: #167
- Baseline: `529bb43ca11ce06f67a4e8a7cfdb6401f0852c09`
- Branch: `security/f1-39-media-audit-atomicity-2026-11-16`

## 1. Reuse the existing transaction seam

- Import `withTransaction` from `packages/db/src/transaction.js` in both media backends.
- Keep object writes outside PostgreSQL transaction scope.
- Inside `withTransaction`, insert `media_assets`, await the optional `onAssetUploaded({ queryable, result })` callback, and return the inserted row.
- Let the existing helper own connection acquisition, transaction statements, rollback preservation, and release. Do not duplicate transaction lifecycle code in the two backends.

## 2. Preserve/compensate backend objects

- Local: preserve validation, path containment, exclusive create and permissions; make the post-create write/sync/close and transaction path one compensation scope. Remove only the object created by this upload. A pre-existing path rejected by `wx` must never be removed.
- S3: preserve the private `PutObject` contract; include `PutObject` in the compensation scope because a transport error can leave its outcome ambiguous. Attempt `DeleteObject` after ambiguous upload errors and later SQL/audit/commit failures; preserve the triggering error if cleanup fails.
- Both: connection acquisition, BEGIN, INSERT, audit callback, and COMMIT failures reject the operation and trigger compensation.

## 3. Move the route audit into the transaction

- Add a backwards-compatible injected media-store dependency to `createApiServer` for route tests; production continues to construct its configured backend.
- Replace the post-return audit call with an optional `onAssetUploaded` callback.
- Call `identity.audit` with the exact callback queryable and unchanged event/metadata contract.
- Keep authorization, request parsing, response, and public URL behavior unchanged.

## 4. Regression tests

- Local backend: callback receives the transaction client and inserted row; callback runs before COMMIT; audit failure rolls back and deletes the object; connect/insert/commit failures compensate; callback omission remains supported; cleanup must not mask the original error.
- S3 backend: equivalent transaction behavior; PutObject remains private/no-store; DeleteObject is attempted on ambiguous PutObject transport failure and later transaction failure; cleanup errors do not replace the original error.
- API route: verify `media.uploaded` is emitted through the callback with the exact queryable before the store call resolves; no separate post-commit audit remains.
- PostgreSQL integration: trigger-fail `media.uploaded`, assert no asset/audit rows and no local object, remove trigger, retry, assert one asset and one metadata-only audit.

## 5. Documentation and release evidence

- Add this spec and plan.
- Update `docs/LIBRARIES-AND-MEDIA.md`, `docs/ARCHITECTURE.md`, `docs/README.md`, `docs/ROADMAP.md`, and `docs/IMPLEMENTATION-ROADMAP.md` so the completed increment and next issue remain consistent.
- Add a dated F1.39 implementation report and a dated full 0.6.2 release gate snapshot. Bind each status claim to its exact source SHA and CI run; retain older reports as historical records.
- Preserve current 0.6.2 status as private/unreleased and production NO-GO until every independent/provider/product/operations gate is actually accepted.

## 6. Validation and delivery

- Run focused unit/API tests, full `npm run check`, generated tenant-inventory check if source changes affect inventory, and `git diff --check`.
- Run live PostgreSQL integration only when an explicit dedicated `TEST_DATABASE_URL` is configured and the test runner's safety gate allows it. Do not fall back to `DATABASE_URL`.
- Push the feature branch and open PR #169 against main; close issue #167 only after merge and successful exact-main evidence consolidation. No SemVer/package release change.

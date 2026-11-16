# F1.39 — Legacy media upload and audit atomicity (merged)

- Issue: [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) (CLOSED)
- Parent: [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- Branch: `security/f1-39-media-audit-atomicity-2026-11-16`
- Baseline: `529bb43ca11ce06f67a4e8a7cfdb6401f0852c09`
- Merge: [PR #169](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/169) merged at d4e1c1ce5e08b4594614448d64ad2738a84355b2 from implementation head 639f0513ddde6ed5b6cce9d5847ec5cda31d8c41; issue #167 is CLOSED.
- Status: MERGED to main at d4e1c1ce5e08b4594614448d64ad2738a84355b2; exact-main workflow #681 and signed attestation passed. No formal PR reviews or inline review threads were recorded.

## Gap and selected design

The legacy site-scoped `POST /api/v1/media/uploads` route wrote a `media_assets` row through the configured local or S3 store, waited for the store call to finish, then persisted `media.uploaded` through an independent audit operation. A failed audit could therefore return an API error after the row and object had already persisted.

Both backends now reuse the existing `withTransaction(pool, work)` helper from `packages/db/src/transaction.js`. No new transaction helper or nested transaction abstraction was added. Each backend accepts an optional, backward-compatible `onAssetUploaded({ queryable, result })` callback; it is awaited on the store-owned PostgreSQL client after inserting the media row and before COMMIT. The API route now passes the callback and emits the unchanged metadata-only `media.uploaded` event using `identity.audit(event, { queryable })`.

## Storage compensation and limits

Local storage keeps the existing site-scoped, path-contained key and exclusive `wx` creation with owner-only permissions. Once this upload creates its file, any write/sync/close, PostgreSQL connection acquisition, BEGIN, insert, callback/audit or COMMIT failure enters the same cleanup scope. The file is removed best-effort; cleanup failure does not replace the original error.

S3 keeps its existing private `PutObject` metadata, generated tenant-scoped key, endpoint/HTTPS checks, public-CDN fail-closed behavior and per-request visibility check. The `PutObject` call itself is inside the compensation scope because a transport failure can leave the provider write outcome ambiguous; the store attempts best-effort `DeleteObject` after an ambiguous `PutObject` error and after subsequent PostgreSQL transaction failures. Delete failure does not replace the original provider/transaction error.

PostgreSQL and object storage do not share a distributed transaction. Process loss or provider/network failure can still leave an orphan, and a network error at COMMIT can leave outcome ambiguity. This increment does not claim cross-system atomicity; the existing reconciliation/operational gates remain required.

## Changed files

- `packages/media/src/local-store.js`: transaction-owned insert/callback and local object compensation; input validation, supported image signatures, size limit, alt-text constraint, list/read behavior and stored metadata remain unchanged.
- `packages/media/src/s3-store.js`: same transaction callback contract; private/no-store upload, signed-image validation, bounded body read/integrity check, public URL behavior and store close remain intact.
- `apps/api/src/server.js`: injected media-store seam for deterministic route tests; post-commit audit replaced by the store callback. Route path, auth/capability checks, request/response shape and event metadata remain unchanged.
- `test/media-upload-audit-atomicity.test.js`: local/S3 transaction order, callback identity, rollback, cleanup, connection and commit failure, backwards compatibility, route regression, and best-effort cleanup after an ambiguous S3 PutObject transport failure.
- `test/integration/media-audit-atomicity.integration.test.js`: live PostgreSQL trigger-injection failure, row/audit rollback, local object compensation and safe retry.
- `test/domain-plugins-media.test.js`, `test/security-boundaries.test.js`: transaction-aware pool test doubles; no behavior weakening.

## Local validation

- Focused route/store regression command: **49 passed, 0 failed, 0 skipped**.
- Dedicated media store/route unit suite: **11 passed, 0 failed, 0 skipped**; the separately gated PostgreSQL integration test is **1 skipped** because no dedicated test database is configured.
- Full `npm run check`: **638 passed, 0 failed, 3 Windows-specific skips**; artifact verification passed **238 required paths** and syntax-checked **256 JavaScript files** on Node.js 26.12.1.
- `npm run security:tenant-inventory`: passed and regenerated **27 flow families, 78 declared route patterns, 21 implementation source files and 46 referenced test files**. The generated inventory test passes in the full check.
- `git diff --check`: passed after implementation and documentation updates.
- Live PostgreSQL trigger-injection integration test: added, but not run locally. The local environment has neither `TEST_DATABASE_URL` nor `DATABASE_URL`; no database connection was attempted. The test is intentionally opt-in and the repository runner refuses to infer `DATABASE_URL` for destructive integration work.
- Exact-head candidate CI (#679/#680) and exact-main CI (#681) passed. PR #169 merged with no formal review submissions or inline review threads; independent provider-backed S3 cleanup acceptance remains a separate Milestone C operational qualification. Mocked S3 tests prove best-effort DeleteObject is attempted after ambiguous PutObject transport failure and SQL/audit failure, and cleanup errors do not mask the triggering failure; they do not prove real provider credentials, object versioning, delete permissions, consistency or recovery.

## Hosted candidate acceptance — exact head

Candidate head 639f0513ddde6ed5b6cce9d5847ec5cda31d8c41 on PR #169 was validated by both exact-head [push workflow #679](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43808420828) and [pull-request workflow #680](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43808426639); each run completed successfully. The PR run completed the functional CI jobs: CodeQL, Node 22.23.4 tests/security/dependency checks, Node 24.22.1 tests/security/dependency checks, PostgreSQL/Memgraph integration, browser/editor smoke and candidate evidence consolidation. The mainline-only signing job was skipped as designed.

- Node.js 22.23.4: **641/641 Hub tests**, 0 failures/skips; vendored EnginEx **94/94**, 0 failures/skips.
- Node.js 24.22.1: **641/641 Hub tests**, 0 failures/skips; vendored EnginEx **94/94**, 0 failures/skips.
- Dedicated PostgreSQL/Memgraph suite: **106/106 passed**, 0 failures/skips. The new media.uploaded trigger-injection regression passed: audit failure rolled back the media_assets row, the created local file was removed, and retry committed exactly one asset plus one audit event.
- Fresh migrations: **18/18 applied** to an isolated database; the idempotent second pass skipped **18/18** as expected.
- CodeQL and browser/editor smoke jobs completed successfully. Full npm audit and production-only audit each reported zero vulnerabilities in the Node matrix; the CI SBOM schema check passed (200 components / 201 dependency records per runtime).
- The first candidate attempts #677/#678 failed only on a test assertion that expected numeric byteSize; PostgreSQL returned the established bigint detail as a string. The fixture now asserts String(image.length); rerun workflows #679/#680 passed on the corrected exact head.
- GitHub records **zero formal PR reviews and zero inline review threads** for PR #169. The PR was merged by the repository owner; no formal review submission was recorded.
- Candidate release-readiness output was NOT_PRODUCTION_CERTIFIED; the PR signing job was skipped by design for non-mainline refs. Exact-main workflow #681 subsequently passed signed attestation and finalized canonical mainline readiness evidence, which remains NOT_PRODUCTION_CERTIFIED.
## Exact-main acceptance — merged commit

After PR #169 merged, exact-main [workflow #681](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43812646684) validated the merge commit d4e1c1ce5e08b4594614448d64ad2738a84355b2 and completed all seven jobs successfully.

- Node.js 22.23.4 and 24.22.1 each passed 641/641 Hub tests and 94/94 EnginEx 7.0.0 tests, zero failures/skips.
- PostgreSQL/Memgraph passed 106/106 live integration tests, zero failures/skips, including the F1.39 media-upload/audit trigger-injection rollback/compensation/retry regression.
- Fresh migrations applied 18/18; idempotent second pass skipped 18/18. Browser/editor smoke passed 9/9 and CodeQL passed.
- Mainline lockfile/SBOM attestations were signed and verified; SLSA provenance and CycloneDX SBOM attestation passed and bind the exact merged SHA. Evidence consolidation finalized the canonical readiness artifact.
- Final mainline readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED; the F1.39 merge does not grant release authorization.
- The repository records no formal PR review submissions or inline threads for #169. This is maintainer/automation implementation and CI evidence, not independent security approval.
## Compatibility and release impact

The new callback is optional; direct store callers may continue calling `upload` with existing arguments. No database schema or migration, package dependency, public REST route, lockfile, package version, SemVer, release tag, publication or deployment change is intended. Package `virgoscorpio-hub@0.6.2` remains private/unreleased and Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## Next acceptance step

PR #169 is merged, issue #167 is closed, exact-main CI and signed attestation passed, and canonical mainline readiness evidence is retained. Remaining work is completion of the external Milestone C/D/E production gates; no release or deployment is authorized.

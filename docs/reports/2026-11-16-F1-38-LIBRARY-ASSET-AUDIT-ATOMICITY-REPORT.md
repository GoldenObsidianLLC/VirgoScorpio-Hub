# F1.38 Library Asset Upload and Version Audit Atomicity — Merge and Mainline Validation Report

**Date:** 16 November 2026  
**Package boundary:** `virgoscorpio-hub@0.6.2`, private/unreleased  
**Parent:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)  
**Issue:** [#165](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/165) — CLOSED  
**Pull request:** [#166](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/166) — MERGED  
**Implementation commit:** `125a8cd0539bf11891fc05745b95273b99a76bbf`  
**Mainline merge commit:** `4e3efd859b0447ee215d26343314da25d0a867c2`

## Summary

F1.38 makes the library asset upload and version-replacement mutations atomic with their correlated audit events. The existing `createLibraryStore` transaction methods now accept optional `onAssetUploaded({ queryable, result })` and `onVersionReplaced({ queryable, result })` callbacks. The route writes `library.asset_uploaded` and `library.asset_version_replaced` through `identity.audit(event, { queryable })` using the exact checked-out client that owns the asset/version mutation, before COMMIT.

Upload compensation now covers PostgreSQL connection-acquisition failure after the object is written, as well as database/callback failure. Version replacement preserves the prior row/version/object when the callback fails and removes the uncommitted replacement object. Audit details remain metadata-only.

This increment reuses the existing transaction boundaries; it adds no nested transaction helper, migration, schema, dependency, public REST API, lockfile, package-version or SemVer change.

## Changes

- `packages/library/src/file-store.js`: optional transaction callbacks for upload and replacement; preserve the original failure while rolling back and compensating.
- `apps/api/src/library-routes.js`: write both correlated audit events using the transaction queryable supplied by the store callback.
- `test/library-routes.test.js`: assert callbacks are provided and the exact store transaction queryable is passed to audit.
- `test/release-hardening.test.js`: cover callback order/identity, rollback, connection acquisition, object cleanup and prior-version preservation.
- `test/integration/library-audit-atomicity.integration.test.js`: trigger-injection coverage for both audit actions, rollback, storage compensation and safe retry.
- Architecture, README, roadmap, implementation roadmap, feature plan and generated tenant-isolation inventory were updated. Inventory snapshot: 27 families, 78 declared route patterns, 21 source files and 46 test references.

## Local validation

| Check | Result |
|---|---|
| Focused library-store and route tests | 26 passed, zero failures |
| Full `npm run check` | 627 passed, zero failures, three platform-specific skips |
| Tenant-inventory freshness | PASS |
| `git diff --check` | PASS |
| Local `npm run test:integration:live` | BLOCKED: no approved disposable `TEST_DATABASE_URL` / PostgreSQL-Memgraph target was configured |

The dedicated live PostgreSQL integration test is present and is invoked by the live runner. The local integration command was not treated as a pass because the database target was unavailable.

## Exact-head hosted acceptance

PR-head [workflow #672](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43784747633) completed successfully for implementation SHA `125a8cd0539bf11891fc05745b95273b99a76bbf`.

- Node.js 22.23.4: 630/630 Hub tests passed; zero failures and skips.
- Node.js 24.22.1: 630/630 Hub tests passed; zero failures and skips.
- PostgreSQL/Memgraph: 105/105 passed, zero failures/skips. The two F1.38 audit-trigger rollback/retry paths passed.
- Browser editor/accessibility smoke: PASS.
- CodeQL: PASS.
- Candidate evidence consolidation: PASS.
- The mainline-only signed dependency/SBOM attestation job was expectedly skipped for the pull-request event; it was not represented as PR-head attestation.

## Exact-mainline acceptance

After PR #166 merged, exact-main push [workflow #673](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43790202761) completed successfully on main SHA `4e3efd859b0447ee215d26343314da25d0a867c2`. All seven jobs passed: Node.js 22, Node.js 24, PostgreSQL/Memgraph integration, browser editor/accessibility smoke, CodeQL, signed dependency/SBOM attestation and evidence consolidation.

The live integration evidence records **105/105 passed, zero failures, zero skips**. Fresh migrations applied **18/18**; the second idempotency pass skipped **18/18** as already applied. Both supported Node matrices passed **630/630 Hub tests** and **94/94 EnginEx tests**, with no skips.

### Signed supply-chain identity

Mainline verification records:

- Source ref: `refs/heads/main`
- Source revision: `4e3efd859b0447ee215d26343314da25d0a867c2`
- Package: `virgoscorpio-hub@0.6.2`
- Lockfile SHA-256: `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`
- CycloneDX SBOM SHA-256: `25d8919eb9766ce99212533bd041956ea247c738566b9388c6982ce4d1c0e265`
- Provenance subjects verified: `package-lock.json` and `virgoscorpio-hub.sbom.cdx.json`
- Predicate type: `https://cyclonedx.org/bom`
- Signed SBOM predicate matches the generated file: true.

### Run-bound GitHub Actions artifacts

Archive digests below are GitHub Actions artifact archive SHA-256 values, not inner-file hashes. All artifacts were reported unexpired when inspected; their listed expiration is 14 February 2027 at approximately 02:07 UTC.

| Artifact | ID | Archive SHA-256 |
|---|---:|---|
| Node 24 CI evidence | 14192605024 | `d9f952a34e724e342c0df910a077f342c7e8db19ebb63bd548c7c73a2049bac9` |
| Live integration Node 22 | 14192351049 | `a942862c34a4809f5f44a1f72c559513a2ff2b01ecc24416d0464a547eaaae32` |
| CodeQL evidence | 14192245533 | `ce93e5eaae733ecec6605d744991d8bb18f044f8137b2087bf80b0e813a05267` |
| Signed supply-chain attestations | 14192240801 | `ecee669ff2aabfebbfb46ce6f28cde483d2d5feca33dc0d01a532ed03301f49b` |
| Browser/accessibility evidence | 14192125971 | `1b1a42509751f2d51a941a6e820a1c667b220ad24fdbfd2085b4d67f44723cf2` |
| Node 22 CI evidence | 14191863932 | `e1d14a7af79bdff72ac538ed5738eace81d044a8e64430b92cc38f520f3c819e` |
| Node 24 dependency evidence | 14191863890 | `4e17c88400af353bee9a1d6ed2b00d49fc793852adef1bcb6bda734f0f03e375` |
| PostgreSQL/Memgraph CI evidence | 14191844156 | `476eee5af679229721bf3b1a3952c7fe0262634bf4be305c15c1e4b7e4415aa9` |
| Release-readiness CI evidence | 14191634947 | `76603bac3510c2725801a7793a6aaaa11002f9ae719f07d32ddb7ea036373463` |
| Node 22 dependency evidence | 14191634673 | `6f1725b81cbed8cecc32a2b81949bf6377c1434b91e0ac5f0e3ca3bb8ec1e844` |

## Release-readiness boundary

The canonical release-readiness artifact for the exact mainline source remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**. It records `readyForProduction: false` and `NOT_PRODUCTION_CERTIFIED`. The 14 missing evidence gates and two partial gates remain as documented in the [15 November 0.6.2 release-gate baseline](2026-11-15-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) and the exact-main readiness artifact from workflow #673.

This change and its passing automation do not complete independent tenant review #14, platform security assessment #25, or human dependency/license/distribution review #23. It also does not complete external provider validation, manual WCAG acceptance, load/backup/restore, operations approval or product parity acceptance.

**Production remains NO-GO.** Package 0.6.2 remains private/unreleased. No release tag, publication, deployment or SemVer increment is authorized.

## Next bounded engineering increment

Source review identified the remaining legacy media route `POST /api/v1/media/uploads`: it commits the `media_assets` row in the local/S3 media store and only then writes `media.uploaded` using a separate pool operation. F1.39 issue [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) tracks making that mutation/audit pair transaction-atomic while preserving best-effort compensation for local/S3 objects. This is a distinct store family from the F1.38 library implementation.

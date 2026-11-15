# F1.32 — Relationship mutation audit atomicity candidate

**Date:** 14 November 2026
**Status:** Corrected exact-head hosted functional CI passed; PR #149 remains open for human review; not merged.
**Issue:** [#148 — Make relationship mutation audit events atomic](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/148)
**Parent:** [#124 — Maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Original source baseline:** main at `c084e8916e9d4ac51a55154a4fad4f7b1cd65820`
**Rebased PR base:** main at `63e4db46426c606b73fea6d03bc4ea6a54219f16` (includes merged F1.31)
**Branch:** `security/f1-32-relationship-audit-atomicity-2026-11-14`

## Source finding

The site relationship create and delete routes in `apps/api/src/server.js` already use a PostgreSQL transaction for the relationship row and its durable outbox event. However, each route committed before calling the identity service's pool-backed audit default:

- `POST /api/v1/sites/:siteId/relationships` — `relationship.created`
- `DELETE /api/v1/sites/:siteId/relationships/:relationshipId` — `relationship.deleted`

An audit persistence error could therefore produce an API error after the relationship and outbox had committed without the corresponding audit event. Mainline already provides the compatible `identity.audit(input, { queryable })` contract, so no new transaction abstraction is needed.

## Bounded change

Both mutation paths now pass their existing transaction client to `identity.audit(..., { queryable: client })` before `COMMIT`. A failed audit insert consequently follows the existing rollback path. The pool-backed default remains unchanged for unrelated audit callers.

The route authorization and tenant predicates, endpoint existence and node-type checks, metadata bounds, duplicate mapping, row lock, soft-delete/version behavior, outbox envelope, actor/request correlation and HTTP response contracts are otherwise unchanged. There is no schema or migration change.

## Regression coverage

The existing two-site PostgreSQL integration fixture now has a reusable, uniquely named, automatically cleaned-up audit-failure trigger helper and a relationship mutation subtest. It exercises:

- Cross-site endpoint rejection, endpoint-type rejection and invalid metadata without relationship, outbox or audit side effects.
- A forced `relationship.created` audit failure, proving that both the relationship row and its outbox event roll back; a normal retry then persists one relationship/outbox/audit set with actor, request and site correlation.
- Duplicate relationship conflict behavior without a second outbox/audit event.
- A forced `relationship.deleted` audit failure, proving that the active row/version and original outbox event remain unchanged; a normal retry soft-deletes once and writes one correlated delete outbox/audit pair.
- A Site A control relationship that remains unchanged during Site B failure injection.

The test runs only when the dedicated PostgreSQL integration environment is enabled; it is not part of the default top-level unit-test command.

## Local validation

| Check | Result |
|---|---|
| `node --check apps/api/src/server.js` | PASS |
| `node --check test/integration/tenant-content-object-isolation.integration.test.js` | PASS |
| `npm run security:tenant-inventory` | PASS — 27 flow families, 78 route patterns, 21 source files, 43 test references |
| Tenant inventory `--check` | PASS — current; source digest `18415024e83f8bb3b0b838befb69df75a4f01c242257b12974b6a85efcc92bf6` |
| `npm run check` | PASS — 608 tests, 605 passed, 0 failed, 3 Windows-specific platform skips; 235 required paths and 246 JavaScript files verified |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `npm audit --omit=dev --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| Internal Markdown links | PASS — 134 Markdown files, 441 local links, 0 missing targets |

**Local live database boundary:** the attempt to run `scripts/test-integration-live.js` stopped before migrations or integration tests because PostgreSQL was not listening at `127.0.0.1:5432` (`ECONNREFUSED`). No live PostgreSQL/Memgraph result is claimed locally. The exact candidate revision must pass hosted CI's disposable PostgreSQL/Memgraph integration job with zero skips.

## Test-fixture request-throttle isolation

The tenant-content-object integration server now sets RATE_LIMIT_MAX_REQUESTS=1000 in its test-only environment. The relationship rollback/retry coverage adds HTTP requests to a shared API fixture; the existing default request ceiling of 60 caused three later tenant-content assertions to receive 429. This test-only setting isolates tenant authorization assertions from the unrelated global request throttle. No production rate-limit behavior or default is changed.

## Hosted CI validation

The first exact-head PR workflow #625 (run 43655440155) executed 98 PostgreSQL/Memgraph integration tests: 95 passed, zero failed and zero skipped. The new F1.32 rollback/retry regression passed. Three existing tenant-content assertions returned HTTP 429 because the expanded HTTP test set exhausted the shared fixture default request ceiling of 60. The test-only fixture ceiling was raised to 1000; production rate-limit settings remain unchanged.

The corrected exact-head PR workflow [#627](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43656852133) passed all functional jobs on commit 046c61b4b7db21a6d8d2e1883c55619404a7a3da with PR base 63e4db46426c606b73fea6d03bc4ea6a54219f16:

- Node.js 22.23.4 and 24.22.1: 608/608 Hub tests and 94/94 EnginEx tests per runtime, zero skips.
- PostgreSQL/Memgraph: 98/98 integration tests passed, zero failures and zero skips.
- Migrations: 18/18 fresh migrations applied, 18/18 idempotent re-entry checks skipped as already applied.
- Browser editor/accessibility smoke: 9/9 passed.
- CodeQL and candidate evidence consolidation passed.
- Branch-only lockfile/SBOM attestation skipped as designed for a non-mainline PR; signed mainline attestation remains a main-only gate.

GitHub records no formal human review submission for PR #149. This is maintainer/automation evidence, not independent security approval. The live database suite passed in hosted CI; the separate local live test attempt remains NOT RUN because PostgreSQL refused the local 127.0.0.1:5432 connection.

## Release and assurance boundary

This is maintainer implementation and automated-test evidence, not an independent security assessment. Independent tenant review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and platform security review [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain OPEN / NOT PERFORMED.

No route contract, schema, migration, dependency, provider, lockfile, package version or SemVer change is included. `virgoscorpio-hub@0.6.2` remains private and unreleased. No tag, publication, deployment or production-data testing is authorized. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

F1.31 has since merged through [PR #147](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/147) at main commit 63e4db46426c606b73fea6d03bc4ea6a54219f16; exact-main workflow #622 (run 43653758324) passed all seven jobs, including 97/97 live PostgreSQL/Memgraph tests with zero skips. GitHub records no formal human review submission for PR #147. F1.32 is based on the merged F1.31 mainline and remains a separate relationship-mutation change. Corrected exact-head PR workflow #627 passed all functional jobs, including 98/98 live PostgreSQL/Memgraph tests with zero skips. PR #149 remains open for human review.

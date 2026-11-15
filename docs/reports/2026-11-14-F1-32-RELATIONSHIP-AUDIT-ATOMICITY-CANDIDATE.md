# F1.32 — Relationship mutation audit atomicity candidate

**Date:** 14 November 2026
**Status:** Maintainer candidate; local unit checks pass; hosted live integration and exact-head CI pending; not merged.
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
| Internal Markdown links | PASS — 133 Markdown files, 442 local links, 0 missing targets |

**Local live database boundary:** the attempt to run `scripts/test-integration-live.js` stopped before migrations or integration tests because PostgreSQL was not listening at `127.0.0.1:5432` (`ECONNREFUSED`). No live PostgreSQL/Memgraph result is claimed locally. The exact candidate revision must pass hosted CI's disposable PostgreSQL/Memgraph integration job with zero skips.

## Test-fixture request-throttle isolation

The tenant-content-object integration server now sets RATE_LIMIT_MAX_REQUESTS=1000 in its test-only environment. The relationship rollback/retry coverage adds HTTP requests to a shared API fixture; the existing default request ceiling of 60 caused three later tenant-content assertions to receive 429. This test-only setting isolates tenant authorization assertions from the unrelated global request throttle. No production rate-limit behavior or default is changed.

## Hosted CI diagnostic — first exact-head attempt\n\nPR workflow #625 (run `43655440155`) reached the PostgreSQL/Memgraph suite. The dedicated F1.32 relationship rollback/retry subtest passed. Three existing tenant-content assertions in the shared integration server received HTTP 429 instead of their expected 404/200 responses; the fixture's default global API request limit (60) was exhausted by the extra HTTP coverage. The evidence aggregator failed as a consequence of the live-integration job failure. The integration fixture now sets `RATE_LIMIT_MAX_REQUESTS=1000` for that test server only; production configuration and defaults are unchanged. This is a test-harness isolation correction, and a new exact-head CI run is required before acceptance.\n\n## Release and assurance boundary

This is maintainer implementation and automated-test evidence, not an independent security assessment. Independent tenant review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and platform security review [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain OPEN / NOT PERFORMED.

No route contract, schema, migration, dependency, provider, lockfile, package version or SemVer change is included. `virgoscorpio-hub@0.6.2` remains private and unreleased. No tag, publication, deployment or production-data testing is authorized. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

F1.31 has since merged through [PR #147](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/147) at main commit 63e4db46426c606b73fea6d03bc4ea6a54219f16; exact-main workflow #622 (run 43653758324) passed all seven jobs, including 97/97 live PostgreSQL/Memgraph tests with zero skips. GitHub records no formal human review submission for PR #147. F1.32 has been rebased onto that current mainline; its relationship-mutation diff remains separate. Exact-head hosted CI for PR #149 is pending.

# F1.29 Site-Creation Audit Atomicity — Candidate Engineering Report

**Date:** 14 November 2026
**Issue:** [#141 — Make site creation audit writes transactional](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/141)
**Parent:** [#124 — Maintainer-led tenant-isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Branch:** `security/f1-29-site-creation-audit-atomicity-2026-11-14`
**Base main SHA:** `e4712202d3d29c5517e335df658ce5f6d72a25cb`
**Disposition:** Implemented locally; not merged; hosted CI pending; independent review not performed.

## Finding

At the base main revision, `POST /api/v1/sites` called `identity.createSite()`, which committed the new site and its initial `site-owner` membership. The route then issued a separate `identity.audit()` call for `site.created`. An audit persistence failure after the first commit could therefore leave a usable site and owner membership without the corresponding audit event.

## Implementation

The service now reuses the existing `withTransaction(pool, work)` and `insertAuditEvent(queryable, input)` helpers. Site creation, initial owner membership and the correlated `site.created` audit insert execute through one PostgreSQL transaction. The service receives the request ID from the route, and the route no longer performs a second audit write.

The existing `site:manage` authorization check, slug/name validation, developer-token denial before body parsing, response shape, and duplicate-slug HTTP 409 behavior are preserved. The unique-slug mapping is scoped to the `sites` insert so an unrelated unique-constraint error from audit persistence is not mislabeled as a slug collision. No authorization invalidation, owner-transfer API, schema migration, API contract change, dependency/provider/lockfile change, or SemVer change was introduced.

## Validation on the candidate worktree

| Check | Result |
|---|---|
| Focused auth/API tests | **43/43 passed**, zero failures/skips |
| Dedicated tenant-membership PostgreSQL integration | **21/21 passed**, zero failures/skips |
| Disposable PostgreSQL | PostgreSQL 18; all **18/18** migrations applied to a fresh isolated database |
| Tenant-isolation inventory | **27 flow families, 78 declared route patterns, 21 source files, 42 test references**; generator freshness check PASS |
| Repository artifact / JavaScript syntax verification | **235 required paths, 246 JavaScript files syntax-checked**, PASS |
| Dependency audit | `npm audit --audit-level=high`: **0 vulnerabilities** |
| Diff hygiene | `git diff --check`: PASS |

The live PostgreSQL test installs a temporary trigger that fails only for `site.created`. It confirms the failed request leaves no site, owner membership or audit record; after removing the trigger, a retry creates exactly one site, one initial owner membership and one request-correlated audit row. The disposable PostgreSQL container was removed after validation. The pre-existing development Memgraph container was left untouched.

The final full `npm run check` passed **607 tests, 604 passed, 0 failed, 3 platform-specific skips**. `node scripts/verify.js` passed with 235 required paths and 246 JavaScript files syntax-checked. The tenant inventory is current (27 families, 78 route patterns, 21 source files, 42 test references; source SHA-256 `1a830cfea7eded8647e49e6aec7da1d8e5ca85028d21a3e46f5ff70a4e89d2be`). `npm audit --audit-level=high` reported zero vulnerabilities; `git diff --check` passed.

## Boundaries and remaining acceptance

This is maintainer-authored implementation and test evidence only. It is not an independent tenant-isolation or platform security assessment. The candidate has not yet been pushed, so no hosted PR/push CI exists for this change; hosted validation remains a required acceptance step. Issue #141 remains OPEN pending review, hosted validation and eventual merge. Parent #124 remains OPEN.

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED. The current mainline readiness record remains exact-main workflow #603 with **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE**, `readyForProduction: false`, and `NOT_PRODUCTION_CERTIFIED`. F1.29 candidate results are not mainline release evidence and must not be copied into `RELEASE-MANIFEST.json`.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO**. No release tag, GitHub Release, npm publication, deployment or SemVer increment is authorized.

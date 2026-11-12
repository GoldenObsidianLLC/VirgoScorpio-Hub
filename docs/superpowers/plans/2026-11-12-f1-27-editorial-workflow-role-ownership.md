# F1.27 Editorial Workflow Role and Ownership Gates — Plan

**Date:** 12 November 2026

**Status:** Implementation, focused API tests, and the local full repository check are complete; exact-head hosted PostgreSQL/Memgraph validation remains pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).

**Design:** [F1.27 design](../specs/2026-11-12-f1-27-editorial-workflow-role-ownership-design.md).

## Objective

Enforce the existing author own-content edit boundary when submitting a draft for review, and add a live role matrix for editor and site-owner editorial workflow actions without changing the workflow API or data model.

## Work

- [x] Trace workflow capability grants and the existing `canEditContent` helper.
- [x] Reuse the existing authorization helper for `submit-review` after site capability authorization and before the store transition.
- [x] Reuse seeded `site-owner`, `editor`, and `author` roles in the existing two-site PostgreSQL integration fixture.
- [x] Extend the no-side-effect oracle to include content-scoped audit events.
- [x] Add live role cases for author own-draft submission, same-site non-owner submission denial, editor submission/approval/rejection, editor publish/schedule/archive/unpublish denial, and site-owner publish/archive.
- [x] JavaScript syntax validation passed for the modified API route and integration spec.
- [x] Focused `node --test test/api.test.js` passed 26/26, zero failures/skips, including own-draft allow and non-owner draft denial before transition/audit.
- [x] Regenerate the source-anchored tenant-isolation inventory: 27 flow families, 78 route patterns, 21 source files and 42 test references.
- [x] Run `npm run check`: 595 tests, 592 passed, 0 failed, 3 Windows-specific skips; artifact verification covered 235 required paths and syntax-checked 243 JavaScript files.
- [x] Run `git diff --check` and changed-Markdown relative-link/conflict-marker validation.
- [ ] Execute the live workflow role/ownership fixture on exact-head hosted PostgreSQL/Memgraph CI with zero integration skips.
- [x] Reconcile the candidate state and latest local check counts in README/docs index, implementation/product roadmaps, release scope/readiness/report, maintainer assurance policy and generated route inventory; exact-head hosted validation remains pending.
- [ ] Obtain human review; no formal PR review submission is currently recorded.

## Local validation boundary

The Windows maintainer host does not have a disposable PostgreSQL `DATABASE_URL`; the live integration fixture is expected to skip locally. Focused API unit tests, syntax checks, and `npm run check` do not count as execution of the database-backed role/ownership assertions.

## Boundaries

This is maintainer-led, non-production engineering. It does not authorize new owner-transfer behavior, production deployment, provider qualification, release tags, package publication or SemVer change. Independent reviews #14/#25 remain OPEN / NOT PERFORMED; issue #23 remains OPEN / PARTIAL; production remains **NO-GO**. Issue #124 remains open.

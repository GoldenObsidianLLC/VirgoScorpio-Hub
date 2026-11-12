# F1.25 Site-Scoped Content-Type Definition Concurrency and Role Gate — Plan

**Date:** 12 November 2026

**Status:** Exact-head hosted validation complete on final code/test head `d37cde71daa84e75a2ad2cae8701c9d98a08a1ca`; human review remains pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).

**Design:** [F1.25 design](../specs/2026-11-12-f1-25-content-type-definition-concurrency-design.md).

**Base:** `5929a53a1c551a2fe43bc38e61cb63dbecec52f5` (post-PR #129 main).

## Objective

Use the existing live two-site PostgreSQL fixture to verify that non-admin registry writes fail before persistence and overlapping same-site writes to one custom content-type slug serialize into monotonically increasing versions without mutating an identically named definition in another site.

## Work

- [x] Inspect the content-type registry handler, `site:manage` capability resolution, transaction/advisory-lock path, migration uniqueness, fixture identities and existing Site A/B test.
- [x] Add a Site B editor identity with content read/create/edit but no `site:manage`; preserve existing test user/role cleanup.
- [x] Assert the editor can read the scoped registry but cannot create a definition; require 403 and zero database row/side-effect changes.
- [x] Issue two concurrent Site B definition POSTs for the same site/slug.
- [x] Assert both succeed with versions 2 and 3, exactly one active Site B version, versions 1 and 2 inactive, and the active registry response matches the request that received version 3.
- [x] Assert Site A's same-slug version 1 row remains active and unchanged.
- [x] Retain existing content-record Site A/B list/detail isolation and site-selector mismatch/no-side-effect assertions.
- [x] Run focused test suites and JavaScript syntax checks: Node syntax check passed; `test/content-type-routes.test.js` and `test/content-owner-store.test.js` passed 20/20.
- [x] Run `npm run security:tenant-inventory`; generated 27 flow families, 78 route patterns, 21 source files and 41 test files; full-check inventory freshness passed.
- [x] Run `npm run check`: 594 tests, 591 passed, 0 failed, 3 Windows-specific skips; 235 required paths and 243 JavaScript files syntax-checked.
- [x] Run `git diff --check`; passed.
- [x] Validate relative Markdown links; 158 links across 11 changed/new Markdown files, zero broken.
- [x] Opened draft [PR #130](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/130) against current main `5929a53a1c551a2fe43bc38e61cb63dbecec52f5` at head `d37cde71daa84e75a2ad2cae8701c9d98a08a1ca`.
- [x] Exact-head push workflow [#575](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43191238551) and pull-request workflow [#576](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43191393692) both passed all required non-attestation jobs. Each live PostgreSQL/Memgraph suite passed **92/92, zero failures, zero skips**, including both F1.25 regressions. Node 22/24 each passed **594/594, zero failures/skips**; CodeQL passed; browser/accessibility passed 9/9; collaboration Playwright passed 3/3; dependency audit reported 0 vulnerabilities. Main-only signed attestation was skipped by design on feature-branch events.
- [x] Reconciled the implementation roadmap, roadmap, README/docs index, release readiness/scope, release-gate report, assurance policy and generated inventory to F1.25 hosted evidence while preserving main SHA/workflow #574 as the current-main baseline.
- [ ] Human review remains pending; PR #130 remains draft/open and no issue closure is requested.

## Validation boundary

The live PostgreSQL integration is skipped locally on this Windows host without a disposable `DATABASE_URL`; the local skip is not claimed as a pass. Exact-head push/PR workflows #575/#576 each executed the fixture on head `d37cde71daa84e75a2ad2cae8701c9d98a08a1ca` with **92/92 passed, zero failed, zero skipped**. Both supported Node matrices, CodeQL, browser/accessibility, collaboration Playwright and evidence consolidation passed. Main-only attestation was skipped by design on feature-branch events. This is maintainer/automation validation, not independent security approval.

## Boundaries

No production runtime change, schema/migration, public API, dependency, provider, package version, release tag, publication, deployment or independent-review approval is in scope. Independent reviews #14/#25 remain OPEN / NOT PERFORMED; issue #23 remains OPEN / PARTIAL; production remains **NO-GO**.

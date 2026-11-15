# F1.33 — Site AI-policy mutation audit atomicity candidate

**Date:** 15 November 2026
**Status:** Hosted exact-head functional CI passed; PR #151 is open for human review; not merged.
**Issue:** [#150 — Make site AI-policy update and audit atomic](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/150)
**Parent:** [#124 — Maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Main baseline:** 9230177d3155d9ff9134180a67ed69203d618c0f (includes merged F1.32 / PR #149)
**Branch:** security/f1-33-ai-policy-audit-atomicity-2026-11-15

## Source-confirmed finding

The site AI-policy PUT route in apps/api/src/server.js previously persisted the site_ai_policies INSERT/ON CONFLICT UPDATE through the pool, then called identity.audit() through its pool-backed default in a separate operation. If audit persistence failed, the API could return an error after the policy had committed, leaving new tenant AI-governance settings without the corresponding ai.policy_updated audit event.

Mainline already provides identity.audit(input, { queryable }) and the shared withTransaction(pool, work) utility. No new abstraction or migration is required.

## Bounded implementation

The policy upsert and correlated ai.policy_updated audit insert now execute inside one withTransaction(localPool, work) transaction. The existing transaction client is passed to identity.audit(input, { queryable: client }) before COMMIT. The returned policy row is preserved for the existing 200 response.

The existing policy validation order, site selector reconciliation, site:manage authorization, global provider allowlist, external-content deployment approval, mandatory-human-review rule, persisted columns, actor/request correlation, response shape and status remain unchanged. Unrelated identity.audit callers retain the pool-backed default.

No schema, migration, API contract, dependency, provider, lockfile, package version or SemVer change is included.

## Regression coverage

test/integration/tenant-isolation.integration.test.js adds a nested two-site PostgreSQL regression using the existing site A/site B authenticated fixture. It seeds distinct AI-policy control rows and verifies:

- Forced ai.policy_updated audit-trigger failure rolls the Site B upsert back to its exact prior policy snapshot and leaves no correlated audit row.
- Safe retry commits the requested Site B policy once and writes one audit event with the expected actor, site, target type, request ID and details.
- Site A policy state remains unchanged during Site B failure injection and after the successful Site B retry.
- Conflicting site selectors, a member without site:manage, invalid quota input, a provider excluded by the global allowlist and unapproved external content retain their existing error behavior and create no audit side effects.
- Trigger and function names are unique to the test and both are dropped in finally; final audit cleanup is scoped to the test sites and request IDs.

The failure trigger is scoped to action ai.policy_updated and the isolated Site B ID; no production setting or rate ceiling is changed.

## Local validation

| Check | Result |
|---|---|
| npm run check | PASS — 608 tests, 605 passed, zero failures, three Windows-specific platform skips |
| Artifact verifier | PASS — 235 required paths and 246 JavaScript files syntax-checked |
| npm audit --audit-level=high | PASS — zero vulnerabilities |
| npm audit --omit=dev --audit-level=high | PASS — zero vulnerabilities |
| Tenant inventory generation and --check | PASS — 27 flow families, 78 route patterns, 21 source files, 43 test references |
| Markdown local links | PASS — 135 Markdown files, 441 local links, zero missing targets |
| Changed JavaScript syntax and git diff --check | PASS |

## Live integration boundary

The dedicated PostgreSQL integration test is gated by DATABASE_URL and VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true. Neither is configured in this local environment; the live suite was NOT RUN locally. The exact candidate revision must pass hosted PostgreSQL/Memgraph integration with zero skips, supported Node matrices, CodeQL, browser smoke and evidence consolidation.

## Hosted CI validation

The first exact-head push/PR workflows #631/#632 failed because the generated tenant-isolation inventory did not reflect the newly changed source/catalog. The AI-policy transaction regression itself had no reported failure in that attempt. The generator was rerun, the generated inventory and route map were refreshed, and the follow-up was committed as documentation-only commit 3228f66fc9cdeb8fc69367bc1c8a457d722b9b15.

Corrected exact-current-head push workflow #633 (run 43664467084) and PR workflow #634 (run 43664470029) both passed all functional jobs on 3228f66fc9cdeb8fc69367bc1c8a457d722b9b15. Node.js 22.23.4 and 24.22.1 each passed 608/608 Hub and 94/94 EnginEx tests with zero skips; PostgreSQL/Memgraph passed 99/99 with zero skips, including the ai.policy_updated audit-trigger rollback/retry regression; 18/18 fresh migrations and 18/18 idempotent re-entry checks passed; Playwright 9/9; CodeQL; and candidate evidence consolidation passed. Branch-only dependency/SBOM attestation skipped as designed for non-mainline workflows. The initial runs #631/#632 failed only because generated inventory outputs were stale after source/catalog changes; docs-only commit 3228f66 regenerated them and current-head validation is green.

GitHub records no formal human review submission for PR #151. The separate local live database attempt remains NOT RUN due missing DATABASE_URL/integration enable flag; the hosted disposable PostgreSQL/Memgraph run supplies the live integration result.

## Mainline and assurance boundary

F1.32 merged through PR #149 at main 9230177d3155d9ff9134180a67ed69203d618c0f; issue #148 is CLOSED. Exact-main workflow #630 passed 98/98 PostgreSQL/Memgraph tests with zero skips and all seven jobs. GitHub records no formal human review submission for PR #149; maintainer merge and CI evidence are not independent approval.

This F1.33 candidate is maintainer implementation evidence only. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED. Package 0.6.2 remains private and unreleased. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED. No release, publication, deployment or production-data testing is authorized.

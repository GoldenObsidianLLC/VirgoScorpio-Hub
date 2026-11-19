# F1.53 — Community friendship creation race revalidation

**Status:** Merged maintainer implementation; [PR #211](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/211) merged into main at e8913fa812304e80dc4c8846f7ea637a2fa4e4d1 on 18 November 2026 America/Chicago, closing issue [#210](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/210). Candidate workflows #771/#772 and documentation-only follow-up #773/#774 passed their six applicable jobs; exact-main workflow #776 passed all seven jobs. No formal PR review or independent assessment is recorded.

**Runtime implementation commit:** `5ddae486ff39635f33b0594475626542643d18fb`.

**Code-bearing candidate head validated by workflows #771/#772:** `62b14371ca430f9d7723bf816924b74568060af8`.
**Final PR head at merge:** `f4193675fc729cc5d1648a7054f2443ff4378f08`.
**Merged mainline:** `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1`; exact-main workflow #776 passed 7/7 jobs; readiness artifact #14493590005 is bound to that SHA.

**Implementation branch:** `security/f1-53-community-friendship-create-race-2026-11-18`

**Base repository main before merge:** `c07c10763f0660c3d0d60b755de0429211f75b14`

**Runtime baseline:** F1.52 merge `ccd454c0fa8bc49a91526756819af451c1a390d2`

**Package:** `virgoscorpio-hub@0.6.2` (private and unreleased)

## Finding

The community friendship-create handler previously validated the target participant's active account and same-site membership in a preliminary SELECT, then performed the friendship INSERT in a separate statement. If the target account was disabled or its membership was revoked after that preflight but before the INSERT, the handler could still create a pending friendship. The authenticated requester had the same time-of-check/time-of-use exposure if its account or membership changed after request/site authorization.

The defect is a write-boundary authorization race, not a new API or data-model requirement. Issue #210 records the pre-fix PostgreSQL reproduction: a participant was changed from eligible to disabled between preflight and friendship INSERT, and the old route still wrote the friendship.

## Implementation

The existing `POST /api/v1/sites/{siteId}/community/friends/{userId}` route and early preflight remain in place. The final parameterized write is now an `INSERT ... SELECT` that:

1. Materializes and locks both participant user rows in deterministic UUID order.
2. Materializes and locks every corresponding membership row for the requested site in deterministic user-ID / role-ID order.
3. Inserts only when both user rows still have `status = 'active'` and both participants still have at least one membership row for that site.
4. Uses membership `EXISTS` predicates, rather than joining multiple role rows into the INSERT source, so multiple memberships cannot multiply the source row or trigger an `ON CONFLICT` cardinality error.
5. Preserves the existing `ON CONFLICT` policy: blocked friendships remain blocked, while existing accepted/pending states are not downgraded.

The existing non-disclosing `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND` response is retained when the final write has no eligible participant pair. The route path, HTTP methods, success status, response payload shape, and existing friendship status contract remain unchanged.

The implementation adds no route helper, public API, database schema, migration, dependency, lockfile, or package-version change.

## Regression coverage

The existing two-site live PostgreSQL fixture was extended to cover the stale-preflight window for both participants:

- Addressee disabled after the active-membership preflight.
- Requester disabled after request authentication/site authorization.
- Addressee membership revoked after the active-membership preflight.
- Requester membership revoked after request authentication/site authorization.

Each case asserts the generic 404, checks that requester/recipient IDs and display names are not disclosed, and compares complete Site A/Site B community snapshots to ensure no friendship or unrelated community side effect is written. The injected account/membership change is verified and then restored.

Separate concurrency tests hold a participant user row or membership row in a PostgreSQL transaction while the API request reaches the friendship INSERT. They verify the write waits on the row lock, then observes a disablement or membership revocation committed before the INSERT can proceed. The response remains a generic 404 and both site snapshots remain unchanged.

Additional compatibility coverage verifies that:
- Multiple role memberships for both participants still create/update exactly one friendship row (the `EXISTS` predicates prevent duplicate INSERT source tuples).
- An existing blocked friendship remains blocked after a repeated create request.
- Existing active friendship acceptance and the prior inactive-recipient / requester-lifecycle cases continue to pass.

## Validation

Local Windows host, Node.js 26.12.1, disposable/local PostgreSQL 18 test database:

- Focused `tenant-community-object-isolation.integration.test.js`: **20/20 passed**, zero failures, skips, or TODOs.
- Full `npm run check` (using `NODE_OPTIONS=--max-old-space-size=4096`): **670 tests total; 667 passed, 0 failed, 3 Windows-specific skips**.
- Artifact verification: **238 required paths** and **268 JavaScript files** syntax-checked.
- Tenant-isolation inventory regenerated and freshness-checked: **28 families / 80 declared route patterns / 21 source files / 57 test files**.
- `git diff --check`: passed.
- Updated Markdown link audit across all 9 Markdown files in the PR diff: **241 relative links checked, 0 broken targets**.
- All 18 repository migrations were already present in the local test database; the migration command confirmed 18/18 existing migrations as already applied. This is not a fresh-database migration claim.
- Exact-head push workflow [#44434648866 / run #771](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44434648866) and PR workflow [#44434656869 / run #772](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44434656869) both passed on PR head `62b14371ca430f9d7723bf816924b74568060af8`. Each run passed all six applicable jobs: Node.js 22.23.4, Node.js 24.22.1, PostgreSQL/Memgraph integration, browser editor/accessibility smoke, CodeQL and candidate evidence consolidation. The mainline-only dependency/SBOM attestation job was skipped by design on candidate events; no exact-main readiness or signed mainline attestation is claimed for F1.53.

## Merge and exact-main validation

PR #211 merged on 18 November 2026 America/Chicago at main SHA `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1`, closing issue #210. Exact-main [workflow #44445082339 / run #776](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44445082339) passed all seven jobs on that exact SHA:

- Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub and 94/94 EnginEx tests with zero failures/skips; both npm audit scopes reported zero vulnerabilities.
- Live PostgreSQL/Memgraph passed 153/153 with zero failures, skips or TODOs. All 18 migrations applied to a fresh database and all 18 passed the idempotent second pass.
- Browser smoke and CodeQL passed. Mainline SLSA provenance and CycloneDX SBOM attestations were created and verified; exact-source evidence consolidation passed.
- Post-producer readiness artifact #14493590005 is source-bound to the merge SHA (archive SHA-256 `38a8d9b4c479cff4ac6145cbe31afd715e04f9c69c661762addd6bf2a90ed7b9`; readiness JSON SHA-256 `d9d0ed95c4fe60d50ccb4054d0c7b6d75aa67ea88e13bad1c8043e13633987a0`). It remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction=false`.

PR #211 has zero formal review submissions and zero inline review threads; this is maintainer/automation evidence only, not independent tenant or platform security approval.

## Security and release boundary

This is maintainer-authored regression and concurrency evidence. It does not satisfy or replace the independent tenant/site-isolation assessment in issue #14 or broader independent platform security assessment #25. Those reviews remain OPEN / NOT PERFORMED. Qualified dependency/license review #23 and the remaining identity, provider, malware, browser, parity, plugin-isolation, load/restore, observability, operations and governance evidence gates remain separate.

F1.53 is merged at main SHA `e8913fa812304e80dc4c8846f7ea637a2fa4e4d1` and validated by exact-main workflow #776. It is not a release or production approval. Package 0.6.2 remains private/unreleased; canonical readiness remains **8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE**, `readyForProduction=false`, production **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, tag, GitHub Release, npm publication, deployment, or production-data use is authorized.

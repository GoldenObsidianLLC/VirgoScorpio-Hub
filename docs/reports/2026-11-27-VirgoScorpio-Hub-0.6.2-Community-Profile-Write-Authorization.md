# VirgoScorpio Hub 0.6.2 — Community Profile Write Authorization Revalidation

**Date:** 27 November 2026 (America/Chicago)  
**Increment:** F1.79  
**Issue:** [#318](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/318) — closed  
**Implementation PR:** [#319](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/319) — merged  
**Merge commit:** `2b4d5a5c096f704eb8a7c3066ba1e5c8dccb0542`  
**Exact-main CI:** [workflow #46072736082](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46072736082) — success, 7/7 jobs  
**Package:** `virgoscorpio-hub@0.6.2` — private and unreleased

## Finding and hosted reproduction

The community profile route, `PUT /api/v1/sites/:siteId/community/profile`, checked site membership during request-time preflight and then wrote `social_profiles` through a direct pool query. Membership could be revoked after preflight but before that autocommit upsert. The upsert could therefore persist a profile and increment its version for an actor who no longer belonged to the site.

The race was reproduced before the fix against commit `2fac2c7f9e68323da8039e3d4ae6534988edf2c4` in [hosted workflow #46071303082](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46071303082), PostgreSQL/Memgraph job `140748610119`. The integration test paused the real PUT handler after successful site authorization, held an independent transaction that deleted site membership, resumed the handler, then committed the revocation. The vulnerable handler completed its profile upsert; the post-revocation snapshot contained the new profile row at version 1 where the expected snapshot was empty. The pre-fix job was intentionally red because the regression correctly detected the stale write.

## Implementation

PR #319 moved the profile upsert inside `withTransaction` and calls the existing `assertActiveSiteMembership` helper on the transaction client before mutation. The helper enforces the established site-first authorization lock ordering, serializing the write with site-member revocation.

The change reuses shared authorization logic rather than copying membership/account SQL. It preserves profile GET behavior, the existing tenant-denial 403 contract, the optimistic-version 409 contract, and the response shape. No schema or migration was needed.

## Regression coverage

The hosted two-site PostgreSQL regression verifies the real-route preflight/revocation barrier, rejection after membership revocation, no profile/version/metadata side effect, preservation of the other site's snapshot, successful profile mutation by an active member, and unchanged stale-version conflict behavior.

The source-anchored tenant-isolation inventory and Markdown capability map were regenerated: 28 route families, 80 declared route patterns, 22 source files and 61 test references.

## Validation evidence

- Candidate push [#46072067810](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46072067810) and PR-context [#46072258907](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46072258907) both completed successfully.
- Node.js 22.23.4 and 24.22.1 each passed 1,145/1,145 Hub tests with zero skips.
- Hosted PostgreSQL/Memgraph passed 204/204 with zero failures and zero skips.
- Browser smoke passed 9/9; CodeQL and candidate evidence consolidation passed.
- Local full Hub suite: 1,142 passed, 0 failed, 3 platform-conditional skips (1,145 total). `node scripts/verify.js` passed (241 required paths / 316 JavaScript files); changed JavaScript syntax checks and `git diff --check` passed.
- Exact-main workflow [#46072736082](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46072736082) passed 7/7 on merge SHA `2b4d5a5c096f704eb8a7c3066ba1e5c8dccb0542`, including 22/22 fresh migrations, 22/22 idempotent second-pass skips, Memgraph outage/replay, graph rebuild, CodeQL, browser smoke, and signed lockfile/SBOM attestations.

Canonical readiness/evidence artifact [#15233427068](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46072736082/artifacts/15233427068) is bound to `2b4d5a5c096f704eb8a7c3066ba1e5c8dccb0542`. Archive SHA-256: `97dfb9d352089f2e44b5b0b40d7215966500f191dd18fff9352eb70fe6f1b445`. Readiness JSON SHA-256: `a50db65d67281e1886d2bdc1a0903a18901fcffbc16afeef1a05cfdea81efefc`; readiness Markdown SHA-256: `850a170384221b8f9f4b4fabad0ee5bb8c6d760e705f69de8127c236a117d2dd`. The readiness record is 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED` / NO-GO.

## Release and assurance boundary

No schema/migration, dependency/lockfile, API response-contract, package-version, or SemVer change was made. Package 0.6.2 remains private/unreleased. No release tag, publication, production deployment, or promotion is authorized.

This is bounded maintainer-led implementation and CI evidence. It does not constitute independent tenant-isolation review or platform security assessment. Independent reviews #14 and #25 remain open/not performed, and parent issue #124 remains open for further source-anchored community and tenant workflow review.

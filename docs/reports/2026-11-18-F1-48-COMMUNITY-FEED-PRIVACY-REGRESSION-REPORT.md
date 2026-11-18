# F1.48 — Community feed privacy and comment-parent isolation

**Date:** 18 November 2026 UTC / 17 November 2026 America/Chicago
**Issue:** [#196](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/196) — CLOSED
**Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Runtime PR:** [#197](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/197) — MERGED
**Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
**Implementation commit:** 4fa49b7403db3881ac50d9827223fb1d912b5b44
**Main merge SHA:** 37f0bfff82c53e4d616ba87ce94f5d7a784200fe
**Status:** Merged and exact-main validated; maintainer-authored evidence only.
> **Assurance boundary:** F1.48 is maintainer-authored route hardening and regression coverage. It is not an independent security assessment, risk acceptance, waiver, or production-certification evidence.

## Executive summary

F1.48 closes a community-feed privacy gap involving group-associated activities and comment parent references. The existing source inventory had called out group-post/comment visibility combinations as requiring further review. A new disposable-PostgreSQL regression confirmed that a legacy comment whose stored group and visibility fields did not match its private-group parent could still be returned by the feed to its author, despite that actor lacking active membership in the parent group.

The route is now stricter at both write and read time. New comments must reference an accessible, same-site, non-deleted parent and inherit its exact group and visibility scope. Feed reads validate a comment's entire parent chain, not only the immediate parent, and hide legacy comments whose stored scope widens or moves away from any ancestor. Private and hidden group activities cannot be made site-visible by a broader caller-supplied visibility value.

No schema, migration, dependency, lockfile, public route or response-shape change was required.

## Confirmed behavior and correction

### Read-side legacy scope bypass

The original feed read predicate evaluated an activity's own visibility and group membership but did not require a comment's stored group and visibility to match its parent. A comment written with no group ID and members visibility could therefore be visible independently from a private-group parent.

The new regression seeded three synthetic legacy rows against a private-group post: an unscoped comment written by a site member outside the group, a comment moved to a different public group with public visibility, and a valid comment whose scope matches its parent. The first local live-PostgreSQL execution failed on the expected negative assertion: the unauthorized comment was present in the author's feed. That is the confirmed regression that motivated the read-side fix.

### Route hardening

The community feed route now uses two small, shared SQL predicate builders:

- A single activity visibility predicate is reused for feed reads and comment-parent authorization. It distinguishes private/hidden groups from public groups and non-group activities, and requires active group membership for private/hidden-group content.
- A recursive comment-parent predicate walks every ancestor. Each link must remain in the same site, refer to a non-deleted activity, preserve exact group and visibility scope, and be visible to the requesting actor. A malformed, missing, detached, or cyclic ancestor chain fails closed. The recursive set uses distinct rows so legacy cycles terminate, and the aggregate requires a top-level non-comment root before any thread is visible.

The POST path rejects absent, foreign-site, soft-deleted or inaccessible parents with the existing non-disclosing not-found response. Caller-supplied group scope cannot move a comment away from its parent. New comments take group ID and visibility from the parent. Group posts in private/hidden groups clamp broader caller visibility to group visibility while preserving the more restrictive private setting.

The GET path only returns top-level non-comment activities without a parent, or comments whose complete parent chain passes the shared scope/visibility check. This prevents legacy rows from bypassing the corrected write path.

## Regression coverage

Added test/integration/community-feed-privacy.integration.test.js and extended the existing tenant-community-object-isolation.integration.test.js activity snapshot.

The focused live PostgreSQL fixture uses random synthetic sites, identities, public/private/hidden groups, group memberships, posts and comments. It covers:

- Private/hidden group posts with omitted visibility and an explicit public visibility request.
- Site-only actors and foreign-site actors not seeing private/hidden-group activity.
- Public-group visibility and non-group public, members and private controls.
- A site member outside the group being unable to comment on a private-group post.
- Legacy comments with missing or moved group scope, including proof that both the comment author and group members do not see them.
- A site member being unable to reply to a legacy comment whose stored scope widens its parent.
- Same-site, non-deleted parent requirements; foreign-site and soft-deleted parent denial.
- Caller-supplied group scope mismatch rejection with no activity mutation.
- Authorized comments inheriting the parent's group/visibility, including nested comments; group members can read them and site-only actors cannot.
- Detached comment rejection.
- Before/after snapshots of activities, groups, group memberships, audit events and outbox events for denied writes; this confirms rejected attempts do not create secondary audit or background-work effects.

The existing two-site community object-isolation suite remains in place and now snapshots social_activities as part of its site-state assertions.

## Local validation

| Check | Result | Qualification |
|---|---|---|
| Focused community-feed privacy integration | PASS — 11/11, zero failures/skips | Disposable PostgreSQL 18; all 18 migrations were already applied to the isolated test database. |
| Combined community-feed and existing community-object isolation integrations | PASS — 19/19, zero failures/skips | Same disposable PostgreSQL database; synthetic data only. |
| Full local npm run check | PASS — 670 tests, 667 passed, 0 failed, 3 Windows-specific skips | Windows / Node.js 26.12.1; artifact verification passed 238 required paths and 268 JavaScript syntax checks. |
| Tenant-isolation inventory generation | PASS | 28 families / 80 route patterns / 21 implementation sources / 57 referenced tests. |
| Inventory freshness | PASS | Existing generator --check. |
| Candidate push / PR workflows | PASS | PR #197 candidate jobs passed; exact-main evidence is recorded below. |

The confirmed red regression was observed against the candidate read predicate before the recursive parent-chain guard was added. After the fix, the focused integration passed with zero skips. Additional live assertions verify that a two-row cyclic legacy comment chain terminates and remains hidden, that detached/non-comment roots cannot validate a reply chain, and that denied writes leave site data, audit events and outbox events unchanged.

## Inventory and release boundary

The source-anchored community route family now references the new integration test and characterizes the exact covered group/comment cases. The generated inventory and route/capability map were refreshed through the existing generator. They remain maintainer-prepared navigation aids, not independent review evidence.

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED. F1.48 does not populate the independent evidence contract. Other community profile, workflow, moderation, asynchronous, provider, cache and realtime surfaces still require their own coverage and/or independent assessment.

Package virgoscorpio-hub@0.6.2 remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, schema, migration, dependency, lockfile, release, tag, publication, deployment, assessor engagement or spending is authorized.
## Merge and exact-main validation — 18 November 2026 UTC / 17 November America/Chicago

PR #197 merged at main SHA `37f0bfff82c53e4d616ba87ce94f5d7a784200fe` from implementation commit `4fa49b7403db3881ac50d9827223fb1d912b5b44`; issue #196 is CLOSED. Exact-main [workflow #44235945030](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44235945030) completed **7/7 jobs successfully** on the exact main revision.

| Mainline validation | Result |
|---|---|
| Node.js 22.23.4 and 24.22.1 | Each passed 670/670 Hub tests and 94/94 EnginEx tests; zero failures or skips. |
| Dependency audit | Full and production-only npm audit scopes reported zero vulnerabilities on both runtimes. |
| Live PostgreSQL/Memgraph/Redis | **141/141 passed; zero failures, zero skips, zero TODOs**. F1.48 private-group/comment-parent cases and the F1.47 two-site regular-menu isolation regression both passed. |
| Fresh / idempotent migrations | 18/18 applied to a fresh disposable database; 18/18 recognized as already applied on the second pass. |
| Browser/editor smoke | 9/9 passed. |
| CodeQL | Passed; scanned 268 JavaScript, 1 GitHub Actions and 2 HTML files. |
| Mainline supply-chain attestations | Signed provenance and CycloneDX SBOM attestations were created and verified against the exact lockfile and SBOM. |
| Exact-source evidence consolidation | Passed; CI evidence is PASS and final readiness remains NOT_PRODUCTION_CERTIFIED. |

Run-bound artifacts:

| Evidence | Artifact ID | SHA-256 |
|---|---:|---|
| Consolidated readiness / CI evidence | 14396544068 | `578b6f06cf15d15a0ed7750b74613bf03d2b14d632e1d9a1b04ecfc10b8b7df8` |
| Live PostgreSQL/Memgraph integration | 14398020197 | `e25342847d246e51b55644dbe75b726abc59cb1e3c514d568bd3dfa0e451d3fb` |
| Signed supply-chain evidence | 14397825231 | `ef1b0abc4e1ba9b2e49c552b880516786380d7a55b6d115bc3dd000aee0f7d0c` |
| Browser/editor smoke evidence | 14397257485 | `06ea2b3d199fcd9204fed2e32c2704053e101723dcea1ec81aa881c5d2c4003c` |
| CodeQL evidence | 14396334182 | `923969ce91a561a624a8e089dcc1bc8c3be4797e9c6da1ed8517e784f99766cd` |

The exact-source readiness artifact is bound to `37f0bfff82c53e4d616ba87ce94f5d7a784200fe`: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, with `readyForProduction=false` and `releaseClassification=NOT_PRODUCTION_CERTIFIED`. The PARTIAL rows remain human dependency/license review and a service-less integration diagnostic (46 skipped of 47 tests per runtime); those diagnostic skips are not live integration results. The separate live integration producer passed 141/141 with zero skips.

PR #197 has no formal review submissions or inline review threads. Merge and CI are maintainer/automation evidence, not independent security approval. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; F1.48 does not populate either evidence contract. Package 0.6.2 remains private/unreleased and production remains NO-GO.

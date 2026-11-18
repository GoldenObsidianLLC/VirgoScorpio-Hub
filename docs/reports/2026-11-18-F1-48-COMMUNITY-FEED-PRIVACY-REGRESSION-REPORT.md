# F1.48 — Community feed privacy and comment-parent isolation

**Date:** 17 November 2026 (America/Chicago)
**Issue:** [#196](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/196) — OPEN
**Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
**Candidate branch:** security/f1-48-community-feed-privacy-2026-11-18
**Base main SHA:** fba84b91bdb4e6791f4c66f7a90acaa466f74aa3
**Status:** Maintainer implementation and local live-PostgreSQL validation complete; exact-head hosted CI, review and merge remain pending.

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
| Exact-head hosted CI | NOT RUN | Required before merge. |

The confirmed red regression was observed against the candidate read predicate before the recursive parent-chain guard was added. After the fix, the focused integration passed with zero skips. Additional live assertions verify that a two-row cyclic legacy comment chain terminates and remains hidden, that detached/non-comment roots cannot validate a reply chain, and that denied writes leave site data, audit events and outbox events unchanged.

## Inventory and release boundary

The source-anchored community route family now references the new integration test and characterizes the exact covered group/comment cases. The generated inventory and route/capability map were refreshed through the existing generator. They remain maintainer-prepared navigation aids, not independent review evidence.

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED. F1.48 does not populate the independent evidence contract. Other community profile, workflow, moderation, asynchronous, provider, cache and realtime surfaces still require their own coverage and/or independent assessment.

Package virgoscorpio-hub@0.6.2 remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, schema, migration, dependency, lockfile, release, tag, publication, deployment, assessor engagement or spending is authorized.

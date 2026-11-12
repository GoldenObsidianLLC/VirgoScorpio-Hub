# F1.27 Editorial Workflow Role and Ownership Gates — Design

**Date:** 12 November 2026

**Status:** Implemented as a maintainer-led candidate. Focused API tests passed 26/26 and local `npm run check` passed 595 tests (592 passed, 0 failed, 3 Windows-specific skips); the live PostgreSQL/Memgraph fixture remains unexecuted locally and exact-head hosted validation is pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). Candidate branch: `security/editorial-workflow-role-gates-2026-11-12`.

## Problem

The editorial workflow API gates `submit-review` on the site-scoped `content:submit-review` capability. The built-in author role has that capability, but its edit permission is deliberately limited to `content:edit:own`. The route must enforce both the site-level workflow capability and the content-level ownership/edit boundary. A capability-only check risks allowing an author to submit another member's same-site draft into review.

Other workflow actions also need role-boundary regression evidence: editors may approve/reject but do not have publish, schedule, unpublish or archive authority; site owners retain the full workflow controls.

## Design and implementation

- Reuse the existing `canEditContent(actor, siteId, content)` authorization helper; do not create a second ownership policy.
- After the existing `content:submit-review` capability check, load the content through the existing site-scoped store lookup and invoke `canEditContent` before calling `submitForReview`.
- Site-wide editors and site owners pass through their existing `content:edit` grant. Authors pass only when the selected content's `created_by` matches their principal and they hold `content:edit:own`.
- Leave all other workflow action capability checks and the PostgreSQL transaction/state machine unchanged.
- Reuse the existing tenant content integration fixture and the seeded `site-owner`, `editor` and `author` roles rather than manufacturing duplicate role definitions.

## Regression coverage

The live two-site PostgreSQL fixture checks:

1. A Site B author can submit their own draft and cannot submit another Site B member's draft.
2. The denied author submission returns a generic 403 and changes no content, workflow, audit, outbox or collaboration state.
3. A Site B editor can submit another member's draft and can approve/reject review items.
4. Authors cannot approve/reject; editors cannot publish, schedule, archive or unpublish.
5. A Site B site owner can publish and archive an approved/published item.
6. Every denied action leaves the target content, workflow-event count, audit count, outbox count, and collaboration state unchanged.

The test helper's audit snapshot now includes content-scoped audit events so the negative side-effect oracle checks the full workflow effect set.

## Security and compatibility boundaries

- No new route, request/response contract, schema, migration, dependency, provider contract, lockfile, worker, outbox pattern or runtime abstraction.
- Authorization remains site-scoped and fail-closed. PostgreSQL remains the source of truth; workflow state, audit, and outbox writes continue through the existing PostgreSQL store.
- This is one targeted role/ownership regression, not exhaustive workflow, route-family, tenancy or security review.
- Maintainer-authored tests do not satisfy independent tenant review #14 or platform-wide security assessment #25.

## Release

Package `virgoscorpio-hub@0.6.2` remains private/unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release tag, publication, deployment or issue closure is implied.

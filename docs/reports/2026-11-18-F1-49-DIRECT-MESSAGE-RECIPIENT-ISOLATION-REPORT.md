# F1.49 — Direct-message recipient tenant-isolation regression

- **Date:** 18 November 2026 UTC / 17 November 2026 America/Chicago
- **Issue:** [#199](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/199) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-49-community-direct-message-recipient-isolation-2026-11-18`
- **Baseline main SHA:** `00c60fd1380123f7af436e4bfcb6b515bfbc2e34`
- **Status:** Focused local implementation and disposable-PostgreSQL validation complete; candidate not yet hosted-validated, reviewed, or merged.

> **Assurance boundary:** This is maintainer-authored regression coverage. It is not an independent security assessment, risk acceptance, waiver, or production-certification evidence.

## Executive summary

F1.49 extends the existing two-site community object-isolation test to cover the direct-message creation recipient boundary at `POST /api/v1/sites/{siteId}/community/conversations`.

The source review confirmed that `createDirectConversation()` already verifies an active recipient through `site_memberships` constrained by the selected `site_id`, and rejects non-members with the existing generic `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND` before opening the conversation transaction. No runtime defect was found and no application runtime change was made.

The coverage gap was that the existing two-site suite tested cross-site conversation list/message/read behavior, but not a direct-conversation creation request naming a user who belongs only to the other site. The same-site create/reuse path was covered separately, but not as the positive control in this A/B no-side-effect scenario.

## Scope and implementation

Extended `test/integration/tenant-community-object-isolation.integration.test.js` using its existing disposable-PostgreSQL fixture and shared `snapshotCommunitySite()` projection. No new test framework, fixture abstraction, runtime helper or endpoint was introduced.

The new dedicated subtest:

1. Authenticates the existing Site B-only actor and submits Site A's member ID as the direct-message recipient for Site B.
2. Requires the established generic 404 error code and asserts that neither the foreign recipient ID nor Site A's ID/name/marker is disclosed in the response.
3. Deep-compares Site A and Site B community snapshots before and after the denied request. The shared projection includes groups and memberships, conversations and members, messages, blocks, reports, friendships, activities, notifications and moderation records.
4. Uses a same-site Site B recipient as a positive control. The route must return the already-existing direct conversation with `created: false`; both site snapshots must remain unchanged, proving that reuse does not duplicate the conversation, memberships, or notification fan-out.

No database schema, migration, route contract, API response contract, dependency, lockfile, package version or SemVer change was required.

## Local validation

All 18 migrations were applied fresh to a newly created disposable PostgreSQL 18 database dedicated to this test.

| Check | Result |
|---|---|
| Changed integration test syntax | PASS — `node --check` |
| Focused two-site community isolation integration | **PASS — 9/9, zero failures, zero skips, zero TODOs** |
| Related community workflow + tenant isolation + unit set | **PASS — 18/18, zero failures, zero skips, zero TODOs** |
| Fresh PostgreSQL migrations | PASS — 18/18 applied |
| Tenant inventory generation | PASS — 28 families / 80 route patterns / 21 implementation sources / 57 referenced tests |
| Tenant inventory freshness check | PASS — source digest current |
| Full `npm run check` | **PASS — 670 tests, 667 passed, 0 failed, 3 skipped** | Node.js 26.12.1; artifact verifier passed 238 required paths and syntax-checked 268 JavaScript files. The three skips are platform-specific and do not represent live integration results. |
| Hosted exact-head CI | NOT RUN — required before merge |

The focused live test executes the cross-site POST and the positive same-site reuse control through the real API server and PostgreSQL-backed identity/workflow paths. The combined related run also re-executes the existing direct-message workflow and unit tests.

## Inventory and documentation

The source-anchored `community-conversations-moderation-notifications` family now records the direct-recipient A/B boundary, both-site state snapshots, and same-site reuse control. The existing generator refreshed:

- `artifacts/security/tenant-isolation-route-inventory.json`
- `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`

The current generated inventory records **28 route/flow families, 80 route patterns, 21 implementation source files and 57 referenced tests**. Its `--check` freshness validation passes.

The changelog, project roadmap and implementation roadmap now record F1.49 as an OPEN maintainer candidate on the branch above, based on the exact main SHA in this report. It is not described as merged or independently reviewed.

## Assurance and release boundaries

F1.49 covers one additional direct-message recipient authorization scenario. It does not establish exhaustive conversation workflow authorization, all invitation/membership lifecycle combinations, every notification/event fan-out path, realtime delivery security, or independent adversarial coverage.

Independent tenant/site review #14 remains OPEN / NOT PERFORMED. Platform security assessment #25 remains OPEN / NOT PERFORMED. This work does not populate `artifacts/evidence/tenant-isolation-review.json` or satisfy either independent-review evidence contract.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, npm publication, deployment, provider qualification, spending, assessor engagement, risk acceptance, or SemVer increment is authorized.

# F1.69 — Direct-conversation participant revalidation

- **Date:** 22 November 2026 America/Chicago
- **Issue:** [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) — OPEN
- **Independent tenant/site review:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-69-community-direct-conversation-revalidation-2026-11-22`
- **Baseline:** main `287508b16d9c7d3156fab07f975413de2c659ae0`
- **Status:** Maintainer candidate; local focused and full unit/artifact checks pass. Hosted PostgreSQL/Memgraph CI and formal review are pending. Not merged.

> **Assurance boundary:** This is a maintainer-authored source fix and regression candidate. It is not an independent security assessment, risk acceptance, waiver or production-certification evidence. Independent review #14 and platform security assessment #25 remain open.

## Finding

Direct conversation creation at `POST /api/v1/sites/{siteId}/community/conversations` performed an active-recipient/selected-site membership preflight before opening its transaction. Inside the transaction it acquired the per-pair advisory lock, but did not revalidate either participant before reusing or creating the conversation, inserting conversation memberships, and creating the recipient notification.

A request could pass the initial authorization check, wait for a concurrent direct-pair operation, then continue after a site membership had been removed or an account disabled. This created a time-of-check/time-of-use gap for both the actor and recipient. The previously merged F1.49 regression covered a foreign recipient, but did not cover this lifecycle change between preflight and transaction lock acquisition.

## Implementation

The existing direct-conversation transaction and per-pair advisory lock are retained. Immediately after acquiring that lock, the transaction now:

1. Acquires the selected site row with `FOR KEY SHARE`, which serializes the final authorization check against the existing membership-removal `FOR UPDATE` lock on that site row.
2. Locks both participant user rows in stable identifier order and reads current account status.
3. Locks all selected-site membership rows for both participants in stable user/role order.
4. Requires both the actor and recipient to remain active users with a current membership in the selected site before block checks, conversation reuse/creation, membership insertion or notification fan-out.
5. Returns the established generic `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND` contract when either participant is no longer eligible.

No new helper or parallel conversation workflow was introduced. The existing transaction abstraction, pair lock, error contract, and database fixture patterns are reused. The lock order is site → users → selected-site memberships after the existing direct-pair advisory lock, compatible with the site-first member-removal path. Row locks remain held through the transaction.

## Regression coverage

The unit fixture now models the additional transaction queries and verifies that an inactive participant or missing current membership causes rollback, releases the checked-out client, and does not issue a conversation insert. The focused `test/community-workflows.test.js` suite passes **10/10**.

The existing two-site PostgreSQL integration fixture gains deterministic preflight-to-final-lock regressions. For membership-removal scenarios, a blocker holds the selected site row with `FOR UPDATE`, and the API request is observed waiting at its `FOR KEY SHARE` site-row check after passing preflight and acquiring the direct-pair advisory lock. For account deactivation, a blocker holds the recipient user row with `FOR UPDATE`, and the API request is observed waiting at the final ordered participant-row lock query. The blocker commits the eligibility change, the waiting transaction resumes and must deny the stale request, and both site snapshots remain unchanged. Each scenario uses a fresh actor session so a throttled authentication last-seen touch cannot be mistaken for the conversation transaction's lock wait. Scenarios cover:

- Recipient site-membership removal after request preflight.
- Recipient account deactivation after request preflight.
- Actor site-membership removal after request preflight.

The regression asserts the generic non-disclosing error, no direct conversation membership pair, no conversation-created recipient notification, and no cross-site community side effect. It reuses the existing `waitForDatabaseWriteLock` helper and two-site snapshot projection rather than adding a new harness.

The source-anchored tenant inventory has been regenerated and now records **28 families / 80 route patterns / 22 source files / 61 test files**.

## Validation

| Check | Result |
|---|---|
| Focused community workflow unit tests | **PASS — 10/10; zero failures/skips** |
| Changed source and test JavaScript syntax checks | PASS |
| `git diff --check` | PASS |
| Tenant inventory generation | PASS — 28 families / 80 route patterns / 22 source files / 61 test files |
| Full local `npm run check` (Node.js 26.12.1) | **PASS — 812 total tests: 809 passed, 0 failed, 3 conditional platform skips** |
| Artifact/syntax verification | PASS — 241 required paths; 283 JavaScript files syntax-checked |
| Tenant inventory generation and freshness | PASS — 28 families / 80 route patterns / 22 source files / 61 test files |
| Local live PostgreSQL/Memgraph integration | **BLOCKED locally** — Docker Desktop Linux engine is not running; no local live-pass is claimed |
| Hosted PostgreSQL/Memgraph CI | Pending PR |
| Independent tenant/site review #14 | OPEN / NOT PERFORMED |

The first full-suite attempt correctly exposed that editing these source files made the generated tenant inventory stale. The source-anchored inventory was regenerated and the full check then passed against the refreshed output. This test-driven freshness gate is preserved; the initial stale-inventory failure is not counted as a passing test run.

## Scope and release boundary

- No database schema or migration change.
- No HTTP/API request or response contract change.
- No dependency or lockfile change.
- No new runtime abstraction or duplicated transaction pattern.
- No package version or SemVer change is warranted.
- No Aikido finding fingerprint is marked resolved by this work.
- Independent tenant review #14, dependency/license review #23, platform security assessment #25 and all other production evidence gates remain separate and open.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, publication or deployment is authorized.

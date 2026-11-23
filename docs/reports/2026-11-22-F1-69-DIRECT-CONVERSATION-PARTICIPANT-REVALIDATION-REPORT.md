# F1.69 — Direct-conversation participant revalidation

- **Initial report date:** 22 November 2026 America/Chicago
- **Updated:** 23 November 2026 America/Chicago
- **Issue:** [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) — OPEN
- **Pull request:** [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) — OPEN / DRAFT
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) — OPEN
- **Independent tenant/site review:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-69-community-direct-conversation-revalidation-2026-11-22`
- **Candidate head:** `6282ce294f93d527f40bd02677a6d41e85c2315a`
- **Baseline:** main tip `287508b16d9c7d3156fab07f975413de2c659ae0` (docs-only PR #297 successor to F1.68 runtime baseline `c4c5fb6328d2747d1d9b9c43aab70fc93d4eb96e`)
- **Status:** Maintainer candidate. Last pushed head `6282ce294f93d527f40bd02677a6d41e85c2315a`; hosted push #1307 and PR #1308 both failed the live PostgreSQL race-observation assertion. A further test-only drain of prior asynchronous session touches is present locally but is not yet committed, pushed, or hosted-validated. Not merged.

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

The unit fixture models the additional transaction queries and verifies that an inactive participant or missing current membership causes rollback, releases the checked-out client, and does not issue a conversation insert.

The existing two-site PostgreSQL integration fixture adds deterministic preflight-to-final-lock regressions for recipient membership removal, recipient account deactivation, and actor membership removal. Each race now creates **a fresh actor and a fresh recipient**; the recipient is intentionally never authenticated. The first repair removed the previously authenticated recipient, but hosted runs #1307/#1308 showed that a fire-and-forget `auth_sessions.last_seen_at` update from an earlier authenticated request could still be waiting behind the test blocker. The current local follow-up adds `waitForSessionTouchesToSettle()`: it polls `pg_stat_activity` until no active or lock-waiting session-touch UPDATE remains for a continuous 100 ms quiet window (bounded by five seconds) before the blocker is acquired. Each scenario still has a fresh actor and never-authenticated recipient; the actor session is checked for freshness and refreshed only after the blocker owns the intended participant lock. This follow-up is local/uncommitted pending exact-head hosted database validation. The blocker commits the eligibility change, the waiting transaction resumes and must deny the stale request, and both site snapshots remain unchanged.

The regression asserts the generic non-disclosing error, no direct conversation membership pair, no conversation-created recipient notification, and no cross-site community side effect. It reuses the existing `waitForDatabaseWriteLock` helper and two-site snapshot projection rather than adding a new harness.

The source-anchored tenant inventory is regenerated and committed at **28 families / 80 route patterns / 22 source files / 61 test files**.

## Validation

| Check | Result |
|---|---|
| Focused `test/community-workflows.test.js` | **PASS — 10/10; zero failures/skips** |
| Changed integration test syntax (`node --check`) | PASS |
| `git diff --check` | PASS |
| Tenant inventory generation and freshness | **PASS — 28 families / 80 route patterns / 22 source files / 61 test files** |
| Full local `npm run check` (Node.js 26.12.1) | **PASS — 812 total tests: 809 passed, 0 failed, 3 conditional platform skips** |
| Artifact verification | **PASS — 241 required paths; 283 JavaScript files syntax-checked** |
| Local live PostgreSQL/Memgraph integration | **BLOCKED locally** — Docker Desktop Linux engine is not running; no local live-pass is claimed |
| Hosted PR run #1304 (pre-fix candidate) | **FAIL** — PostgreSQL lock-wait regression observed an unrelated `auth_sessions.last_seen_at` waiter; this identified fixture interference, not a passing race proof |
| Hosted push run #1305 / PR run #1306 (head before inventory refresh) | **Superseded** — the candidate commit had not yet included refreshed generated inventory; do not use these runs as acceptance evidence for the current head |
| Hosted push run [#1307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45125049507) on head 6282ce2 | **FAIL** — Node 22/24, browser/accessibility and CodeQL passed; PostgreSQL/Memgraph failed the revocation lock-wait assertion because a prior session-touch UPDATE was waiting on the blocker |
| Hosted PR run [#1308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45125057424) on head 6282ce2 | **FAIL** — same PostgreSQL/Memgraph lock-wait assertion; Node 22/24, browser/accessibility and CodeQL passed; evidence consolidation failed as a downstream consequence |
| Local follow-up drain helper | Syntax, focused unit tests 10/10, inventory generation and full `npm run check` pass; **live DB outcome pending** because Docker Desktop's local Linux engine is unavailable and this follow-up is not yet hosted |
| Independent tenant/site review #14 | OPEN / NOT PERFORMED |

The full local checks pass after regenerating the canonical tenant inventory. The hosted database failure remains real and unresolved at the pushed 6282ce head; neither CI run is counted as a passing revocation-race proof. A subsequent local-only test adjustment drains outstanding session-touch writes before acquiring the blocker; it passes the local syntax, focused unit and full local checks, but must be pushed and validated by the hosted PostgreSQL/Memgraph job before PR #299 can be considered ready.

## Scope and release boundary

- No database schema or migration change.
- No HTTP/API request or response contract change.
- No dependency or lockfile change.
- No new runtime abstraction or duplicated transaction pattern.
- No package version or SemVer change is warranted.
- No Aikido finding fingerprint is marked resolved by this work.
- Independent tenant review #14, dependency/license review #23, platform security assessment #25 and all other production evidence gates remain separate and open.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, publication or deployment is authorized.

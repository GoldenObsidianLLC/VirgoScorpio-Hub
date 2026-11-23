# F1.69 — Direct-conversation participant revalidation

- **Initial report date:** 22 November 2026 America/Chicago
- **Updated:** 23 November 2026 America/Chicago
- **Issue:** [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) — OPEN
- **Pull request:** [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) — OPEN / DRAFT
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) — OPEN
- **Independent tenant/site review:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-69-community-direct-conversation-revalidation-2026-11-22`
- **Candidate head:** `485f6f5ecc8eb537ce98f7ca4764d24817097e82`
- **Baseline:** main tip `287508b16d9c7d3156fab07f975413de2c659ae0` (docs-only PR #297 successor to F1.68 runtime baseline `c4c5fb6328d2747d1d9b9c43aab70fc93d4eb96e`)
- **Status:** Maintainer candidate. Current pushed head `485f6f5ecc8eb537ce98f7ca4764d24817097e82`; prior push/PR runs #1307/#1308, #1309/#1310 and #1311/#1312 all failed the PostgreSQL race-observation assertion. Actor-session pre-refresh did not resolve the unrelated session-touch waiter. Commit 485f6f5 added a pool.query-level session-touch tracker and PostgreSQL lock diagnostics; exact-head runs #1313/#1314 showed it did not observe the reported backend (empty pending map/owner lookup while PID 254 waited behind PID 253). Exact-head push #1313 and PR #1314 on 485f6f5 both failed the PostgreSQL/Memgraph lock-wait proof. Diagnostics showed `pendingSessionTouches=[]` and `pendingTouchOwners=[]` while PostgreSQL still reported backend pid 254 running/waiting on `UPDATE auth_sessions SET last_seen_at` behind blocker pid 253 (`transactionid` 1561; `site_memberships` tuple page 0/tuple 41). The pool.query-level tracker did not observe this backend, so the source of the untracked query remains unresolved. The latest local test-only follow-up moves tracking to checked-out `client.query` callbacks via `pool.connect`, covering pg.Pool's callback-based query path. The patch passes local syntax, focused tests and full `npm run check`, but is not yet committed/pushed or hosted-validated. Not merged.

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

The existing two-site PostgreSQL integration fixture adds deterministic preflight-to-final-lock regressions for recipient membership removal, recipient account deactivation, and actor membership removal. Each race now creates **a fresh actor and a fresh recipient**; the recipient is intentionally never authenticated. Hosted runs #1307/#1308 first showed an unrelated fire-and-forget `auth_sessions.last_seen_at` update waiting behind the test blocker. A bounded drain of `pg_stat_activity` plus an actor-session pre-refresh in 3e44c4b did not remove the waiter; exact-head runs #1311/#1312 still failed the lock-wait proof. The pool.query-level tracker in commit 485f6f5 did not observe the backend that CI reported waiting on `auth_sessions.last_seen_at`: the failure snapshot showed an empty pending-promise map and empty session-owner lookup, while PID 254 remained blocked by PID 253 on transaction ID 1561 and held a tuple lock on `site_memberships` page 0/tuple 41. This shows the observer was attached too high in the pg.Pool call path or otherwise missed that backend; the exact cause is not yet confirmed. The latest local test-only follow-up wraps checked-out `client.query` calls through `pool.connect`, tracking callback-based completion at the physical client boundary while retaining the bounded drain, owner lookup and lock snapshot. Actor session pre-refresh remains before blocker acquisition. Production authentication is unchanged. This follow-up is local/uncommitted and awaits exact-head hosted PostgreSQL/Memgraph validation. The blocker commits the eligibility change, the waiting transaction resumes and must deny the stale request, and both site snapshots remain unchanged.

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
| Actor session pre-refresh (commit 3e44c4b) | **FAIL in hosted #1311/#1312** — session-touch UPDATE still waited behind the blocker; local Docker Desktop Linux engine unavailable |
| Pool.query-level tracker and diagnostics (commit 485f6f5) | **FAIL in hosted #1313/#1314** — pending map and owner lookup empty while PID 254 waited on the blocker; did not capture the backend waiter |\n| Checked-out client.query tracking via pool.connect (local follow-up) | Syntax, focused tests and full local check pass; **not yet committed/pushed or hosted-validated** |
| Independent tenant/site review #14 | OPEN / NOT PERFORMED |

The full local checks pass after regenerating the canonical tenant inventory. No hosted PostgreSQL/Memgraph run has yet established the three revocation-race proofs: #1307/#1308, #1309/#1310 and #1311/#1312 each failed the lock-wait assertion. The actor pre-refresh was insufficient. The diagnostic follow-up committed at 485f6f5 exposed an instrumentation gap: its pool.query tracker showed no pending touch, while the PostgreSQL activity log still showed PID 254 waiting on `auth_sessions.last_seen_at` behind PID 253. The latest local change moves query tracking to checked-out clients via `pool.connect` and callback wrapping; syntax, focused tests and full local suite pass. It remains uncommitted/unpushed pending final local checks and a new exact-head hosted PostgreSQL/Memgraph run. The assertion remains strict; an unrelated session-touch wait is not accepted as proof. PR #299 cannot be considered ready until the PostgreSQL/Memgraph job proves all three revocation races with zero skips and all required CI/evidence checks pass.

## Scope and release boundary

- No database schema or migration change.
- No HTTP/API request or response contract change.
- No dependency or lockfile change.
- No new runtime abstraction or duplicated transaction pattern.
- No package version or SemVer change is warranted.
- No Aikido finding fingerprint is marked resolved by this work.
- Independent tenant review #14, dependency/license review #23, platform security assessment #25 and all other production evidence gates remain separate and open.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, publication or deployment is authorized.

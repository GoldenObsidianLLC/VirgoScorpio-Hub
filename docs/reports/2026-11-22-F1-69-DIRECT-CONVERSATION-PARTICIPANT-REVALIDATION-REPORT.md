# F1.69 — Direct-conversation participant revalidation

- **Initial report date:** 22 November 2026 America/Chicago
- **Updated:** 25 November 2026 America/Chicago
- **Issue:** [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) — OPEN
- **Pull request:** [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) — OPEN / READY
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) — OPEN
- **Independent tenant/site review:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-69-community-direct-conversation-revalidation-2026-11-22`
- **Last failed hosted CI candidate head:** `4c9238df56c7cb132799f3cd46fb85b88eace996`
- **Synchronized candidate:** relation-aware lock-observer bind layout and lock-state handling are committed in the validated candidate head; focused observer tests are included in the passing exact-head suite.
- **Current main baseline:** `e985c18d18088249f68d908ed2d349c287dac8f3` (docs-only PR #297 successor to F1.68 runtime baseline `c4c5fb6328d2747d1d9b9c43aab70fc93d4eb96e`)
- **Status:** The synchronized candidate head `f6ea24011932bc54143ae60a0ec2ef230faf735f` is now validated by exact-head push [run 45637000522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637000522) and PR [run 45637014263](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637014263), both successful. The PostgreSQL/Memgraph job passed **195/195 with zero failures/skips**, explicitly including recipient membership removal, recipient account deactivation and actor membership removal after preflight. Node 22/24, browser/accessibility 9/9, CodeQL and candidate evidence consolidation passed. Feature-branch signed attestation is skipped by design. Local Node.js 26.12.1 `npm run check` passed 938 tests (935 passed, zero failures, three conditional Windows skips); `scripts/verify.js` passed 241 required paths / 292 JavaScript files. Tenant inventory regenerated at 28 families / 80 route patterns / 22 source files / 61 test files. A maintainer technical self-review is recorded in the PR review history; no unresolved inline review threads remain. Independent tenant/site review #14 remains OPEN / NOT PERFORMED. Historical failed runs above are retained as debugging history, not acceptance evidence for the synchronized head.

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

The existing two-site PostgreSQL integration fixture adds deterministic preflight-to-transaction-lock regressions for recipient membership removal, recipient account deactivation, and actor membership removal. Each race creates **a fresh actor and a fresh recipient**; the recipient is intentionally never authenticated. Hosted runs #1307 through #1320 failed successive versions of the lock-wait proof. The #1317/#1318 activity trace showed the membership-row blocker held before authentication/preflight. The follow-up pair-advisory-lock barrier also failed in #1319/#1320: the API auth-session SELECT was observed waiting on the advisory lock before the route could complete preflight, so it still did not reproduce the intended gap. The current local fixture correction no longer uses an advisory-lock blocker. Instead, it holds the selected-site row `FOR UPDATE`, starts the API request and waits until the production transaction query `SELECT id FROM sites WHERE id=$1 FOR KEY SHARE` is blocked. In `createDirectConversation()`, that site-row query follows authentication, selected-site/recipient preflight and the direct-pair advisory lock; observing it proves the request has reached the post-preflight participant-revalidation boundary. The fixture then removes the recipient or actor membership, or disables the recipient account, commits the blocker, and requires the waiting request to return the generic 404 with no conversation membership pair, no conversation-created notification and unchanged two-site snapshots. The original `waitForDatabaseWriteLock` observer remains strict. The committed auth-session `should_touch` guard is retained as a separate optimization: it avoids no-op last-seen UPDATEs for fresh sessions, while stale sessions continue through the existing throttled, best-effort predicate. No production auth/API/schema change is included in the local fixture correction.

The regression asserts the generic non-disclosing error, no direct conversation membership pair, no conversation-created recipient notification, and no cross-site community side effect. It reuses the existing `waitForDatabaseWriteLock` helper and two-site snapshot projection rather than adding a new harness.

The source-anchored tenant inventory is regenerated and committed at **28 families / 80 route patterns / 22 source files / 61 test files**.

## Validation

| Check | Result |
|---|---|
| Focused `test/session-service.test.js` | **PASS — 7/7; zero failures/skips** |
| Focused `test/community-workflows.test.js` | **PASS — 10/10; zero failures/skips** |
| Changed integration test syntax (`node --check`) | PASS |
| `git diff --check` | PASS |
| Tenant inventory generation and freshness | **PASS — 28 families / 80 route patterns / 22 source files / 61 test files** |
| Full local `npm run check` (Node.js 26.12.1) | **PASS — 814 total tests: 811 passed, 0 failed, 3 conditional platform skips** |
| Artifact verification | **PASS — 241 required paths; 283 JavaScript files syntax-checked** |
| Local live PostgreSQL/Memgraph integration | **BLOCKED locally** — Docker Desktop Linux engine is not running; no local live-pass is claimed |
| Hosted PR run #1304 (pre-fix candidate) | **FAIL** — PostgreSQL lock-wait regression observed an unrelated `auth_sessions.last_seen_at` waiter; this identified fixture interference, not a passing race proof |
| Hosted push run #1305 / PR run #1306 (head before inventory refresh) | **Superseded** — the candidate commit had not yet included refreshed generated inventory; do not use these runs as acceptance evidence for the current head |
| Hosted push run [#1307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45125049507) on head 6282ce2 | **FAIL** — Node 22/24, browser/accessibility and CodeQL passed; PostgreSQL/Memgraph failed the revocation lock-wait assertion because a prior session-touch UPDATE was waiting on the blocker |
| Hosted PR run [#1308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45125057424) on head 6282ce2 | **FAIL** — same PostgreSQL/Memgraph lock-wait assertion; Node 22/24, browser/accessibility and CodeQL passed; evidence consolidation failed as a downstream consequence |
| Actor session pre-refresh (commit 3e44c4b) | **FAIL in hosted #1311/#1312** — session-touch UPDATE still waited behind the blocker |
| Auth-session guard and queue-aware drain (commit 6c58edd) | **FAIL in hosted #1317/#1318** — the membership-row blocker stopped the auth-session SELECT before route preflight; no intended race proof |
| Pair-advisory-lock fixture barrier | **FAIL in hosted #1319/#1320** — auth-session SELECT waited on the test-held advisory lock before route preflight; Node 22/24 also detected stale generated inventory |
| Relation-aware observer bind correction (local follow-up) | **IMPLEMENTED / FOCUSED-TESTED** — relation mode now binds only `$1`/`$2` as `[blockerPid, relationName]`; `test/postgres-locks.test.js` passes 4/4. Hosted #1323/#1324 exposed SQLSTATE `42P18` from the preceding bind layout; full non-live suite passes 814 total (811 passed, zero failures, three conditional skips); all three live races require fresh exact-head CI |
| Independent tenant/site review #14 | OPEN / NOT PERFORMED |

No hosted PostgreSQL/Memgraph run has yet established all three revocation-race proofs. Exact-head #1323/#1324 failed after the relation-aware observer was introduced: the helper query raised PostgreSQL SQLSTATE `42P18` because parameter `$2` had no inferable type. The SQL has now been corrected so relation mode uses only `$1` and `$2`, with values `[blockerPid, relationName]`; the default query-fragment mode retains its existing `$1`/`$2` layout. The focused helper suite passes 4/4 on the corrected working tree. The corrected local Node.js 26.12.1 full `npm run check` passes 814 total tests (811 passed, zero failures, three conditional platform skips), with 241 required paths / 283 JavaScript files checked. The integration fixture continues to use the selected-site `FOR UPDATE` blocker and revokes membership/account eligibility only after the relation/tuple/transaction-ID lock evidence and exact blocker PID are observed. Local live PostgreSQL/Memgraph cannot be run because Docker Desktop's Linux engine is unavailable, so the corrected race still requires exact-head hosted validation with zero skips. PR #299 is not ready until all three revocation races pass and all required CI/evidence checks succeed.

## Scope and release boundary

- No database schema or migration change.
- No HTTP/API request or response contract change.
- No dependency or lockfile change.
- No new runtime abstraction or duplicated transaction pattern.
- No package version or SemVer change is warranted.
- No Aikido finding fingerprint is marked resolved by this work.
- Independent tenant review #14, dependency/license review #23, platform security assessment #25 and all other production evidence gates remain separate and open.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, publication or deployment is authorized.

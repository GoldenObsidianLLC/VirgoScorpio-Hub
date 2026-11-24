# VirgoScorpio Hub 0.6.2 — Release Gate and Open PR Review

**Report date:** 24 November 2026 (America/Chicago)
**Source baseline:** `main` at `287508b16d9c7d3156fab07f975413de2c659ae0`
**Package:** 0.6.2, unreleased
**Disposition:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## Executive decision

The exact-main CI run is green, but the release is not production-certified. The canonical readiness artifact records **8 PASS, 2 PARTIAL, 0 BLOCKED, 14 MISSING_EVIDENCE, and 0 NOT_RUN**, with `readyForProduction=false`. Passing CI does not replace independent tenant-security, dependency/license, platform-security, operational, or release-owner evidence.

No tag, GitHub Release, publication, SemVer increment, production deployment, or promotion is authorized.

## Exact-main evidence

- Main SHA: `287508b16d9c7d3156fab07f975413de2c659ae0`, following documentation PR #297. F1.68 / PR #296 remains the latest merged runtime increment.
- Exact-main workflow [#45103774547](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45103774547) completed successfully, 7/7 jobs.
- Node 22.23.4 and Node 24.22.1 each passed 810/810 Hub tests and 94/94 EnginEx tests. Hosted PostgreSQL/Memgraph integration passed 194/194 with zero failures or skips; all 19 migrations applied fresh and passed idempotent re-entry. Browser smoke passed 9/9. CodeQL, signed lockfile/SBOM attestation, and exact-source evidence consolidation passed.
- Readiness artifact [#14787205420](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45103774547/artifacts/14787205420), source-bound to main: ZIP SHA-256 `82ea5854d9694ffbfff47028104e7a6da4b3e03099a16aa77368f8cbfb554ce8`; JSON SHA-256 `e091d3720007ce45c4aa70422eb8f379b2cafbe09b3f8464b713f28a2cdc5242`; Markdown SHA-256 `1a5dd5d66ce7b8034fdfcb0aa0a680b219db7a680f181db524aee82e4ab1d228`.
- Mainline supply-chain attestation artifact [#14786397158](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45103774547/artifacts/14786397158): ZIP SHA-256 `be73b411fc86dc8534e0a4cd37420ecdfcaf8e37de8293efb296c41c5f2891d8`; verification summary SHA-256 `f4f3946db62119bc5ea00761f38f2fb7c233b3dd211c139e6bac4a71a4dec835`.

## Production evidence still outstanding

Independent tenant-isolation review #14, qualified dependency/license review #23, independent platform security assessment #25, load/backup/restore #24, operations approval #26, release scope/owner authorization #13, and governance controls #32 remain open. Live provider and product-parity evidence, antivirus corpus, plugin isolation, observability, and other operational requirements are also incomplete. The release gate ledger in [RELEASE_READINESS.md](../RELEASE_READINESS.md) and [RELEASE-EVIDENCE.md](../RELEASE-EVIDENCE.md) remains authoritative.

## F1.69 candidate — PR #299

[PR #299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) remains draft at `95d38d1aed870ebf407bb963b17d3b693dd2b9f1`; its code-bearing implementation commit is `1df0ae2a87f08a48b5a40ef5750e69d48346cd83`. It revalidates direct-conversation participants after acquiring the relevant transaction locks, preserving the non-disclosing 404 and covering membership removal, account deactivation, and actor-membership revocation races. The diff also changes session `last_seen_at` write throttling; that adjacent change remains in review scope.

Candidate runs #1327/#1328 passed on the code-bearing implementation commit. Final documentation-head runs #1329/#1330 passed all applicable PR checks, including PostgreSQL/Memgraph 195/195, both Node matrices, browser/accessibility smoke, CodeQL, and candidate evidence consolidation. The mainline-only attestation job is expected to skip on PR events. There are no formal review submissions or inline threads. Keep #299 draft until the complete diff receives maintainer review; maintainer tests do not satisfy independent review #14.

## Open pull-request audit

The repository has 23 open PRs. Review APIs showed no formal review submissions across the audited set. The workflow results below are historical observations and must be repeated on the final head after current-main integration; a stale green result is not merge authorization.

| PR | Area | Review finding / next action |
|---:|---|---|
| #239 | Plugin-runner admission control | Existing cap is process-local and image-digest scoped; verify behavior across replicas and avoid claiming distributed tenant fairness. |
| #240 | Container concurrency and cleanup | Await or durably observe cleanup; test orphan recovery instead of relying on detached cleanup. |
| #248 | Required release-evidence gates | Local change consolidates gate IDs, titles, and filenames into one immutable registry shared by report generation and CI validation. Requires commit, fast-forward push, and exact-head hosted CI. |
| #242 | Content-type authorization | Not mergeable against recorded base; integrate current main and review action/capability and owner/reviewer separation. |
| #251 | Membership authorization race | Recorded evidence consolidation failed; revalidate the transaction and actor guard on current main. |
| #243 | Password-reset invalidation | Recorded Node checks fail on stale generated tenant-route inventory; existing local repair candidate has unrelated deletions and is not safe to publish. |
| #246 | Per-site storage quotas | Recorded Node 22/24 checks failed; review legacy/versioned object accounting and every storage adapter. |
| #258 | Email-verification rate limit | Recorded Node checks fail on stale tenant-route inventory; refresh and rerun after integration. |
| #256 | MFA enrollment credential guard | Inventory drift in recorded Node checks; review re-enrollment and recovery behavior. |
| #253 | Query-loop resource bounds | Inventory drift in recorded Node checks; validate compatibility for large result sets and bounded pagination. |
| #252 | Library-route body limits | Inventory drift in recorded Node checks; verify body-supplied site selectors remain correctly authorized. |
| #250 | Login CSRF | Recorded startup-fixture and inventory failures; verify Origin, content type, trusted-host, and proxy-scheme handling. |
| #249 | OIDC/SAML browser-state binding | Recorded identity-provider reachability failures plus inventory drift; fix provider test boundary and verify browser-cookie behavior. |
| #245 | Password-reset resource limits | Inventory drift in recorded Node checks; verify expiry and token consumption transactionally. |
| #264 | Stripe webhook resource bounds | Behavioral failures in timeout/connection handling and timeout configuration; socket destruction cannot deliver an HTTP 408 response. |
| #265 | Checkout reservation limits | Inventory drift in recorded Node checks; review customer normalization, lock ordering, and stock-allocation transactions. |
| #266 | Public media download limits | Behavioral failures in public asset/variant delivery, 404 handling, and concurrency configuration. |
| #269 | Password-reset/mail-worker bounds | Inventory drift in recorded Node checks; ensure failed mail jobs remain retryable and are not excluded by worker queries. |
| #270 | Plugin registry limits | Inventory drift in recorded Node checks; ensure pagination defaults do not silently hide existing entries. |
| #274 | Password-reset timing/rate limits | Inventory drift in recorded Node checks; replace fire-and-forget mail delivery with durable enqueue-before-acknowledge. |
| #267 | Stripe checkout expiry | Inventory drift in recorded Node checks; reconcile authoritative provider expiry before releasing inventory holds. |
| #257 | Tenant-scoped firewall and quotas | Not mergeable against recorded base; review cache generations, tenant context, and fail-closed policy refresh. |
| #299 | Direct-conversation participant revalidation | Draft, applicable candidate CI green, no formal review submissions; review the full diff including session-service throttling. |

Inventory failures are generated-artifact drift, not proof the code is secure. Regenerate the source-anchored tenant inventory only after a branch is integrated with current main. Behavioral test failures need code fixes, not an inventory-only refresh.

## PR #248 local remediation and validation

A dedicated worktree was updated with a normal merge of current `origin/main`, producing local merge commit `3290d33d858981117fb65976fc7ce44004faf60e`. The primary worktree was not changed. The PR's original remote head remains `aad27fc70c29dbd5223cc0baad849f44ac7e0b3b`; no force-push was used.

The local remediation:
- Adds an immutable 15-record evidence registry containing each gate's ID, display title, and expected evidence filename.
- Makes the release-readiness report generator consume that registry, removing a second hard-coded gate list.
- Retains the existing CI validator's shared gate-ID inventory and adds coverage that the report generator and CI agree on the exact immutable registry.
- Fixes stale migration test data by deriving migration count from the same versioned SQL filename convention used by CI. The current repository contains 19 migrations.

Validation on the isolated candidate worktree:
- `npm ci`: completed; npm audit reported 0 vulnerabilities.
- `npm run check`: artifact check passed; **816 passed, 3 skipped, 0 failed**.
- EnginEx: **91 passed, 3 skipped, 0 failed**.
- Focused evidence-gate and evidence-consolidation tests were included in the full Hub check and passed.
- `git diff --check`: passed before the final filename-pattern alignment. The final full `npm run check` passed after that alignment.
- Local runtime was Node 26.12.1. Hosted Node 22/24 checks remain required for the PR's final head.
- Hosted PR checks for this new candidate head have not yet run; live database/provider integration was not run locally.

## Recommended sequence

1. Finish PR #248 maintainer review, commit the local remediation, and push the mainline-merged branch with a normal fast-forward update to the existing PR branch. Require all seven applicable hosted checks on its exact final head.
2. Integrate and repair the security changes in priority order: #251 and #299; authentication and CSRF (#249, #250, #256, #243, #245, #258, #274); then resource-exhaustion, media, plugin, and billing/inventory PRs.
3. Refresh tenant-route inventory where relevant, but only after source integration. Fix behavioral test failures directly and validate on Node 22/24 and hosted service matrices.
4. Keep independent assurance issues #14/#23/#25 and operations/release gates open until qualified evidence and authorized sign-off actually exist.

**Release boundary:** 0.6.2 remains unreleased. No SemVer change, release tag, GitHub Release, publication, production deployment, or promotion is authorized.

# VirgoScorpio Hub 0.6.2 — Release Gate and Development Status Report

**Report date:** 26 November 2026 (America/Chicago)
**Repository:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub
**Verified main:** 5be81f7388c2c32484377b918010ac399cafd574
**Exact-main workflow:** [#45904695214](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45904695214) — success, 7/7 jobs
**Canonical readiness artifact:** [#15157402047](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45904695214/artifacts/15157402047)
**Artifact archive SHA-256:** 9347b258984f828c298831669c25831936199fcdd663883c04c8655f8d123408
**Package:** 0.6.2 — private, unreleased
**Disposition:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## 1. Executive decision

GitHub main is 5be81f7388c2c32484377b918010ac399cafd574. Its latest exact-main Actions run completed all seven required jobs. This validates current mainline source; it does not certify external providers, full product parity, operational recovery, independent security review or release-owner approval.

The canonical source-bound readiness artifact reports **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, with readyForProduction=false and releaseClassification NOT_PRODUCTION_CERTIFIED. The formal decision remains **NO-GO**. The two PARTIAL items are qualified human dependency/lockfile review and a service-less diagnostic (1 pass / 54 skipped); the separate hosted PostgreSQL/Memgraph job passed 200/200 with zero skips.

Keep 0.6.2 private and unreleased. Do not create a tag or GitHub Release, publish packages, increment SemVer, deploy or promote to production.

## 2. Exact-main CI and source-bound evidence

| Evidence | Result on exact main |
|---|---|
| Node.js 22.23.4 | 1,113/1,113 Hub tests; zero failures/skips; EnginEx 94/94 |
| Node.js 24.22.1 | 1,113/1,113 Hub tests; zero failures/skips; EnginEx 94/94 |
| Hosted PostgreSQL/Memgraph | 200/200 integration tests; zero failures/skips |
| Fresh migrations | 21/21 application migrations applied to a disposable database |
| Idempotency | Second migration pass skipped all 21/21 as already applied |
| Browser editor/accessibility smoke | Required job passed; smoke is not full WCAG acceptance |
| CodeQL | Security-analysis job passed |
| Dependency audit | npm audit reported zero vulnerabilities in both Node jobs |
| Supply chain | Lockfile/SBOM attestation and provenance verification passed; runtime SBOM parity passed |
| Evidence consolidation | Exact-source evidence and checksum consolidation passed |

The readiness artifact was generated at 2026-11-26T22:28:38.206Z and binds to the main SHA above. Its embedded workflow subdocument captured an intermediate in-progress state; the authoritative Actions run subsequently completed 7/7. The artifact source tree was recorded clean and the EnginEx submodule was pinned/clean.

## 3. Formal production gate

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

### The two PARTIAL gates

1. **Human dependency/lockfile review.** Automated dependency audits, clean install, CodeQL, SBOM and provenance automation pass; a qualified human review with recorded license/risk disposition is still missing.
2. **Service-less integration diagnostic.** This records 1 pass and 54 skips. It is not a substitute for hosted PostgreSQL/Memgraph integration, which passed 200/200.

### Fourteen missing evidence categories

| # | Required evidence | Tracking / gap |
|---:|---|---|
| 1 | Independent tenant isolation/site authorization review | #14; maintainer inventories are not independent review |
| 2 | Live OIDC/SAML, email delivery and MFA recovery E2E | Identity provider, mailbox and recovery acceptance |
| 3 | ClamAV and malicious-file corpus | Scanner integration, adversarial corpus and legacy-asset quarantine |
| 4 | Real cloud object storage | S3/GCS/Azure-compatible credentials, least privilege, lifecycle/failure tests |
| 5 | Stripe lifecycle | Webhook replay/idempotency, ambiguous outcomes and inventory acceptance |
| 6 | Full browser and accessibility | Complete editor journeys, manual WCAG and screen-reader acceptance |
| 7 | Commerce parity | Tax, shipping, coupons, refunds, fulfilment, downloads and subscriptions |
| 8 | Community parity | Group privacy, abuse/spam, search, export/deletion and forum acceptance |
| 9 | Plugin isolation | Signed pipeline and adversarial container/runtime isolation evidence |
| 10 | Human dependency/SBOM/provenance/CodeQL assessment | #23; automation does not replace qualified human review |
| 11 | Load and recovery | #24; load/soak, fault injection, backup/restore and drills |
| 12 | Independent platform security assessment | #25; severe-finding remediation and retest |
| 13 | Operations and release approval | #26/#13; runbooks, secrets, rollback, monitoring, named approver |
| 14 | Production observability | OTLP backend, security, governance, retention, ownership and delivery |

All evidence must be tied to the exact candidate version and full source SHA. A source change invalidates source-bound evidence and requires regeneration. Internal inventories and CI do not satisfy independent assurance requirements.

## 4. GitHub pull requests and issue inventory

### Open pull requests

Two PRs are open in the current GitHub snapshot:

- **[#274 — Aikido password-reset timing mitigation](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/274)** — open, Changes requested, non-draft, mergeability false / dirty. Head SHA 30f3a3754548c9a1445e5d6a4599b1cf4bbd7aab; base main SHA 13533aeb2c8288025f395ab0fb9f328367e3d33b, behind current main. Review identifies a duplicate handler declaration (parse-time failure), generic 202 before detached in-memory work (requests can be lost on process exit), and mock-only tests that do not execute the real route/service/outbox path. **Do not merge as submitted.**

- **[#306 — F1.74 durable password-reset queue](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/306)** — open draft at commit 97939ea8ff69d1cd85c620a7c00a7c069a78ce79. Exact-head [PR workflow #45923224770](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45923224770) and [push workflow #45923219219](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45923219219) passed Node 22/24, CodeQL, browser smoke, hosted PostgreSQL/Memgraph (fresh/idempotent migrations and zero-skips integration), and evidence consolidation. Lockfile/SBOM attestation is intentionally mainline-only and skipped on PR/push. The maintainer self-review attestation is still pending; the PR remains draft.

PR #305, the release-gate documentation refresh, is merged into the current main SHA. No GitHub Release is published.

### Active issue register

| Issue | Priority / subject | Current interpretation |
|---:|---|---|
| #277 | Aikido autofix PR-batch triage | PR-state inventory does not close scanner-fingerprint disposition |
| #235 | Domain scan freshness and asset coverage | Scanner coverage/evidence remains incomplete |
| #234 | SAST and secret-history triage | Findings and historical-secret disposition remain open |
| #124 | Tenant/site authorization hardening | Parent assurance and maintainer-led follow-up |
| #14 | Independent tenant isolation review | P0 release evidence missing |
| #23 | Human dependency/SBOM review | P1 evidence missing/partial |
| #24 | Load, restore and recovery | P1 evidence missing |
| #25 | Independent security assessment | P0 evidence missing |
| #26 | Operations and release-owner approval | P0 evidence missing |
| #13 | Approved 0.6.2 scope/provider matrix | Preview recommendation non-production only; no exception granted |
| #32 | Operating/compensation/capital controls | P0 business-operating controls remain open |
| #1 | Community call | Ongoing community tracker |

## 5. Merged engineering baseline since the prior report

| Increment | PR | Mainline change |
|---|---:|---|
| F1.73 retained library quotas | #304 | Per-site 5 GiB / 10,000 object defaults, 50 MiB per-file ceiling and 30-minute storage reservations (migration 0020) |
| Checkout reservation hardening | #265 | Bounded per-customer pending reservations and held units per product |
| Public asset concurrency | #266 | Public reads capped at 1–8 (default 4); webhook ingress guards restored |
| Plugin registry quotas | #270 | Bounded registry quotas and pagination with compatible defaults |
| Password-reset/mail-worker reliability | #269 | Per-IP/target throttles and five-minute abandoned outbox-claim recovery with eight-attempt terminalization (migration 0021) |
| Documentation refresh | #305 | Updated source-bound release-gate baseline |

These increments are in current main and covered by the exact-main CI result in Section 2.

## 6. Recommended next development increment — F1.74 durable password-reset queue

F1.74 is an isolated local worktree and a draft candidate in [PR #306](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/306), not mainline code and not part of the exact-main readiness artifact.

### Scope implemented in the candidate worktree

- Migration 0022 creates a bounded password_reset_requests queue with status/attempt/lock invariants and indexes for pending claims, stale claims and target-cooldown lookups.
- Production request handling preserves a generic response and the existing per-IP throttle, but now awaits PostgreSQL queue commit before returning 202. The in-memory target-email short-circuit was removed so every production 202 passes the durable database boundary.
- A global transaction-scoped advisory lock serializes pending-capacity and 120-second target-cooldown checks across API replicas. Default pending + processing capacity is 5,000; allowed configuration range is 1–100,000.
- Shared identity helper performs user lookup, reset-token hashing, token persistence and mail-outbox insertion through the same transaction. Queue completion commits in that transaction, avoiding a reset token/outbox message without corresponding queue acknowledgement.
- Existing mail worker processes reset requests using SKIP LOCKED, bounded exponential retry, five-minute stale-claim recovery, terminalization after eight attempts, validated error-code-only logs and target-email PII scrubbing after cooldown. Mail reset links are suppressed when expiry is missing/invalid or elapsed; pending/retry payloads remain available for delivery but clear after successful send, expiry or terminal failure. Added a low-cardinality 30-second queue depth/age snapshot through structured OTLP logs, an explicit `npm run start:mail-worker` entry point, and a systemd reference unit/host guide under deploy/systemd/ (not deployed or target-host validated).
- Non-production developer-token output remains an explicit opt-in; it bypasses the durable queue and is not permitted in production.
- Added route/service and worker tests cover durable-before-202 ordering, fail-closed queue absence/capacity, normalized target cooldown, retry/recovery, exhaustion, sanitized logs and PII cleanup.

### Candidate validation and remaining work

The broader queue/route/worker/tenant-inventory focused suite passed 58/58 before the final shared-helper deduplication; the post-refactor focused regression subset passed 33/33. The complete top-level test glob passes 1,128/1,131 (3 platform skips, 0 failures) on local Node v26.12.1. scripts/verify.js passes (241 required paths; 314 JavaScript files syntax-checked), and git diff --check passes. Two PostgreSQL integration tests cover multi-replica deduplication/capacity, concurrent SKIP LOCKED workers, hashed token storage, outbox payload scrubbing, and stale-claim recovery; both skip locally because TEST_DATABASE_URL is not configured and passed in the previous hosted PR integration run. Fresh hosted CI is required for the shared-worker-helper refactor.

Next steps: (1) maintainer completes and attests the repository-required full-diff self-review; (2) qualify the systemd mail-worker service, secret permissions, OTLP routing, queue alerts and ownership on the target deployment host; (3) address remaining release-evidence gaps #14/#23/#24/#25/#26/#13 and external provider/product acceptance; (4) make a deliberate supersession decision for PR #274 after #306 is accepted. Do not close #274 or issue #13 prematurely.

## 7. Stability, security and architecture notes

- Keep PostgreSQL authoritative for queue state; do not replace it with process-local maps or fire-and-forget promises.
- Preserve transaction reuse and the existing mail-worker retry/claim patterns; avoid a second queue framework or duplicate worker service.
- Store only the token digest in identity_action_tokens. The delivery URL necessarily carries the raw token inside mail_outbox.payload while pending/retrying; clear that payload after successful send, expiry or terminal failure. Never put target email, reset URL, token or provider payload in logs.
- Keep response content and status generic for unknown or known accounts; target cooldown is enforced in PostgreSQL, not by an API-process map.
- Retain per-IP ingress limiting; bound queue depth and retention to prevent unbounded PII or resource growth.
- The worker emits low-cardinality queue depth/oldest-age snapshots through its structured OTLP log pipeline. A reference systemd unit and host guide exist under deploy/systemd/, but have not been installed or validated on a target host. Mail-provider delivery, bounce handling, sender verification and live identity E2E remain independent production evidence gates.
- No package/dependency/lockfile change or SemVer change is proposed by F1.74. Version 0.6.2 remains private/unreleased.

## 8. Final release disposition

**NO-GO for production.** CI is green on current main, but the canonical artifact contains 14 missing evidence gates and two partial gates. Keep the product in development or controlled non-production preview only. F1.74 is a justified next reliability/security increment but does not close any formal production gate until reviewed, merged, exact-source CI regenerated and external acceptance gaps completed.

**No tag, GitHub Release, package publication, SemVer increment, deployment or production promotion.**

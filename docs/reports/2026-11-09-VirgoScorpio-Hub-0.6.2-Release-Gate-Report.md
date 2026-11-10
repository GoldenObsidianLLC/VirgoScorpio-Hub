# VirgoScorpio Hub 0.6.2 — Release Gate Report

**Assessment date:** 9 November 2026 (America/Chicago)
**Repository:** [GoldenObsidianLLC/VirgoScorpio-Hub](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub)
**Candidate:** `0.6.2` — private, unreleased developer-preview candidate
**Current main SHA:** `267380be1ba441f83408e2c63c042760ec662ac7`
**Current PR #115 branch head:** `bac0813bcc82327790fb3fa1a4f347f56c42c093`
**Latest PR workflow:** [run #503](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42766200232) — all six required jobs passed on exact PR head `bac0813bcc82327790fb3fa1a4f347f56c42c093`.
**Current production decision:** **NO-GO — NOT_PRODUCTION_CERTIFIED**
**Scope decision:** Technical recommendation only; authorized release-owner approval remains pending under [issue #13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13).

> This report supersedes the 5 November 2026 0.6.2 release-gate snapshot as the current assessment. Older dated reports and evidence are retained as historical records for their exact source revisions. GitHub Actions timestamps are UTC and may fall on 10 November while this assessment date is still 9 November in America/Chicago.

## 1. Executive assessment

VirgoScorpio Hub 0.6.2 remains suitable only for isolated, self-hosted developer-preview evaluation using synthetic or non-sensitive data. It is not approved for production, hosted multi-tenant service, commercial payment processing, or broad provider/parity claims.

The current mainline includes the F1.20 real Redis outage/recovery qualification merged through PR #114. Its first exact-mainline run, [workflow #495](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42700441554), passed four of six required jobs but failed the PostgreSQL/Memgraph integration job and consolidated evidence aggregation because API-node shutdown exceeded the 180-second Playwright ceiling after the Redis outage/authorization assertions. Memgraph outage/rebuild steps were skipped after teardown timed out. The mainline therefore does not have a green exact-source release-evidence bundle.

The follow-up [PR #115](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/115) adds a shared bounded Redis-client shutdown lifecycle and has a complete green hosted run [#501](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42756901512) on its code head `47e130c61eb867266699f6d76c39efe75dfde348`. All six required jobs passed on that PR head. This is strong evidence for the fix, but it is **PR evidence, not post-merge mainline evidence**. PR #115 remains open, and GitHub currently records no formal review submissions or inline review threads. It must receive maintainer review, be merged through the normal process, and pass a new exact-mainline workflow before F1.20 / issue #113 can be accepted.

**Release disposition:** continue the 0.6.2 developer-preview candidate; keep production NO-GO; do not bump SemVer, tag, publish, or deploy.

## 2. Candidate identity and boundaries

| Field | Assessment |
|---|---|
| Package | `virgoscorpio-hub` |
| Version | `0.6.2` |
| Package visibility | `private: true`; unreleased |
| Release classification | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| Runtime minimum | Node.js `>=22.23.4` |
| Package manager | npm `11.19.1` |
| Hosted runtime matrix | Node.js 22.23.4 and 24.22.1 |
| Local development runtime | Node.js 26.12.1 on Windows x64 |
| Renderer | EnginEx 7.0.0, pinned submodule commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |
| Durable system of record | PostgreSQL |
| Graph projection | Memgraph, driven from PostgreSQL outbox |
| Redis role | Ephemeral Pub/Sub and presence/connection leases; not a durable event log |
| SemVer | No change; retain `0.6.2` |

The recommended scope in [RELEASE-SCOPE.md](../RELEASE-SCOPE.md) remains a conservative self-hosted developer preview. The sample defaults remain intentionally restricted: mock-only AI; external AI content disabled; local media/library storage; email disabled; OIDC/SAML unconfigured; realtime, Memgraph and plugin execution disabled by default; Stripe credentials absent; ClamAV unset. Optional source adapters do not constitute provider validation.

Preview exclusions for issues #15–#22 are not completed production gates. Their provider, browser, product-parity and plugin evidence requirements remain visible for any future production scope.

## 3. Mainline and pull-request evidence

### 3.1 Current mainline — PR #114 / SHA `267380be`

Mainline is `267380be1ba441f83408e2c63c042760ec662ac7`, merged through PR #114. The exact-mainline [run #495](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42700441554) completed all six jobs with this result:

| Required job | Result | Notes |
|---|---|---|
| Node.js 22.23.4 unit/security/dependency | **PASS** | 576/576 Hub tests; 94/94 EnginEx tests; audit reported zero vulnerabilities. Service-less integration subset remained PARTIAL with 34 skips. |
| Node.js 24.22.1 unit/security/dependency | **PASS** | 576/576 Hub tests; 94/94 EnginEx tests; audit reported zero vulnerabilities. Service-less integration subset remained PARTIAL with 34 skips. |
| PostgreSQL/Memgraph integration | **FAIL** | Dedicated live integration subtest passed 80/80 with zero skips. Fresh migrations applied 18/18 and idempotent rerun skipped 18/18. Physical Redis reconnect/recovery, no Pub/Sub replay, exact service restoration and PING passed. The PostgreSQL-backed browser assertions observed membership revocation and heartbeat closure, but API-node teardown exceeded 180 seconds; later Memgraph outage/rebuild steps were skipped. |
| Browser editor/accessibility smoke | **PASS** | 9/9 smoke tests. This is not manual WCAG/screen-reader acceptance. |
| CodeQL | **PASS** | Static-analysis workflow evidence only; not an independent application-security assessment. |
| Consolidated candidate evidence | **FAIL** | The required PostgreSQL/Memgraph producer job did not complete successfully, so the aggregate exact-source evidence gate failed. |

Run #495 therefore has **4/6 jobs passing**. The successful individual subtests do not override the failed integration job or failed aggregator. The last fully green mainline result, [run #472](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42535903899), belongs to the earlier SHA `36220abf4ebcc629fa616961879f5a2ffe1f847d`; it is historical evidence and cannot certify current mainline.

### 3.2 Bounded Redis shutdown follow-up — PR #115

PR #115 is based on the current main SHA and has code head `47e130c61eb867266699f6d76c39efe75dfde348`. Its exact-head hosted [run #501](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42756901512) passed **all six required jobs**:

- Node.js 22.23.4 and 24.22.1 each passed **586/586 Hub tests** and **94/94 EnginEx tests**; npm audit reported zero vulnerabilities.
- The dedicated PostgreSQL/Memgraph suite passed **80/80** with zero skips; all **18/18 migrations** applied fresh and **18/18** were skipped on the idempotent second pass.
- The PostgreSQL-backed multi-node Playwright scenario passed **3/3**, including physical Redis outage, PostgreSQL heartbeat reauthorization after membership revocation, Redis restore/PING, browser-client closure and both API-node shutdowns.
- Memgraph outage/outbox replay and canonical graph rebuild passed.
- Browser editor/accessibility smoke passed **9/9**; CodeQL and consolidated evidence aggregation passed.

The PR introduces one shared `closeRedisClient` lifecycle helper, reused by the real-time bridge, Redis presence adapter/service and Redis connection-quota adapter. Graceful `QUIT` is issued only when readiness is positively known (`isReady === true`, or explicit `isOpen === true` for compatibility clients without `isReady`). Open-but-reconnecting and unknown-readiness clients are destroyed without queuing `QUIT`. Graceful shutdown is bounded to one second before forced destruction; `destroy()` is preferred, with `disconnect()` fallback and safe asynchronous error reporting. Regression tests exercise ready, closed, unknown, reconnecting, rejected, timed-out and fallback paths.

This is an internal lifecycle correction. It adds no runtime dependency, public route/API/protocol, migration/schema, quota-policy change or SemVer increment. The PR is open and mergeable, but formal review submissions and inline review threads are currently absent. Run #501 qualifies the PR code head only. This follow-up also makes the generated tenant-inventory freshness comparison line-ending agnostic for Windows checkouts; that additional source change and the report/index updates are not covered by run #501. The updated branch head is `bac0813bcc82327790fb3fa1a4f347f56c42c093`. Hosted [run #503](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42766200232) passed all all six jobs passed, including consolidated evidence aggregation. Run #503 is a completed PR-head pass on exact SHA `bac0813bcc82327790fb3fa1a4f347f56c42c093`, but it is not post-merge mainline evidence.

### 3.3 Local engineering validation

The following local results are kept separate from hosted evidence:

| Revision / command | Result | Interpretation |
|---|---|---|
| Main SHA `267380be`, Windows / Node 26.12.1, `npm run check` | 576 total; 572 passed; 1 failed; 3 platform skips | Artifact verification passed 230 required paths and syntax-checked 241 JavaScript files. The one failure was the generated tenant-isolation inventory freshness assertion (`npm run security:tenant-inventory` required). This local discrepancy is not an assertion failure in application behavior; PR #115 refreshes the source-anchored inventory and its hosted Node jobs pass. |
| Main SHA `267380be`, `npm run release:readiness -- --skip-tests` | 4 PASS, 1 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE, 4 NOT_RUN | The command deliberately skipped tests, artifact verification and integration execution. It is a diagnostic snapshot, not a complete readiness run. |
| Main SHA `267380be`, supplemental local evidence | Fresh isolated `npm ci`, prior configured Playwright Chromium smoke, Memgraph replay/rebuild and local object-reconciliation dry run passed | These checks do not replace exact-SHA hosted integration, external provider acceptance or independent review. |
| PR #115 plus this report follow-up, Windows / Node 26.12.1 | `npm run check`: 586 total; 583 passed; 0 failed; 3 Windows-specific skips. Artifact verification passed 233 required paths and syntax-checked 243 JavaScript files. | `node scripts/generate-tenant-isolation-route-inventory.js --check` now passes (27 families). The generator normalizes CRLF to LF when comparing generated output, avoiding a false stale result under `core.autocrlf=true`; generated inventory data, source/test hashes and anchors were not rewritten. The upstream PR local Redis suite (33/33) and PostgreSQL-backed multi-node Playwright spec (3/3) remain separate local evidence, not hosted acceptance. |

The exact-HEAD local npm run release:readiness snapshot at `bac0813bcc82327790fb3fa1a4f347f56c42c093` reported **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE, and 0 NOT_RUN**. It verified a clean source tree, Node.js 26.12.1, 18 migration files, the required-artifact syntax gate, and the current unit suites. Hub tests were 583/586 with zero failures and three Windows-specific skips; EnginEx was 91/94 with zero failures and three platform skips. The service-less integration command skipped all 34 tests. The fresh/upgrade database evidence gate remains BLOCKED until a successful evidence bundle is bound to this exact source revision; the 14 missing evidence records remain independent/provider/operations gates. This local run is not the hosted Node 22/24 matrix or production acceptance.

The mainline local inventory failure was caused by strict generated-file text comparison treating a Windows CRLF checkout as different from canonical LF output. The PR follow-up now normalizes CRLF-to-LF on comparison; the canonical source/test digests already normalize line endings, and the checked-in generated data and anchors remain unchanged. The existing tenant-inventory freshness test exercises this path. Do not manually edit generated JSON or anchors. Do not carry ignored local readiness reports into a commit or treat a `--skip-tests` result as release certification.

## 4. Release gate matrix

Status reflects the **current mainline and accepted evidence**, not the best result from an unmerged PR.

| Gate | Status | Evidence / outstanding acceptance |
|---|---|---|
| Candidate identity, Node floor and clean install | **PARTIAL** | Package version and runtime constraints are explicit; hosted Node 22/24 jobs pass. The committed lockfile is present and reproducible, but human dependency/license review remains open (#23). |
| Required source artifacts and automated tests | **PARTIAL** | Hosted mainline Node tests passed, but local mainline inventory assertion was stale. PR #115 exact-head CI has the updated inventory and all tests pass. Require green post-merge CI on the resulting main SHA. |
| PostgreSQL fresh install, upgrade and idempotency | **PARTIAL** | Main run #495 applied/skipped 18 migrations successfully, but integration job did not complete its whole contract or aggregate. PR #115 run #501 passed all 18 apply/18 skip checks and the database producer. Retain exact-main evidence after merge. |
| PostgreSQL transactions, concurrency, outbox and Memgraph recovery | **PARTIAL** | Mainline live subtest passed 80/80, but Memgraph outage/rebuild was skipped after browser teardown timeout. PR #115 run #501 passed the complete PostgreSQL/Memgraph job, outage/replay and canonical rebuild. |
| Tenant/site isolation and independent authorization review (#14) | **MISSING** | Maintainer-generated inventory covers 27 flow families, 78 declared route patterns, 19 implementation files and 41 referenced test files. It is a navigation/drift aid, not an independent review or proof of complete route discovery. Independent reviewer evidence is absent. |
| Identity provider, email and MFA recovery (#15) | **MISSING** | Live OIDC/SAML/email/MFA recovery, replay, rotation, logout and outage tests are not evidenced for an approved provider scope. Deferred from preview; not passed. |
| Malware scanning and legacy asset quarantine (#16) | **MISSING** | Live ClamAV (or selected scanner) malicious-file corpus, timeout/unavailable, false-positive and legacy-asset quarantine/rescan acceptance is absent. |
| Object storage and cloud providers (#17) | **MISSING** | Local storage is the preview default. Live S3/GCS/Azure or other claimed provider credential, least-privilege, encryption, lifecycle and crash-recovery acceptance is absent. |
| Stripe payment and subscription lifecycle (#18) | **MISSING** | Unit coverage exists, but live test-mode provider lifecycle, signed/replayed/out-of-order webhooks, ambiguous outcomes, refund and reservation acceptance is absent. |
| Browser and accessibility acceptance (#19) | **PARTIAL** | Automated browser smoke passed 9/9 on main and PR workflows; the PR multi-node scenario passed 3/3. Manual keyboard, focus, contrast, screen-reader and full user-journey acceptance remain missing. |
| Commerce and community parity (#20–#21) | **MISSING** | Explicit scoped acceptance for tax, shipping, discounts, refunds, fulfilment, entitlements, subscriptions, group privacy, abuse controls, search, export and deletion is absent. Deferred scope is not a parity pass. |
| Plugin signing and adversarial isolation (#22) | **MISSING** | Signed build/provenance pipeline and adversarial container/runtime isolation evidence are absent. |
| Dependency, SBOM, provenance and CodeQL review (#23) | **PARTIAL** | Hosted audit and SBOM parity passed on PR and main matrix; CodeQL passed. Human lockfile/license notice review, provenance/attestation and reviewed evidence bundle remain open. |
| Load/soak, fault injection and backup/restore (#24) | **MISSING** | Bounded Redis and Memgraph correctness tests are not production load/soak, Redis Cluster/failover, arbitrary partition, capacity, RPO/RTO or full backup/restore drills. |
| Independent security assessment (#25) | **MISSING** | No independent assessment record or verified critical/high finding disposition. CodeQL and maintainer tests do not substitute. |
| Operations, monitoring, rollback and release-owner approval (#26) | **MISSING** | Operational roles remain unassigned; deployment/rollback, secret rotation, alerting, incident response and a named release-owner decision are not approved. |
| Production observability deployment | **MISSING** | No deployment-approved OTLP backend manifest/evidence for TLS/authentication, network restrictions, access/retention/deletion/legal-hold, durable delivery, capacity, outage recovery and named owners. |
| Exact-source production readiness and scope approval (#13) | **BLOCKED / NO-GO** | No complete exact-main external evidence set or signed release-owner scope approval. `release:assert-ready` is not satisfied. |

The 0.6.2 developer-preview scope intentionally leaves multiple provider and product gates outside the preview claim. That does not waive the gates for a later production decision.

## 5. Security, reliability and architecture assessment

### Authoritative data and degraded operation

- PostgreSQL remains authoritative for durable collaboration operations, replay history, idempotency, membership and authorization.
- Redis Pub/Sub is ephemeral best-effort notification. Messages missed during outages are not replayed; clients must fetch fresh authorized presence snapshots and collaborative state must reconcile from PostgreSQL.
- Redis presence/connection leases are bounded ephemeral coordination. Redis-backed paths must fail closed while unavailable rather than silently downgrade or replay stale queued commands.
- Memgraph remains a derived graph projection driven by durable PostgreSQL outbox records. A passing projection test is not independent proof of tenant isolation or production recovery.

### F1.20 fault-injection safety

The live outage test is restricted to the dedicated disposable CI Redis service and validates the credential-free loopback URL, exact full container ID, approved `redis:7.4-alpine` image and running state before interruption. Test cleanup and a CI `always()` recovery step restore that exact container. Never apply the procedure to developer-shared Redis/Memurai, remote Redis, or production resources.

### Reuse, duplication and code quality

PR #115 removes duplicated Redis close/quit behavior across three owners and centralizes readiness policy, timeout, forced destruction and safe error reporting. The helper has focused tests, is included in the required-artifact verifier, and does not change public contracts. Keep this shared helper as the single lifecycle seam; avoid adapter-specific shutdown forks. Continue to use the existing shared Redis reconnect policy rather than adding a second backoff implementation.

### Tenant inventory boundary

The generated inventory is useful for source navigation, drift detection and preparing independent review. It is maintainer-authored, curated and dependent on its catalog. The 27/78/19/41 counts must not be represented as exhaustive runtime route discovery, complete tenant coverage or independent security sign-off. Regenerate it with `npm run security:tenant-inventory`; do not hand-edit generated anchors/checksums.

## 6. Open GitHub tracking items

| Issue | Current purpose | Disposition |
|---|---|---|
| [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | Approve 0.6.2 preview scope/provider matrix | Open; named authorized release-owner approval required. |
| [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | Independent tenant/site isolation review | Open; no independent acceptance yet. |
| [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | Lockfile, SBOM, provenance, dependency and CodeQL review | Open; human review/attestation outstanding. |
| [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | Load/soak, fault injection and backup/restore | Open; production topology and RPO/RTO evidence absent. |
| [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | Independent security assessment | Open; independent assessment and remediation verification absent. |
| [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | Operations runbooks and release-owner approval | Open; named owners and approval absent. |
| [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | Zero-reserve operating/compensation/capital controls | Open; no reserve, assessor budget or spending authority is approved. |
| [#113](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/113) | F1.20 real Redis outage/recovery acceptance | Open / PARTIAL until PR #115 is reviewed, merged, and a post-merge exact-main run plus evidence aggregation passes. |

Issues #15–#22 are closed as not planned for the narrow 0.6.2 preview, but the corresponding future production acceptance is still missing. Closure as out of preview scope must not be reported as successful provider or product certification.

## 7. Recommended next development sequence

1. **Complete review of PR #115.** Review the new shared lifecycle helper and adapter integrations, ensure no review threads remain, and merge only through the normal maintainer process after approval. Keep issue #113 open meanwhile.
2. **Qualify the resulting main SHA.** Require all six hosted jobs to pass: both Node matrix jobs, complete PostgreSQL/Memgraph integration, browser smoke, CodeQL and evidence aggregation. Confirm the exact resulting main SHA in the run and ensure the consolidated bundle binds to that same revision.
3. **Re-run source-bound readiness.** On the resulting clean main checkout, retrieve the current successful workflow artifact, run `npm run release:readiness`, inspect each external evidence record and run `npm run release:assert-ready`. Do not transplant CI evidence from the PR synthetic merge or a different SHA. Close #113 only after all F1.20 criteria and post-merge acceptance are met.
4. **Continue the P0 independent gates.** Sequence authorized tenant-isolation/security reviews (#14/#25), dependency/license/provenance review (#23), load/restore and fault evidence (#24), and operational ownership/rollback approval (#26). Obtain authorized scope approval under #13. Resolve #32 governance controls before any paid engagement or expenditure; no assessor or vendor spend is implied.
5. **Only then resume P1 product expansion.** The durable encrypted AI task queue already has persistence, worker and scoped lifecycle foundations. The next product increment should connect authorized enqueue routes to a separately operated worker, revalidate site/caller policy at execution, reserve budgets atomically, enforce idempotency and safe cancellation, and define result retrieval, retention/deletion and key rotation. Provider fallback should follow only after these lifecycle and governance semantics are accepted. Do not start a feature expansion that obscures the F1.20/P0 release blocker.

## 8. SemVer, release and deployment decision

No compatibility-breaking public API, route, protocol, dependency, database schema or migration change is part of the Redis shutdown follow-up. Keep the package at **0.6.2**; no patch bump is justified by this internal in-candidate correction. Do not create a release tag or GitHub Release, publish the private package, deploy to production, or claim production certification.

**Final decision:**

- **Developer preview:** technically supportable within the documented isolated scope, subject to the release-owner scope decision.
- **F1.20 acceptance:** **PARTIAL** on current main; PR #115 has green exact-head hosted evidence but is not merged.
- **Production readiness:** **NO-GO / NOT_PRODUCTION_CERTIFIED**.
- **Release owner:** approval pending; operational roles unassigned.
- **Next blocking action:** obtain formal maintainer review of [PR #115](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/115), then merge normally and require a fully green post-merge mainline run plus exact-source evidence review. PR-head run #503 has passed all six jobs, but no post-merge mainline run has yet qualified F1.20.

## 9. References

- [Recommended 0.6.2 release scope](../RELEASE-SCOPE.md)
- [Release readiness and certification gates](../RELEASE_READINESS.md)
- [Release evidence contract](../RELEASE-EVIDENCE.md)
- [Real-Time Foundation 1](../REALTIME-FOUNDATION-F1.md)
- [Real-Time Operations Runbook](../REALTIME-OPERATIONS.md)
- [Implementation roadmap](../IMPLEMENTATION-ROADMAP.md)
- [Tenant-isolation inventory](../security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-07.md)
- [Changelog](../../CHANGELOG.md)

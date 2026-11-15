# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Evidence snapshot:** 15 November 2026 UTC / 15 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`  
**Current main:** 460eff191d84fe422ed4ac15260a8fd6d9100d77
**Current release decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**  
**Package:** `virgoscorpio-hub@0.6.2` — private and unreleased

> This report distinguishes exact-main hosted evidence, local maintainer engineering checks, and missing production acceptance. It does not authorize release, deployment, publication, or risk acceptance.

## 1. Executive decision

F1.35 plugin registry lifecycle/audit atomicity merged through PR #157 at code SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023; issue #156 is CLOSED. F1.36 firewall-rule create/delete and security-event atomicity merged through PR #160 at main SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77; issue #159 is CLOSED. Exact-main workflow #661 passed all seven jobs, including the live F1.36 PostgreSQL regression, signed mainline lockfile/SBOM attestations and exact-source evidence consolidation. GitHub records no formal review submission for PR #160; implementation, merge and CI remain maintainer evidence, not independent approval.

The canonical readiness classification remains:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction` is **false**. The 14 missing production gates, two partial reviews, absent independent assessments, and pending release-owner/governance decisions are material blockers. Successful CI does not remove them.

## 2. Source and release baseline

| Item | Verified value |
|---|---|
| Main SHA | 460eff191d84fe422ed4ac15260a8fd6d9100d77 |
| Main commit | fix(security): make firewall rule audit atomic (F1.36) (#160) |
| F1.35 PR | [#157](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/157), merged 15 November 2026; no formal review submission recorded |
| F1.35 issue | [#156](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/156), CLOSED |
| F1.36 PR | [#160](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/160), merged 15 November 2026 at 20:37:01 UTC as main SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77; issue [#159](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/159) CLOSED | Maintainer implementation; no formal review submission recorded. Exact-head workflows #659/#660 and exact-main workflow #661 passed. |
| Prior release documentation sync | PR #158, merged on pre-F1.36 main 52b47aebfc537b91f21399080d514a406b613e5a; documentation-only | Reconciled F1.35 readiness before F1.36. Exact-main workflow #658 passed 7/7 jobs; no runtime/API/schema/dependency/SemVer change. |
| CI workflow | Run #661 (https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43759090734), push, attempt 1, 7/7 jobs successful |
| CI completion | 15 November 2026 20:40:33 UTC |
| Readiness snapshot generated | 15 November 2026 20:40:28.106 UTC, after all exact-source producers and evidence verification |
| Package version | `0.6.2`, `private: true`, not published |
| Preview classification | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| SemVer | No change authorized |
| Release / deployment | No tag, GitHub Release, npm publication, production deployment, or release authorization |

The source GitHub repository is public while the package remains private and unreleased. Do not confuse repository visibility with package publication or production authorization.

## 3. Exact-main CI and supply-chain evidence

Current main SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77 was validated by exact-main workflow #661 (https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43759090734), which completed all seven required jobs on 15 November 2026 at 20:40:33 UTC.

| Job / evidence family | Result | Exact evidence |
|---|---|---|
| Node.js 22.23.4 unit, security, dependency checks | PASS | 619/619 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| Node.js 24.22.1 unit, security, dependency checks | PASS | 619/619 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| PostgreSQL / Memgraph integration | PASS | 101/101 live integration tests; zero failures/skips; includes the F1.36 firewall rule/audit rollback/retry regression |
| Fresh and idempotent migrations | PASS | 18/18 applied to a fresh disposable database; 18/18 skipped on idempotent second pass |
| Browser / editor smoke | PASS | Playwright 9/9 |
| PostgreSQL-backed collaboration browser | PASS | Playwright 4/4 |
| CodeQL static analysis | PASS | Workflow job succeeded |
| Mainline SBOM / provenance attestation | PASS | Required mainline signing and verification succeeded |
| Evidence consolidation | PASS | Five exact-source producer manifests validated; canonical readiness artifacts generated |

The PostgreSQL integration log explicitly reports the F1.36 “PostgreSQL firewall rule create/delete mutations commit atomically with site security events” subtest as passed. The two simulated firewall security-event failures in database logs are expected failure-injection trigger diagnostics, not failed tests.

Additional dependency evidence from #661:

- Both runtime CycloneDX 1.5 SBOMs contain 200 components and 201 dependency records, with normalized inventory/dependency-graph parity.
- Hosted npm CLI was pinned to 11.19.1.
- Lockfile SHA-256: 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086.
- Both full and production npm audit scopes reported zero vulnerabilities.
- Mainline provenance and SBOM attestations were signed and verified against the exact merge source.
- Qualified human dependency/license review remains open under issue #23; automated audits and attestations are not legal clearance.

The service-less integration diagnostic remains PARTIAL: 35 tests were skipped on each Node runtime because those jobs do not supply live services. Those skips are not counted as live integration passes. The separate dedicated PostgreSQL/Memgraph producer is the 101/101 live result.

### Run-bound exact-main artifact inventory — workflow #661

The following artifacts belong to exact-main workflow run 43759090734, attempt 1, source SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77. Digests are GitHub Actions artifact archive SHA-256 values, not inner-file hashes. GitHub reported expiry on 13 February 2027 at 20:37:04 UTC.

| Artifact | GitHub artifact ID | API SHA-256 digest |
|---|---:|---|
| PostgreSQL/Memgraph CI evidence | 14178759271 | 5538b846546a70908994e4da8f8be44e6e08b959c8503b5d67af3042b115d4aa |
| Live PostgreSQL/Memgraph integration (Node 22) | 14179138389 | d28b598d0879b44034a23c3c9bad68d7b6c0cbf2feec97542b2c516119b0bceb |
| Canonical release-readiness CI evidence | 14179023559 | 20c4cf0886ffed176a0ce0fdd945d255763c33cb906b79921b5090f84a506334 |
| Node.js 22 CI evidence | 14179940681 | 6e2599b9cee2c85874924fba229e0f721f99d26f99fe04279dd05018e3bbd82b |
| Node.js 24 CI evidence | 14179910989 | be68fe548b637ec440153f050fed735b67f36a9df49cab75892312e737c7b134 |
| Node.js 22 dependency evidence | 14179482514 | d65df34edf8a32017bef5ad6e1b0134ab94f2b1534c7aa12865a40123de0cc6f |
| Node.js 24 dependency evidence | 14179462555 | 8aa7cc624d6063c87cc13cbb2a4572c231d9661e7b7c75e7857557beedcb70cc |
| CodeQL evidence | 14178514516 | 40d5aa8dc394ba6dec5382bbcbce7b141bdcb31442677a5cf5d96fd1fa90c9fe |
| Signed supply-chain attestations | 14179133198 | 67a77621df5b17ef663841cbdc659da36d40803fcc04963b2bdc28bb770af700 |
| Browser/accessibility smoke evidence | 14179980373 | 273d72c181516cca2555227ad5808d5ab5f18db4a6410802720b7ad3850aa9ac |

The canonical readiness artifact generated at 2026-11-15T20:40:28.106Z is bound to main SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77. It remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; readyForProduction is false and classification remains NOT_PRODUCTION_CERTIFIED.
## 4. Production evidence gate matrix

All 14 listed gates remain **MISSING_EVIDENCE**. The hosted CI passes above do not convert these gates into production passes.

| Gate | Status | Required evidence still outstanding |
|---|---|---|
| Tenant isolation / authorization review | MISSING_EVIDENCE | Qualified independent tenant-isolation and authorization assessment; issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) is OPEN / NOT PERFORMED |
| Identity-provider E2E | MISSING_EVIDENCE | OIDC/SAML, email delivery, MFA recovery and identity lifecycle end-to-end evidence |
| ClamAV corpus | MISSING_EVIDENCE | Live scanner plus representative malicious-file corpus, quarantine and legacy-asset acceptance |
| Cloud live providers | MISSING_EVIDENCE | Live S3/GCS/Azure/S3-compatible credential, identity and least-privilege operational acceptance |
| Stripe lifecycle | MISSING_EVIDENCE | Live/test webhook replay, ambiguous-outcome recovery and inventory lifecycle evidence |
| Browser accessibility | MISSING_EVIDENCE | Manual WCAG/assistive-technology acceptance; automated Playwright smoke is not a substitute |
| Commerce parity | MISSING_EVIDENCE | Tax, shipping, coupons, refunds, fulfilment, downloads and subscription acceptance |
| Community parity | MISSING_EVIDENCE | Group privacy, abuse/spam, search, export/deletion and forum acceptance |
| Plugin container isolation | MISSING_EVIDENCE | Signed plugin pipeline and adversarial runtime/container isolation |
| Dependency / SBOM / CodeQL human acceptance | MISSING_EVIDENCE | Qualified human dependency, maintenance, license/distribution, provenance and CodeQL disposition; issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) remains OPEN / PARTIAL |
| Load / backup / restore | MISSING_EVIDENCE | Load/soak, fault injection, backup/restore, recovery objectives and drill results; issue [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) remains open |
| Independent platform security | MISSING_EVIDENCE | Qualified independent platform security assessment and severe-finding remediation; issue [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) is OPEN / NOT PERFORMED |
| Operations / release approval | MISSING_EVIDENCE | Named operational ownership, deployment/rollback runbooks, secrets, monitoring and authorized release decision; issue [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) remains open |
| Production observability | MISSING_EVIDENCE | Deployment-approved OTLP backend, security, governance, ownership, retention and delivery evidence |

The two **PARTIAL** readiness classifications remain:
1. Human lockfile/dependency/license/distribution review is incomplete.
2. The service-less integration diagnostic contains 34 skipped tests per runtime; skipped tests are not passes.

The separate scope/governance issues [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) and [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) remain open. Issues #15–#22 are outside the present 0.6.2 developer-preview plan; their corresponding production provider/parity/plugin acceptance must remain visibly missing, not relabeled as passed.

## 5. Maintainer security and architecture status

The maintainer-led process permits ordinary, isolated, non-production engineering to continue. It is explicitly not independent security review, production risk acceptance, waiver, or certification.

- [Issue #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): OPEN / NOT PERFORMED.
- [Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): OPEN / NOT PERFORMED.
- [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23): OPEN / PARTIAL.
- The merged F1.28–F1.35 mutation/audit atomicity series covers membership, site creation, design-system, taxonomy, relationships, site AI-policy, seven editorial workflow transitions, and plugin registration/administrative lifecycle mutations. All reuse the existing transaction queryable seam; F1.35 is mainline behavior from PR #157.
- PR #154 has no formal human review submission recorded. Automated CI and maintainer implementation evidence do not constitute independent approval.

Current main branch protection is not enabled (`protected: false`). Treat this as a governance hardening gap to address through an explicitly authorized repository policy decision; do not infer that green checks alone enforce human review or release ownership.

## 6. F1.34 — Editorial workflow transition/audit atomicity (merged mainline)

A bounded follow-up tracked by [issue #152](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/152) was implemented through [PR #154](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/154), which merged 15 November 2026 at 08:03:20 UTC into main SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`. Issue #152 is CLOSED.

Source inspection on the F1.33 baseline found that the seven editorial routes dispatched content status/version, workflow and outbox writes through the PostgreSQL store, then inserted the correlated audit event after the store transaction had returned. An audit persistence failure could therefore report an API error after the editorial mutation and durable outbox event had committed.

F1.34 reuses the existing PostgreSQL transition transaction and established `identity.audit(input, { queryable })` seam. It adds an optional, backwards-compatible `onTransition` callback to the transition and seven wrappers, passes the active transaction queryable to the audit service before COMMIT, and removes the route-level post-commit audit to avoid duplicate writes. Published-route uniqueness error mapping is narrowed to the content UPDATE so workflow/outbox/audit database errors retain their original identity. Existing route authorization, site scope, action mapping, optimistic version checks, scheduling bounds, actor/request correlation, response shape and pool-backed defaults are preserved. No new transaction abstraction, schema, migration, dependency, API/protocol, provider, lockfile or SemVer change was introduced.

### Exact-head candidate evidence

PR #154 candidate head was `9848fbfeb973bf8b349ef432dc7d03a495ee543a`. Exact-head push [workflow #640](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43689323133) and PR [workflow #641](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43689373659) both completed successfully with all seven workflow jobs. Node.js 22/24 each passed 612/612 Hub and 94/94 EnginEx tests with zero failures/skips. PostgreSQL/Memgraph passed 100/100 live tests with zero failures/skips, including the editorial workflow audit-trigger rollback/retry regression; migrations passed 18 fresh and 18 idempotent checks; Playwright smoke passed 9/9; DB-backed collaboration passed 4/4; CodeQL and evidence consolidation passed. The mainline-only attestation job was skipped as designed for the feature branch.

### Exact-main merge evidence

Exact-main [workflow #643](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43692705776) completed successfully at 08:06:57 UTC with all seven jobs, including the signed mainline SBOM/provenance attestation and post-producer evidence consolidation. On exact main SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`, Node.js 22/24 each passed 612/612 Hub and 94/94 EnginEx; PostgreSQL/Memgraph passed 100/100 with zero failures/skips; 18 fresh migrations applied and 18 idempotently skipped; Playwright smoke passed 9/9 and DB-backed collaboration passed 4/4. Both full and production npm audit scopes reported zero vulnerabilities. CycloneDX 1.5 SBOMs contain 200 components / 201 dependency records per runtime and match the signed mainline attestation.

GitHub records no formal review submission for PR #154. Merge and automation are maintainer evidence, not independent approval. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. F1.34 does not populate or waive those independent evidence contracts.

## 7. F1.35 — Plugin registry lifecycle/audit atomicity (merged mainline; issue #156 CLOSED)

F1.35 merged through [PR #157](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/157) as exact main SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023 on 15 November 2026. [Issue #156](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/156) is CLOSED.

### Source gap and implementation

The plugin registration route previously wrote the plugin_installs row and then persisted plugin.registered separately. The approve, security-review, activate and disable routes likewise persisted state before a separate plugin.<action> audit insert. An audit failure could therefore return an HTTP error after state had committed. Lifecycle checks also loaded plugin state without a row lock, so concurrent re-registration could invalidate a review's assumptions.

F1.35 reuses withTransaction(localPool, work) and identity.audit(input, { queryable }). Registration/upsert and all four administrative transitions now persist state and correlated audit together. Lifecycle code selects the site-scoped row FOR UPDATE through the active transaction queryable before validating status, two-administrator separation, signature/artifact/SBOM provenance and pinned-image requirements. External invoke and sandbox execution stay outside transaction/row-lock scope. No new transaction helper, schema, migration, dependency, public route, API contract, lockfile or SemVer change was introduced.

### Regression and exact-head evidence

The two-site PostgreSQL fixture injects audit-events trigger failures for registration, approval, security review, activation and disable. Each failure verifies rollback/no audit followed by safe retry/exactly one correlated event. An advisory-gated concurrency regression pauses replacement registration in its audit transaction, queues security review behind the plugin row lock, then verifies that the reviewer reads the replacement pending row and is rejected. The fixture restores its expected disabled state after the concurrency case.

Exact-head push workflow [#653](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733427094) and PR workflow [#654](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733433490) each passed 7/7 jobs. Both supported Node runtimes passed 612/612 Hub and 94/94 EnginEx tests with zero failures/skips; PostgreSQL/Memgraph passed 100/100 with zero skips; migrations passed 18 fresh and 18 idempotent checks; Playwright passed 9/9 and collaboration 4/4; CodeQL and evidence consolidation passed. The branch-only attestation job was skipped as designed.

Exact-main [workflow #655](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733907591) passed all seven jobs on SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023, including the mainline signed lockfile/SBOM attestation and post-producer evidence consolidation. Node 22/24 each passed 612/612 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph passed 100/100, 18 fresh migrations plus 18 idempotent second-pass checks passed, Playwright 9/9, collaboration 4/4 and CodeQL passed. Both npm audit scopes reported zero vulnerabilities. The canonical readiness artifact is bound to the exact source revision and remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN.

Supplemental Windows/Node.js 26.12.1 npm run check passed 609 tests, zero failures and three platform-specific skips. Local live PostgreSQL/Memgraph was not run because local database configuration is absent; hosted exact-head and post-merge workflows supply the live integration validation. No formal GitHub review submission was recorded for PR #157; merge and CI are maintainer/automation evidence, not independent security approval.

F1.35 closes issue #156 only. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. This feature does not satisfy or waive those separate evidence contracts or any production gate.


## 8. F1.36 - Firewall rule and security-event atomicity (merged mainline; issue #159 CLOSED)

F1.36 was implemented on exact main baseline 52b47aebfc537b91f21399080d514a406b613e5a and merged through PR [#160](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/160) at merge commit 460eff191d84fe422ed4ac15260a8fd6d9100d77 on 15 November 2026 at 20:37:01 UTC. Issue [#159](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/159) is CLOSED.

In the site-scoped firewall POST and DELETE routes, the rule mutation and corresponding firewall.rule_created / firewall.rule_deleted security event now use the existing withTransaction(localPool, work) transaction client. Cache invalidation occurs only after transaction commit. Delete audit details include the rule ID, action and scope; the caller-provided free-form reason is not copied into the event.

The implementation preserves existing request validation, security:manage authorization, site-selector reconciliation, site predicates, error mapping, route methods/paths and response contracts. Global rules, matching behavior, TTL, database schema, migrations, dependencies, public API, package version and SemVer are unchanged.

Regression coverage proves that create/delete audit writes share the mutation transaction; event insert and COMMIT failures roll back state and do not invalidate cache; safe retries persist exactly one event; and missing/cross-site delete attempts do not mutate state or cache. The hosted trigger-based PostgreSQL test explicitly passed in exact-head workflows #659/#660 and exact-main workflow #661. Candidate Node 22/24 matrices passed 619/619 Hub and 94/94 EnginEx tests; the live database suite passed 101/101 with zero skips; migrations passed 18/18 fresh and 18/18 idempotent; Playwright passed 9/9 and collaboration 4/4; CodeQL and both npm audit scopes passed.

PR #160 has no formal review submission recorded. The implementation, merge and automated test evidence are maintainer evidence only, not independent security assessment or production approval. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. F1.36 does not close or waive any production gate.

See the [F1.36 merge and mainline validation report](2026-11-15-F1-36-FIREWALL-RULE-AUDIT-ATOMICITY-REPORT.md) and [issue #159](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/159).
## 9. SemVer and release authorization

No public API, schema, migration, dependency, provider, lockfile or package-version change was introduced by merged F1.33–F1.35. Keep `virgoscorpio-hub@0.6.2` private and unreleased. Do not create a tag or GitHub Release, publish to npm, deploy to production, or increment SemVer until:
1. all required production evidence gates are genuinely satisfied;
2. independent tenant and platform security assessments are completed and accepted;
3. qualified human dependency/license/provenance acceptance is documented;
4. load/restore, operations, observability and release-owner approvals are complete; and
5. the named release owner explicitly authorizes the release scope and deployment.

**Final status: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.**

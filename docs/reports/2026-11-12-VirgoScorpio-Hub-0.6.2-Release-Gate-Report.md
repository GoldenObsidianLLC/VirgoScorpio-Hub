# VirgoScorpio Hub 0.6.2 — Release Gate Report

> **Assessment:** 12 November 2026 (America/Chicago)<br>
> **Decision:** **NO-GO FOR PRODUCTION — NOT_PRODUCTION_CERTIFIED**<br>
> **Permitted posture:** Private, unreleased, isolated self-hosted developer preview using synthetic or non-sensitive test data.<br>
> **Current main:** `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907`<br>
> **Merged increment:** [PR #132](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/132), F1.27 editorial workflow author-ownership enforcement
> **Exact-main CI:** [Workflow #585](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43266581120) — **7/7 jobs successful**.

This report consolidates source-bound GitHub Actions evidence, the release-readiness snapshot, the current release manifest, open issue state, and the approved developer-preview boundary. It is a maintainer engineering report, not independent security certification, legal advice, provider qualification, release-owner approval, or deployment authorization.

## 1. Executive decision

VirgoScorpio Hub **0.6.2 remains private and unreleased**. Current main is `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907`, the merge commit for PR #132/F1.27. Exact-main workflow #585 completed all seven jobs successfully. It exercised the supported Node.js 22/24 matrix, the live PostgreSQL/Memgraph integration path, browser/accessibility smoke, CodeQL, signed supply-chain attestations, and CI evidence consolidation.

F1.27 closes a specific authorization gap: the `submit-review` workflow action now applies the existing `canEditContent(actor, siteId, content)` ownership guard after the existing site-level `content:submit-review` capability check and before the workflow store transition. Authors can submit their own drafts; a same-site author cannot submit another member's draft; site-wide editor and site-owner behavior remains intact. The live seeded-role integration matrix also asserts that denied operations do not mutate content, workflow, audit, outbox, or collaboration state. This is targeted maintainer-led regression coverage, not an exhaustive route review or independent assessment.

The new exact-main CI results materially strengthen confidence in the tested paths. They do **not** close the independent review, legal/supply-chain, live provider, recovery/operations, governance, product parity, or release-approval gates. Several maintainership PRs in this sequence have no formal review submissions recorded; successful CI and merge status are not independent approval.

**No production deployment, release tag, GitHub Release, npm publication, production-support claim, or SemVer increment is authorized.** The package remains `0.6.2`, `private: true`, and unreleased.

## 2. Source, branch, and package boundary

| Item | Current value |
|---|---|
| Repository | `GoldenObsidianLLC/VirgoScorpio-Hub` |
| Branch | `main` |
| Current source SHA | `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907` |
| Latest merge | [PR #132](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/132), F1.27 |
| PR head SHA | `ffb2632ed11f774982587a49abaef6bfe4380be0` |
| Previous main baseline | `0748f56e01421d13121ec08f7bc036579e5406835` (F1.26 / PR #131) |
| Exact-main workflow | [#585](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43266581120), push on the exact current main SHA |
| Package | `virgoscorpio-hub@0.6.2` |
| Package state | `private: true`; unreleased |
| SemVer | Unchanged; 0.6.2 remains the unreleased patch candidate |
| Declared Node.js floor | `>=22.23.4` |
| Supported CI matrix | Node.js 22.23.4 and 24.22.1 |
| CI package manager | npm 11.19.1 |
| EnginEx renderer | 7.0.0; pinned submodule `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |

PR #132 changed the authorization guard in the existing API route and strengthened API/live integration tests and the source-anchored tenant inventory. It did not add a route, request/response contract, schema, migration, dependency, provider contract, lockfile change, runtime service, or package version change.

## 3. Exact-main workflow #585 — verified results

Workflow [#585](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43266581120) ran on current main SHA `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907`. GitHub recorded **completed / success**, with all **7 of 7 jobs** successful.

| Job / evidence area | Result | Exact observed outcome |
|---|---|---|
| Node.js 22.23.4 unit/security/dependency checks | **PASS** | Hub tests 595/595; EnginEx tests 94/94; zero failed or skipped; full and production npm audits each reported zero vulnerabilities. |
| Node.js 24.22.1 unit/security/dependency checks | **PASS** | Hub tests 595/595; EnginEx tests 94/94; zero failed or skipped; full and production npm audits each reported zero vulnerabilities. |
| PostgreSQL/Memgraph live integration | **PASS** | 93/93 tests, zero failures, zero skips, zero TODOs; exact source SHA verified. |
| Fresh PostgreSQL migrations | **PASS** | 18/18 migrations applied; 18/18 skipped on the idempotent second pass; disposable database dropped. |
| Browser editor/accessibility smoke | **PASS** | Playwright smoke 9/9. This is automated smoke evidence, not full manual WCAG/assistive-technology acceptance. |
| Two-node collaboration recovery scenario | **PASS** | CI browser evidence recorded a two-node, ten-editor reconnect storm: 10 reconnecting editors, 24 replayed operations per editor, 240 total replay deliveries, and 154 ms observed harness recovery latency. This is a test-harness observation, not a production benchmark or SLO. |
| Redis recovery and Pub/Sub behavior | **PASS** | Live Redis interruption/reconnect path passed; post-reconnect authorization events were delivered. Pub/Sub messages missed during an outage are not durably replayed. PostgreSQL and command/heartbeat reauthorization remain authoritative fallbacks. |
| Memgraph outage/replay and canonical rebuild | **PASS** | A graph event remained pending while Memgraph was unavailable, replayed after restart, and projected successfully; canonical rebuild preserved tombstones, removed stale nodes, and produced a deterministic second-run summary. |
| CodeQL | **PASS** | The exact-main analysis job completed successfully. CodeQL is automated analysis, not an independent security assessment or final finding disposition. |
| Supply-chain attestations | **PASS** | Mainline attestation job completed for the exact source and the expected lockfile/SBOM subjects. |
| Evidence consolidation | **PASS** | Consolidator completed successfully and accepted the exact-source producer evidence. |

### 3.1 Dependency audit and SBOM

Both Node matrix jobs reported **zero vulnerabilities** for the full dependency audit and the production-only audit at the configured high-severity threshold.

The committed lockfile SHA-256 is:

`8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`

The two runtime-generated CycloneDX 1.5 SBOMs each describe **200 components and 201 dependency records**. Their normalized component/dependency inventories matched.

| SBOM producer | SHA-256 |
|---|---|
| Node.js 22.23.4 | `91bfefa0c00308a3abfbc6fb4ae7493b6f4b77fae142e6b5b8f4147c0f34ac44` |
| Node.js 24.22.1 | `e438234c9a1ec1fc3a62becf1bb9776a007c43fd852a1668a9436be69cd4bfaa` |

The current producer logs identify **14 components with LGPL license terms** and zero components without an identified license expression. These are inventory facts, not legal clearance. Qualified human review of distribution obligations, optional/native packages, and the exact SBOM/provenance/CodeQL evidence remains open under [issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23).

The mainline supply-chain artifact is **13966781173** (`virgoscorpio_hub-supply-chain-attestations`), archive digest:

`sha256:51abc261fdd48444dd97bee2a20f48b421ed6d49898f713de6ea796f7bd579f8`

The workflow recorded exact-source provenance attestation [66803035](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66803035) and SBOM attestation [66803059](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66803059). These demonstrate artifact/source integrity for the run; they do not replace human dependency/license review or an independent security assessment.

### 3.2 F1.27 authorization result

The merged change deliberately reuses the existing authorization policy rather than introducing a parallel ownership abstraction.

- The handler first retains the existing site-scoped `content:submit-review` capability check.
- It then loads the current content in the selected site and applies `canEditContent(actor, siteId, content)`.
- Only after both checks does the existing PostgreSQL workflow transition run.
- Authors can submit their own draft; a same-site non-owner author receives the established forbidden response before any workflow side effect.
- Editors retain site-wide submit/approve/reject behavior; owner-only publish/schedule/archive/unpublish behavior remains unchanged.
- Denial assertions compare content, workflow, audit, outbox, and collaboration state before and after the request.

The database-free API tests passed 26/26 on the PR head. The live exact-main PostgreSQL/Memgraph suite passed 93/93 with no skipped tests, including the seeded site-owner/editor/author workflow role matrix. Local pre-merge validation reported 595 tests (592 passed, 0 failed, 3 Windows-specific skips); the local database-backed fixture was skipped because the Windows host had no disposable PostgreSQL `DATABASE_URL`. The exact-main hosted database suite subsequently executed the integration scenario without skips.

GitHub recorded no formal review submission for PR #132. Treat this as maintainer/automation evidence only.

## 4. Formal release-readiness snapshot and evidence-ordering discrepancy

The current exact-source Node-job readiness snapshot reports:

| Classification | Count |
|---|---:|
| PASS | 7 |
| PARTIAL | 2 |
| BLOCKED | 1 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

The snapshot is correctly marked `NOT_PRODUCTION_CERTIFIED`, with `readyForProduction: false` and production certification `BLOCKED`.

**Important timing qualification:** the Node matrix jobs generate their readiness snapshot before the dedicated PostgreSQL/Memgraph producer job has finished and published its run-bound artifacts. Consequently, that early snapshot still shows the database/migration evidence as blocked or absent. Later in the same workflow #585, the exact-source dedicated producer passed 93/93 live integration tests, the fresh migration artifact passed 18/18 applied plus 18/18 idempotent second-pass checks, and the evidence consolidator completed successfully. The early `BLOCKED` database line must therefore not be misreported as a failed database test. Equally, the successful CI producer does not make the remaining independent/provider/operational gates complete or turn the formal release decision into GO.

This is a CI sequencing/reporting improvement opportunity: generate a final consolidated readiness snapshot only after all required producer artifacts are available, while keeping each artifact bound to its own run, job, and exact source SHA. Do not copy or edit evidence from another revision to make the report pass.

The 14 missing items and the two partial classifications remain release blockers. The service-less integration sweep recorded 34 skips per runtime and remains PARTIAL; skipped tests do not count as live integration passes. The lockfile is present, a clean isolated `npm ci` passed, but human dependency/license review remains incomplete.

## 5. Production gate inventory

The following table follows the 14 production-gate categories in `RELEASE-MANIFEST.json`. The PASS entries describe the bounded automated evidence observed in workflow #585; they do not broaden the preview's supported provider or production claims. These gate-specific dispositions are not a one-to-one restatement of the aggregate machine readiness classifier in section 4, so the table rows should not be summed to reproduce the 7 PASS / 2 PARTIAL / 1 BLOCKED / 14 MISSING_EVIDENCE snapshot.

| # | Production gate | Current disposition | Evidence / remaining work |
|---:|---|---|---|
| 1 | Supported Node runtime, reviewed committed lockfile, clean `npm ci`, repeatable installation | **PARTIAL** | Supported Node 22/24 CI and isolated installation passed; qualified human dependency/license review remains open under #23. |
| 2 | Fresh PostgreSQL migration install and idempotency | **PASS — bounded CI fixture** | Workflow #585 applied 18/18 migrations and skipped 18/18 on the idempotent second pass. A supported-upgrade fixture was not separately asserted in #585; do not infer upgrade acceptance from fresh migrations. Deployment-specific upgrade/restore acceptance remains open. |
| 3 | PostgreSQL transactions/concurrency, outbox, Memgraph outage/replay and reconciliation | **PASS — bounded CI fixture** | 93/93 live integration tests, zero skips; Memgraph outage replay and canonical rebuild passed. This does not establish production topology, capacity, HA or DR. |
| 4 | Independent tenant isolation and authorization review | **MISSING** | [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) remains OPEN / NOT PERFORMED. Maintainer-authored route inventories and regressions do not satisfy the independent reviewer contract. |
| 5 | Real OIDC/SAML/email-provider and account-recovery validation | **MISSING** | Provider-backed identity, delivery, MFA recovery and account lifecycle acceptance remain unverified; see issue #15 and the authorized provider matrix under #13. |
| 6 | Malware-scanner integration, malicious-file corpus and legacy asset quarantine/rescan | **MISSING** | A fail-closed adapter is not a live scanner qualification; ClamAV corpus and legacy-asset handling evidence remain required under the preview scope. |
| 7 | Local object reconciliation, crash recovery and storage consistency | **MISSING** | Reconciler rehearsal, crash/restart, orphan/retention, and restore evidence for the approved topology remain incomplete; coordinate with #24 and #26. |
| 8 | Live S3/GCS/Azure/S3-compatible storage credentials, permissions, encryption, retention and lifecycle | **MISSING** | Provider adapters/configuration are not provider certification. Dedicated non-production accounts and least-privilege evidence remain absent; #13/#17. |
| 9 | Stripe webhook replay, refund/subscription and inventory lifecycle | **MISSING** | Test-mode provider lifecycle, replay/idempotency, ambiguous outcomes, refunds and subscriptions remain to be accepted; #13/#18. |
| 10 | WooCommerce/BuddyPress/Elementor scoped acceptance | **MISSING** | Feature subset and parity claims require an approved acceptance matrix and evidence; excluded features are not passed. |
| 11 | Signed plugin build pipeline and adversarial container isolation | **MISSING** | Provenance for this application does not qualify plugin artifact signing, runtime isolation, denied egress or adversarial container behavior; #22. |
| 12 | Browser/accessibility, fuzz/load/soak, backup/restore and recovery | **PARTIAL** | Automated Chromium smoke passed 9/9; the ten-editor CI recovery scenario passed. Full manual WCAG/assistive-technology, fuzz, representative load/soak, database/object restore and measured RPO/RTO remain open under #19/#24. |
| 13 | Human dependency/SBOM review, independent security, operations runbooks and release approval | **MISSING** | Human supply-chain review #23, independent assessment #25, named operations/release owners and rehearsals #26, and governance authority #32 remain open. CodeQL and attestation are not substitutes. |
| 14 | Exact-candidate release-readiness and assertion with retained report/logs/evidence | **BLOCKED / REQUIRES FINALIZATION** | CI evidence consolidation passed, but the readiness snapshot is produced before the DB producer artifacts become available. Follow up by generating the final readiness summary after exact-source evidence aggregation; production GO still requires all external approvals and gates. |

The broader readiness report also identifies production observability delivery/backend/security/governance/ownership evidence as missing. The automated preview smoke checks must not be treated as production observability acceptance.

## 6. Open release and assurance issues

| Issue | State | Required decision / evidence |
|---|---|---|
| [#13 — Approve 0.6.2 release scope and provider matrix](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | **OPEN** | Authorized release owner must approve exact version/SHA, preview/production boundary, provider matrix, topology and included features. The current scope remains a technical recommendation only. |
| [#14 — Independent tenant/site isolation review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | **OPEN / NOT PERFORMED** | Independent qualified reviewer, exact-SHA route/tenant review, adversarial tests, findings and retest evidence. |
| [#23 — Dependency/SBOM/provenance/CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | **OPEN / PARTIAL** | Qualified human review of direct/transitive dependencies, optional/native packages, 14 LGPL-bearing SBOM components, provenance, advisories and CodeQL findings. |
| [#24 — Load/soak/fault/backup/restore](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | **OPEN** | Workload and SLO definition, sustained load, fault injection, full restore, data-integrity checks and measured RPO/RTO. |
| [#25 — Independent security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | **OPEN / NOT PERFORMED** | Independent platform review, threat model, severity-ranked findings and independent retest/risk disposition. |
| [#26 — Operations runbooks and release-owner approval](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | **OPEN** | Named accountable owners, approved topology, rehearsed deployment/migration/rollback/secret rotation/incident/restore controls, monitoring and release approval. |
| [#32 — Governance and zero-reserve operating/capital controls](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | **OPEN** | Properly authorized company decision; no paid assessor, vendor, supplier or other spending may be inferred from this engineering work. |

F1.27 remains linked to ongoing maintainer-led issue [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). The issue remains open for the larger tenant-isolation hardening work; the F1.27 merge does not close or replace #14 or #25.

Issue [#133](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/133) tracks the documentation reconciliation that produced this report and the synchronized project-status snapshots. It should remain open until the documentation PR is reviewed and merged.

## 7. Developer-preview boundary and operational restrictions

The current recommended default posture remains conservative:

| Area | Preview default / limitation |
|---|---|
| Storage | Local filesystem/object storage only; no live cloud provider is certified by these CI runs. |
| AI | Mock provider only; external AI content is disabled by default; do not enable prompt/content logging. |
| Email and identity federation | Email disabled; OIDC unconfigured; SAML disabled/unconfigured. |
| Realtime | Optional and non-production; Redis Pub/Sub is ephemeral and does not replay outage-time messages. PostgreSQL is authoritative; command/heartbeat reauthorization remains a security fallback. |
| Graph | Memgraph is a rebuildable projection, not the source of truth. |
| Plugin execution | Disabled by default; signed build and adversarial isolation remain unqualified. |
| Payments | Stripe credentials unset; live payment lifecycle not qualified. |
| Malware scanning | ClamAV scanner unset; adapter tests do not certify a production scanning service. |
| Test data | Synthetic/non-sensitive data in an isolated self-hosted environment only. |

Do not use production/customer data, enable uncertified providers, expose a public hosted service, or infer production support from green CI. Verify the current `.env.example`, `docs/RELEASE-SCOPE.md`, `docs/RELEASE_READINESS.md`, operations runbooks and issue decisions before changing preview defaults.

## 8. Semantic versioning and release controls

- Package version remains **0.6.2**; it remains private and unreleased.
- The F1.27 change is a compatible authorization correction and regression-coverage increment within the existing 0.6.2 candidate. It introduces no public HTTP contract, schema, migration, dependency, lockfile, provider or package-version change.
- Do not increment to 0.6.3 for documentation or evidence-only work.
- No release tag, GitHub Release, npm publication, production deployment or production certification is authorized.
- A future release decision requires an authorized owner, approved release scope, all required exact-SHA evidence, human/legal/security review, operational readiness and a successful final `release:readiness` / `release:assert-ready` process.

## 9. Recommended next development step

The next bounded engineering task is tracked in [issue #134](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/134): fix the **release-readiness evidence ordering** identified in section 4. Keep the existing producer/consumer boundaries and exact-SHA evidence contracts, but ensure the final readiness report is generated or refreshed only after the dedicated database/migration producer artifacts have been downloaded and validated by the consolidator. The early Node-job snapshot may remain as a diagnostic snapshot, but it must be labelled as preliminary and must not be presented as the final gate decision.

Acceptance criteria for that follow-up:

1. A final readiness artifact is generated after all required producer jobs complete and their checksum/source-revision contracts are validated.
2. The final snapshot reports the exact current source SHA and distinguishes genuine gate failures from evidence that was not yet produced at the time of an earlier job.
3. No artifact from another workflow, source revision, or job can satisfy the contract; the aggregator remains fail-closed on missing, mismatched, or stale evidence.
4. The 14 external/human production gates remain missing until their own independently acceptable evidence and approvals exist.
5. Tests cover job-order variation, missing producer artifacts, wrong source SHA, checksum mismatch, partial producer failure and the successful all-producers path.
6. Documentation and the release manifest use one canonical final-readiness definition; no SemVer change is made.

This is a release-tooling/report-correctness improvement, not production gate waiver or authorization to ship.

## 10. Evidence references

- [PR #132 — F1.27 author-ownership enforcement](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/132)
- [Exact-main workflow #585](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43266581120)
- [PR #131 — F1.26 Redis subscriber re-subscription coverage](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/131)
- [Issue #124 — maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- [Issue #133 — README project-status reconciliation](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/133)
- [Recommended 0.6.2 release scope](../RELEASE-SCOPE.md)
- [Release readiness and gate definitions](../RELEASE_READINESS.md)
- [Implementation roadmap](../IMPLEMENTATION-ROADMAP.md)
- [Maintainer-led security assurance policy](../security/MAINTAINER-LED-SECURITY-ASSURANCE.md)

---
*Snapshot is bound to main SHA `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907` and workflow #585. Re-run against the exact release candidate before any formal release decision.*

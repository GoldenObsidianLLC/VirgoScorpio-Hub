# VirgoScorpio Hub 0.6.2 — Full release-gate report
**Assessment snapshot:** 16 November 2026 (UTC)
**Current mainline source:** fef8c9e19ceac14d965a3ed824250a7abbafc04f (F1.40 / PR #172 merged)
**Latest exact-main CI:** [workflow #688](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43926434802) — successful, 7/7 jobs
**Latest runtime merge:** F1.40 / PR #172 at fef8c9e19ceac14d965a3ed824250a7abbafc04f
**Decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**

> This report records F1.39 as merged mainline functionality and separates engineering CI evidence from the remaining independent/provider/product/legal/operational production gates. Passing CI and internal regression tests do not satisfy external provider, independent security, manual product acceptance, legal, governance, or operational release gates.

## Executive decision

VirgoScorpio Hub `0.6.2` remains a private, unreleased developer-preview candidate. `readyForProduction` is `false`. No SemVer increment, release tag, GitHub Release, npm publication, production deployment, or claim of production certification is authorized.

The current mainline includes F1.38 (PR #166), F1.39 legacy media upload/audit atomicity (PR #169), and F1.40 reusable-component mutation/audit atomicity (PR #172). Current main is fef8c9e19ceac14d965a3ed824250a7abbafc04f. Exact-main workflow #688 passed all seven jobs, including 111/111 live PostgreSQL/Memgraph tests, Node 22/24 each 646/646 Hub and 94/94 EnginEx tests, 18/18 fresh and 18/18 idempotent migration checks, Playwright 9/9, CodeQL, signed mainline attestations and exact-source evidence consolidation. Canonical readiness artifact 14256906930 was generated at 2026-11-16T18:16:00.210Z, archive SHA-256 7eadf403d925e29166a4db152c39afa62b8ddf728764ab081646a5eab85a9892. Final readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

The finalized production-gate classification is:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

This is the authoritative final aggregate, not the preliminary per-runtime readiness snapshot. The preliminary Node reports are retained as audit records; they show 38 service-less integration skips per runtime before producer validation. The final aggregate promotes the exact-source live PostgreSQL/Memgraph producer evidence but does not convert the service-less skips into passes.

## Latest exact-main source validation — workflow #688 (F1.40 merged; current main fef8c9e)

Workflow [#688](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43926434802) validated current main SHA fef8c9e19ceac14d965a3ed824250a7abbafc04f and completed all seven jobs successfully.

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 646/646 Hub; 94/94 EnginEx; zero failures/skips |
| Node.js 24.22.1 | PASS | 646/646 Hub; 94/94 EnginEx; zero failures/skips |
| PostgreSQL / Memgraph | PASS | 111/111 live integration tests; zero failures/skips, including F1.40 two-site boundary and create/update/delete audit rollback/retry |
| Fresh migrations | PASS | 18/18 applied; 18/18 idempotent second-pass checks passed |
| Browser editor/accessibility smoke | PASS | 9/9 Playwright smoke tests; not full manual WCAG acceptance |
| CodeQL | PASS | Static analysis succeeded; not independent application-security review |
| Mainline attestations | PASS | Signed SLSA provenance and CycloneDX SBOM attestations passed and verified |
| Evidence consolidation | PASS | Exact-source producer manifests/checksums verified; canonical readiness generated |

Canonical readiness artifact 14256906930 was generated at 2026-11-16T18:16:00.210Z; archive SHA-256 7eadf403d925e29166a4db152c39afa62b8ddf728764ab081646a5eab85a9892. Final status remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction false, NOT_PRODUCTION_CERTIFIED, production NO-GO. The two PARTIAL categories remain service-less integration diagnostics (39 skips per runtime, not live integration failures) and incomplete qualified human dependency/license review.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release readiness | 14256906930 | 7eadf403d925e29166a4db152c39afa62b8ddf728764ab081646a5eab85a9892 |
| PostgreSQL/Memgraph producer | 14257061824 | 1d616806e1cd455d3140776137475ff253d5bc783dfa307f6a806a3263254084 |
| Live PostgreSQL/Memgraph tests | 14256002273 | 714e260b9d6bbb67e62bb97813d5a98d0494ea10332dddc432d546bf9445847b |
| Node.js 22 evidence | 14257455351 | a1a7e7203c59bd107d77ad9352ec17b19d5c217d63b815bfa7370da6d0254d55 |
| Node.js 24 evidence | 14256416968 | 63b65a64b7cda8da3652c7c3f807b2011ea4b7b80c430221ec52a399cc4a4ddc |
| Browser/editor evidence | 14255962007 | 3d2d48df33f26ea449f0a83c1f981c96d3a3246f2140fd99e8ac587ce09e8718 |
| CodeQL evidence | 14255912153 | 4dc1cf712e3971beb007d1da74b33c610e2bc9721970adc846b35511745a4d58 |
| Signed supply-chain bundle | 14257570303 | 1e0e24af312d3cf9e6a7e9fa47131315a8bfc90bc465b1c9617205606eff1296 |
| Node.js 22 dependency evidence | 14257395503 | c54bb17cdeff594ed0071270ff20752d355b6fc9c7a569134630f3a1ea4564a0 |
| Node.js 24 dependency evidence | 14257046704 | 808c2cc68c0b9d6db7bd57b1c1194ddbc813d1dad46b2c8d6f7d16c6e417ef05 |

Lockfile SHA-256: 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086. Attested CycloneDX SBOM SHA-256: 2e01fa397584f4adc716e2108d8e4c8b632fb0e7476157c301df89000340eb9a. Attestations: [SLSA provenance](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68257370) and [CycloneDX SBOM](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68257381). Listed artifact digests are ZIP archive digests, not inner-file hashes.

PR #172 has zero formal review submissions and zero inline review threads. This is maintainer implementation and automation evidence, not independent security/legal approval. See the [F1.40 merged report](2026-11-16-F1-40-REUSABLE-COMPONENT-AUDIT-ATOMICITY-REPORT.md).

## Historical exact-main source validation — workflow #685 (F1.39/docs-only baseline)

Workflow [#685](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43893136232) validated current docs-synced main SHA `b77505ef34507c8ba84152b47b3ebffb8f1420e7` and completed all seven jobs successfully.

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 641/641 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| Node.js 24.22.1 | PASS | 641/641 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| PostgreSQL / Memgraph | PASS | 106/106 live integration tests; zero failures or skips |
| Fresh migrations | PASS | 18/18 migrations applied; 18/18 idempotent second-pass checks passed |
| Browser editor/accessibility smoke | PASS | 9/9 Playwright smoke tests; not full manual WCAG acceptance |
| CodeQL | PASS | Static analysis workflow succeeded; not an independent security review |
| Mainline attestations | PASS | Signed dependency/SBOM attestations passed and were verified |
| Evidence consolidation | PASS | All five producer manifests verified; canonical readiness generated |

The finalized readiness artifact was generated at `2026-11-16T15:11:41.167Z`: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction: false`, `NOT_PRODUCTION_CERTIFIED`, production NO-GO. The 38 service-less diagnostic skips per runtime remain PARTIAL and are not part of the 106/106 live database result. The two PARTIAL categories remain service-less diagnostics and incomplete qualified human dependency/license review.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release-readiness bundle | 14239020197 | 40edac0ca9415dcdc3d026a5af55e1cb6e393b1b6e13bf115dff2adf5a87c104 |
| PostgreSQL/Memgraph producer | 14238166932 | 065b85cce30b952229284a8ed73e2e098537dfaca2656dbc08e1e395ce7ff352 |
| Live PostgreSQL/Memgraph test archive (Node 22) | 14237912545 | 99d580132e62a78e3e59dfb0530e322387e2a2a5b87d5ad83bd0f458a6aeb573 |
| Node.js 22 evidence | 14238016835 | ca51dd6d22c568954deb42c6cdcc217ee7c2618a2362033f4f3e7b3646fec729 |
| Node.js 24 evidence | 14237303241 | d8fbf063c0cae50a66ae9532403798c9d0fb3173324423e363726dd8fe80bfc7 |
| Browser/editor evidence | 14238405827 | cc738f18a7c6a33d9818c97e49def9a6b3e0266e4c95a085a18503a86864aaeb |
| CodeQL evidence | 14237073750 | 3a88e761b0417a224a9116f836ba83dfc81ce93097447f368a0f205a15236ee8 |
| Signed mainline dependency/SBOM attestation | 14237812068 | 6e57928f226dc4858745286e0e9704b7973321daaa9e8b97f60a7888ea07ebd9 |
| Node.js 22 dependency evidence | 14237557292 | d0f6e79bfe1110a6b2aba2d778776511c7bb456173c3f0ac0ab5c42e6f0bd19d |
| Node.js 24 dependency evidence | 14237846828 | 7292d574eef1b83ded59ccd4270fe3528adb6d1bdfb88600b3783d486ee56f0b |

The lockfile SHA-256 remains `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; the verified Node 22 CycloneDX SBOM SHA-256 is `14165da23bdd2ed449d278e3a30e559f0ae8758fd2733f1dbdd641b46d3215d9`. Node 24's produced SBOM SHA-256 is `52f63fccd76f3e94e17be7458e3e4bbb115206164855e2abc593dc05d292200e`. These are artifact archive digests where marked in the table, not hashes of inner files. This subsection is the historical #685 F1.39/docs-only source snapshot. F1.40 was merged later and is validated in the current #688 section above.

## Historical F1.39 runtime-merge exact-main evidence — workflow #681

### F1.39 exact-main engineering and CI evidence — workflow #681

Workflow #681 completed all seven required jobs successfully on the F1.39 runtime merge commit d4e1c1ce5e08b4594614448d64ad2738a84355b2 (main at that point). At that historical point, docs-synced main was b77505ef34507c8ba84152b47b3ebffb8f1420e7, validated by workflow #685:

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 641/641 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| Node.js 24.22.1 | PASS | 641/641 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| PostgreSQL / Memgraph | PASS | 106/106 live integration tests; zero failures or skips, including F1.39 media audit rollback/retry |
| Fresh migrations | PASS | 18/18 migrations applied; 18/18 idempotent second-pass checks passed |
| Browser editor/accessibility smoke | PASS | Hosted browser smoke job succeeded; this is not manual WCAG/assistive-technology acceptance |
| CodeQL | PASS | Static analysis workflow succeeded; this is not independent application-security review |
| Mainline attestations | PASS | Required mainline signed dependency/SBOM attestation job succeeded |
| Evidence consolidation | PASS | Five producer manifests verified; final readiness artifact written and retained |

The final artifact records a clean source tree at the exact main SHA and a clean EnginEx submodule at pinned commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b`. The live database producer manifest SHA-256 is `d5172aa60c98d4f3f786db26e1a24d910f2e8b7fb49d06f64cea48ba6b18f209`. The finalizer recorded successful browser, Node 22, Node 24, PostgreSQL/Memgraph and CodeQL producers, and `attestation.jobStatus=success`.

Run-bound evidence artifacts retained by the run include:

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release-readiness bundle | 14201530780 | 145462dd72d24bc8d6328238c283b334610fcb909b5548b9235272bdedda1d12 |
| PostgreSQL/Memgraph producer | 14200409285 | 8949409f4713a8a5380272b44a10957498463c4dcd243fa51c33952b277772c0 |
| Live PostgreSQL/Memgraph test archive (Node 22) | 14201415841 | 91588fb920083ea04b71a4f4a3c87121d659ef24d56e283f3a61b29ed25bdc8f |
| Node.js 22 evidence | 14201072438 | 553af9f3c74f36edb7cdf3c2d60f9bc9aa75e5cbd48eb5dad5920eb1f18c70c1 |
| Node.js 24 evidence | 14200674202 | 4d0e8725ba5b5225979e44de8a7f00754074618d9fc99b1b0ecf2c1ae5c3cf7d |
| Browser/editor evidence | 14200479986 | 507e21c5b9436c345309d783dddaafd44d82a1c2a17f9c0f141e81513b95857f |
| CodeQL evidence | 14200658920 | 20936c00bf3efbee3a5fe0982ec6b713ed8097bdaf7cc127e60700dfa0935586 |
| Signed mainline dependency/SBOM attestation | 14201002106 | 68a5ff333371f24605e9b2394bf26e78c7a6f5d3011b2445c9bc131ac6567c2b |
| Node.js 22 dependency evidence | 14201236945 | e0044943ba2a01c5976e18c102a941cc12575816bf03bf0a201ac07fa43cb827 |
| Node.js 24 dependency evidence | 14200559447 | a0776282d084ef314e44054f092c7530e391f3637319c5e3ae91e16fe1c22760 |

These are GitHub artifact archive digests, not hashes of the files inside the ZIP archives. All are bound to workflow #681 and exact main SHA d4e1c1ce5e08b4594614448d64ad2738a84355b2. The run-bound source and final canonical JSON are the authority for this snapshot.

The canonical aggregate has two PARTIAL checks:
1. **Reviewed lockfile/dependency inventory:** clean `npm ci`, dependency audit, CycloneDX generation and signed attestations pass; qualified human dependency/license/maintenance/distribution review remains incomplete.
2. **Service-less integration diagnostic:** 38 tests are intentionally skipped per supported Node runtime without live services. These are not integration passes. This is separate from the 106/106 zero-skip PostgreSQL/Memgraph producer result.

Supplemental evidence in the run also records clean `npm ci`, fresh migration validation, Playwright smoke, zero high-severity npm audit findings, CycloneDX SBOM generation/schema checks, Memgraph outage recovery, deterministic graph projection rebuild, and library reconciliation dry-run. These do not waive the missing deployment/acceptance gates.

## Production evidence matrix — 14 missing gates

| Gate | Current status | Evidence still required |
|---|---|---|
| Tenant isolation / authorization review (#14) | MISSING_EVIDENCE | Independent assessor's own route discovery, adversarial testing, findings and signed acceptance. The maintainer route inventory is not independent evidence. |
| Identity-provider E2E | MISSING_EVIDENCE | Real OIDC/SAML provider journeys, email delivery, password recovery and MFA enrollment/recovery with operational credentials and failure handling. |
| ClamAV corpus and legacy asset quarantine | MISSING_EVIDENCE | Managed scanner execution against safe/infected test corpus; quarantine/remediation of existing `not_scanned` assets; provider operational evidence. |
| Live cloud storage providers | MISSING_EVIDENCE | S3/GCS/Azure/S3-compatible live upload/read/delete/visibility-revocation/restore operations, least-privilege credential policies and deployment-bound configuration evidence. |
| Stripe lifecycle | MISSING_EVIDENCE | Live/test-mode provider-verified checkout, signed webhook replay, ambiguous outcomes, refunds, stock reconciliation and full subscription lifecycle acceptance. |
| Manual accessibility | MISSING_EVIDENCE | Human WCAG/assistive-technology acceptance across keyboard-only, screen reader, focus, zoom/reflow and supported browsers. Playwright smoke is not a substitute. |
| Commerce parity | MISSING_EVIDENCE | Acceptance of tax, shipping, coupons, refunds, invoices/receipts, fulfillment, downloads, disputes and recurring subscription lifecycle. |
| Community parity | MISSING_EVIDENCE | Acceptance of group privacy, abuse/spam controls, moderation, search, export/deletion and browser workflows. |
| Plugin container isolation | MISSING_EVIDENCE | Signed OCI pipeline, SBOM/provenance verification, adversarial sandbox/egress/resource testing and containment acceptance. |
| Human dependency/SBOM/CodeQL review (#23) | MISSING_EVIDENCE | Qualified human license/notice/distribution review, SBOM disposition and exact-SHA CodeQL alert review. Machine attestations and scanner success are not legal clearance. |
| Load/backup/restore (#24) | MISSING_EVIDENCE | Measured load/soak/fault/resource-exhaustion testing, verified backup/restore and graph reconstruction drills with recovery objectives. |
| Independent platform security (#25) | MISSING_EVIDENCE | Qualified independent security assessment and documented severe-finding remediation/retest. |
| Operations/release approval (#26) | MISSING_EVIDENCE | Named release-owner approval, deployment and rollback runbooks, secret rotation, incident response, monitoring and production change control. |
| Production observability | MISSING_EVIDENCE | Approved OTLP backend, secure delivery, ownership, governance, retention, access control and alert/incident evidence. |

## Other governance and formal controls

- **#13 — release scope/provider matrix:** OPEN. Final product subset, provider enablement and explicit acceptance scope require authorized governance.
- **#14 — independent tenant-isolation review:** OPEN / NOT PERFORMED.
- **#23 — human dependency/SBOM/license/distribution review:** OPEN / PARTIAL.
- **#24 — load, backup and restore:** OPEN.
- **#25 — independent platform security assessment:** OPEN / NOT PERFORMED.
- **#26 — operations/release-owner acceptance:** OPEN.
- **#32 — operating reserve, compensation and capital controls:** OPEN.
- Mainline CI and maintainer merges are not independent security or legal approvals. No production gate is waived by this report.

## Engineering roadmap

### Merged recent hardening series

F1.21–F1.39 comprise 19 consecutive bounded engineering increments merged to main. The increments harden site-owner concurrency; site capability and SSE revocation; invitation role/audit boundaries; content-type registry concurrency; Redis Pub/Sub reconnect; editorial role ownership; membership, site creation and design-system transaction/audit consistency; taxonomy, relationship and AI-policy outbox/audit consistency; editorial workflow transitions; plugin lifecycle locking/audit consistency; firewall rule/audit consistency; page-draft/revision/collaboration/workflow/outbox/audit atomicity; library upload/version audit atomicity; and legacy local/S3 media upload audit atomicity.

The latest merged runtime increment is F1.40, PR #172 / issue #171, at current main fef8c9e19ceac14d965a3ed824250a7abbafc04f, validated by exact-main workflow #688. F1.39 (PR #169, merge SHA d4e1c1ce5e08b4594614448d64ad2738a84355b2) and F1.38 (PR #166) remain prior completed increments. PR #172 has zero formal reviews and zero inline review threads; maintainer/automation evidence only.

### F1.39 merged — legacy media upload/audit atomicity

Issue [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) is CLOSED after [PR #169](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/169) merged on 16 November 2026 at d4e1c1ce5e08b4594614448d64ad2738a84355b2 from implementation head 639f0513ddde6ed5b6cce9d5847ec5cda31d8c41. The mainline route now uses transaction-owned audit persistence across both local and S3 media stores. The route writes media.uploaded using the exact queryable owned by withTransaction before COMMIT; local/S3 object cleanup is best-effort compensation, not a distributed transaction.

Exact-head workflows #679/#680 passed before merge; exact-main [workflow #681](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43812646684) passed all seven jobs on the merge commit. Node 22.23.4 and 24.22.1 each passed 641/641 Hub tests and 94/94 EnginEx tests with zero failures/skips. PostgreSQL/Memgraph passed 106/106 live integration tests with zero skips, including the media audit trigger-injection rollback/compensation/retry regression. Fresh migrations applied 18/18 and the idempotent second pass skipped 18/18. Browser/editor smoke passed 9/9, CodeQL passed, signed mainline lockfile/SBOM attestations verified, and final evidence consolidation passed.

The initial exact-head attempts #677/#678 failed only because the integration assertion expected a numeric byteSize while PostgreSQL returns the existing bigint audit detail as a string. The test fixture was corrected to the PostgreSQL representation; reruns #679/#680 passed. Local full check passed 638 with zero failures and three Windows-specific skips; focused local regressions passed 49/49. Local live PostgreSQL was not configured, but hosted #680/#681 executed the test successfully.

GitHub records zero formal review submissions and zero inline review threads for PR #169. This remains maintainer/automation evidence, not independent security approval. The F1.39 merge does not alter the production readiness aggregate (8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; readyForProduction false; production NO-GO).

### Milestones C, D and E

**Milestone C — runtime and integration validation:** substantial CI and architecture foundations are verified. Remaining external qualification includes live cloud-provider credentials/least privilege, ClamAV safe/infected corpus and legacy scan/quarantine, full identity-provider/password/email/MFA journeys, and deployment-grade storage/malware recovery.

**Milestone D — product workflows and feature completeness:** partial foundations exist, but acceptance remains incomplete for the visual editor and manual accessibility; theme/template/design systems, forms, popups and dynamic/query workflows; commerce, fulfillment and subscriptions; community privacy/moderation/export/deletion/forum workflows; recurring membership lifecycle; and signed, adversarially isolated plugin execution.

**Milestone E — production readiness:** remains unaccepted. Performance/load/soak/fuzz/resource limits, backup/restore/DR, independent security remediation, qualified dependency/license review, deployment/secrets/WAF/observability, runbooks and release-owner approvals are outstanding.

No meaningful overall percentage or delivery date is asserted: these gates have different scope and evidence weight, and green CI should not be conflated with external product or production acceptance.

## Recommended next actions

1. Close the missing Milestone C provider qualifications: live cloud storage and least-privilege evidence, ClamAV safe/infected corpus and quarantine, identity-provider/password/email/MFA journeys, and storage recovery.
2. Complete Milestone D product acceptance: visual editor and manual WCAG/assistive-technology testing, commerce/subscription lifecycle, community privacy/moderation/export/deletion, recurring memberships and adversarial plugin isolation.
3. Complete Milestone E production acceptance: load/soak/fuzz, backup/restore/DR, independent tenant and platform security reviews, qualified dependency/license review, production observability, operations runbooks and release-owner/governance approvals. Preserve NO-GO until the evidence is formally accepted.

## Evidence links

- Mainline exact-source workflow #681: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43812646684
- Mainline readiness artifact: GitHub artifact 14201530780, digest recorded above.
- F1.39 runtime merge commit: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/commit/d4e1c1ce5e08b4594614448d64ad2738a84355b2
- Current F1.40 main / merge: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/commit/fef8c9e19ceac14d965a3ed824250a7abbafc04f (exact-main workflow #688)
- F1.38 merge report: [2026-11-16-F1-38-LIBRARY-ASSET-AUDIT-ATOMICITY-REPORT.md](2026-11-16-F1-38-LIBRARY-ASSET-AUDIT-ATOMICITY-REPORT.md)
- F1.39 issue: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167
- Parent engineering issue: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124

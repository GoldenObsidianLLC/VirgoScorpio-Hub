# VirgoScorpio Hub 0.6.2 â€” Release Blocker Triage

**Snapshot:** 11 November 2026 (continuation of 10 November triage)
**Candidate:** `0.6.2`, `private: true`, unreleased developer preview
**Node engine floor:** `>=22.23.4`
**Current main:** 97f11434a211f982b539ef11effd5b7432b5e4a9 (PR #119 merge)
**Exact-mainline CI:** [workflow #527](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42964407873) â€” core jobs passed; main-only attestation verification failed on mutually exclusive CLI options and the dependent evidence aggregator failed closed.
**Maintainer supply-chain review:** [10 November review report](2026-11-10-SUPPLY-CHAIN-REVIEW.md) â€” lockfile inventory, local CycloneDX and npm audit checks recorded; human license/distribution and formal attestation review remain open.
**Production disposition:** **NO-GO / NOT_PRODUCTION_CERTIFIED**

This document tracks distinct release gates; a green CI run or a documentation update does not close a human, independent, governance, provider, or operations gate. Companion: [Independent Tenant-Isolation Review Matrix](../security/TENANT-ISOLATION-INDEPENDENT-REVIEW-MATRIX-2026-11-10.md).

## 1. Open blockers

| Issue | Priority / gate | Present state | Required next action / accountable party |
|---:|---|---|---|
| [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | P0 â€” candidate scope/provider matrix | Engineering recommendation and preview boundaries exist; named authorized product/release-owner acceptance and named accountable owners remain missing. | Authorized product/release owner must accept/amend the exact 0.6.2 scope, assign named provider/operations owners and record authority, decision date and exact SHA. Engineering cannot self-approve. |
| [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | P0 â€” independent tenant/site isolation | PRs #116 and #118 are merged; maintainer inventory and targeted live custom-content-type/cloud-connection A/B regressions exist. No independent assessor/report/result exists. | Commission an independent qualified reviewer; perform independent route discovery and adversarial review against a clean exact-SHA checkout using the review matrix. Do not create or accept the formal evidence file from maintainer work. |
| [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | P1 — lockfile/SBOM/provenance/dependencies | PR #119 mainline verification failure and CodeQL medium alert #38 are addressed by corrective PR #120 at d2245d127a42eb054eca68d012cce005986c3ec5. Push #42983499337 and PR #42983649410 passed six non-attestation jobs; the main-only signer was skipped by design. CodeQL returned no open alerts on PR merge ref; default-main alert #38 awaits post-merge refresh. | Complete qualified dependency, maintenance, GPL/LGPL distribution and exact-SHA CodeQL review; after authorized merge verify SLSA/SBOM signer, source SHA and digests, retain artifacts, then record reviewer identity/date/dispositions. Keep issue OPEN / PARTIAL and formal evidence missing until accepted. |
| [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | P1 â€” load, fault, backup/restore | Selected Redis and Memgraph outage/recovery tests pass. No approved production-like topology/workload/SLO or full PostgreSQL+graph+object backup/restore rehearsal with measured RPO/RTO. | Operations/database/storage owners define topology, workload and service budgets, then run isolated load/soak/fault and full restore/integrity/rollback drills with measured results. Do not invent SLOs. |
| [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | P0 â€” broader independent security | CodeQL and targeted controls pass; no independent platform-wide security assessment, findings triage or retest exists. | Commission a separate independent assessment; track severity-ranked findings, authorized risk dispositions and independent retesting. |
| [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | P0 â€” operations/release ownership | Runbooks and architecture documentation exist, but named operational/release owners and rehearsed deployment, rollback, recovery, secret-rotation and incident processes are missing. | Name accountable release/on-call/database/cache/storage/security owners; approve topology and rehearse migration, rollout/rollback, recovery, secret rotation and incident response on an isolated environment. |
| [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | P0 â€” governance, capital and legal authority | Draft zero-reserve controls exist; governing approval, authority, funding and legal review are not established. | Authorized governing persons and qualified legal/tax advisors must validate entity/jurisdiction authority and adopt/amend/reject the controls. No engineering action can grant this authority. |

F1.20 issue #113 is CLOSED / ACCEPTED within the restricted developer-preview reliability scope. PR #116 is merged at the current main SHA. Neither fact closes #14, #25 or the other gates.

## 2. Dependency and sequencing

1. **#32 authority and funding** determines whether paid reviewers, vendors, staffing or other expenditures can lawfully and validly be authorized. Do not promise or commit spend without transaction-specific funded approval.
2. **#13 scope and ownership** defines what is in the candidate and who accepts it, owns provider integrations and is accountable for residual risk.
3. **#14 and #25 independent assessment** require reviewers independent of implementation, controlled synthetic environments, their own methodology and independently retested findings.
4. **#23 human supply-chain review** can use exact-main CI artifacts but still needs human review and provenance/license decisions.
5. **#24 and #26 load/recovery/operations** require a named owner, approved topology, workload/SLO budgets and isolated infrastructure before drills.

Keep each issue open until its own acceptance criteria and evidence are met. Never close independent review items from maintainer-authored tests, generated inventories or static analysis alone.

## 3. Completed maintainer regression slice â€” cloud-connection tenant isolation

Tracking issue [#117 â€” Add two-site cloud-connection tenant-isolation regression coverage](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/117) is **CLOSED** by PR [#118](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/118), merged into current `main` at `c7653bb433ae8b363925d13babf239e64b2b5125). Exact PR-head workflow [#42878000787](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42878000787) and exact-mainline workflow [#522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157) each passed all six required jobs.

The route implementation in `apps/api/src/platform-routes.js` uses `siteIdFor`, requires `cloud:manage`, and scopes cloud-connection reads/updates by `site_id` plus connection ID. PR #118 added maintainer-authored live PostgreSQL coverage for:

- A Site B-only actor whose role grants only `cloud:manage`.
- Site A/B connection fixtures with deliberately unresolved `vault://` references, so no credentials are resolved and no provider/network call occurs.
- Site B list isolation and non-disclosing 404 for foreign Site A IDs supplied to `/test` and `/disable`.
- Conflicting header/query/body/duplicate query selectors rejected with Site A/B row snapshots unchanged.
- Positive Site B own-connection test/disable controls.

The focused live PostgreSQL integration parent passed **2/2, zero skips**. The complete local PostgreSQL/Memgraph/Redis integration runner passed **81/81, zero failures, zero skips and zero TODOs** with dedicated `virgoscorpio_hub_cloud_test`, loopback Memgraph and a temporary loopback-only Redis container (stopped after testing). At the pre-merge snapshot, `npm run check` passed **583/586**, zero failures and three Windows-specific skips on Node.js 26.12.1. These are maintainer regression results only; they do not complete independent review #14 or broader security review #25. No production credential or provider endpoint was used.

The implementation was limited to targeted tests and generated inventory/docs. No migration, runtime dependency, public API change or SemVer bump was introduced.

## 4. SemVer and production guardrails

- Keep package version **0.6.2**, private and unreleased.
- No version bump, tag, package publication, production deployment or expanded support claim is authorized.
- Preserve PostgreSQL as canonical source, Memgraph as rebuildable projection, Redis Pub/Sub as ephemeral notification, and current site-context/capability predicates.
- Distinguish maintainer regression evidence, independent security evidence, provider acceptance, operational readiness and production approval.
- Do not manufacture `artifacts/evidence/tenant-isolation-review.json`; it must come from the independent assessor and authorized gate owner on the exact reviewed SHA.
- Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED** until every applicable gate is independently satisfied and authorized.

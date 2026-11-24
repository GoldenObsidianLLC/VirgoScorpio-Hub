# F1.64-F1.66 Security Hardening and Exact-Main Validation Report

**Date:** 22 November 2026 (America/Chicago)
**Repository:** [GoldenObsidianLLC/VirgoScorpio-Hub](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub)
**Exact main revision:** `daf18f63115e6456800447d66b640247e58121b6`
**Exact-main CI:** [workflow run #45074920350](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45074920350), attempt 1, 7/7 jobs passed.

## Executive summary

Three narrowly scoped security fixes were rebuilt on current main, maintainer-reviewed, validated, and merged. They preserve existing HTTP/API, persistence, and wire contracts. No schema, migration, dependency, lockfile, package-version, or SemVer change was required.

## F1.64 — community moderation write-boundary revalidation

[PR #288](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/288) merged at `8ed6336e4a8086d6fd01274912bfdd4ede581243`.

- Retains the capability preflight for early denial, then re-reads the active actor, selected-site membership, and role capabilities inside the same PostgreSQL transaction as the moderation mutation and audit insert.
- Acquires the site lock first, matching member removal's `FOR UPDATE` site lock, then shared user/membership/role locks. Concurrent revocation either precedes authorization or waits until the moderation transaction completes.
- Adds deterministic live-PostgreSQL lock-wait coverage using the shared test helper. Existing permission names, denial contract, mutation behavior, and audit semantics remain unchanged.

## F1.65 — server-enforced external AI confidentiality

[PR #289](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/289) merged at `0986d003ff4f052e34a5ebf6f36636e802c85d0d`.

- Requests sent to non-mock AI providers are treated as `confidential`, regardless of caller-provided classification; the declared value is still validated.
- Existing global/site provider allowlists and explicit global/site external-content approvals remain enforced. Mock/local behavior is preserved.
- Regression fixtures permit the supported external providers under test so the tests reach the classification guard rather than an earlier allowlist rejection. Focused classification suite: 18/18.

## F1.66 — final WebSocket document-join authorization check

[PR #290](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/290) merged at `daf18f63115e6456800447d66b640247e58121b6`; implementation head `7a9ec2a1381c90d4018d0117460c9edadca0c68d`.

- Revalidates the document edit grant before creating a document subscription and after the asynchronous collaboration sync read.
- Reauthorizes the hub subscription, then performs the narrower document-specific edit-grant check last, immediately before `document.joined` or protected sync/snapshot delivery. This closes the remaining window where the awaited hub reauthorization itself could overlap with revocation of `content:edit:own`.
- Deduplicates document-grant validation in the gateway's private `assertDocumentAuthorization` helper.
- Three deferred race tests cover document/session grant loss during sync, hub-subscription invalidation during sync, and edit-own capability revocation during hub reauthorization. Focused WebSocket suite: 25/25, zero skips.

## Exact-main validation

Exact-main workflow [#45074920350](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45074920350) completed all seven jobs on `daf18f63115e6456800447d66b640247e58121b6`:

- Node.js 22.23.4: 804/804 Hub tests and 94/94 EnginEx tests; zero failures or skips.
- Node.js 24.22.1 unit/security/dependency job: passed.
- Live PostgreSQL/Memgraph integration: 190/190, zero failures/skips; 18/18 migrations applied on a fresh database and 18/18 recognized on idempotent re-entry. Multi-node collaboration, real Redis outage/authorization fallback, Memgraph outage/outbox recovery, and canonical graph rebuild completed.
- Browser editor/accessibility smoke and CodeQL: passed.
- Mainline signed dependency lockfile/SBOM attestation and exact-source CI evidence consolidation: passed.

Run-bound evidence:

| Evidence | Artifact | SHA-256 |
|---|---:|---|
| Canonical readiness bundle | [#14775111286](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45074920350/artifacts/14775111286) | `40a7a79e0ac2f1b97c0292458be8fa72e0249abe51feae6ed844ca2665b5a4f6` |
| Readiness JSON (inside canonical bundle) | — | `7e0c6ac94c14fc6a47d7d5e1da9e635a8df9a68f8ed5469ff77cb43b48dd205f` |
| Readiness Markdown (inside canonical bundle) | — | `9d1cfd74db4bfa03c6bade05cf1a9f9625212f50ea1e05c1f9ad22703bfd61e0` |
| Live PostgreSQL/Memgraph evidence | [#14775057458](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45074920350/artifacts/14775057458) | `481cab09e99cb6e5eaf7eb80a21213f87f65984227bd4e2762a0a4a49b7f7acb` |
| Signed supply-chain attestations | [#14775290352](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45074920350/artifacts/14775290352) | `481d47f2cdeeab94c30bac38a3ae94b6d2ef4887924d388a6df1934e23c8c49e` |

The live database producer manifest SHA-256 is `62f48f2c55c040c4656d05d1517a7588569612d3fe5a9c6f9bedc6ec8ea723f6`. The canonical readiness snapshot was generated at `2026-11-22T22:00:55.494Z` and reports **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED`, and **NO-GO**. The PARTIAL items are human dependency/license review and service-less diagnostics with skipped tests; separate live integration passed 190/190. Fourteen production evidence gates remain missing: independent tenant-isolation review; identity-provider E2E; malware/asset quarantine; live cloud providers; Stripe lifecycle; full accessibility acceptance; commerce parity; community parity; plugin isolation; human dependency/SBOM/CodeQL review; load/backup/restore; independent platform security assessment; operational/release approval; and production observability.

## Local validation note

The dedicated WebSocket suite passed 25/25; focused AI-classification tests passed 18/18. Local EnginEx on Windows reported 91/94 with three platform-conditional Windows skips. Repeated full local `npm run check` attempts on this Windows host encountered intermittent unrelated `fetch failed: bad port` errors in existing HTTP tests that bind to OS-assigned ephemeral loopback ports within the dynamic range. This is not reported as a local full-suite pass; the exact-main hosted Node 22/24 test jobs passed.

## Aikido audit and outstanding assurance

The [20 November Aikido aggregate audit report](2026-11-20-AIKIDO-SECURITY-AUDIT-TRIAGE-REPORT.md) records vendor snapshot totals but does not include individual finding fingerprints, paths, or advisory identifiers. F1.64-F1.66 are source fixes; they are not evidence that a particular Aikido scanner record is resolved until its exact fingerprint is exported and mapped. Issues [#234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234), [#235](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235), and [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277) remain open for scanner triage. Independent tenant review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14), qualified dependency/license review [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23), and platform security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain separate production gates. Maintainer self-review and CI are not independent assurance.

No SemVer bump, tag, GitHub Release, npm publication, deployment, or production promotion is authorized. Package 0.6.2 remains private and unreleased.
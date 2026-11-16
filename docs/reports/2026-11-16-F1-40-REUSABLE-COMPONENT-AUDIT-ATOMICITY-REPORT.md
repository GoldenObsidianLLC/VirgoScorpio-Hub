# F1.40 — Reusable-component mutation and audit atomicity (merged report)

**Status:** Merged through [PR #172](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/172) on 16 November 2026 at 18:12:45Z.
**Issue:** [#171](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/171), CLOSED; parent #124 remains OPEN.
**Implementation head:** 4e16213b5b087fa8fc7b4623c1a9732ed4f6ec65.
**Merge/current main:** fef8c9e19ceac14d965a3ed824250a7abbafc04f.
**Exact-main validation:** [workflow #688](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43926434802), run ID 43926434802.
**Documentation follow-up:** docs-only [PR #173](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/173) is open; exact-head push #689 and PR #690 both passed. It awaits human review and does not change runtime code.
**Package:** virgoscorpio-hub@0.6.2, private and unreleased.

## Scope and finding

The site-scoped reusable-component route already enforced site predicates, selector reconciliation, content:read/content:edit capability checks, document and metadata validation, and optimistic-version checks. Before F1.40, POST/PUT/DELETE used direct localPool.query calls without a correlated identity-audit record in the same PostgreSQL transaction.

This was an audit-consistency and coverage gap, not a demonstrated cross-tenant IDOR. F1.40 preserves the existing authorization, non-disclosure, and route behavior while making each mutation and its audit atomic.

## Implementation

Reusable-component POST, PUT, and DELETE reuse the existing withTransaction(localPool, work) boundary. A shared auditMutation helper writes metadata-only reusable_component.created, reusable_component.updated, and reusable_component.deleted events through the same transaction-owned queryable as the component-row mutation. Audit persistence is awaited before COMMIT; no nested transaction abstraction is introduced.

Audit target type is reusable-component; events include site, actor, request, and target correlation plus safe slug and version details. Component document bodies are excluded from audit details. Mutation SQL remains site-scoped; updates preserve the expected-version predicate. Existing validation, selector reconciliation, capability checks, status codes, response payloads, and not-found/conflict behavior remain intact. Audit persistence errors, including SQLSTATE 23505, retain their original database identity and are not remapped as component conflicts.

## Regression coverage

Unit tests verify successful create/update/delete audit calls receive the exact transaction client and execute after the row mutation but before COMMIT. Injected audit failure for each write rolls back the component change and audit insert, preserving the original error identity.

Route-capability tests verify denial of GET, POST, PUT, and DELETE before protected data access when the actor lacks the required capability.

The live PostgreSQL suite provisions two sites and actors, verifies scoped listings and foreign-site ID update/delete denial, and injects audit failures for create/update/delete. Each failure proves the component state and audit history roll back together; a safe retry persists exactly one correlated event while preserving the other site's control state.

## Local validation

Windows developer workstation, Node.js 26.12.1:

| Check | Result |
|---|---:|
| npm run check | 643 passed; 0 failed; 3 Windows-specific skips (646 total) |
| Focused reusable-component unit and route-capability tests | 23/23 passed; 0 skipped |
| Artifact/syntax verification | 238 required paths; 258 JavaScript files |
| Tenant route inventory | 27 families; 78 declared patterns; 21 source files; 48 test files |
| Markdown relative links | 487 across 152 Markdown files; 0 broken |
| git diff --check | PASS |

Live PostgreSQL was not run locally because neither TEST_DATABASE_URL nor DATABASE_URL was configured. Hosted CI supplied live database validation.

## Hosted candidate and exact-main validation

Exact candidate-head push workflow [#686](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43916914367) and PR workflow [#687](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43917206442) both passed on implementation head 4e16213b5b087fa8fc7b4623c1a9732ed4f6ec65. Each passed Node 22.23.4 and 24.22.1 test/security jobs, browser/editor smoke, CodeQL, and live PostgreSQL/Memgraph integration. Branch-only attestation was skipped by design.

Exact-main workflow #688 completed all seven jobs successfully on merge/current main fef8c9e19ceac14d965a3ed824250a7abbafc04f:

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 646/646 Hub; 94/94 EnginEx; zero failures/skips |
| Node.js 24.22.1 | PASS | 646/646 Hub; 94/94 EnginEx; zero failures/skips |
| npm audit | PASS | Full and production-only audits reported zero vulnerabilities |
| PostgreSQL / Memgraph | PASS | 111/111 live integration tests; zero failures/skips |
| Fresh/idempotent migrations | PASS | 18/18 applied; 18/18 skipped on second pass |
| Browser editor/accessibility smoke | PASS | Playwright 9/9; not full manual WCAG acceptance |
| CodeQL | PASS | Static analysis succeeded; not independent application-security review |
| Signed mainline attestations | PASS | SLSA provenance and CycloneDX SBOM signed and verified |
| Evidence consolidation | PASS | Exact-source producer manifests/checksums verified; readiness finalized |

The 111 live database tests include F1.40 two-site listing/ID-boundary coverage and trigger-injected audit failure for create/update/delete. Each failure proves rollback and a successful retry with exactly one correlated audit record. Migrations used a disposable test database.

Supply-chain attestations:
- [SLSA build provenance](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68257370)
- [CycloneDX SBOM](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68257381)
- Lockfile SHA-256: 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086
- Attested SBOM SHA-256: 2e01fa397584f4adc716e2108d8e4c8b632fb0e7476157c301df89000340eb9a

## Readiness and retained artifacts

Canonical readiness artifact 14256906930 was generated at 2026-11-16T18:16:00.210Z; archive SHA-256 7eadf403d925e29166a4db152c39afa62b8ddf728764ab081646a5eab85a9892.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical readiness | 14256906930 | 7eadf403d925e29166a4db152c39afa62b8ddf728764ab081646a5eab85a9892 |
| PostgreSQL/Memgraph producer | 14257061824 | 1d616806e1cd455d3140776137475ff253d5bc783dfa307f6a806a3263254084 |
| Live integration | 14256002273 | 714e260b9d6bbb67e62bb97813d5a98d0494ea10332dddc432d546bf9445847b |
| Node.js 22 evidence | 14257455351 | a1a7e7203c59bd107d77ad9352ec17b19d5c217d63b815bfa7370da6d0254d55 |
| Node.js 24 evidence | 14256416968 | 63b65a64b7cda8da3652c7c3f807b2011ea4b7b80c430221ec52a399cc4a4ddc |
| Browser/editor | 14255962007 | 3d2d48df33f26ea449f0a83c1f981c96d3a3246f2140fd99e8ac587ce09e8718 |
| CodeQL | 14255912153 | 4dc1cf712e3971beb007d1da74b33c610e2bc9721970adc846b35511745a4d58 |
| Signed attestations | 14257570303 | 1e0e24af312d3cf9e6a7e9fa47131315a8bfc90bc465b1c9617205606eff1296 |
| Node.js 22 dependency evidence | 14257395503 | c54bb17cdeff594ed0071270ff20752d355b6fc9c7a569134630f3a1ea4564a0 |
| Node.js 24 dependency evidence | 14257046704 | 808c2cc68c0b9d6db7bd57b1c1194ddbc813d1dad46b2c8d6f7d16c6e417ef05 |

Final readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; readyForProduction false, NOT_PRODUCTION_CERTIFIED, production NO-GO. The PARTIAL items remain service-less integration diagnostics (39 skips per Node runtime, separate from live integration) and incomplete qualified human dependency/license review. The 14 missing production gates remain open.

## Review and release boundary

GitHub records zero formal review submissions and zero inline review threads for PR #172. The repository owner merged the PR; automated tests and owner merge are maintainer engineering evidence, not independent security/legal approval. Documentation-only PR #173 reconciles these merged facts; push #689 and PR #690 passed, but formal human review remains pending. Parent #124 remains OPEN; independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL.

No schema, migration, dependency, public REST contract, lockfile, package-version, or SemVer change was introduced. Package virgoscorpio-hub@0.6.2 remains private and unreleased. No release tag, publication, or deployment is authorized. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

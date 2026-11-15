# F1.36 - Firewall Rule and Security Event Atomicity: Merge and Mainline Validation

**Date:** 15 November 2026
**Status:** Merged through PR #160 on 15 November 2026; issue #159 is CLOSED. Exact-main workflow #661 passed all seven jobs on the merge commit.
**Issue:** [#159 — Make firewall rule mutations and security events atomic](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/159)
**Parent:** [#124 — Maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Pull request:** [#160](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/160)
**Pre-merge main baseline:** 52b47aebfc537b91f21399080d514a406b613e5a (exact-main workflow #658)
**Implementation branch:** security/f1-36-firewall-rule-audit-atomicity-2026-11-15
**Implementation commit:** b7934d84d9cbe75ae21c956e18fefa5fce46c508
**Merge commit / current main:** 460eff191d84fe422ed4ac15260a8fd6d9100d77
**Merge time:** 15 November 2026 20:37:01 UTC
**Post-merge exact-main workflow:** #661 (run 43759090734)

## Source-confirmed finding

On main baseline #658, the firewall POST route inserted a site-scoped firewall rule, invalidated the firewall cache, then inserted its security event through a separate pool query. Event persistence failure could therefore return an error after the rule had committed and cache state had been invalidated. The DELETE route removed a rule scoped by both site ID and rule ID, invalidated cache, and did not write a corresponding security event.

## Bounded implementation

Both site-scoped firewall mutations now use the existing PostgreSQL withTransaction(localPool, work) helper. The rule insert/delete and the corresponding site_security_events insert use the same transaction client. Cache invalidation runs once, only after the transaction helper resolves successfully. Delete audit details include the rule ID, action and scope. Free-form rule reason text is not copied into the security event.

The implementation preserves the existing route paths and methods, security:manage authorization, site-selector reconciliation, validation order, site predicates, error mapping, response status and response payload. Global rules, matching behavior, TTL, schema and migration inventory are unchanged.

## Regression coverage

The route-level suite proves:

- Create and delete mutation/event writes use the same transaction client.
- Successful mutations commit before cache invalidation.
- Create and delete event-write failures roll back the rule change and leave cache untouched.
- Commit failures also leave the cache untouched and restore the pre-transaction state.
- Not-found and cross-site deletion do not write an event or invalidate cache.
- Create/delete audit details include bounded identifying fields and omit the caller-provided reason.

The disposable PostgreSQL fixture uses narrowly scoped, temporary triggers on site_security_events to force create/delete event failures. It verifies rollback, clean retry with exactly one matching event, and denial when a Site B-only user attempts to delete a Site A rule.

## Validation

### Local validation

On Node.js 26.12.1:

- Focused firewall route tests: 7 passed, 0 failed.
- The integration fixture was skipped locally because no disposable DATABASE_URL was configured.
- npm run check: passed; artifact verification covered 235 required paths and syntax-checked 250 JavaScript files; 619 tests, 616 passed, 0 failed and 3 platform-specific skips.
- No dependency, lockfile, public API, schema or migration change.

### Hosted exact-head validation

Both exact-head workflows completed successfully for implementation commit b7934d84d9cbe75ae21c956e18fefa5fce46c508:

- Push workflow #659, run ID 43754248445: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43754248445
- Pull-request workflow #660, run ID 43754349462: https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43754349462

Each workflow completed with six jobs successful, the non-mainline dependency/SBOM attestation job skipped as designed, and candidate evidence consolidation successful. On both Node.js 22.23.4 and 24.22.1, all 619 Hub tests and 94 EnginEx tests passed with zero failures or skips. Full and production npm audits reported zero vulnerabilities. The live PostgreSQL/Memgraph integration suite passed 101/101 with zero failures/skips; 18/18 migrations applied on a fresh database and 18/18 were skipped on idempotent re-entry. PostgreSQL-backed collaboration Playwright passed 4/4, browser/editor smoke passed 9/9, and CodeQL succeeded.

The exact PR #660 artifact archive digests are recorded below. These are GitHub artifact archive digests, not hashes of individual files.

| Evidence bundle | Artifact ID | SHA-256 archive digest |
|---|---:|---|
| Node.js 22 CI evidence | 14177207497 | 6aacf1ad5839851890107597bb7e5894a99e4886cfc6b8d41cda7b415ab44889 |
| Node.js 24 CI evidence | 14177747628 | d7430b48f8a84da950b4cab234e4b31f3d4f1e6147c0c583250cedd5e338cc0c |
| PostgreSQL/Memgraph CI evidence | 14177103053 | 65a83595d0db36117e752cb53b21534f07cbbb658fa4468f570427d247531000 |
| Live integration test evidence | 14177916376 | 875faaaef6e3505e0af0280074a7183338a6b11b5f82510b610488d30b3f81e0 |
| Browser/accessibility smoke evidence | 14177448264 | c728faab6f536b64e695e1f47e8deaabfd5a49ba65113fe68200ab0c03163d7d |
| CodeQL evidence | 14177483064 | 06a41522aa89af3ec71ff4eda5f47d0a42ec0a31b1813abd324c90274aa821fc |
| Consolidated release-readiness CI evidence | 14177558257 | b54397f8973bdd27ecbbd713b70281bc07a37313c426f3d48894cf5f050a62ad |


### Post-merge exact-main validation

PR #160 merged at 2026-11-15T20:37:01Z as merge commit 460eff191d84fe422ed4ac15260a8fd6d9100d77. Issue #159 is CLOSED. Exact-main push workflow #661 (run ID 43759090734; https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43759090734) completed all seven jobs successfully at 20:40:33 UTC.

| Job / evidence family | Result | Exact evidence |
|---|---|---|
| Node.js 22.23.4 unit, security, dependency checks | PASS | 619/619 Hub; 94/94 EnginEx; zero failures/skips |
| Node.js 24.22.1 unit, security, dependency checks | PASS | 619/619 Hub; 94/94 EnginEx; zero failures/skips |
| PostgreSQL / Memgraph integration | PASS | 101/101 live tests; zero failures/skips; includes the F1.36 firewall create/delete atomicity regression |
| Fresh and idempotent migrations | PASS | 18/18 fresh applications; 18/18 idempotent second-pass skips |
| Browser / editor smoke | PASS | Playwright 9/9 |
| PostgreSQL-backed collaboration browser | PASS | Playwright 4/4 |
| CodeQL static analysis | PASS | Workflow job succeeded |
| Mainline lockfile / SBOM attestations | PASS | Mainline provenance/SBOM attestations signed and verified |
| Evidence consolidation | PASS | Five exact-source producer manifests validated; canonical readiness generated |

The hosted PostgreSQL log confirms the “PostgreSQL firewall rule create/delete mutations commit atomically with site security events” subtest passed. The two “simulated firewall security event failure” database errors are the expected failure-injection trigger diagnostics, not suite failures.

The canonical #661 readiness artifact was generated at 2026-11-15T20:40:28.106Z against merge SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77. It remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction false, NOT_PRODUCTION_CERTIFIED. Production remains NO-GO.

The exact-main #661 artifact archive digests below are SHA-256 values for GitHub Actions artifact archives, not inner-file hashes. GitHub reports expiry on 13 February 2027 at 20:37:04 UTC.

| Evidence bundle | Artifact ID | SHA-256 archive digest |
|---|---:|---|
| Node.js 22 CI evidence | 14179940681 | 6e2599b9cee2c85874924fba229e0f721f99d26f99fe04279dd05018e3bbd82b |
| Node.js 24 CI evidence | 14179910989 | be68fe548b637ec440153f050fed735b67f36a9df49cab75892312e737c7b134 |
| PostgreSQL/Memgraph CI evidence | 14178759271 | 5538b846546a70908994e4da8f8be44e6e08b959c8503b5d67af3042b115d4aa |
| Live PostgreSQL/Memgraph integration (Node 22) | 14179138389 | d28b598d0879b44034a23c3c9bad68d7b6c0cbf2feec97542b2c516119b0bceb |
| Browser/accessibility smoke | 14179980373 | 273d72c181516cca2555227ad5808d5ab5f18db4a6410802720b7ad3850aa9ac |
| CodeQL evidence | 14178514516 | 40d5aa8dc394ba6dec5382bbcbce7b141bdcb31442677a5cf5d96fd1fa90c9fe |
| Signed supply-chain attestations | 14179133198 | 67a77621df5b17ef663841cbdc659da36d40803fcc04963b2bdc28bb770af700 |
| Consolidated release-readiness CI | 14179023559 | 20c4cf0886ffed176a0ce0fdd945d255763c33cb906b79921b5090f84a506334 |
| Node.js 22 dependency evidence | 14179482514 | d65df34edf8a32017bef5ad6e1b0134ab94f2b1534c7aa12865a40123de0cc6f |
| Node.js 24 dependency evidence | 14179462555 | 8aa7cc624d6063c87cc13cbb2a4572c231d9661e7b7c75e7857557beedcb70cc |
## Assurance and release boundary

PR #160 is merged and issue #159 is closed. GitHub records no formal review submission for PR #160. This is maintainer implementation and automation evidence, not an independent security review or production approval. The exact-main #661 readiness result remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction false, NOT_PRODUCTION_CERTIFIED. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL.

Package virgoscorpio-hub@0.6.2 remains private and unreleased. No SemVer increment, release tag, publication, production-data use or deployment is authorized. The merge does not authorize a release, publication, production deployment or risk acceptance.

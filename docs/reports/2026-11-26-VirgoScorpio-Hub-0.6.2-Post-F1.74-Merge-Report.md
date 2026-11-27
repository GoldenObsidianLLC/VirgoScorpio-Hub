# VirgoScorpio Hub 0.6.2 — Post-F1.74 Merge and Readiness Review

**Review date:** 26 November 2026 (America/Chicago; GitHub Actions completed 27 November UTC)
**Main revision:** `4c1052988a8db57d16ca17c267ffb903907c9f69`
**F1.74 pull request:** [#306 — durably enqueue password-reset requests](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/306)
**Exact-main workflow:** [#45935558396](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396)
**Canonical readiness artifact:** [#15169989179](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396/artifacts/15169989179)

## Executive status

F1.74 is merged to `main`. The exact merge revision passed all seven required mainline CI jobs. This closes the implementation gap addressed by PR #306 and supersedes the earlier PR #274 proposal, which was closed without merge.

This merge does **not** certify a production release. Canonical readiness remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, with `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED` and a **NO-GO** decision.

## Exact-main validation

The Actions run completed successfully on the merge SHA with:

| Validation | Result |
|---|---:|
| Node.js 22.23.4 Hub tests | 1,131 / 1,131 passed |
| Node.js 24.22.1 Hub tests | 1,131 / 1,131 passed |
| EnginEx tests | 94 / 94 per runtime |
| PostgreSQL/Memgraph live integration | 202 / 202, zero failures/skips |
| Fresh PostgreSQL migrations | 22 / 22 applied |
| Idempotent migration pass | 22 / 22 already applied/skipped |
| Browser editor/accessibility smoke | Passed |
| CodeQL | Passed |
| Mainline lockfile/SBOM attestations | Passed |
| SBOM parity and exact-source evidence consolidation | Passed |

The readiness artifact still records two partial items: qualified human dependency/lockfile review and a service-less diagnostic with 1 pass / 56 skips. The latter is not the hosted live integration suite. Fourteen independent/provider/product/operational evidence gates remain missing.

## F1.74 implementation merged

The merged increment provides:

- PostgreSQL-backed durable password-reset request queue, with generic HTTP 202 only after the enqueue transaction commits.
- Transaction-scoped advisory-lock coordination for cross-replica target cooldown and active queue capacity, while retaining IP rate limiting.
- Atomic token-digest, mail-outbox and queue-completion state; only token digests are stored in the identity-action-token table.
- Bounded retry, stale-claim recovery, expiry validation, and terminal cleanup of sensitive mail payloads.
- Low-cardinality queue depth/age snapshots through the structured telemetry pipeline.
- Separately supervised mail worker, systemd reference unit, operator guidance, PostgreSQL concurrency/recovery coverage and a dedicated threat model.

The threat model records the residual exposure that the raw reset URL remains in the pending/retryable outbox payload until delivery succeeds or the request reaches a terminal/expired state. The payload is cleared on terminal paths; privileged database readers and backups may still observe it during the delivery window. Target-host supervision, secret-file permissions, telemetry routing/alert thresholds and live email-provider behavior still require operational qualification.

## Superseded PR and PR inventory

PR [#274](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/274) was closed without merge as superseded by F1.74 / PR #306. Its proposed in-memory fire-and-forget queue and handler issues are not part of the merged implementation.

A fresh GitHub inventory of PRs #237–#276 records:

- **27 merged**
- **13 closed without merge**
- **0 open**

This is a pull-request disposition inventory only. It does not show that every Aikido scanner finding has been independently mapped, validated or resolved. Individual fingerprint/source-evidence triage remains open under [issue #234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234), [issue #235](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235) and [issue #277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277).

## Readiness migration-count discrepancy

The exact-main readiness artifact's static migration-artifact row says **19** files. That count is stale: the validator in the merged source used a manually maintained allow-list ending at `0019_library_variant_source_version.sql`. The same exact-main workflow independently applied all **22** migrations on a fresh PostgreSQL database and verified all 22 as already applied on the second pass.

This is a readiness-report correctness defect, not a failed migration or a failed database integration test. The source-bound artifact is retained unchanged; it must not be retroactively edited.

The readiness-validator follow-up is tracked in [draft PR #307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/307) on branch `fix/release-readiness-dynamic-migrations-2026-11-27`, and replaces the fixed list with a filesystem-derived contiguous migration inventory. It validates `NNNN_name.sql` names, detects missing and duplicate version numbers, rejects malformed SQL entries and fails closed when an SQL-named entry is not a regular file. Focused regression tests pass **4/4**; the full local repository suite passes **1,132/1,135** (three platform-specific skips, zero failures), scripts/verify.js passes, and the seven touched Markdown documents have 199 relative links with zero broken targets. Exact-head hosted CI, maintainer review and merge remain before this validator becomes authoritative mainline behavior.

## Remaining release gates

The current fourteen missing evidence categories remain separate and required:

1. Independent tenant/site authorization review (#14).
2. Live OIDC/SAML, email delivery, MFA recovery and identity-provider failure paths.
3. ClamAV corpus, malware handling and legacy-asset quarantine.
4. Real cloud-storage providers, least privilege and lifecycle tests.
5. Stripe webhook, ambiguous-outcome and inventory lifecycle acceptance.
6. Full editor journeys, manual WCAG and screen-reader acceptance.
7. Commerce parity and lifecycle acceptance.
8. Community privacy, abuse, search, export/deletion and forum acceptance.
9. Signed plugin pipeline and adversarial runtime isolation.
10. Qualified human dependency/SBOM/provenance/CodeQL review (#23).
11. Load/soak, fault injection, backup/restore and recovery drills (#24).
12. Independent platform security assessment and remediation/retest (#25).
13. Runbooks, secrets, rollback, monitoring and release-owner approval (#26/#13).
14. Production OTLP backend, governance, retention, ownership and delivery evidence.

## Version and release policy

Package version remains **0.6.2**, `private=true`, unreleased. This work adds no dependency or lockfile change and does not justify a SemVer increment. No release tag, GitHub Release, npm publication, production deployment or promotion is authorized while canonical readiness remains NO-GO.

## Related records

- [Roadmap](../ROADMAP.md)
- [Implementation roadmap](../IMPLEMENTATION-ROADMAP.md)
- [Release readiness](../RELEASE_READINESS.md)
- [Release evidence](../RELEASE-EVIDENCE.md)
- [F1.74 password-reset queue threat model](../security/F1.74-PASSWORD-RESET-QUEUE-THREAT-MODEL.md)

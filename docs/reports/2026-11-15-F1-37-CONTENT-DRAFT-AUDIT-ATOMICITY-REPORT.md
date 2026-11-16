# F1.37 Page-Draft Save and Audit Atomicity - Merge and Mainline Validation Report

**Date:** 15 November 2026
**Issue:** [#162](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/162), child of #124
**Pull request:** [#163 - F1.37: Make page-draft save and audit atomic](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/163)
**Implementation commit:** `058d26605b4984ed7455b5ebd4f70e24e8b9b494`
**Main merge commit:** `212df05a2c2af5b222eb6a06a798f2ce5ba6cabc`
**Mainline workflow:** [#667](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43774335902)
**Package:** `virgoscorpio-hub@0.6.2` - private and unreleased

> **Assurance boundary:** F1.37 is maintainer engineering and CI evidence. GitHub records no formal PR review submission or inline review threads for PR #163. This is not independent security approval or production certification.

## Delivered change

The page-draft endpoint previously committed the `content_items` mutation, collaboration checkpoint, revision, workflow event and outbox row in `saveDraft`, then inserted `content.draft_saved` audit data through a separate pool operation. Audit failure could therefore return an error after the draft had already committed.

F1.37 extends the existing `saveDraft` transaction with optional, backwards-compatible `onDraftSaved`. The callback receives the same checked-out client, saved row and previous locked row, and completes before COMMIT. `POST /api/v1/pages/drafts` now writes the correlated audit through `identity.audit(event, { queryable })` within that callback; the post-commit duplicate audit was removed. Existing callers without the callback and developer-token requests without a persisted actor remain compatible.

The content-route `23505` translation is now scoped to the content row INSERT/UPDATE operations. Audit constraint failures preserve their original database error and roll back the full write set rather than being misreported as a route slug conflict.

## Exact-main validation

GitHub records PR #163 merged on 15 November 2026 at 23:21:07 UTC, with merge commit `212df05a2c2af5b222eb6a06a798f2ce5ba6cabc`. Exact-main workflow [#667](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43774335902) completed all seven jobs successfully:

| Job | Result |
|---|---:|
| Node.js 22.23.4 Hub tests | **626/626 passed** |
| Node.js 24.22.1 Hub tests | **626/626 passed** |
| Vendored EnginEx 7.0.0, each Node matrix | **94/94 passed** |
| PostgreSQL/Memgraph integration | **102/102 passed; zero failures/skips** |
| F1.37 audit fault-injection regression | **PASS** |
| Fresh migrations and idempotent re-entry | **PASS** |
| Browser/editor Playwright smoke | **9/9 passed** |
| CodeQL | **PASS** |
| Mainline dependency/SBOM attestations | **PASS** |
| Exact-source evidence consolidation | **PASS** |

The dedicated live database regression installed a site-scoped temporary trigger on `audit_events`, injected a unique-violation failure, verified rollback of the content row, collaboration checkpoint, revision, workflow, outbox and audit records, removed the trigger, retried, and verified that the complete write set and one correlated audit event committed. The test passed inside the 102/102 live integration suite.

Mainline run #667 produced the signed dependency/provenance and SBOM attestation artifact (GitHub artifact ID `14184749237`, archive SHA-256 `a83182a1e67ce9f1d2459a3eb90f26e3491ca217e1252a21ba42f43e9f9ddd96`). The candidate PR workflow #666 also passed the supported Node matrices, 102/102 live integration tests, browser/editor smoke, CodeQL and evidence consolidation; its mainline-only attestation job was skipped as expected for a pull-request event.

## Release and assurance disposition

The canonical readiness result remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction: false`, and `NOT_PRODUCTION_CERTIFIED`. Production remains **NO-GO**. The F1.37 merge does not satisfy or waive independent tenant review #14, platform security assessment #25, or dependency/license review #23; #14/#25 remain OPEN / NOT PERFORMED and #23 remains OPEN / PARTIAL.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No SemVer increment, release tag, GitHub Release, npm publication, production-data use or deployment is authorized by this implementation. No schema, migration, dependency, public API, lockfile or package-version change was introduced.

## Related implementation records

- [F1.37 design](../superpowers/specs/2026-11-15-f1-37-content-draft-audit-atomicity-design.md)
- [F1.37 implementation plan](../superpowers/plans/2026-11-15-f1-37-content-draft-audit-atomicity.md)
- [Historical candidate-local report](2026-11-15-F1-37-CONTENT-DRAFT-AUDIT-ATOMICITY-CANDIDATE.md)
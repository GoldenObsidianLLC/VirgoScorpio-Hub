# F1.31 — Taxonomy mutation/audit atomicity (maintainer candidate)

**Date:** 14 November 2026
**Issue:** [#146](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/146), parent [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Base main:** c084e8916e9d4ac51a55154a4fad4f7b1cd65820
**Branch:** security/f1-31-taxonomy-audit-atomicity-2026-11-14
**Disposition:** Unmerged maintainer candidate; hosted exact-head workflows and human review pending.

## Finding

Taxonomy collection/item routes previously wrote the taxonomy_terms mutation and durable taxonomy-term outbox event in a PostgreSQL transaction, committed, and then wrote the correlated audit row through identity.audit() using the service pool. Audit failure could return an API error after the taxonomy mutation and outbox event were committed.

## Change

The taxonomy.created, taxonomy.updated and taxonomy.deleted audit calls now pass { queryable: client } and execute before COMMIT in the same transaction as the taxonomy_terms mutation and outbox insert. Other identity.audit callers retain the pool-backed default. Authorization order, site-context reconciliation, version locking, payload validation, unique-conflict mapping, soft-delete semantics, request correlation, outbox envelopes and response contract remain unchanged. No schema/migration, dependency/provider, lockfile, package version, SemVer or API contract change.

## Validation

- Live disposable PostgreSQL integration: 13/13 passed, zero failures/skips. Failure injection for create/update/delete proves the term mutation, outbox event and audit insert roll back together; each safe retry commits exactly one corresponding outbox/audit pair.
- Negative/no-side-effect coverage: cross-site selector mismatch, invalid create/update payloads, duplicate same-site slug, stale optimistic version, and unchanged Site A control row while Site B operations fail.
- Fresh migrations: 18/18 applied; idempotent second pass: 18/18 skipped.
- Identity/audit unit tests: 17/17 passed.
- Full local npm run check: passed, exit 0. scripts/verify.js: 235 required paths / 246 JavaScript files.
- Full and production dependency audits: zero vulnerabilities.
- Tenant inventory: 27 families, 78 route patterns, 21 source files, 43 test references; generator freshness passed.
- An intermediate full local run encountered two unrelated Undici Error: bad port failures in Windows loopback tests; both passed three consecutive isolated reruns, and the final full npm run check exited 0. No OS socket/network settings were changed.

## Review and release boundaries

Push workflow #618 (run 43649134322) and PR workflow #619 (run 43649180654) both completed successfully on 7296f4a729ea20a603d314bc870462e063b8e27e with all functional jobs passing. Node.js 22.23.4 and 24.22.1 each passed 608/608 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph passed 97/97 with zero failures/skips; fresh migrations 18/18 applied and 18/18 idempotently skipped; Playwright browser/editor/accessibility smoke passed 9/9; CodeQL and candidate evidence consolidation passed. Five producer manifests were verified against the exact source. The branch-only signed lockfile/SBOM attestation skipped as designed; signed mainline attestation remains a separate main-only gate. GitHub records no formal human review submission for PR #147; this is maintainer/automation evidence, not independent security approval. Do not treat these automated/maintainer results as independent assessment. GitHub records no formal review submission for PR #147. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED; parent #124 remains open. Package virgoscorpio-hub@0.6.2 remains private/unreleased. No production deployment, publication or SemVer change is authorized.

Relationship, template, reusable-component, plugin, media and commerce audit paths are explicitly out of scope for F1.31 and remain separate source-review candidates.

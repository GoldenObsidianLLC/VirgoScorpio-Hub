# F1.36 — Firewall Rule and Security Event Atomicity

**Status:** implementation in progress
**Parent:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Implementation issue:** [#159](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/159)
**Baseline:** `main` at `52b47aebfc537b91f21399080d514a406b613e5a`; exact-main workflow [#658](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43739487792)

## Problem

The firewall rule collection route in `apps/api/src/platform-routes.js` performs rule creation and its `site_security_events` insert as separate pool operations. It invalidates the firewall cache between them. A failed event insert therefore leaves a persisted rule and a successful cache invalidation despite returning an error. Rule deletion has no correlated site security event.

## Decision

Reuse the shared `withTransaction(pool, work)` helper from `packages/db/src/transaction.js`. For site-scoped POST and DELETE mutations, perform the rule mutation and corresponding security-event insert through the same transaction client. Invalidate the firewall cache only after the helper resolves, which confirms COMMIT.

Keep creation event type `firewall.rule_created`; use `firewall.rule_deleted` for deletion. Keep severity `medium`, site/request/actor context, and safe detail fields. Do not store rule reason or other unnecessary caller-provided content in event details.

## Invariants

1. A successful create commits exactly one rule and one matching `firewall.rule_created` event.
2. A successful delete commits exactly one matching `firewall.rule_deleted` event and removes only the rule in the requested site.
3. Either event insert failure rolls back the associated rule mutation.
4. The firewall cache is invalidated once after successful commit; it is not invalidated on rollback or a missing/cross-site rule.
5. The `security:manage` capability check, site-selector reconciliation, input validation, route path, HTTP statuses and response payloads remain unchanged.
6. No transaction spans a response write or external side effect.
7. Global rules, matching behavior, schema, migrations, dependencies, public API and SemVer remain unchanged.

## Verification

- Unit-level route tests assert use of one transaction client, rollback on event failure, site-scoped deletion and post-commit cache invalidation.
- A disposable PostgreSQL integration test injects event insert failures and proves database rollback/retry and cross-site isolation through the actual database.
- Full repository checks, PostgreSQL/Memgraph integration, migrations, browser, CodeQL and exact-head evidence are required before considering the increment complete.
- This maintainer-led work is not an independent security review or production approval. The #658 readiness baseline remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN with `readyForProduction: false`.

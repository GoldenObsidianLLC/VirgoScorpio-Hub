# F1.24 Invitation-Acceptance Audit Failure and Retry — Design

**Date:** 11 November 2026

**Status:** Implemented as a maintainer-led candidate. The source-test revision passed push workflow #571 (91/91 live PostgreSQL/Memgraph tests, zero failures/skips), including the injected audit failure and retry. Final PR-head validation and human review remain pending.

**Tracking:** Issue [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), draft PR [#129](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/129), branch security/invitation-audit-fault-recovery-2026-11-11.

## Problem

F1.23 writes the `site.invitation_accepted` audit event in the same PostgreSQL transaction as user creation, membership insertion, and invitation consumption. Unit coverage proves that an audit-insert failure triggers rollback and prevents post-commit authorization invalidation. The remaining gap is to verify those guarantees against a real PostgreSQL transaction and prove that the still-valid invitation can be safely retried after the audit sink recovers.

## Design

Extend the existing disposable-PostgreSQL membership/invitation integration fixture. The new case:

1. Creates a normal Site A editor invitation and captures the one-time token from the trusted mail-outbox payload; PostgreSQL stores only its SHA-256 digest.
2. Installs a uniquely named, temporary PostgreSQL trigger scoped to that Site A and the `site.invitation_accepted` action. The trigger raises a deliberate database exception only for the acceptance audit insert.
3. Redeems the invitation and expects the API request to fail.
4. Verifies that the new user, Site A membership, invitation `accepted_at`, and acceptance audit event are all absent, that the original SHA-256 token digest is unchanged, and that the identity service emitted no authorization invalidation.
5. Removes the trigger/function in a `finally` block.
6. Retries the exact same one-time token. It must now succeed, create exactly one active user/membership, consume the invitation, create one request-correlated acceptance audit event, and emit exactly one post-commit authorization invalidation for that principal/site.

The fault is limited to a per-test Site A acceptance-audit event; invitation creation, unrelated audit actions, other sites, and the global database service remain untouched.

## Security and correctness boundaries

- Uses the repository's existing identity service, invitation route, PostgreSQL transaction, audit schema, request ID and authorization-invalidation callback.
- The PostgreSQL trigger is test-only and is dropped in cleanup. No application runtime behavior changes.
- The test proves rollback and retry for this specific audit-write failure. It does not prove general PostgreSQL outage/failover recovery, arbitrary transaction fault injection, audit retention, Redis delivery durability, or production recovery SLAs.
- The test uses synthetic disposable identities and tenant data only.
- Maintainer-authored test evidence does not satisfy independent tenant review #14 or platform security assessment #25.

## Compatibility and release

No public route/API contract, schema, migration, dependency, provider contract, lockfile, or package version changes. Package `virgoscorpio-hub@0.6.2` remains private/unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release tag, publication, deployment, or issue closure is implied.

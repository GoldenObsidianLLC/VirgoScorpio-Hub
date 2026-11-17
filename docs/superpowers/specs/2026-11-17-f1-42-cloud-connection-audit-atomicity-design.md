# F1.42 — Cloud Connection Audit Atomicity Design

**Status:** Proposed for review

**Issue:** [#178 — Commit cloud connection changes and audits atomically](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/178)

**Target increment:** F1.42

**Design baseline:** `326456823f21e2f0526eeb2a8d19b88cddbfc32d`

**Baseline validation:** Exact-main workflow [#706](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44007519987) passed on the baseline revision.

## 1. Summary

Make the three cloud-connection state-changing paths—create, disable, and persisted health-check result—transaction-atomic with their correlated audit events. Continue using the shared PostgreSQL transaction helper and identity audit service. Keep cloud provider probes outside the transaction.

Health checks must not reactivate a disabled connection. A health result describes the provider probe; the persisted connection status remains disabled if a disable operation committed while the probe was in flight.

This is a bounded persistence/audit correction. It does not redesign cloud integrations, introduce a second audit system, change the public route contract, or qualify live cloud providers for production.

## 2. Verified current architecture

- `apps/api/src/platform-routes.js` owns the site-scoped cloud connection routes:
  - `POST /api/v1/sites/:siteId/cloud/connections`
  - `POST /api/v1/sites/:siteId/cloud/connections/:connectionId/disable`
  - `POST /api/v1/sites/:siteId/cloud/connections/:connectionId/test`
- Each route performs site selector reconciliation and the `cloud:manage` capability check. The SQL reads/writes bind both `site_id` and connection ID. Cross-site IDs are non-disclosing 404s.
- Create and disable currently issue direct `localPool.query` writes. The health-check path reads the scoped connection, resolves its credential reference, runs a provider probe when supported, then writes status and `last_health_check_at` directly.
- These writes do not currently call the existing identity audit service.
- `packages/db/src/transaction.js` exports `withTransaction(pool, work)`; it owns a checked-out client and handles BEGIN, COMMIT, rollback on failure, and release while preserving the original error.
- `packages/auth/src/service.js` implements `identity.audit(input, { queryable })`, which writes the standard `audit_events` record through the supplied queryable.
- `packages/cloud/src/storage-adapters.js` contains read-only provider probes such as S3 HeadBucket, Google Cloud bucket metadata, and Azure container properties. The probe can fail outside the control of PostgreSQL.
- Migration `0006_platform_libraries_commerce_social_billing.sql` defines `cloud_connections.status` as `configured | healthy | unhealthy | disabled` and stores the credential reference separately from the JSON configuration.
- PR #118 already added and merged cloud-connection tenant-isolation coverage. F1.42 extends this existing security boundary; it does not duplicate that work.

## 3. Goals

1. Each committed cloud connection create, disable, or health-check persistence has exactly one corresponding audit insert in the same PostgreSQL transaction.
2. If the audit insert or COMMIT fails, the cloud row mutation and audit both roll back.
3. A health-check request never holds a PostgreSQL transaction open while resolving credentials or contacting a provider.
4. A disabled connection remains disabled when a health-check result is persisted, including if disable commits while the provider probe is still running.
5. Audit details are explicitly allow-listed, metadata-only, tenant- and request-correlated, and contain no secret material or provider configuration.
6. Existing route authorization, site scoping, response shapes, validation, and provider error sanitization remain compatible.

## 4. Proposed design

### 4.1 Reuse the shared transaction and audit abstractions

Add a small cloud-route-local helper in `platform-routes.js` to centralize the invariant:

- Open the transaction with `withTransaction(localPool, async queryable => ...)`.
- Execute exactly one site-scoped cloud mutation through `queryable`.
- Await `identity.audit(event, { queryable })` before returning from the transaction callback.
- Return the mutation result only after the shared helper commits successfully.

The helper should accept the audit action and a safe details builder/result. It must not create a parallel audit writer, direct pool fallback, outbox, or new table. If audit is unavailable, fail closed rather than silently committing an unaudited mutation.

### 4.2 Create

Within one transaction:

1. Insert the validated cloud connection using the existing provider, name, config, and credential-reference validation.
2. Use the inserted row's ID as the audit target ID.
3. Await `cloud.connection_created` on the same transaction queryable.
4. Commit, then return the existing 201 response shape.

Suggested audit envelope:

- `siteId`, authenticated `actorId`, `requestId`
- `action: cloud.connection_created`
- `targetType: cloud-connection`
- `targetId: <inserted connection id>`
- `details: { provider, status: configured }`

Do not include the display name, config, endpoint, bucket/container, or credential reference.

### 4.3 Disable

Within one transaction:

1. Update only the row matching both the route site ID and connection ID.
2. Preserve the existing non-disclosing 404 behavior when the row does not exist in that site.
3. Await `cloud.connection_disabled` using the same transaction queryable and returned row ID.
4. Commit, then return the existing 200 response shape.

Suggested details are limited to `{ provider, status: disabled }`. The audit target is the cloud-connection ID.

### 4.4 Health-check result

The external boundary is deliberate:

1. Read the connection using the existing site-scoped query.
2. Resolve the credential reference and run `probeCloudStorageAdapter` outside any PostgreSQL transaction. Preserve current safe error mapping and the existing response contract.
3. After the probe outcome is known, start a short `withTransaction` operation.
4. Update `last_health_check_at` and the effective persisted status, then write `cloud.connection_tested` through the same transaction queryable.
5. Commit before returning the existing test response.

The status update must preserve a concurrent or pre-existing disable. Use a database-side conditional update equivalent to:

```sql
status = CASE
  WHEN status = 'disabled' THEN 'disabled'
  ELSE $3
END
```

This check executes against the row version that PostgreSQL updates after any conflicting writer completes. The timestamp can still record that the explicit health check occurred. The response's probe result and the row's effective status are distinct: a disabled connection may have a healthy provider probe result but remains disabled.

Suggested audit details:

```json
{
  "provider": "s3-compatible",
  "probeStatus": "healthy",
  "connectionStatus": "disabled",
  "credentialReferenceMode": "environment",
  "liveProbeAttempted": true,
  "liveObjectStoreOperationPerformed": true
}
```

Values must be derived from the existing sanitized route result. Use only the known provider enum, `healthy|unhealthy` probe result, persisted status enum, supported credential-reference mode, and booleans. Do not spread or serialize the provider result object.

### 4.5 Audit privacy rules

Never persist any of the following in audit details:

- Credential values, raw credential references, secret-manager paths, tokens, or identity documents.
- Connection config, bucket/container names, project/account names, or endpoint URLs.
- Raw SDK/provider responses, raw provider errors, request identifiers from provider SDKs, or stack traces.

The event is an operational state-change record, not a copy of the cloud configuration or provider diagnostic payload.

## 5. Failure and recovery semantics

| Operation | Failure point | Required local outcome | External outcome |
|---|---|---|---|
| Create | Audit insert fails | Insert rolls back; no cloud row and no audit row | No provider call |
| Disable | Audit insert fails | Status and updated timestamp roll back; no audit row | No provider call |
| Health check | Provider probe fails normally | Persist unhealthy result and timestamp with one audit event, as today | Provider failure is sanitized |
| Health check | Audit insert/COMMIT fails after probe | Status/timestamp and audit roll back together | The read-only provider probe may already have occurred and cannot be rolled back |
| Health check | Disable races with in-flight probe | Effective status remains disabled; health timestamp and audit commit together | Probe remains outside PostgreSQL |

A repeated health-check request may repeat a read-only provider probe after an audit failure. Do not claim PostgreSQL rollback reverses provider activity. Existing request correlation and safe error responses must be retained.

## 6. Test strategy

### Unit/route tests

- Verify create, disable, and health-check persistence use one transaction-owned queryable for mutation and audit.
- Verify audit is awaited before COMMIT and that the provider probe completes before the health-check transaction begins.
- Inject audit failure and COMMIT failure; assert rollback and original error preservation.
- Verify the audit details contain only allow-listed metadata and omit raw credential references, config, bucket/container, endpoint, and provider error fields.
- Verify an already-disabled connection remains disabled after a healthy or unhealthy probe result.

### PostgreSQL integration

Extend the existing tenant-isolation cloud-connection integration coverage (or a focused sibling test using the same disposable DB harness):

- Install narrowly scoped audit triggers that fail only for each F1.42 action.
- For create, disable, and health-check persistence, assert the database mutation rolls back and no audit event survives.
- Remove each trigger, retry, and assert exactly one audit row with the expected site, actor, target, action, request correlation, and safe details.
- Verify foreign-site IDs and selector conflicts still return their current errors with no audit or state mutation.
- Verify unresolved credential references do not invoke a provider probe.
- Verify a health check cannot overwrite disabled status.

The PostgreSQL integration suite must run against disposable test services with zero skips in hosted CI. A stubbed/unresolved provider reference does not qualify as live cloud-provider acceptance.

## 7. Documentation and architecture consistency

After implementation and validation, update only the relevant canonical material:

- `docs/ARCHITECTURE.md`
- `docs/API-CONTRACTS.md`
- `docs/CLOUD-INTEGRATIONS.md`
- `docs/OPERATIONS.md`
- `docs/PLATFORM-FEATURES.md`
- `docs/SECURITY-AND-THREAT-MODEL.md` if the documented audit/security boundary changes
- Current tenant-isolation route map and generated inventory/catalog
- `docs/IMPLEMENTATION-ROADMAP.md`, `docs/ROADMAP.md`, `CHANGELOG.md`
- `RELEASE-MANIFEST.json` and release evidence/readiness only after exact-main evidence exists

Preserve F1.39–F1.41 historical reports. Keep manual independent security review, live provider lifecycle, IAM/egress/SSRF review, and other production gates distinct from maintainer implementation evidence.

## 8. Compatibility and SemVer

- No schema or migration change.
- No public route, request, response, or error-contract change intended.
- No new dependency or lockfile change.
- No package version or SemVer increment. The package remains private/unreleased `0.6.2` unless a later, independently approved public-contract or release-policy change proves otherwise.

## 9. Decisions and review focus

- Use the action names `cloud.connection_created`, `cloud.connection_disabled`, and `cloud.connection_tested`, with target type `cloud-connection`. These follow the existing domain-qualified audit-action convention.
- Audit every accepted disable request. The current handler updates `updated_at` even when the status is already disabled, so the operation remains a persisted write; one correlated audit event per accepted request preserves that behavior.
- Keep the explicit test action available for disabled rows, matching the current route and admin UI. The provider probe may return a healthy result, but it must never change the persisted disabled state. Record both the observed `probeStatus` and effective `connectionStatus` in audit details.
- Extend the existing cloud tenant-isolation PostgreSQL integration fixture to avoid duplicating expensive server/identity setup. Add focused route tests to `test/platform-routes.test.js` for same-queryable, rollback, and audit-data allow-list contracts.
- Confirm the exact safe details fields during implementation; event details must remain an explicit allow-list and must not serialize the test response or provider result object.

## 10. Approval boundary

This design is the proposed F1.42 contract, not an implementation claim. No production route or persistence code has been changed on this branch. After approval, the implementation plan will map each step to a failing regression, the smallest code change, and its validation command.

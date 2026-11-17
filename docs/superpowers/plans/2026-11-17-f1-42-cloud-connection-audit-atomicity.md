# F1.42 Cloud Connection Audit Atomicity Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cloud connection create, disable, and health-check persistence atomic with correlated audit events while ensuring a health check never reactivates a disabled connection.

**Architecture:** Reuse `withTransaction(pool, work)` and `identity.audit(input, { queryable })` through one small route-local wrapper. Provider resolution and read-only probe execution remain outside PostgreSQL; only the resulting health-state/timestamp write and its audit insert run in one short transaction.

**Tech Stack:** Node.js 22+, CommonJS, `node:test`, PostgreSQL integration harness, AWS S3 SDK against an ephemeral loopback HTTP probe endpoint.

**Spec:** `docs/superpowers/specs/2026-11-17-f1-42-cloud-connection-audit-atomicity-design.md`

## Global Constraints

- Preserve public route paths, request/response shapes, error contracts, tenant selector checks, `cloud:manage` authorization, and non-disclosing site-scoped 404 behavior.
- Reuse the existing `withTransaction` and `identity.audit` abstractions; do not create a second audit writer, transaction helper, outbox, migration, or database table.
- Never hold a PostgreSQL transaction open during credential resolution or external provider I/O.
- Audit details are allow-listed metadata only; never include credentials, credential references, configuration, bucket/container names, endpoints, raw provider responses, or raw error messages.
- A persisted `disabled` state is sticky across health checks, even when a disable commits while the probe is in flight.
- No new dependency, lockfile change, schema migration, public API redesign, or SemVer bump. Preserve private package version `0.6.2`.
- Keep historical release evidence immutable; update current docs and evidence only from verified results.

## Review Focus

- A provider probe may succeed while another request disables the row; the persisted state must remain disabled and the audit must record both probe outcome and effective connection status.
- An audit failure after the provider probe cannot roll back external provider I/O; it must roll back only local status/timestamp and audit persistence, with safe retry semantics.
- A row may be deleted or disabled between initial read and post-probe persistence; do not update or audit an absent row, and never reveal cross-site existence.
- Missing identity audit capability must fail closed before any cloud configuration mutation.
- Audit detail serialization must remain safe if the provider response or connection config gains new fields in a future release.

---

### Task 1: Route transaction/audit behavior and deterministic unit coverage

**Files:**
- Modify: `apps/api/src/platform-routes.js`
- Create: `test/cloud-connection-audit-atomicity.test.js`

**Interfaces:**
- Consumes: `withTransaction(pool, work)` from `packages/db/src/transaction.js`; `identity.audit(input, { queryable })`; existing cloud credential and adapter functions.
- Produces: a private route-local `withCloudConnectionAudit({ localPool, identity, fail, mutate, audit })` helper. It returns the mutation result only after the audit insert and transaction commit succeed.

- [ ] **Step 1: Write failing route tests** named:
  - `cloud connection creation commits its audit event on the same transaction client`
  - `cloud connection creation rolls back when its audit insert fails`
  - `cloud connection disable commits its audit event on the same transaction client`
  - `cloud connection disable rolls back when its audit insert fails`
  - `cloud connection health check probes before opening its persistence transaction`
  - `cloud connection health check preserves a concurrent disable after a successful probe`
  - `cloud connection health check rolls back status and timestamp when audit fails`
  - `cloud connection mutations fail closed when identity auditing is unavailable`
  - Assert actor/site/request/target correlation, safe detail allow-list, same queryable, event-before-COMMIT order, and rollback state.
- [ ] **Step 2: Run** `node --test test/cloud-connection-audit-atomicity.test.js`.
  - **Expected:** FAIL because cloud mutations currently bypass the transaction-owned audit callback and health checks overwrite `disabled`.
- [ ] **Step 3: Implement** the route-local helper and migrate create, disable, and health-check persistence to it.
  - Keep collection GET and pre-probe connection SELECT read-only and outside the transaction.
  - Use `cloud.connection_created`, `cloud.connection_disabled`, and `cloud.connection_tested`, target type `cloud-connection`.
  - Make the health update conditional on the row's current status so `disabled` is preserved; return the effective persisted status for audit details.
  - For a missing row at post-probe persistence, preserve the existing non-disclosing 404 contract and do not emit an audit event.
  - Fail closed with `ERR_VIRGOSCORPIO_HUB_AUDIT_UNAVAILABLE` if the identity audit seam is absent.
- [ ] **Step 4: Run** `node --test test/cloud-connection-audit-atomicity.test.js test/platform-routes.test.js`.
  - **Expected:** All new cloud route tests and existing platform route tests pass; zero failures/skips.
- [ ] **Step 5: Commit** as `fix(cloud): make connection audits transaction-atomic`.

### Task 2: PostgreSQL audit-failure rollback/retry integration proof

**Files:**
- Modify: `test/integration/tenant-isolation.integration.test.js`

**Interfaces:**
- Consumes: Task 1 route event actions/details and the existing tenant-isolation test server, Site B cloud-manager session, and disposable PostgreSQL pool.
- Produces: live database evidence for create/disable/health-check transaction rollback and safe retry.

- [ ] **Step 1: Extend the existing cloud-connection tenant-isolation case** with one trigger-injection scenario per audit action. Use unique trigger/function identifiers and trigger only on the exact F1.42 action.
- [ ] **Step 2: Run the targeted integration test with PostgreSQL enabled** using the repository's live integration environment:
  `node --test test/integration/tenant-isolation.integration.test.js`.
  - **Expected before implementation is present:** The failure-injection assertions FAIL because the new cloud audit events are not emitted.
- [ ] **Step 3: Assert each injected audit failure** returns a safe server error, leaves row state unchanged, and leaves zero matching audit rows; remove the trigger and retry, asserting success and exactly one correlated audit row.
  - Cover create rollback/retry, disable rollback/retry, and health status/timestamp rollback/retry.
  - Keep the unresolved test credential reference; the test must not contact a live provider.
  - Retain all existing cross-tenant ID, selector-conflict, and least-privilege assertions.
- [ ] **Step 4: Run** `npm run test:integration:live` with the configured disposable PostgreSQL/Memgraph services.
  - **Expected:** All required live integration groups pass with zero skips for the relevant services.
- [ ] **Step 5: Commit** as `test(cloud): prove audit rollback and retry in postgres`.

### Task 3: Documentation, inventory, and release-governance reconciliation

**Files:**
- Modify as required: `docs/ARCHITECTURE.md`, `docs/API-CONTRACTS.md`, `docs/CLOUD-INTEGRATIONS.md`, `docs/OPERATIONS.md`, `docs/PLATFORM-FEATURES.md`, `docs/SECURITY-AND-THREAT-MODEL.md`, current tenant-isolation route map/catalog, `docs/IMPLEMENTATION-ROADMAP.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, `RELEASE-MANIFEST.json`, and a dated F1.42 implementation report.

**Interfaces:**
- Consumes: verified Task 1 behavior, Task 2 PostgreSQL output, generator contract in `scripts/generate-tenant-isolation-route-inventory.js`, and the latest exact-main release evidence.
- Produces: mutually consistent canonical documentation, source-derived route inventory, and an evidence report that clearly distinguishes maintainer tests from independent and live-provider production gates.

- [ ] **Step 1: Inspect the inventory generator, Markdown link-check conventions, changelog/manifest conventions, and current release readiness schema before editing docs.**
- [ ] **Step 2: Update canonical docs** to describe transactional audit persistence, safe metadata-only details, short transaction boundary, and disabled-state preservation without implying live cloud-provider qualification.
- [ ] **Step 3: Regenerate** the tenant route inventory through the supported script; do not manually edit generated output if the script owns it.
- [ ] **Step 4: Update roadmap, changelog, manifest, and dated report** with only verified F1.42 facts. Do not change package version or mark production readiness gates complete based on these tests.
- [ ] **Step 5: Run** Markdown link validation, JSON parsing/manifest validation, `git diff --check`, route inventory verification, and relevant focused suites.
  - **Expected:** No broken local Markdown links, invalid JSON, stale source references, inconsistent roadmap status, or whitespace errors.
- [ ] **Step 6: Commit** as `docs(cloud): document F1.42 audit consistency and evidence`.

## Final verification contract

Run the complete project validation available in the current environment:
- `npm run check`
- `npm run test:integration:live` with PostgreSQL/Memgraph enabled
- `npm audit --omit=dev` and the repository's full audit command
- tenant inventory generation/check
- Markdown, manifest, syntax, and diff validation

Run/inspect hosted PR checks, supported Node matrix, PostgreSQL/Memgraph integration, browser smoke, CodeQL, and exact-main workflow before making any hosted validation claim. Do not merge the PR without human review. Do not claim production certification.

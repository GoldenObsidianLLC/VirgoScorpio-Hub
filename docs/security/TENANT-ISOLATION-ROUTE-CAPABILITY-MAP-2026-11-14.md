# VirgoScorpio Hub 0.6.2 - Tenant-Isolation Route and Data-Access Inventory

> **MAINTAINER-GENERATED PREPARATION ONLY. NOT AN INDEPENDENT REVIEW, SECURITY OPINION, PASS, OR RELEASE EVIDENCE.**

Maintainer-prepared route, capability, data-access, and regression-test navigation inventory for independent tenant/site-isolation review issue #14.

## Status and provenance

- Status: MAINTAINER_PREPARED_NOT_INDEPENDENTLY_REVIEWED.
- Generated from the current working-tree implementation anchors and the catalog at docs/security/tenant-isolation-route-inventory.catalog.json.
- Implementation-source digest: b8d9939306de65425d027b2e3cac2047da7a6327c161bf77921801ad7db58269 across 21 files.
- Referenced-test digest: b06d2194537d01501cc7c7a4dd5721f663fd848f2d540bcb8b673b31d0aa74e1 across 57 files.
- Inventory size: 28 route/flow families, 80 declared route patterns, 21 source files, and 57 test files.
- Regenerate with npm run security:tenant-inventory; CI checks freshness with node scripts/generate-tenant-isolation-route-inventory.js --check.

Curated, source-anchored navigation inventory; route patterns, capabilities, data-access notes and test limitations are maintainer-authored metadata, not proof of runtime behavior. F1.21/F1.22 owner-removal serialization, role/capability matrix, cross-site denial and SSE revocation merged via PR #127; exact-main #563 passed 85/85 live PostgreSQL/Memgraph tests. F1.23 invitation lifecycle hardening merged via PR #128; exact-main #570 passed 90/90. F1.24 invitation-audit failure rollback/retry merged via PR #129; exact-main #574 passed 91/91. F1.25 content-type registry concurrency merged via PR #130; final-head #577/#578 passed 92/92. F1.26 Redis subscriber recovery merged via PR #131; exact-main #582 passed 92/92. F1.27 editorial ownership guard merged via PR #132; exact-main #585 passed 93/93. F1.28 direct membership add/remove audit atomicity merged via PR #140 at main e4712202d3d29c5517e335df658ce5f6d72a25cb; exact-main #603 passed 94/94. F1.29 site creation and initial owner membership now commit atomically with site.created through PR #142 at main debd9890b94b55dd3b9496d80f49a9a7c00615fb; exact-main #609 passed 95/95 live PostgreSQL/Memgraph tests with zero skips. F1.30 design-system mutation/audit atomicity merged via PR #144 at main 67e9440b9c543e69a46bba8cbb25a9d2329f3502. Exact-main workflow #612 passed 7/7 jobs: Node 22/24 each 608/608 Hub and 94/94 EnginEx tests, PostgreSQL/Memgraph 96/96 with zero skips, 18 fresh plus 18 idempotent migrations, Playwright 9/9, CodeQL, signed mainline SBOM/provenance attestation and evidence consolidation. Dedicated local PostgreSQL failure-injection suite passed 22/22. No formal PR review submission was recorded; maintainer/automation evidence only. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. PostgreSQL remains authoritative; Memgraph is a rebuildable projection; Redis Pub/Sub is ephemeral, and database-backed authorization/recovery fallbacks remain essential. F1.31 merged through PR #147 at main 63e4db46426c606b73fea6d03bc4ea6a54219f16; exact-main workflow #622 (run 43653758324) passed all seven jobs: Node.js 22/24 matrices, PostgreSQL/Memgraph 97/97 with zero skips, 18 fresh and 18 idempotent migrations, Playwright 9/9, CodeQL, signed mainline attestation and evidence consolidation. GitHub records no formal human review submission; maintainer/automation results are not independent approval. Independent reviews #14/#25 remain OPEN / NOT PERFORMED. F1.32 is tracked by issue #148 / PR #149, based on main 63e4db46426c606b73fea6d03bc4ea6a54219f16. Relationship create/delete audit events use the existing transaction client before COMMIT; rollback/retry, cross-site, invalid endpoint/type/metadata, duplicate and unchanged Site A control coverage is in the focused integration fixture. The initial exact-head PR run #625 executed 98 tests: the new relationship subtest passed, but three existing tenant-content assertions returned HTTP 429 because the shared test fixture exhausted its default request ceiling. The fixture now raises RATE_LIMIT_MAX_REQUESTS=1000 only in its test environment; production defaults are unchanged. Corrected exact-head PR workflow #627 (run 43656852133) passed all functional jobs on 046c61b4b7db21a6d8d2e1883c55619404a7a3da: Node 22/24 608/608 Hub and 94/94 EnginEx each; PostgreSQL/Memgraph 98/98 with zero skips; 18 fresh and 18 idempotent migrations; Playwright 9/9; CodeQL; and evidence consolidation. The branch-only attestation skipped as designed. Local live PostgreSQL/Memgraph was NOT RUN because no listener was available at 127.0.0.1:5432. PR #149 merged on 15 November 2026 at main 9230177d3155d9ff9134180a67ed69203d618c0f; no formal human review submission or review threads were recorded. Independent reviews #14/#25 remain OPEN / NOT PERFORMED. F1.32 merged mainline exact-main workflow #630 (run 43662357311) passed 98/98 PostgreSQL/Memgraph tests with zero skips, Node 22/24 matrices, 18 fresh plus 18 idempotent migrations, Playwright 9/9, CodeQL, signed mainline attestation and evidence consolidation. No formal human review submission was recorded for PR #149; maintainer automation is not independent review. F1.33 issue #150 is a maintainer candidate on main 9230177d3155d9ff9134180a67ed69203d618c0f: the site AI-policy upsert and ai.policy_updated audit are now in one transaction and a two-site failure-injection rollback/retry regression is added. Local unit/security checks pass; local live PostgreSQL is not run because DATABASE_URL and the integration enable flag are absent. Corrected exact-current-head push workflow #633 (run 43664467084) and PR workflow #634 (run 43664470029) both passed all functional jobs on 3228f66fc9cdeb8fc69367bc1c8a457d722b9b15. Node.js 22.23.4 and 24.22.1 each passed 608/608 Hub and 94/94 EnginEx tests with zero skips; PostgreSQL/Memgraph passed 99/99 with zero skips, including the ai.policy_updated audit-trigger rollback/retry regression; 18/18 fresh migrations and 18/18 idempotent re-entry checks passed; Playwright 9/9; CodeQL; and candidate evidence consolidation passed. Branch-only dependency/SBOM attestation skipped as designed for non-mainline workflows. Initial runs #631/#632 failed because generated inventory outputs were stale after source/catalog changes; docs-only commit 3228f66 regenerated them and current-head validation is green. F1.35 plugin registry lifecycle/audit atomicity merged through PR #157 at main SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023; issue #156 CLOSED. Exact-head workflows #653/#654 and exact-main workflow #655 passed; the mainline PostgreSQL/Memgraph suite passed 100/100 with zero skips, including audit-failure rollback/retry and re-registration/review concurrency regressions. Maintainer/automation evidence only; independent reviews #14/#25 remain open and are not represented as satisfied. F1.36 firewall-rule/security-event atomicity merged through PR #160 at main 460eff191d84fe422ed4ac15260a8fd6d9100d77; exact-main workflow #661 passed 101/101 live PostgreSQL/Memgraph tests with zero skips. F1.37 issue #162 is an unmerged candidate on branch security/f1-37-content-draft-audit-atomicity-2026-11-15, based on current main after docs-only PR #161 at ead1760b71d747dad3100a568ac403ce6a59a08f: page-draft persistence now uses an optional onDraftSaved callback and identity.audit(..., { queryable }) on the existing transaction client, before COMMIT; audit failure rolls back the content/revision/workflow/outbox write set, and audit 23505 errors retain their original identity. Candidate-local store/API coverage passes 7/7; full npm run check passes 623 tests with zero failures and 3 platform-specific skips on Node 26.12.1. The dedicated live PostgreSQL rollback/retry test and exact-head hosted CI remain pending; this is maintainer preparation, not mainline, independent-review or production evidence. F1.37 page-draft save/audit atomicity merged through PR #163 at main 212df05a2c2af5b222eb6a06a798f2ce5ba6cabc from implementation commit 058d26605b4984ed7455b5ebd4f70e24e8b9b494; exact-main workflow #667 passed 102/102 live PostgreSQL/Memgraph tests with zero skips, including the content.draft_saved audit rollback/retry regression. Node 22/24 matrices, Playwright 9/9, CodeQL, signed mainline attestations and exact-source evidence consolidation passed. PR #163 has no formal review submission or inline review threads; maintainer/automation evidence only. Issue #162 remains OPEN pending maintainer close-out; independent assessments #14/#25 and dependency/license review #23 remain open. Current main is 68cfd2f0e05e5c43ccb617770124a39c9226db9c after F1.44 follow-up PR #186 merged; exact-main workflow #721 passed all seven jobs on that SHA. F1.41 Stripe refund provider-response/audit atomicity and F1.42 cloud connection mutation/audit atomicity are merged. The authoritative release-gate report retains the separate F1.41 exact-main workflow #703 historical snapshot. F1.42 cloud connection audit atomicity merged through PR #179 / issue #178 (CLOSED) at main 10e62a5902a68cee5edc31b57847a5602078feb1; implementation commit 19a4599db0087810550ea152bd509c80ce49e1bf, candidate head 2c20dafc1ffc28e67b7be0f73bbe989162c80c0f. Cloud create, disable and post-probe health persistence use the transaction-owned identity audit queryable; provider probes remain outside PostgreSQL and disabled state is preserved across a concurrent health check. Candidate-local Windows/Node.js 26.12.1 npm run check passed 652 tests with zero failures and three Windows-specific skips; live local PostgreSQL/Memgraph/Redis integration passed 114/114 with zero skips. Exact-head workflow #708 and exact-main workflow #709 passed; #709 includes Node 22/24 (655/655 Hub and 94/94 EnginEx each), 115/115 live PostgreSQL/Memgraph/Redis tests, browser smoke 9/9, collaboration Playwright 4/4, CodeQL, signed attestations and evidence consolidation. The probe protocol test uses loopback HTTP rather than a live provider account. PR #179 had zero formal reviews and zero inline threads; independent review, post-merge exact-main readiness is 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE with production NO-GO, and live provider lifecycle qualification remain separate gates; no production certification is claimed. F1.43 site-invitation upsert, mail-outbox intent and metadata-only site.invitation_created audit commit or roll back together through the existing identity transaction callback; PR #182 merged and issue #181 is CLOSED. F1.44 authenticated revision restore now emits the correlated content.draft_saved audit on the existing store transaction. Test-only PR #186 added a live authenticated PostgreSQL route rollback/retry case plus database URL safety guard, merged at current main 68cfd2f0e05e5c43ccb617770124a39c9226db9c; issue #185 is CLOSED. Exact-main workflow #721 passed 120/120 live PostgreSQL/Memgraph/Redis tests with zero skips. This catalog is a maintainer navigation aid, not an independent security review, acceptance or production certification. F1.41 implementation commit c60c0448de676e06f7b22b399107a8e61674b8af merged through PR #176 at main eb6fe4c8672dadd98892a62062ecf718ce9393b6. Stripe refund provider calls remain outside the PostgreSQL transaction; provider response binding, refund/order status and commerce.refund_requested audit now commit together on the same transaction queryable. Audit failure rolls back local persistence while retaining the durable reservation; same-key retry uses the stable Stripe idempotency key and terminal replay makes no duplicate provider or audit call. Dedicated PostgreSQL failure-injection tests passed 4/4 with zero skips. Exact-head #702 and exact-main #703 passed; exact-main live PostgreSQL/Memgraph passed 115/115 with zero skips. Stripe is stubbed; no live provider acceptance is claimed. Issue #175 remains OPEN for maintainer close-out; PR #176 recorded zero formal review submissions and zero inline review threads. This is maintainer/automation evidence only, not independent review or production acceptance.

The source digests identify the exact implementation and test file contents represented by this catalog. They are not a substitute for the independent reviewer recording the full Git commit SHA, clean checkout, runtime environment, and exact review scope.

## 1. How to interpret this inventory

- Route patterns and control descriptions are curated maintainer metadata, not automatically inferred proofs that every matching method follows the stated policy.
- The generator verifies each declared source anchor and test-file reference and refreshes line numbers. It does not prove all registered routes or reverse-proxy paths are cataloged.
- A test-file reference means that a relevant test file exists; it does not assert that every listed scenario is covered or passed on the reviewed revision.
- Data-access and side-effect lists are navigation hints. The independent reviewer must trace each request through SQL, transactions, object storage, provider callbacks, outbox, workers, graph, caches and realtime delivery.
- A public/anonymous endpoint still requires explicit site binding, publication/visibility checks, and non-disclosing behavior.

## 2. Shared request and authorization controls

### Authentication and developer-token boundary

Session authentication is backed by the identity store. Browser-cookie writes require same-origin and CSRF validation. Development tokens are disabled in production.

Source: apps/api/src/server.js (lines 360, 387)

Tests: test/auth-security.test.js, test/auth-cookies.test.js, test/api.test.js

### Site selector reconciliation

siteIdFor compares route, x-virgoscorpio-hub-site-id, query, and body selectors; rejects duplicated/conflicting/malformed selectors; resolves an explicit or membership-derived site; and verifies membership before route-specific capability checks.

Source: apps/api/src/server.js (lines 392, 397)

Tests: test/integration/tenant-isolation.integration.test.js

### Capability authorization

requireCapability delegates non-developer authorization to identity.authorizeSite. Some route families use path site IDs directly with this guard rather than siteIdFor; the route catalog calls out those differences for assessor verification.

Source: apps/api/src/server.js (lines 426, 431)

Tests: test/tenant-route-capabilities.test.js

### Own-content and collaboration authorization

Content read/edit scope and collaboration-document authorization include ownership, document type, site and active-session checks where applicable.

Source: apps/api/src/server.js (lines 351, 439, 450, 1766, 1793, 1872, 1895)

Tests: test/content-type-routes.test.js, test/collaboration-api.test.js, test/realtime-websocket.test.js

## 3. Route-family inventory

### 1. Health, readiness, metrics and static application surfaces

- Inventory ID: health-and-static
- Methods (family-level union): GET, HEAD
- Routes/flows: GET /health; GET /ready; GET /metrics; GET /platform; GET /admin; GET /assets/**
- Authentication: Mixed: health/readiness and selected static resources are public; metrics and admin surfaces have separate deployment/runtime controls.
- Tenant/site context: No ordinary tenant selector. These operational/static surfaces must not expose tenant records, secrets, or privileged diagnostics.
- Capabilities/controls: Operational access policy (deployment-specific)
- Data-access boundary: Process health and configured dependency state; Static assets
- Side effects: Read-only responses; no tenant writes are expected.
- Source: apps/api/src/server.js (lines 749, 756, 792)
- Test references: test/api.test.js, test/api.test.js
- Coverage characterization: **targeted**. Health and readiness behavior has automated coverage; deployment-specific metrics/admin exposure and reverse-proxy policy require environment review.

### 2. Authentication, MFA, password recovery, federation and sessions

- Inventory ID: authentication-and-session
- Methods (family-level union): GET, POST, DELETE
- Routes/flows: /api/v1/auth/**
- Authentication: Public credential/callback flows plus authenticated session-management flows.
- Tenant/site context: Primarily account/session scoped. Invitation acceptance and identity-provider state must remain bound to the intended site/issuer and one-time state.
- Capabilities/controls: Account/session lifecycle policy, Site association for invitation acceptance
- Data-access boundary: users; auth_sessions; MFA challenges/secrets; invitations; OIDC/SAML state; email/outbox delivery records
- Side effects: Session creation/revocation; Cookie and CSRF state changes; One-time invitation and federation state consumption; Email/outbox delivery
- Source: apps/api/src/auth-routes.js (lines 50, 199, 258)
- Test references: test/auth-security.test.js, test/auth-cookies.test.js, test/api.test.js
- Coverage characterization: **targeted**. Unit and HTTP tests cover important token/session controls. Exhaustive cross-site invitation, SAML/OIDC provider, recovery-token and stale-session adversarial review remains external.

### 3. Site discovery and site creation

- Inventory ID: site-directory
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/sites
- Authentication: Authenticated session; developer-preview behavior is separately constrained.
- Tenant/site context: Collection-level identity operation. Listing is actor-scoped; creation delegates ownership/bootstrap policy to the identity service.
- Capabilities/controls: Site membership/ownership policy, Developer-token restriction for site creation
- Data-access boundary: sites; site_memberships; identity/audit records
- Side effects: Site and owner-membership creation
- Source: apps/api/src/server.js (lines 1329, 1333)
- Test references: test/api.test.js, test/auth-security.test.js
- Coverage characterization: **targeted**. F1.29 merged through PR #142 at main debd9890b94b55dd3b9496d80f49a9a7c00615fb. Site creation now commits the site row, initial site-owner membership and correlated site.created audit event atomically using shared transaction/audit helpers. The route passes requestId into the service and no longer inserts a duplicate route-level event. Exact-main workflow #609 passed 95/95 live PostgreSQL/Memgraph tests with zero skips, including audit-trigger rollback/retry. This is targeted maintainer/automation evidence; no formal PR review submission was recorded. Owner handoff, concurrent ownership changes, creation abuse and independent assessment remain open.

### 4. Site membership administration and invitations

- Inventory ID: site-membership-administration
- Methods (family-level union): GET, POST, DELETE
- Routes/flows: /api/v1/sites/{siteId}/members; /api/v1/sites/{siteId}/members/{userId}; /api/v1/sites/{siteId}/invitations
- Authentication: Authenticated session.
- Tenant/site context: Each path site ID is reconciled through the shared siteIdFor helper against the x-virgoscorpio-hub-site-id header, siteId query values, and JSON body siteId on writes. The resolver validates UUID shape and selector consistency with its generic membership precheck explicitly disabled for this route family; the established site:manage capability check remains the authorization gate and preserves the existing forbidden response contract. Conflicting or duplicated selectors fail with a site-context 400 before identity-store operations.
- Capabilities/controls: site:manage
- Data-access boundary: site_memberships; users; invitations; mail/outbox; audit events; authorization invalidation; transactional invitation-acceptance audit
- Side effects: Add/remove membership; Create invitation; Mail delivery intent; Audit and session/realtime authorization invalidation; Consume invitation and create membership in one PostgreSQL transaction; Site-scoped invitation-acceptance audit; Post-commit authorization invalidation
- Source: apps/api/src/site-membership-routes.js (lines 34, 62, 80); apps/api/src/server.js (lines 1925)
- Test references: test/site-membership-routes.test.js, test/integration/tenant-membership-administration-isolation.integration.test.js, test/auth-security.test.js, test/site-invitation-audit-atomicity.test.js, test/integration/site-invitation-audit-atomicity.integration.test.js
- Coverage characterization: **targeted-selector-reconciliation-two-site-membership-and-invitation-lifecycle-with-atomic-audit**. Unit tests assert site-selector resolution before capability authorization. Live A/B integration rejects path/header/query/body conflicts for membership and invitation operations, compares membership/invitation/mail-outbox/audit snapshots, and preserves foreign-user non-disclosure. F1.29 site creation/initial-owner membership/site.created and F1.43 invitation upsert/mail-outbox/site.invitation_created now use existing transaction callbacks so local writes and correlated metadata-only audit events commit or roll back together. F1.43 merged through PR #182 at main 82ace7f0413842a9d92156f6d4be3692e3913ce5; issue #181 is CLOSED. The one-time invitation token is excluded from audit details. Exact-main workflow #715 passed all seven jobs. PR #182 has no formal review submission or inline thread; maintainer/automation evidence only. Independent reviews #14/#25 and broader role combinations, last-owner concurrency, active-stream revocation and abuse cases remain separate review work.

### 5. Design system, reusable components, templates, taxonomy, relationships, menus and AI policy

- Inventory ID: site-content-configuration
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/design-system; /api/v1/sites/{siteId}/reusable-components/**; /api/v1/sites/{siteId}/templates/**; /api/v1/sites/{siteId}/terms/**; /api/v1/sites/{siteId}/relationships/**; /api/v1/sites/{siteId}/menus/**; /api/v1/sites/{siteId}/ai-policy
- Authentication: Authenticated session.
- Tenant/site context: Path-addressed configuration operations reconcile the route site against x-virgoscorpio-hub-site-id and siteId query selectors before the route-specific capability check. Bounded JSON writes reconcile body siteId after parsing and before domain validation or persistence. The shared resolver validates selector shape and agreement with its generic membership precheck disabled so each route preserves its established capability/error contract.
- Capabilities/controls: content:read, content:edit, site:manage
- Data-access boundary: site_design_systems; reusable_components; site_templates; taxonomy_terms; content_relationships; navigation_menus; site_ai_policies; outbox; audit
- Side effects: Versioned metadata/configuration writes; Relationship/taxonomy domain events; Graph projection work; Audit events
- Source: apps/api/src/server.js (lines 1236, 1340, 1366, 1371, 1420, 1447, 1512, 1570, 1646)
- Test references: test/tenant-route-capabilities.test.js, test/integration/tenant-isolation.integration.test.js, test/integration/postgres.integration.test.js, test/outbox-contract.test.js, test/identity-audit-queryable.test.js, test/integration/tenant-membership-administration-isolation.integration.test.js, test/reusable-component-audit-atomicity.test.js, test/integration/reusable-component-audit-atomicity.integration.test.js
- Coverage characterization: **path-header-query-and-write-body-selector-reconciliation-transactional-mutation-audit-atomicity-and-two-site-identifier-boundaries-f1-30-to-f1-40-merged**. Live PostgreSQL tenant-isolation tests exercise header/query conflicts for each configuration family, body conflicts for design-system/reusable-components/templates/menus/AI-policy writes, path-addressed delete selector checks and tenant snapshot comparisons. F1.30 merged through PR #144 at main 67e9440b9c543e69a46bba8cbb25a9d2329f3502; exact-main workflow #612 passed 96/96 PostgreSQL/Memgraph tests with zero skips, Node 22/24 matrices, migrations 18/18 plus 18/18 idempotent re-entry, Playwright 9/9, CodeQL, signed mainline attestation and evidence consolidation. F1.31 merged through PR #147 at main 63e4db46426c606b73fea6d03bc4ea6a54219f16; exact-main workflow #622 passed 97/97 PostgreSQL/Memgraph tests with zero skips, Node 22/24 matrices, 18 fresh and 18 idempotent migrations, Playwright 9/9, CodeQL, signed mainline attestation and evidence consolidation. F1.32 relationship.created/deleted audit inserts use the existing transaction client before COMMIT, so an audit failure rolls back the relationship row and durable outbox event. The two-site regression covers create/delete rollback and safe retry, actor/request/site/outbox correlation, cross-site endpoint, invalid endpoint type/metadata, duplicate conflict and an unchanged Site A control. The initial exact-head PR run #625 hit three unrelated fixture HTTP 429 assertions after the new regression passed; RATE_LIMIT_MAX_REQUESTS=1000 is set only for that test server. Corrected exact-head PR workflow #627 passed Node 22/24, PostgreSQL/Memgraph 98/98 with zero skips, migrations, Playwright 9/9, CodeQL and evidence consolidation. Documentation-only head e4df53785c51f7ab4b81532421f278ed4cb4c658 passed exact-head push #628 and PR #629 with the same functional jobs and 98/98 live database tests. PR #149 merged on 15 November 2026 at main 9230177d3155d9ff9134180a67ed69203d618c0f. Exact-main workflow #630 passed all seven jobs: Node 22/24 each 608 Hub and 94 EnginEx; PostgreSQL/Memgraph 98/98 zero skips; 18 fresh/18 idempotent migrations; Playwright 9/9; CodeQL; signed mainline attestation; evidence consolidation. GitHub records no formal human review; this is maintainer/automation evidence. F1.33 is a maintainer candidate tracked by issue #150 on main 9230177d3155d9ff9134180a67ed69203d618c0f. The site AI-policy PUT upsert and correlated ai.policy_updated event now execute on the same withTransaction client; the existing pool-backed audit default is unchanged. The two-site regression injects a site/action-scoped audit failure, proves Site B policy rollback and no audit row, retries once and verifies policy plus actor/site/request/details correlation, checks Site A remains unchanged, and asserts selector, capability, quota, provider allowlist and external-content denials have no side effects. Trigger/function names are unique and cleaned in finally. Local npm run check passed 608 tests (605 pass, zero failures, three Windows-specific platform skips); artifact verifier passed 235 required paths / 246 JavaScript files; both npm audit modes found zero vulnerabilities; inventory generation and --check pass at 27 families / 78 routes / 21 source files / 43 test references. Local live PostgreSQL/Memgraph was NOT RUN because DATABASE_URL and VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION are absent. Corrected exact-current-head push workflow #633 (run 43664467084) and PR workflow #634 (run 43664470029) both passed all functional jobs on 3228f66fc9cdeb8fc69367bc1c8a457d722b9b15. Node.js 22.23.4 and 24.22.1 each passed 608/608 Hub and 94/94 EnginEx tests with zero skips; PostgreSQL/Memgraph passed 99/99 with zero skips, including the ai.policy_updated audit-trigger rollback/retry regression; 18/18 fresh migrations and 18/18 idempotent re-entry checks passed; Playwright 9/9; CodeQL; and candidate evidence consolidation passed. Branch-only dependency/SBOM attestation skipped as designed for non-mainline workflows. Initial runs #631/#632 failed because generated inventory outputs were stale after source/catalog changes; docs-only commit 3228f66 regenerated them and current-head validation is green. F1.40 reusable-component POST/PUT/DELETE audit atomicity is merged through PR #172; exact-main workflow #693 passed 111/111 live PostgreSQL/Memgraph tests with zero skips, including the two-site boundary and create/update/delete audit-failure rollback/retry regression. This is maintainer/automation evidence, not independent security acceptance; remaining presentation, cache invalidation and role combinations require assessor review.

### 6. Custom content-type registry and records

- Inventory ID: content-type-registry-and-records
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/content-types; /api/v1/content-types/{slug}/records; /api/v1/content-types/{slug}/records/{recordId}
- Authentication: Authenticated session.
- Tenant/site context: Site resolved by siteIdFor; shared content-read policy is supplied by the API composition layer. Record list/detail storage receives the selected site and actor ownership scope.
- Capabilities/controls: site:manage, content:create, content:read, content:read:own, content:edit, content:edit:own
- Data-access boundary: content_type_definitions; content records via content store; Git-managed configuration definitions
- Side effects: Advisory-lock-protected definition version updates; Record create/update/delete operations
- Source: apps/api/src/content-type-routes.js (lines 111, 179, 253); packages/db/src/postgres-store.js (lines 558, 566, 576); database/migrations/0001_initial.sql (lines 41)
- Test references: test/content-type-routes.test.js, test/content-owner-store.test.js, test/api.test.js, test/integration/tenant-content-object-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-same-slug-registry-and-record-isolation-f1.25-concurrency-and-role-denial-merged-main**. Merged mainline A/B coverage creates same-slug admin definitions in two sites, creates the Site B definition and record through the API, proves registry/list/detail responses use only Site B definitions and records, hides a foreign Site A record ID as 404 without disclosure, and rejects conflicting query/body site selectors before mutation. Unit tests verify content:read:own list/detail owner filters at storage boundaries. F1.25 merged via PR #130 at main 9f8e612c883a78d322d2086b4b08d3438b0b9231; exact-head workflows #575/#576 and docs-final #577/#578 passed 92/92 live PostgreSQL/Memgraph tests each, proving Site B editor site:manage denial-before-persistence and same-site concurrent same-slug version progression to versions 2/3 while preserving Site A version 1. Node 22/24 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3 and dependency audits passed. No formal review submission; maintainer/automation evidence only. Independent review must still enumerate all methods, publication/role combinations, search/count behavior, and all mutation/side-effect paths.

### 7. Pages, drafts, revisions, restore and editorial workflow

- Inventory ID: pages-revisions-and-workflow
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/pages; /api/v1/pages/drafts; /api/v1/pages/{pageId}; /api/v1/pages/{pageId}/revisions; /api/v1/pages/{pageId}/restore/{version}; /api/v1/pages/{pageId}/{action}; /api/v1/content/{contentId}/{action}
- Authentication: Authenticated session.
- Tenant/site context: Site selected through siteIdFor. Page/object reads and writes pass site plus content ID to the content store. Workflow operations use route-specific capabilities and own-content exceptions only where explicitly supported.
- Capabilities/controls: content:read, content:read:own, content:edit, content:edit:own, content:submit, content:approve, content:publish, content:archive
- Data-access boundary: content records; content revisions; published snapshots; workflow state; outbox/audit
- Side effects: Content/revision writes; Restore and workflow transitions; Publication and outbox events
- Source: apps/api/src/server.js (lines 1758, 1763, 1844, 1858, 1869, 1886); packages/db/src/postgres-store.js (lines 154)
- Test references: test/integration/tenant-content-object-isolation.integration.test.js, test/api.test.js, test/content-owner-store.test.js, test/content-draft-audit.test.js, test/content-draft-audit-route.test.js, test/integration/content-draft-audit.integration.test.js, test/integration/content-restore-audit-atomicity.integration.test.js
- Coverage characterization: **targeted-two-site-plus-authenticated-revision-restore-audit-rollback-retry**. The A/B suite reuses foreign page IDs against selected read/revision/collaboration/restore/publish paths and snapshots relevant state. F1.44 runtime PR #184 passes the existing onDraftSaved callback from authenticated revision restore into store.saveDraft(), keeping the metadata-only content.draft_saved event on the content/revision/workflow/outbox transaction queryable. Test/documentation PR #186 adds the live authenticated restore-route PostgreSQL trigger-failure rollback/retry regression and a database URL safety guard; it passed 2/2 focused tests with zero skips against disposable PostgreSQL 18 after all 18 migrations applied. PR #186 merged at current main 68cfd2f0e05e5c43ccb617770124a39c9226db9c; exact-main workflow #721 passed 120/120 live PostgreSQL/Memgraph/Redis tests with zero skips, including the new regression. This is maintainer/automation evidence, not independent security approval. Other workflow actions, own-content exceptions, authorization combinations and concurrency still require independent coverage.

### 8. Durable collaboration operations and synchronization

- Inventory ID: collaboration-rest
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/pages/{pageId}/collaboration/operations; /api/v1/pages/{pageId}/collaboration/sync
- Authentication: Authenticated, active session.
- Tenant/site context: Site resolved at the API layer; document lookup binds site and content ID, then validates document type, edit capability and owner rules.
- Capabilities/controls: content:edit, content:edit:own
- Data-access boundary: content documents; collaboration operations/cursors; document publisher/realtime topics
- Side effects: Durable operation append; Sequence and cursor updates; Site/document-scoped publication
- Source: apps/api/src/server.js (lines 351, 439, 1778)
- Test references: test/collaboration-api.test.js, test/realtime-websocket.test.js, test/integration/tenant-content-object-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-and-unit**. Selected foreign document IDs and stale/invalid collaboration cases are covered; replay, reconnect, membership revocation during active collaboration and all cross-instance paths remain reviewer work.

### 9. AI generation, governance and task history

- Inventory ID: ai-generation-and-tasks
- Methods (family-level union): GET, POST, DELETE
- Routes/flows: /api/v1/ai/**
- Authentication: Authenticated session for generation/task history; task capabilities depend on configured stores and provider state.
- Tenant/site context: AI operations resolve optional/required site context through ensureSiteCapabilityForAI and apply the selected site's policy, quotas, classification and usage controls.
- Capabilities/controls: ai:use, site:manage (AI policy management)
- Data-access boundary: site_ai_policies; AI task metadata and encrypted payloads; usage/quota reservations; provider adapters
- Side effects: Task enqueue/claim/complete; Provider invocation; Usage/audit records; Cancellation and lease transitions
- Source: apps/api/src/server.js (lines 456, 1682); apps/api/src/ai-task-routes.js (lines 8, 9, 104)
- Test references: test/ai-task-routes.test.js, test/ai-task-queue.test.js, test/ai-queue-worker.test.js, test/api.test.js
- Coverage characterization: **targeted**. Tenant-bound task cursors, payload AAD, policy and provider guards have focused tests; every selected-page/context/provider path and concurrent quota isolation require broader review.

### 10. Authenticated media listing and upload

- Inventory ID: authenticated-media
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/media; /api/v1/media/uploads
- Authentication: Authenticated session.
- Tenant/site context: Selected site passed through siteIdFor before media:manage checks and store access.
- Capabilities/controls: media:manage
- Data-access boundary: media metadata; local/S3 object storage
- Side effects: Object write followed by metadata write; Compensating object cleanup on metadata failure
- Source: apps/api/src/server.js (lines 1731, 1736); packages/media/src/local-store.js (lines 102)
- Test references: test/api.test.js, test/security-boundaries.test.js, test/integration/tenant-library-media-isolation.integration.test.js
- Coverage characterization: **targeted**. File signature and storage safety tests exist; remote provider IAM, object key collisions, deletion/reconciliation and media-specific two-site byte access require independent/provider testing.

### 11. Site-scoped library assets, versions, downloads and optimization

- Inventory ID: authenticated-library
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/library/items; /api/v1/sites/{siteId}/library/items/{assetId}; /api/v1/sites/{siteId}/library/items/{assetId}/versions; /api/v1/sites/{siteId}/library/items/{assetId}/download; /api/v1/sites/{siteId}/library/items/{assetId}/optimize
- Authentication: Authenticated session.
- Tenant/site context: Route site is supplied to siteIdFor and library:manage is required before store operations.
- Capabilities/controls: library:manage
- Data-access boundary: library_assets; library_asset_versions; media_variants; local or cloud object storage; malware scan state
- Side effects: Upload/replace object bytes; Metadata/version writes; Optimization variants; Quarantine/publication flags; Audit
- Source: apps/api/src/library-routes.js (lines 22, 23); packages/library/src/file-store.js (lines 182, 240)
- Test references: test/library-routes.test.js, test/release-hardening.test.js, test/integration/tenant-library-media-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-and-unit**. A/B tests cover selected metadata/history/download/optimize/delete attempts and local bytes. Provider-specific storage, legacy assets, every variant type and live malware corpus remain open.

### 12. Public pages, search, product catalogs and membership-plan catalogs

- Inventory ID: public-content-search-and-catalog
- Methods (family-level union): GET
- Routes/flows: /public/{siteSlug}/pages/{slug}; /api/v1/public/{siteSlug}/search; /api/v1/public/{siteSlug}/products; /api/v1/public/{siteSlug}/membership-plans; /api/v1/public/sites/{siteId}/products/**; /api/v1/public/sites/{siteId}/membership-plans
- Authentication: Public/anonymous.
- Tenant/site context: Site derived from a slug or explicit public site identifier. Published/active state and site predicates are the authorization boundary; anonymous does not mean cross-site.
- Capabilities/controls: Public publication/visibility policy
- Data-access boundary: sites; published content snapshots; search index/query data; commerce_products; membership_plans
- Side effects: Read-only responses; caches/public query paths must preserve site and visibility scope.
- Source: apps/api/src/server.js (lines 846, 871, 879, 1207, 1222)
- Test references: test/api.test.js, test/integration/tenant-commerce-isolation.integration.test.js, test/integration/tenant-public-catalog-isolation.integration.test.js, test/integration/tenant-public-query-loop-isolation.integration.test.js
- Coverage characterization: **targeted-public-catalog-search-query-loop**. Live PostgreSQL A/B coverage verifies public search, slug- and UUID-based product and membership catalogs, foreign-site product detail hiding, and rendered public-page query loops scoped to each site?s published posts. Query-loop output excludes foreign-site, draft, and soft-deleted posts. Shared-cache invalidation/revocation and independent adversarial review remain separate gates.

### 13. Public media, library assets and public variants

- Inventory ID: public-media-and-library-assets
- Methods (family-level union): GET
- Routes/flows: /media/{assetId}; /library/public/{assetId}; /library/public/{assetId}/variants/{variantKey}
- Authentication: Public/anonymous.
- Tenant/site context: No caller-selected site. Public byte routes resolve through store-level current visibility and lifecycle predicates; bytes are checked for stored length/hash and variants for MIME signature and parent category. S3 media URLs are API-mediated; direct public CDN URLs are disabled pending a verified invalidation contract.
- Capabilities/controls: Public asset publication flag and active/quarantine state
- Data-access boundary: media assets and object storage; library_assets; media_variants
- Side effects: Read-only byte delivery; successful responses use private, no-store and recheck database visibility on each request. Shared-cache/CDN overrides remain deployment-review items.
- Source: apps/api/src/server.js (lines 838, 854, 862); packages/library/src/file-store.js (lines 150, 226)
- Test references: test/release-hardening.test.js, test/integration/tenant-library-media-isolation.integration.test.js, test/security-boundaries.test.js
- Coverage characterization: **targeted-two-site-revocation-and-no-store**. The live two-site integration suite reads a public library asset and variant, revokes visibility through the authorized metadata route, and confirms the next origin request returns 404; it also verifies public media revocation and private, no-store success headers. S3 tests prove direct public CDN mode fails closed and objects are stored private/no-store. The tests do not validate reverse-proxy/CDN overrides, provider IAM/bucket policy, purging legacy direct-CDN URLs already issued before this change, or every asset/variant type; those remain deployment and independent-review work.

### 14. Commerce products, orders, checkout, idempotency and refunds

- Inventory ID: commerce-products-orders-checkout
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/products/**; /api/v1/sites/{siteId}/commerce/orders/**; /api/v1/sites/{siteId}/commerce/checkout; /api/v1/sites/{siteId}/commerce/orders/{orderId}/refunds
- Authentication: Authenticated session; checkout additionally binds customer/order ownership and provider outcome.
- Tenant/site context: Site context is resolved for selected route operations; SQL and order/idempotency predicates must retain site, customer and object identity.
- Capabilities/controls: commerce:read, commerce:manage
- Data-access boundary: commerce_products; orders/order_items; inventory and stock reservations; checkout idempotency records; Stripe provider session/refund state
- Side effects: Order create/update; Stock reserve/commit/release; Stripe checkout/refund requests; Webhook/reconciliation state changes
- Source: apps/api/src/commerce-routes.js (lines 31, 44, 51, 272)
- Test references: test/commerce-routes.test.js, test/checkout-idempotency.test.js, test/checkout-reconciliation.test.js, test/integration/tenant-commerce-isolation.integration.test.js, test/integration/tenant-checkout-idempotency-isolation.integration.test.js, test/integration/stripe-refund-audit-atomicity.integration.test.js
- Coverage characterization: **targeted-two-site**. A/B tests cover selected product/order access and idempotency-key reuse/foreign product IDs. Full concurrency, provider ambiguous outcomes, all refund transitions and live Stripe lifecycle are not certified. F1.41 merged through PR #176 at main eb6fe4c8672dadd98892a62062ecf718ce9393b6 from implementation commit c60c0448de676e06f7b22b399107a8e61674b8af. The site-scoped trigger-injection PostgreSQL regression proves provider-response refund binding/status, order transition and commerce.refund_requested audit share one transaction; audit failure rolls back local state and same-key retry reconciles the stable Stripe idempotency key exactly once. Local dedicated PostgreSQL fixture passed 4/4 with zero skips. Exact-head #702 and exact-main #703 passed; exact-main live PostgreSQL/Memgraph passed 115/115 with zero skips. Stripe is stubbed, so live Stripe lifecycle acceptance remains open. Issue #175 remains OPEN for maintainer close-out; PR #176 recorded zero formal reviews and zero inline review threads. Maintainer/automation evidence only, not independent review or production certification.

### 15. Membership plans, subscription checkout and public plan access

- Inventory ID: membership-plans-and-subscriptions
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/memberships/**; /api/v1/public/sites/{siteId}/membership-plans; /api/v1/public/{siteSlug}/membership-plans
- Authentication: Mixed: site plan administration/checkout requires authenticated actor; public plan catalog is anonymous.
- Tenant/site context: Plan operations use site-scoped predicates and memberships:manage. Provider subscription state must bind signed metadata to site, user and plan.
- Capabilities/controls: memberships:manage
- Data-access boundary: membership_plans; paid_memberships; provider subscription metadata; billing webhook receipts
- Side effects: Provider checkout/session creation; Membership/subscription state reconciliation; Webhook receipt/idempotency updates
- Source: apps/api/src/commerce-routes.js (lines 455, 462, 464); apps/api/src/server.js (lines 886)
- Test references: test/billing-webhook-tenant.test.js, test/commerce-routes.test.js, test/billing-webhook-tenant.test.js
- Coverage characterization: **targeted**. Provider metadata binding and selected state reconciliation are tested with doubles. Live provider-generated events and two-site database behavior remain open.

### 16. Community profiles, groups, feed and friendships

- Inventory ID: community-profiles-groups-feed
- Methods (family-level union): GET, POST, PUT, DELETE
- Routes/flows: /api/v1/sites/{siteId}/community/profile; /api/v1/sites/{siteId}/community/groups/**; /api/v1/sites/{siteId}/community/feed; /api/v1/sites/{siteId}/community/friends/**
- Authentication: Authenticated site member.
- Tenant/site context: Route site passed to siteIdFor and member/policy checks; resource and recipient lookups should include site ID.
- Capabilities/controls: Site membership, content:create, community:moderate (group member administration)
- Data-access boundary: social profiles; social groups and memberships; activities/feed; social friendships
- Side effects: Group membership changes; Friendship transitions; Feed/activity writes
- Source: apps/api/src/platform-routes.js (lines 228, 230, 297, 401)
- Test references: test/community-workflows.test.js, test/integration/tenant-community-object-isolation.integration.test.js, test/tenant-route-capabilities.test.js, test/integration/community-feed-privacy.integration.test.js
- Coverage characterization: **targeted-two-site-group-privacy-comment-parent-join-idempotency-state-and-side-effect-isolation**. F1.48 adds disposable PostgreSQL coverage for private/hidden group posts with default and caller-broadened visibility, public-group and non-group visibility controls, private-group comments, same-site and non-deleted parent requirements, caller-supplied scope mismatch denial, nested comment ancestry, and legacy comments whose stored scope widens or moves away from a private-group parent. Feed reads and comment writes reuse shared visibility predicates and validate every ancestor for site, deletion, exact group/visibility scope, actor visibility, and a top-level non-comment root; cyclic or malformed parent chains fail closed. Denied writes preserve activity, group, membership, audit-event and outbox snapshots. Existing tenant-community-object-isolation.integration.test.js also snapshots social_activities for cross-site/no-side-effect checks. Profile privacy and broader adversarial/provider/realtime coverage remain separate. F1.51 reproduces and fixes private-group join idempotency: an existing active member remains active with the stored role across repeated joins; existing pending private-group requests remain pending; banned members remain banned and receive the existing generic 403; first-time private-group joins remain pending; and public-group joins remain active. The shared two-site community snapshot includes groups, group memberships, conversations, members, messages, blocks, reports, friendships, activities, notifications, outbox events and moderation actions. Before/after assertions prove retries do not create duplicate notification/outbox or other community side effects and leave both sites at the original fixture state. The unmerged F1.52 candidate adds maintainer-authored live PostgreSQL coverage for friendship acceptance after requester lifecycle changes: an active same-site requester remains acceptable, but a requester disabled after creating a pending request receives the existing generic non-disclosing 404 when the addressee attempts acceptance. The test confirms requester identifiers/profile details are not disclosed and Site A/Site B community snapshots, including the still-pending friendship, remain unchanged after denial. This is maintainer-authored regression coverage, not an exhaustive friendship/group lifecycle review or independent adversarial assessment.

### 17. Community conversations, messages, blocks, reports, moderation and notifications

- Inventory ID: community-conversations-moderation-notifications
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/community/conversations/**; /api/v1/sites/{siteId}/community/blocks/**; /api/v1/sites/{siteId}/community/reports/**; /api/v1/sites/{siteId}/community/notifications/**; /api/v1/sites/{siteId}/community/moderation/**
- Authentication: Authenticated site member; moderation actions require stronger capability.
- Tenant/site context: Workflow helper extracts path site, invokes siteIdFor and binds conversation, recipient, message and report lookup to the same site.
- Capabilities/controls: Site membership, community:moderate
- Data-access boundary: social conversations and members; messages; blocks/friendships; reports/moderation actions; notifications
- Side effects: Message creation/read markers; Report/moderation transitions; Notification fan-out/read state
- Source: packages/community/src/workflows.js (lines 21, 375); apps/api/src/platform-routes.js (lines 401)
- Test references: test/community-workflows.test.js, test/integration/community-workflows.integration.test.js, test/integration/tenant-community-object-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-active-recipient-direct-message-and-friendship-no-side-effects**. Existing A/B cases cover selected conversation/message/block/report/moderation/notification access and side effects. F1.49 adds live PostgreSQL coverage for POST /community/conversations: a Site B-only actor using a Site A-only recipient ID receives the existing non-disclosing 404 before the conversation transaction begins; deep before/after snapshots for both sites cover conversations, members, messages, notifications and the complete shared community-state projection; a same-site Site B create/reuse positive control returns the existing conversation without duplicate rows or notification fan-out. Complete workflow state transitions, other recipient variants, event fan-out outside the direct-create transaction, and independent adversarial/provider/realtime review remain separate. F1.50 adds a live PostgreSQL A/B regression for POST /api/v1/sites/{siteId}/community/friends/{userId}. Site B retains membership rows for invited and disabled users; the route must reject both, and foreign-site recipients, with the existing non-disclosing 404 before any friendship is written. Deep Site A/Site B snapshots prove denied attempts do not modify friendships or other community state. An active same-site recipient remains a positive control and produces one pending friendship. F1.52 adds the requester-lifecycle acceptance case: after an active requester creates a pending friendship, disabling that requester before acceptance yields the existing generic non-disclosing 404 and leaves both site snapshots unchanged. F1.53 closes the friendship-create stale-preflight race. The existing preflight remains for early denial, while the final parameterized INSERT ... SELECT materializes and locks both participant user rows in UUID order, then every same-site membership row in user/role order, and requires both accounts to be active with at least one site membership. Membership existence is checked with EXISTS so multiple role rows cannot multiply the INSERT source rows or cause an ON CONFLICT cardinality error. Deterministic live PostgreSQL regressions revoke either participant's account or membership immediately before insertion, prove concurrent status/membership changes wait on the participant row locks and are observed after commit, retain the blocked-state upsert contract, and compare full Site A/Site B community snapshots. The friendship route implementation is in apps/api/src/platform-routes.js (friendRequest), while conversation workflows remain in packages/community/src/workflows.js. Wider friendship state-machine coverage and independent adversarial/provider/realtime review remain separate.

### 18. Plugin registry, approvals, security review, activation and invocation

- Inventory ID: plugin-registry-and-lifecycle
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/plugins; /api/v1/plugins/register; /api/v1/plugins/{pluginId}/{action}
- Authentication: Authenticated session.
- Tenant/site context: Site resolved by siteIdFor; plugin lookup and all mutations bind both site ID and plugin ID.
- Capabilities/controls: plugins:read, plugins:manage
- Data-access boundary: plugin_installs; approval and security-review metadata; artifact/SBOM/provenance/signature metadata; plugin runner boundary
- Side effects: Registration/update; Capability approval; Security review state; Activation/disable/invocation
- Source: apps/api/src/server.js (lines 1942, 1948, 1985)
- Test references: test/security-boundaries.test.js, test/security-boundaries.test.js, test/integration/tenant-isolation.integration.test.js, test/integration/tenant-plugin-registry-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-lifecycle**. Live PostgreSQL A/B coverage verifies site-scoped plugin listing, non-disclosing foreign plugin IDs across approve/security-review/activate/disable/invoke, and no mutation or invocation records after denied cross-site actions. Conflicting registration site selectors are rejected before writes. The positive control approves a Site B plugin, requires a different Site B administrator for security review, and confirms activation/invocation remain fail-closed while execution is disabled. Actual isolated runner sandbox behavior and independent review remain external release gates.

### 19. Site firewall rules and shared policy cache

- Inventory ID: firewall-rules
- Methods (family-level union): GET, POST, DELETE
- Routes/flows: /api/v1/sites/{siteId}/security/firewall-rules; /api/v1/sites/{siteId}/security/firewall-rules/{ruleId}
- Authentication: Authenticated session.
- Tenant/site context: Path site is resolved through siteIdFor; site-specific rules are capability-guarded. GET deliberately includes global rules where site_id is NULL.
- Capabilities/controls: security:manage
- Data-access boundary: firewall_rules; shared firewall cache; site_security_events
- Side effects: Rule create/delete; Cache invalidation; Security event write
- Source: apps/api/src/platform-routes.js (lines 489)
- Test references: test/tenant-route-capabilities.test.js, test/tenant-route-capabilities.test.js
- Coverage characterization: **targeted**. Denied capability is tested before tenant data access. Global/site precedence, cross-site rule visibility and cache invalidation require reviewer verification.

### 20. Cloud connection configuration and provider probes

- Inventory ID: cloud-connections
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/sites/{siteId}/cloud/connections; /api/v1/sites/{siteId}/cloud/connections/{connectionId}/{test|disable}
- Authentication: Authenticated session.
- Tenant/site context: Site selected by siteIdFor; connection reads, tests, updates and disable operations must bind site ID and connection ID.
- Capabilities/controls: cloud:manage
- Data-access boundary: cloud_connections; secret-manager credential references; object-storage provider adapters
- Side effects: Configuration writes; Read-only provider probe; Connection status/health timestamp update
- Source: apps/api/src/platform-routes.js (lines 544)
- Test references: test/release-hardening.test.js, test/security-boundaries.test.js, test/tenant-route-capabilities.test.js, test/integration/tenant-isolation.integration.test.js
- Coverage characterization: **targeted**. Live PostgreSQL coverage verifies Site A/B listing isolation, non-disclosing 404s for foreign test/disable IDs, selector mismatch rejection with unchanged row state, and Site B positive controls using deliberately unresolved vault:// references so no provider calls occur. Real provider lifecycle, least-privilege provider IAM, egress/SSRF and live secret-manager behavior remain unverified.

### 21. Mega-menu configuration

- Inventory ID: mega-menus
- Methods (family-level union): GET, POST, PUT, DELETE
- Routes/flows: /api/v1/sites/{siteId}/mega-menus; /api/v1/sites/{siteId}/mega-menus/{slug}
- Authentication: Authenticated session.
- Tenant/site context: Path site is reconciled with optional header, query and JSON-body selectors through siteIdFor before route-specific authorization. GET requires content:read; create/update/delete require site:manage. Collection reads, versioned updates and deletes are scoped by site_id, with site/slug as the composite navigation key.
- Capabilities/controls: content:read, site:manage
- Data-access boundary: navigation_menus
- Side effects: Create/update/delete versioned navigation configuration; Metadata-only navigation.mega_menu_created, navigation.mega_menu_updated and navigation.mega_menu_deleted identity audit events
- Source: apps/api/src/platform-routes.js (lines 177, 194, 785, 837, 870)
- Test references: test/tenant-route-capabilities.test.js, test/api.test.js, test/integration/tenant-mega-menu-isolation.integration.test.js, test/mega-menu-audit-atomicity.test.js, test/integration/mega-menu-audit-atomicity.integration.test.js
- Coverage characterization: **targeted-two-site-plus-transactional-audit-rollback**. Live PostgreSQL A/B route tests cover scoped listing, create, versioned update and delete with the same slug present in both sites. Foreign-site list/update/delete attempts and conflicting header/query/body selectors are rejected before mutation; snapshots prove both tenants remain unchanged after denial. The merged PR #92 regression races two updates with the same expected version and requires exactly one success, one version conflict, one version increment and a final row matching the winning request; the Site B same-slug row remains unchanged. F1.45 adds metadata-only identity audit events for create/update/delete on the same transaction queryable; unit tests prove callback ordering, fail-closed audit availability, stale-version behavior and rollback/retry for all three actions, while the live PostgreSQL route test injects audit_events trigger failures and proves database rollback plus exactly-one-event retry. Consumer rendering/cache invalidation, every presentation variant and independent adversarial review remain separate gates. F1.45 specifically validates the /mega-menus route family; the separate regular /menus route is tracked independently in the navigation-menus family.

### 22. Site navigation-menu configuration

- Inventory ID: navigation-menus
- Methods (family-level union): GET, POST, PUT, DELETE
- Routes/flows: /api/v1/sites/{siteId}/menus; /api/v1/sites/{siteId}/menus/{slug}
- Authentication: Authenticated session.
- Tenant/site context: The path site is reconciled with optional header, query and JSON-body selectors before route authorization. GET requires content:read; create/update/delete require site:manage. Every read and mutation is scoped by site_id; update uses the existing expected-version condition.
- Capabilities/controls: content:read, site:manage
- Data-access boundary: navigation_menus
- Side effects: Create/update/delete versioned site navigation-menu configuration; Metadata-only navigation.menu_created, navigation.menu_updated and navigation.menu_deleted identity audit events commit on the same transaction queryable as the menu mutation.
- Source: apps/api/src/server.js (lines 1570, 1577, 1613)
- Test references: test/tenant-route-capabilities.test.js, test/integration/navigation-menu-audit-atomicity.integration.test.js, test/integration/tenant-navigation-menu-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-same-slug-crud-plus-audit-no-side-effects**. The route-capability suite verifies site:manage authorization before tenant data access. The F1.46 dedicated PostgreSQL integration injects audit_events trigger failures for create, update and delete, verifies the menu mutation and audit row roll back together, then verifies safe retry commits exactly one metadata-only correlated event; stale updates preserve 409 without audit and missing deletes preserve 404 without audit. The F1.47 two-site PostgreSQL regression uses identical slugs in Site A and Site B, an A-only actor, non-disclosing cross-site list/update/delete denials, menu and navigation-audit snapshots proving denied requests have no side effects, and positive Site A CRUD while preserving Site B state. Selector conflicts remain covered by tenant-isolation.integration.test.js. Cache/rendering behavior, broader role combinations and independent adversarial review remain separate gates.

### 23. Stripe billing webhook

- Inventory ID: stripe-webhook
- Methods (family-level union): POST
- Routes/flows: /api/v1/billing/stripe/webhook
- Authentication: Provider-signature authenticated; no browser/session principal.
- Tenant/site context: Tenant identity is bound through validated order/subscription metadata and database predicates, not a client-supplied site selector.
- Capabilities/controls: Valid timestamped Stripe signature, Event ID idempotency, Order or membership metadata binding
- Data-access boundary: billing_webhook_events; orders; stock reservations; paid_memberships
- Side effects: Payment/order transitions; Reservation commit/release; Subscription reconciliation
- Source: apps/api/src/server.js (lines 886, 889)
- Test references: test/billing-webhook-tenant.test.js, test/billing-webhook-tenant.test.js, test/billing-webhook-tenant.test.js
- Coverage characterization: **targeted-provider-double**. Signed event and metadata-binding regressions use test doubles. Provider-generated payloads and two-site PostgreSQL callback execution remain external acceptance.

### 24. Presence HTTP, SSE, realtime events and WebSocket

- Inventory ID: presence-and-realtime
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/sites/{siteId}/presence; /api/v1/sites/{siteId}/presence/heartbeat; /api/v1/sites/{siteId}/realtime/events; /api/v1/sites/{siteId}/realtime/ws (upgrade)
- Authentication: Authenticated persistent session; WebSocket additionally enforces same-origin and reauthorizes commands.
- Tenant/site context: Presence HTTP, SSE and WebSocket upgrade routes reconcile the path site against x-virgoscorpio-hub-site-id and siteId query selectors before realtime capability authorization. Heartbeat JSON bodies also reconcile an optional siteId after bounded parsing and before presence operations. The generic membership precheck is disabled so the existing requireRealtimeCapability control remains the authorization gate. Per-command/document authorization, active-session and distributed Redis scope checks remain separate.
- Capabilities/controls: Realtime capability policy, content:edit/content:edit:own for document collaboration
- Data-access boundary: presence leases; SSE/WebSocket subscriptions; Redis channels/keys; connection quotas; document operations
- Side effects: Presence lease create/renew/release; Stream fan-out; Authorization invalidation; Quota lease acquire/release
- Source: apps/api/src/server.js (lines 1236, 1240, 1242, 2117); packages/realtime/src/redis-presence.js (lines 64, 65, 66, 68, 78, 81, 111, 113, 124, 128, 138, 141, 146, 183, 185, 201, 212, 216, 217)
- Test references: test/realtime-tenant-isolation.test.js, test/realtime-websocket.test.js, test/redis-realtime.test.js, test/integration/redis-presence.integration.test.js, test/e2e/collaboration-postgres-multinode.spec.js
- Coverage characterization: **targeted-tenant-selector-and-cross-node-redis-pubsub-resubscription-hosted-validated**. Realtime tenant-isolation tests exercise conflicting header/query selectors for presence, SSE and WebSocket upgrades plus heartbeat body mismatch. Tests assert rejected upgrades create no subscriptions and rejected heartbeat mismatch leaves the existing presence lease unchanged. F1.26 merged in PR #131 at main 0748f56e01421d13121ec08f7bc036579e5406835. Exact PR-head #580/#581 and exact-main #582 all executed the real Redis 7.4 stop/restore scenario: both API bridges re-subscribed, a newly published site-scoped authorization invalidation reached the remote API node exactly once, only the revoked Site A socket closed before the test-only heartbeat, and Site B remained usable. Each hosted live DB/graph suite passed 92/92 with zero failures/skips; collaboration Playwright passed 4/4. The test proves a new event after reconnection, not replay/durable delivery of messages missed during outage. PostgreSQL remains authoritative and command/heartbeat reauthorization fallbacks remain required. PR #131 has no formal review submission; evidence is maintainer/automation only. Production Redis ACL/failover, independent deployment review and production distributed quota assessment remain open.

### 25. PostgreSQL outbox, delivery and worker execution

- Inventory ID: postgres-outbox-and-workers
- Methods (family-level union): WORKER
- Routes/flows: Non-HTTP processing flow.
- Authentication: System worker; not an end-user HTTP route.
- Tenant/site context: Canonical event envelope carries schema version, site scope/classification, actor/resource identity and correlation; consumers validate subscription/scope before delivery.
- Capabilities/controls: Worker identity and registered consumer subscription, Site-private/public/internal envelope classification
- Data-access boundary: outbox_events; outbox_deliveries; worker leases; consumer subscriptions
- Side effects: At-least-once delivery; Retry/dead-letter/replay; Projection and notification consumers
- Source: packages/db/src/outbox-worker.js (lines 7); apps/worker/src/outbox-worker.js (lines 60)
- Test references: test/outbox-contract.test.js, test/outbox-delivery.test.js, test/graph-projection-worker.test.js, test/integration/postgres.integration.test.js
- Coverage characterization: **targeted-integration**. Envelope validation and retry/replay behavior have tests; hostile event injection, tenant teardown, all consumers and replay against a live multi-site dataset need independent review.

### 26. Memgraph projection and graph rebuild

- Inventory ID: graph-projection-and-rebuild
- Methods (family-level union): WORKER, CLI
- Routes/flows: Non-HTTP processing flow.
- Authentication: System worker/rebuild operator.
- Tenant/site context: Projected graph nodes and relationships must carry site identity; query and rebuild paths must bind tenant plus aggregate/resource IDs and preserve version/tombstone ordering.
- Capabilities/controls: Worker/maintenance authorization and deployment controls
- Data-access boundary: Memgraph nodes and relationships; PostgreSQL source/outbox rows; projection version/tombstone state
- Side effects: Graph projection writes/deletes; Full or scoped rebuild
- Source: packages/graph/src/memgraph-store.js (lines 62, 76, 90, 100, 117, 123, 125, 128, 141, 147, 157, 171, 172); packages/graph/src/rebuild-projection.js (lines 164, 190, 212)
- Test references: test/memgraph-projector.test.js, test/graph-projection-worker.test.js, test/integration/memgraph.integration.test.js
- Coverage characterization: **targeted-integration**. Selected cross-site lookup and replay/rebuild behavior are tested. Forged envelopes, partition collisions, stale projection versions and site deletion cleanup require assessor review.

### 27. Redis presence and cross-instance realtime relay

- Inventory ID: redis-realtime-relay
- Methods (family-level union): SERVICE
- Routes/flows: Non-HTTP processing flow.
- Authentication: Service-to-service adapter used by authenticated API streams.
- Tenant/site context: Channel/key naming and payload validation carry site scope; no user-provided raw channel or record data should be trusted.
- Capabilities/controls: Redis service credentials and adapter configuration
- Data-access boundary: Redis presence leases/indexes; Pub/Sub channels; site-scoped invalidation envelopes
- Side effects: Cross-instance notification/fan-out; Lease expiry and invalidation
- Source: packages/realtime/src/redis-realtime.js (lines 32, 33, 36, 39, 43, 57, 62, 63, 84, 104, 105, 115, 248, 249, 251, 252, 269, 274, 299, 310, 342, 343, 349, 364, 394, 397, 416, 430, 437, 452, 460, 480, 501, 513, 537, 541, 560); packages/realtime/src/redis-presence.js (lines 64, 65, 66, 68, 78, 81, 111, 113, 124, 128, 138, 141, 146, 183, 185, 201, 212, 216, 217)
- Test references: test/redis-realtime.test.js, test/realtime-tenant-isolation.test.js, test/integration/redis-presence.integration.test.js, test/e2e/collaboration-postgres-multinode.spec.js
- Coverage characterization: **targeted-cross-instance-pubsub-reconnect-and-resubscription-hosted-main-validated**. Unit and integration tests cover selected site-scoped channels, envelope validation, authorization invalidation and Redis outage fallback. F1.26 merged via PR #131 at main 0748f56e01421d13121ec08f7b320fd7621499f4. Exact PR-head workflows #580/#581 and exact-main workflow #582 executed the real Redis 7.4 stop/restore scenario: both API bridges re-subscribed, a new site-scoped authorization invalidation reached the remote API node exactly once, the revoked Site A socket closed, and Site B remained usable. Each hosted live PostgreSQL/Memgraph suite passed 92/92 with zero failures/skips; collaboration Playwright passed 4/4. The test proves delivery of a new event after reconnect, not replay or durable delivery of events lost during outage. PostgreSQL command/heartbeat reauthorization remains the fallback. Production Redis ACL, cluster/failover, network partition, durable invalidation and independent operational review remain open. PR #131 has no formal review submission; maintainer/automation evidence only.

### 28. Local library object reconciliation and storage adapters

- Inventory ID: library-object-reconciliation
- Methods (family-level union): CLI
- Routes/flows: CLI: npm run reconcile:library
- Authentication: Local operator/maintenance process; not a public HTTP route.
- Tenant/site context: Database references include local library assets, historical versions and media variants. The reconciler defaults to dry-run, rejects traversal and never follows symlinks.
- Capabilities/controls: Local filesystem and PostgreSQL operator permissions, Explicit --apply required for deletion
- Data-access boundary: library_assets; library_asset_versions; media_variants; local filesystem or configured object-storage adapter
- Side effects: Dry-run reports orphan candidates; --apply deletes only eligible unreferenced local files.
- Source: packages/library/src/reconcile-local-objects.js (lines 35); scripts/reconcile-library-objects.js (lines 18)
- Test references: test/release-hardening.test.js, test/integration/tenant-library-media-isolation.integration.test.js
- Coverage characterization: **targeted-local-filesystem**. Local dry-run/traversal behavior is tested. Remote object storage, provider-side orphans, retention, concurrent reference creation and restore lifecycle are not covered by this reconciler test.

## 4. Mandatory independent-review work

1. Independently enumerate the deployed HTTP routes, methods, middleware, reverse-proxy rewrites, public assets, worker entry points and operational/admin paths. Compare that enumeration with this curated catalog and add omitted surfaces to the review report.
2. For each route/method, record authentication/session source, actor memberships/roles, all site selectors, tenant derivation, route capability and ownership policy, object lookup, SQL predicates/joins, transactions, cache keys, object-storage keys, event envelopes, provider calls and response redaction.
3. Build synthetic site A/site B fixtures with A-only, B-only, multi-site actors with differing capabilities, and privileged actors. Exercise list/read/create/update/delete/history/export/download, same-ID and foreign-ID cases, malformed/conflicting selectors and positive controls.
4. For denied operations, compare database rows, versions, audit, outbox/delivery, graph, cache, notification/realtime state, stored bytes and provider calls before/after. Include async replay, worker retries, reconnect and authorization revocation.
5. Record each test/procedure as pass, fail, not run or not applicable with rationale. Preserve exact environment, sanitized artifacts, limitations and findings privately where exploit detail is sensitive.
6. Populate artifacts/evidence/tenant-isolation-review.json only after an independent reviewer has completed the exact-commit review and accepted all issue #14 criteria. This generated inventory must never be copied into the formal evidence path as a substitute.

## 5. Release disposition

**Issue #14 remains OPEN / NOT PERFORMED.** This inventory is maintainer-prepared navigation and coverage planning only. It does not close the independent tenant/site isolation review, the broader security assessment in issue #25, or any release gate. VirgoScorpio Hub remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

No reviewer approval, risk acceptance, production readiness, release, publication, or deployment is inferred by this document.

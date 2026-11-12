# VirgoScorpio Hub 0.6.2 - Tenant-Isolation Route and Data-Access Inventory

> **MAINTAINER-GENERATED PREPARATION ONLY. NOT AN INDEPENDENT REVIEW, SECURITY OPINION, PASS, OR RELEASE EVIDENCE.**

Maintainer-prepared route, capability, data-access, and regression-test navigation inventory for independent tenant/site-isolation review issue #14.

## Status and provenance

- Status: MAINTAINER_PREPARED_NOT_INDEPENDENTLY_REVIEWED.
- Generated from the current working-tree implementation anchors and the catalog at docs/security/tenant-isolation-route-inventory.catalog.json.
- Implementation-source digest: 062e5af6cccdc1fdcb2705f5c2b46fc2b0fbf5b18109161ee0fd5163df2055d9 across 21 files.
- Referenced-test digest: 1d49969507b16a5e16f1b73ffa224c4362f03b68d73443a423283617689ff6c2 across 42 files.
- Inventory size: 27 route/flow families, 78 declared route patterns, 21 source files, and 42 test files.
- Regenerate with npm run security:tenant-inventory; CI checks freshness with node scripts/generate-tenant-isolation-route-inventory.js --check.

Curated, source-anchored navigation inventory; route patterns, capabilities, data-access notes and test limitations are maintainer-authored metadata, not proof of runtime behavior. F1.21/F1.22 membership and SSE regressions merged in PR #127 and passed exact-main #563. F1.23 request-correlated transactional invitation audit merged in PR #128; exact-main #570 passed 90/90 live PostgreSQL/Memgraph tests. F1.24 PostgreSQL trigger fault/retry regression merged in PR #129; exact-head #572/#573 and exact-main #574 passed 91/91 live tests. F1.25 content-type registry concurrency/role denial test increment merged in PR #130 at main 9f8e612c883a78d322d2086b4b08d3438b0b9231; exact-head #575/#576 and docs-final #577/#578 each passed 92/92 live PostgreSQL/Memgraph tests. These PRs were maintainer merged without formal review submissions; all evidence is maintainer/automation generated, not independent approval. F1.26 merged in PR #131 at main 0748f56e01421d13121ec08f7bc036579e5406835. Exact PR-head workflows #580/#581 and exact-main workflow #582 passed 92/92 PostgreSQL/Memgraph integration with zero failures/skips; Node 22/24 each passed 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 4/4, fresh migrations, main-only signed provenance/SBOM and evidence consolidation passed. PR #131 has no formal review submission; this remains maintainer/automation evidence, not independent approval. The test proves delivery of a new post-reconnect authorization event, not replay or durability of messages lost during outage. PostgreSQL remains authoritative and command/heartbeat reauthorization fallbacks remain essential. F1.27 is an active candidate in branch security/editorial-workflow-role-gates-2026-11-12 / issue #124: the same-site author own-content boundary is being applied to submit-review using the existing canEditContent helper, with a seeded-role matrix and no-side-effect workflow assertions. Exact-head live PostgreSQL/Memgraph validation is pending. Independent reviews #14/#25 remain outstanding; issue #23 remains OPEN / PARTIAL.

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

Source: apps/api/src/server.js (lines 359, 386)

Tests: test/auth-security.test.js, test/auth-cookies.test.js, test/api.test.js

### Site selector reconciliation

siteIdFor compares route, x-virgoscorpio-hub-site-id, query, and body selectors; rejects duplicated/conflicting/malformed selectors; resolves an explicit or membership-derived site; and verifies membership before route-specific capability checks.

Source: apps/api/src/server.js (lines 391, 396)

Tests: test/integration/tenant-isolation.integration.test.js

### Capability authorization

requireCapability delegates non-developer authorization to identity.authorizeSite. Some route families use path site IDs directly with this guard rather than siteIdFor; the route catalog calls out those differences for assessor verification.

Source: apps/api/src/server.js (lines 425, 430)

Tests: test/tenant-route-capabilities.test.js

### Own-content and collaboration authorization

Content read/edit scope and collaboration-document authorization include ownership, document type, site and active-session checks where applicable.

Source: apps/api/src/server.js (lines 350, 438, 449, 1662, 1684, 1763, 1780)

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
- Source: apps/api/src/server.js (lines 744, 751, 787)
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
- Source: apps/api/src/server.js (lines 1324, 1328)
- Test references: test/api.test.js, test/auth-security.test.js
- Coverage characterization: **targeted**. Identity unit and API coverage exists; owner handoff, concurrent ownership changes and creation abuse need independent assessment.

### 4. Site membership administration and invitations

- Inventory ID: site-membership-administration
- Methods (family-level union): GET, POST, DELETE
- Routes/flows: /api/v1/sites/{siteId}/members; /api/v1/sites/{siteId}/members/{userId}; /api/v1/sites/{siteId}/invitations
- Authentication: Authenticated session.
- Tenant/site context: Each path site ID is reconciled through the shared siteIdFor helper against the x-virgoscorpio-hub-site-id header, siteId query values, and JSON body siteId on writes. The resolver validates UUID shape and selector consistency with its generic membership precheck explicitly disabled for this route family; the established site:manage capability check remains the authorization gate and preserves the existing forbidden response contract. Conflicting or duplicated selectors fail with a site-context 400 before identity-store operations.
- Capabilities/controls: site:manage
- Data-access boundary: site_memberships; users; invitations; mail/outbox; audit events; authorization invalidation; transactional invitation-acceptance audit
- Side effects: Add/remove membership; Create invitation; Mail delivery intent; Audit and session/realtime authorization invalidation; Consume invitation and create membership in one PostgreSQL transaction; Site-scoped invitation-acceptance audit; Post-commit authorization invalidation
- Source: apps/api/src/site-membership-routes.js (lines 33, 68, 89); apps/api/src/server.js (lines 1796)
- Test references: test/site-membership-routes.test.js, test/integration/tenant-membership-administration-isolation.integration.test.js, test/auth-security.test.js
- Coverage characterization: **maintainer-role-matrix-membership-lifecycle-sse-and-invitation-acceptance-fault-recovery-hosted-main-validated**. Merged F1.21/F1.22 maintainer regressions cover concurrent last-owner removal, owner/editor/author/viewer capability matrix, disabled-user and cross-site denials, membership add/remove lifecycle, authenticated in-process SSE revocation, and selector-conflict/no-side-effect snapshots. F1.23 merged in PR #128 at main 7b3fe3f857bd20bf5d56bcc31a2044a89ffcfbb3; exact-main #570 passed 90/90 live PostgreSQL/Memgraph integration. F1.24 merged in PR #129 at main 5929a53a1c551a2fe43bc38e61cb63dbecec52f5; exact PR-head #572/#573 and exact-main #574 passed 91/91 live PostgreSQL/Memgraph integration, including acceptance-audit trigger failure, transaction rollback, token-digest preservation, no invalidation and same-token retry. Workflow #574 passed all seven mainline jobs including Node 22/24, CodeQL, browser/accessibility, collaboration Playwright and signed attestation. This is maintainer/automation evidence, not independent tenant review. Local Windows PostgreSQL integration requires a disposable DATABASE_URL. Cross-node Redis outage/failover and independent reviews #14/#25 remain unfinished.

### 5. Design system, reusable components, templates, taxonomy, relationships, menus and AI policy

- Inventory ID: site-content-configuration
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/design-system; /api/v1/sites/{siteId}/reusable-components/**; /api/v1/sites/{siteId}/templates/**; /api/v1/sites/{siteId}/terms/**; /api/v1/sites/{siteId}/relationships/**; /api/v1/sites/{siteId}/menus/**; /api/v1/sites/{siteId}/ai-policy
- Authentication: Authenticated session.
- Tenant/site context: Path-addressed configuration operations reconcile the route site against x-virgoscorpio-hub-site-id and siteId query selectors before the route-specific capability check. Bounded JSON writes reconcile body siteId after parsing and before domain validation or persistence. The shared resolver validates selector shape and agreement with its generic membership precheck disabled so each route preserves its established capability/error contract.
- Capabilities/controls: content:read, content:edit, site:manage
- Data-access boundary: site_design_systems; reusable_components; site_templates; taxonomy_terms; content_relationships; navigation_menus; site_ai_policies; outbox; audit
- Side effects: Versioned metadata/configuration writes; Relationship/taxonomy domain events; Graph projection work; Audit events
- Source: apps/api/src/server.js (lines 1231, 1336, 1359, 1386, 1413, 1478, 1536, 1556)
- Test references: test/tenant-route-capabilities.test.js, test/integration/tenant-isolation.integration.test.js, test/integration/postgres.integration.test.js, test/outbox-contract.test.js
- Coverage characterization: **path-header-query-and-write-body-selector-reconciliation**. Live PostgreSQL tenant-isolation integration tests exercise header/query conflicts for each configuration family, body conflicts for design-system/reusable-components/templates/menus/AI-policy writes, and header mismatches for path-addressed deletes. Snapshot comparisons cover tenant configuration tables. Independent route enumeration, authorization matrices and broader deployment review remain required.

### 6. Custom content-type registry and records

- Inventory ID: content-type-registry-and-records
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/content-types; /api/v1/content-types/{slug}/records; /api/v1/content-types/{slug}/records/{recordId}
- Authentication: Authenticated session.
- Tenant/site context: Site resolved by siteIdFor; shared content-read policy is supplied by the API composition layer. Record list/detail storage receives the selected site and actor ownership scope.
- Capabilities/controls: site:manage, content:create, content:read, content:read:own, content:edit, content:edit:own
- Data-access boundary: content_type_definitions; content records via content store; Git-managed configuration definitions
- Side effects: Advisory-lock-protected definition version updates; Record create/update/delete operations
- Source: apps/api/src/content-type-routes.js (lines 111, 179, 253); packages/db/src/postgres-store.js (lines 536, 544, 554); database/migrations/0001_initial.sql (lines 41)
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
- Source: apps/api/src/server.js (lines 1735, 1749, 1760, 1771)
- Test references: test/integration/tenant-content-object-isolation.integration.test.js, test/api.test.js, test/content-owner-store.test.js
- Coverage characterization: **targeted-two-site-editorial-role-matrix-and-author-ownership-candidate**. The A/B suite covers selected foreign-ID read/revision/collaboration/restore/publish paths and snapshots content, revision, workflow, audit, outbox and collaboration state. F1.27 adds built-in site-owner/editor/author role coverage for own-draft submit-review, same-site non-owner author submission denial, editor submit/approve/reject, editor publish/schedule/archive/unpublish denials, and site-owner publish/archive. The submit-review route reuses canEditContent after site-level content:submit-review permission so authors retain only own-content scope while site-wide editors/site owners keep their existing behavior. Denied requests must leave content, workflow, audit, outbox and collaboration state unchanged. Local API unit tests and source syntax pass; exact-head hosted PostgreSQL/Memgraph execution of the new live role fixture is pending. This is targeted maintainer evidence, not exhaustive workflow/route review or independent approval.

### 8. Durable collaboration operations and synchronization

- Inventory ID: collaboration-rest
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/pages/{pageId}/collaboration/operations; /api/v1/pages/{pageId}/collaboration/sync
- Authentication: Authenticated, active session.
- Tenant/site context: Site resolved at the API layer; document lookup binds site and content ID, then validates document type, edit capability and owner rules.
- Capabilities/controls: content:edit, content:edit:own
- Data-access boundary: content documents; collaboration operations/cursors; document publisher/realtime topics
- Side effects: Durable operation append; Sequence and cursor updates; Site/document-scoped publication
- Source: apps/api/src/server.js (lines 350, 438, 1669)
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
- Source: apps/api/src/server.js (lines 455, 1583); apps/api/src/ai-task-routes.js (lines 8, 9, 104)
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
- Source: apps/api/src/server.js (lines 1632, 1637); packages/media/src/local-store.js (lines 51)
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
- Source: apps/api/src/library-routes.js (lines 22, 23); packages/library/src/file-store.js (lines 168, 223)
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
- Source: apps/api/src/server.js (lines 841, 866, 874, 1202, 1217)
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
- Source: apps/api/src/server.js (lines 833, 849, 857); packages/library/src/file-store.js (lines 136, 209)
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
- Source: apps/api/src/commerce-routes.js (lines 31, 44, 51, 271)
- Test references: test/commerce-routes.test.js, test/checkout-idempotency.test.js, test/checkout-reconciliation.test.js, test/integration/tenant-commerce-isolation.integration.test.js, test/integration/tenant-checkout-idempotency-isolation.integration.test.js
- Coverage characterization: **targeted-two-site**. A/B tests cover selected product/order access and idempotency-key reuse/foreign product IDs. Full concurrency, provider ambiguous outcomes, all refund transitions and live Stripe lifecycle are not certified.

### 15. Membership plans, subscription checkout and public plan access

- Inventory ID: membership-plans-and-subscriptions
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/memberships/**; /api/v1/public/sites/{siteId}/membership-plans; /api/v1/public/{siteSlug}/membership-plans
- Authentication: Mixed: site plan administration/checkout requires authenticated actor; public plan catalog is anonymous.
- Tenant/site context: Plan operations use site-scoped predicates and memberships:manage. Provider subscription state must bind signed metadata to site, user and plan.
- Capabilities/controls: memberships:manage
- Data-access boundary: membership_plans; paid_memberships; provider subscription metadata; billing webhook receipts
- Side effects: Provider checkout/session creation; Membership/subscription state reconciliation; Webhook receipt/idempotency updates
- Source: apps/api/src/commerce-routes.js (lines 454, 461, 463); apps/api/src/server.js (lines 881)
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
- Source: apps/api/src/platform-routes.js (lines 55, 57, 70, 72)
- Test references: test/community-workflows.test.js, test/integration/tenant-community-object-isolation.integration.test.js, test/tenant-route-capabilities.test.js
- Coverage characterization: **targeted-two-site**. A/B tests cover selected groups, joins, friendships and feed operations. Group-post/comment, profile privacy and all visibility combinations require reviewer expansion.

### 17. Community conversations, messages, blocks, reports, moderation and notifications

- Inventory ID: community-conversations-moderation-notifications
- Methods (family-level union): GET, POST, PUT, PATCH, DELETE
- Routes/flows: /api/v1/sites/{siteId}/community/conversations/**; /api/v1/sites/{siteId}/community/blocks/**; /api/v1/sites/{siteId}/community/reports/**; /api/v1/sites/{siteId}/community/notifications/**; /api/v1/sites/{siteId}/community/moderation/**
- Authentication: Authenticated site member; moderation actions require stronger capability.
- Tenant/site context: Workflow helper extracts path site, invokes siteIdFor and binds conversation, recipient, message and report lookup to the same site.
- Capabilities/controls: Site membership, community:moderate
- Data-access boundary: social conversations and members; messages; blocks/friendships; reports/moderation actions; notifications
- Side effects: Message creation/read markers; Report/moderation transitions; Notification fan-out/read state
- Source: packages/community/src/workflows.js (lines 21, 375)
- Test references: test/community-workflows.test.js, test/integration/community-workflows.integration.test.js, test/integration/tenant-community-object-isolation.integration.test.js
- Coverage characterization: **targeted-two-site**. A/B cases cover selected conversation/message/block/report/moderation/notification access and side effects. Complete workflow state transitions, group-private post visibility and event fan-out require further review.

### 18. Plugin registry, approvals, security review, activation and invocation

- Inventory ID: plugin-registry-and-lifecycle
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/plugins; /api/v1/plugins/register; /api/v1/plugins/{pluginId}/{action}
- Authentication: Authenticated session.
- Tenant/site context: Site resolved by siteIdFor; plugin lookup and all mutations bind both site ID and plugin ID.
- Capabilities/controls: plugins:read, plugins:manage
- Data-access boundary: plugin_installs; approval and security-review metadata; artifact/SBOM/provenance/signature metadata; plugin runner boundary
- Side effects: Registration/update; Capability approval; Security review state; Activation/disable/invocation
- Source: apps/api/src/server.js (lines 1812, 1818, 1847)
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
- Source: apps/api/src/platform-routes.js (lines 75)
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
- Source: apps/api/src/platform-routes.js (lines 78)
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
- Side effects: Create/update/delete versioned navigation configuration
- Source: apps/api/src/platform-routes.js (lines 81)
- Test references: test/tenant-route-capabilities.test.js, test/api.test.js, test/integration/tenant-mega-menu-isolation.integration.test.js
- Coverage characterization: **targeted-two-site-route-tests**. Live PostgreSQL A/B route tests cover scoped listing, create, versioned update and delete with the same slug present in both sites. Foreign-site list/update/delete attempts and conflicting header/query/body selectors are rejected before mutation; snapshots prove both tenants remain unchanged after denial. The merged PR #92 regression races two updates with the same expected version and requires exactly one success, one version conflict, one version increment and a final row matching the winning request; the Site B same-slug row must remain unchanged. Consumer rendering/cache invalidation and every presentation variant remain separate review items.

### 22. Stripe billing webhook

- Inventory ID: stripe-webhook
- Methods (family-level union): POST
- Routes/flows: /api/v1/billing/stripe/webhook
- Authentication: Provider-signature authenticated; no browser/session principal.
- Tenant/site context: Tenant identity is bound through validated order/subscription metadata and database predicates, not a client-supplied site selector.
- Capabilities/controls: Valid timestamped Stripe signature, Event ID idempotency, Order or membership metadata binding
- Data-access boundary: billing_webhook_events; orders; stock reservations; paid_memberships
- Side effects: Payment/order transitions; Reservation commit/release; Subscription reconciliation
- Source: apps/api/src/server.js (lines 881, 884)
- Test references: test/billing-webhook-tenant.test.js, test/billing-webhook-tenant.test.js, test/billing-webhook-tenant.test.js
- Coverage characterization: **targeted-provider-double**. Signed event and metadata-binding regressions use test doubles. Provider-generated payloads and two-site PostgreSQL callback execution remain external acceptance.

### 23. Presence HTTP, SSE, realtime events and WebSocket

- Inventory ID: presence-and-realtime
- Methods (family-level union): GET, POST
- Routes/flows: /api/v1/sites/{siteId}/presence; /api/v1/sites/{siteId}/presence/heartbeat; /api/v1/sites/{siteId}/realtime/events; /api/v1/sites/{siteId}/realtime/ws (upgrade)
- Authentication: Authenticated persistent session; WebSocket additionally enforces same-origin and reauthorizes commands.
- Tenant/site context: Presence HTTP, SSE and WebSocket upgrade routes reconcile the path site against x-virgoscorpio-hub-site-id and siteId query selectors before realtime capability authorization. Heartbeat JSON bodies also reconcile an optional siteId after bounded parsing and before presence operations. The generic membership precheck is disabled so the existing requireRealtimeCapability control remains the authorization gate. Per-command/document authorization, active-session and distributed Redis scope checks remain separate.
- Capabilities/controls: Realtime capability policy, content:edit/content:edit:own for document collaboration
- Data-access boundary: presence leases; SSE/WebSocket subscriptions; Redis channels/keys; connection quotas; document operations
- Side effects: Presence lease create/renew/release; Stream fan-out; Authorization invalidation; Quota lease acquire/release
- Source: apps/api/src/server.js (lines 1231, 1235, 1237, 1959); packages/realtime/src/redis-presence.js (lines 64, 65, 66, 68, 78, 81, 111, 113, 124, 128, 138, 141, 146, 183, 185, 201, 212, 216, 217)
- Test references: test/realtime-tenant-isolation.test.js, test/realtime-websocket.test.js, test/redis-realtime.test.js, test/integration/redis-presence.integration.test.js, test/e2e/collaboration-postgres-multinode.spec.js
- Coverage characterization: **targeted-tenant-selector-and-cross-node-redis-pubsub-resubscription-hosted-validated**. Realtime tenant-isolation tests exercise conflicting header/query selectors for presence, SSE and WebSocket upgrades plus heartbeat body mismatch. Tests assert rejected upgrades create no subscriptions and rejected heartbeat mismatch leaves the existing presence lease unchanged. F1.26 merged in PR #131 at main 0748f56e01421d13121ec08f7bc036579e5406835. Exact PR-head #580/#581 and exact-main #582 all executed the real Redis 7.4 stop/restore scenario: both API bridges re-subscribed, a newly published site-scoped authorization invalidation reached the remote API node exactly once, only the revoked Site A socket closed before the test-only heartbeat, and Site B remained usable. Each hosted live DB/graph suite passed 92/92 with zero failures/skips; collaboration Playwright passed 4/4. The test proves a new event after reconnection, not replay/durable delivery of messages missed during outage. PostgreSQL remains authoritative and command/heartbeat reauthorization fallbacks remain required. PR #131 has no formal review submission; evidence is maintainer/automation only. Production Redis ACL/failover, independent deployment review and production distributed quota assessment remain open.

### 24. PostgreSQL outbox, delivery and worker execution

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

### 25. Memgraph projection and graph rebuild

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

### 26. Redis presence and cross-instance realtime relay

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
- Coverage characterization: **targeted-cross-instance-pubsub-reconnect-candidate-pending-hosted-validation**. Unit and integration tests cover selected site-scoped channels, envelope validation, authorization invalidation, Redis outage fallback and reconnect strategy. F1.26 adds a CI-only disposable Redis 7.4 outage/recovery test to verify node-redis subscriber re-subscription and delivery of a new post-recovery authorization event to the remote API process. Exact-head hosted execution is pending. Pub/Sub messages lost during outage are not claimed to replay; PostgreSQL command/heartbeat reauthorization remains the bounded fallback. Production Redis ACL, cluster/failover, durable invalidation, independent deployment and production operational reviews remain open.

### 27. Local library object reconciliation and storage adapters

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

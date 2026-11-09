# VirgoScorpio Hub 0.6.2 — Recommended Release Scope

> **Decision status: Reconciled technical recommendation; named release-owner approval is pending.**
>
> **Candidate classification: `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED`.**
>
> **Package version: `0.6.2` (unreleased, private package).**
>
> This document reconciles the current 0.6.2 source manifest, sample environment, package metadata, CI workflow, feature matrix, and mainline evidence. It defines a conservative self-hosted developer-preview boundary. It is not a production release authorization, provider certification, security attestation, service-level commitment, or waiver of any production gate.

## 1. Decision summary

Recommend retaining VirgoScorpio Hub 0.6.2 as an **isolated, self-hosted, non-production developer preview**. The candidate includes more implementation than the sample environment enables. Code, migrations, route handlers, provider adapters, configuration records, unit tests, and CI definitions must not be conflated with an enabled-by-default feature or a validated provider.

The preview may be used to evaluate the implemented foundations using synthetic or non-sensitive test data in an isolated environment. Do not represent it as a production-ready multi-tenant service, hosted service, PCI-certified payment system, full WordPress/WooCommerce/BuddyPress/Elementor replacement, independently security-certified platform, or provider-certified integration suite.

The package remains at **0.6.2**. This scope/documentation reconciliation is not a SemVer change and does not authorize a tag, publication, deployment, or production use.

## 2. Candidate and evidence baseline

| Field | Current value |
|---|---|
| Repository | `GoldenObsidianLLC/VirgoScorpio-Hub` |
| Version | `0.6.2` |
| Package state | Unreleased candidate; `private: true` in package metadata |
| Source baseline | `36220abf4ebcc629fa616961879f5a2ffe1f847d` |
| Manifest release state | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| Semantic version change | None; remains 0.6.2 |
| Runtime minimum | Node.js `>=22.23.4` |
| Package manager | npm `11.19.1` |
| CI runtime matrix | Node.js 22.23.4 and 24.22.1 on Ubuntu 24.04 |
| CI services | PostgreSQL 18, Memgraph 3.13.1, Redis 7.4, Chromium |
| Vendored renderer | EnginEx 7.0.0, pinned submodule commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |
| Mainline workflow | Run [#472](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42535903899), exact main SHA above; six of six jobs succeeded |
| Release decision | NO-GO for production; named release-owner scope approval remains pending |

The local Windows development host has also exercised Node.js 26.12.1. That is useful local engineering evidence; it does not expand the declared Node support floor or establish a Windows production-support matrix.

### Local developer validation (9 November 2026)

On the Windows development host using Node.js 26.12.1, `npm run check` passed **563/566 tests, zero failures and three platform-specific skips**. The artifact/syntax check passed **230 required paths** and syntax-checked **236 JavaScript files**. The tenant inventory generator passed with **27 flow families, 78 declared route patterns, 19 implementation source files and 41 referenced test files**. Node 26.12.1 is a local validation environment only; the declared support floor remains Node.js >=22.23.4, and hosted acceptance is represented by the Node 22.23.4/24.22.1 run #472 above.


### Mainline CI evidence

Mainline run #472 passed the Node 22.23.4 and 24.22.1 unit/security/dependency jobs, dedicated PostgreSQL/Memgraph integration, browser editor/accessibility smoke, CodeQL, and evidence aggregation. The revision-bound producer/aggregator artifacts are tied to source SHA `36220abf4ebcc629fa616961879f5a2ffe1f847d`.

The dedicated PostgreSQL/Memgraph job recorded:

- 79/79 live integration tests passed, with zero failures, skips, cancellations, or TODOs.
- 18/18 migrations applied on a fresh disposable database and 18/18 skipped on the idempotent second pass; the disposable database was dropped.
- The supported v0008 upgrade fixture, Memgraph outage/replay, and canonical graph rebuild completed.
- The service-less integration sweep inside each Node matrix job recorded 33 skips and remains **PARTIAL**; those skips are not counted as live integration passes.

The CI aggregator reported producer CI PASS and materialized the formal PostgreSQL/Memgraph evidence for the exact main revision. The separate local `npm run release:readiness` snapshot still marks its local fresh-migration evidence check BLOCKED because the local retained evidence file does not satisfy the exact-source evidence contract. Do not conflate that local snapshot with the successful, run-bound hosted integration producer artifact.

The CI run also generated CycloneDX 1.5 SBOMs with 177 components and 178 dependency records in each Node matrix job. Both identify npm 11.19.1 and the same lockfile SHA-256 `f404ce5862bffa60daa2cb9cd471e6ac7893b048b2e877e623ddf43c1a15e7ce`; the aggregator confirmed matching normalized component inventories and dependency graphs. Human dependency/license review and provenance/attestation remain outstanding. The SBOM identifies two LGPL-3.0-or-later sharp/libvips components that require maintainer license/notice review.

These are candidate CI results, not production certification, independent security review, manual accessibility acceptance, or a release-owner decision.

## 3. Supported preview configuration

The following table separates sample defaults from available code and from validated claims. “Default” refers to the committed `.env.example`, not to every deployment. Operators must inspect their effective configuration and must not assume the example file is a production template.

| Area | Implemented capability | 0.6.2 sample/default posture | Permitted preview claim and boundary |
|---|---|---|---|
| Runtime | Node.js application; pinned npm; EnginEx 7.0.0 renderer | Development environment | Node >=22.23.4; CI tests 22.23.4/24.22.1 on Ubuntu 24.04. No broad OS, HA, or production support commitment. |
| Transactional data | PostgreSQL source of truth; versioned migrations; transactional outbox | Local PostgreSQL development URL; PostgreSQL remains authoritative | PostgreSQL-backed preview and current CI integration are evidenced. No managed provider, production HA, failover SLA, RPO, or RTO claim. |
| Graph projection | Optional Memgraph relationship projection and replay/rebuild path | `MEMGRAPH_ENABLED=false` | Optional local/CI projection only. PostgreSQL remains authoritative; no production graph HA or service commitment. |
| Realtime/presence | Authorization-aware event gateway, Redis relay, bounded WebSocket/SSE, presence leases, collaborative draft foundations | `VIRGOSCORPIO_HUB_REALTIME_ENABLED=false`; in-memory presence default; sample Redis URL is a local endpoint | Opt-in developer-preview feature. F1.12–F1.18 qualify selected browser/multi-node correctness and authorization revalidation paths. They do not establish production SLOs, instantaneous revocation, Redis Cluster/failover, broad outage recovery, or load/soak capacity. |
| Identity/session | Local account/password, session, cookie/CSRF/origin controls; TOTP/MFA and OIDC/SAML integration foundations | OIDC fields empty; `SAML_ENABLED=false`; local sign-in path available | Local preview identity only. No certified OIDC/SAML provider, verified-email delivery, enterprise SSO interoperability, MFA recovery assurance, or production identity lifecycle claim. |
| Email/notifications | Mail worker and mailer abstraction | `VIRGOSCORPIO_HUB_MAIL_PROVIDER=disabled` | In-app notification foundations may be evaluated. Do not promise SMTP/provider delivery, account verification, password recovery email, or notification delivery. |
| Media/library storage | Local media and library stores; private/public asset controls; MIME signature checks; SHA-256; versioning; local object reconciliation | `MEDIA_DRIVER=local`; `LIBRARY_STORAGE_PROVIDER=local` | Local filesystem storage only for this preview. The reconciler is local-only and dry-run by default; deletion requires explicit apply and age checks. No remote object/CDN acceptance. |
| Cloud object storage | S3/S3-compatible (including R2/MinIO patterns), GCS, and Azure Blob adapters and read-only probe paths; secret-reference configuration | Remote credentials/connection details are not supplied by sample config | Adapter availability only. No live credential resolution, least-privilege CRUD/multipart, encryption, lifecycle, retention, crash/restart, restore, or tenant-isolation certification for any provider. `configured` is not synonymous with healthy or accepted. |
| Malware scanning | ClamAV `clamdscan` adapter; required-scan fail-closed behavior; non-production unscanned quarantine | `LIBRARY_MALWARE_SCANNER` unset | Live ClamAV daemon/corpus not validated. Non-production assets that are not scanned must remain quarantined/non-public. Do not accept untrusted uploads in a production deployment without a configured scanner and accepted scanner evidence; production upload policy fails closed when required scanner is absent/unavailable. Existing `not_scanned` assets are not thereby cleared. |
| Media optimization | Optional Sharp WebP derivatives; optional FFmpeg WebM derivatives; optional KaTeX with escaped fallback | Sharp is an optional dependency; FFmpeg is an external executable; KaTeX optional | Derivatives are optional best-effort preview features. No representative media corpus, metadata-preservation, load/resource, codec/browser, or performance certification. Original assets remain authoritative; optimization does not overwrite originals. |
| CMS/editor | Versioned page documents, drafts/revisions, review/publication/scheduling foundations, browser drag-and-drop editor, widgets and preview | Local preview app | Implemented/partial CMS and editor foundations. Not full Elementor/theme-builder parity; advanced theme/popup/form/query/marketplace workflows and broad manual accessibility acceptance remain out of scope. |
| Commerce | Product/order foundations, bounded cart, integer minor-unit calculations, finite-stock reservations, Stripe Checkout/webhook foundations, provider-aware expiry reconciliation, idempotent refund/subscription code paths | `STRIPE_SECRET_KEY` and webhook secret empty | Catalog/cart and backend lifecycle foundations may be evaluated with synthetic test data. Stripe-backed routes are unavailable until separately configured; no live payments or real Stripe account acceptance. No complete tax, shipping, coupons, refunds/returns, fulfilment, downloadable entitlements, invoicing, fraud, or subscription lifecycle/parity claim. |
| Memberships | Membership plans and one-time/recurring checkout/webhook foundations | Stripe credentials absent | Schema and workflow foundations only. No production billing portal, renewal/dunning/proration/grace/dispute or complete subscription lifecycle claim. |
| Community | Site-scoped profiles/groups/membership/activity; direct conversations/messages; read markers/notifications; blocking, reports, moderation hide/restore; serialized rate limits | Local application routes and synthetic test data | Partial site-scoped community foundation, not BuddyPress parity. Group conversations/privacy, forums, full abuse/appeal tooling, search/discovery, privacy export/deletion, and complete browser workflows remain incomplete. |
| Plugins | Manifest/capability approval, provenance helpers, pinned-image runner interface and constrained invocation foundations | `VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_ENABLED=false`; runner URL/token and allowed images absent | Plugin execution disabled by default. No external plugin marketplace or production plugin execution claim. No signed-artifact/runner adversarial isolation acceptance. |
| AI | Mock/OpenAI Responses/OpenAI-compatible/Anthropic/Gemini adapter code, content proposal/SEO/translation and MCP foundations | `AI_PROVIDER=mock`; `AI_ALLOWED_PROVIDERS=mock`; `AI_ALLOW_EXTERNAL_CONTENT=false`; prompt logging disabled | Mock AI only by default. External-provider adapters are not an approved supported provider matrix. Use synthetic content; no confidential/customer data sent to external AI under this preview claim. AI output is untrusted and cannot self-authorize publication, billing, permissions, or plugin activation. |
| Application firewall | Application-layer IP/CIDR/path/user-agent rules and audit events | Deployment-specific configuration | Application-layer rules only, not a network firewall, managed WAF, bot-management/DDoS, reputation, or geolocation service. |
| Observability | Structured logging, metrics/trace foundations, local OTLP development fixture and deployment evidence contract | OTEL, HTTP logs, metrics disabled by default; no production backend/owner selected | Local/development observability only. No approved production collector/backend, retention, access, data residency, alerting, ownership, capacity, or recovery policy. |
| Browser/accessibility | Playwright Chromium editor/accessibility smoke in CI | Chromium smoke job | Smoke evidence only. No full WCAG conformance claim; no complete manual keyboard/focus/contrast/zoom/reflow/screen-reader acceptance, Firefox/WebKit/Safari/mobile matrix, or assistive-technology signoff. |
| Security/tenancy | Automated authorization/site-scoping regressions; tenant route/data-access inventory; CodeQL CI | CI/security checks enabled | Maintainer-authored tests and static analysis are engineering evidence only. No independent tenant-isolation assessment, penetration test, or independent security certification has been completed. |

## 4. Required safe preview posture

For a deployment represented as the 0.6.2 developer preview:

- Keep it isolated and non-production. Start from the sample development configuration, use strong unique secrets and never reuse example bootstrap credentials or tokens.
- Use synthetic/test data. Do not store real customer information, production secrets, personal data, or confidential content in the preview.
- Keep realtime disabled unless deliberately enabling it for isolated evaluation. Do not expose PostgreSQL, Memgraph, Redis, or plugin-runner ports to untrusted networks.
- Keep Memgraph disabled unless running a controlled local/test topology; PostgreSQL remains authoritative.
- Keep AI on mock, globally allow only mock, keep external content disabled, and keep prompt logging disabled.
- Keep email disabled, SAML disabled, OIDC credentials unset, and use local identity only.
- Keep media and library storage on local filesystem. Do not claim remote cloud storage support based solely on adapters or connectivity probes.
- Keep plugin execution disabled; do not configure an external runner or trusted images for this candidate.
- Leave Stripe credentials unset. Any separate Stripe engineering test must use a dedicated test-mode account, isolated synthetic records, and its own authorization; never use live payment credentials for the preview.
- Do not accept untrusted uploads unless a real scanner is configured and its acceptance procedure is complete. Unscanned non-production uploads must remain quarantined/non-public. Production upload policy must fail closed where scanning is required.
- Keep optional media optimization best-effort and resource bounded; never overwrite the original asset with a derivative.
- Use HTTPS, secure cookies, correct proxy trust, access controls, and deployment-specific secret handling if the preview is reachable beyond loopback. These controls do not convert the preview into a certified deployment.

These restrictions describe the preview claim, not a substitute for code-level controls, infrastructure isolation, or independent assessment. A deployment that cannot reliably enforce these boundaries must not be presented as a supported preview environment.

## 5. Capabilities explicitly excluded from the 0.6.2 preview claim

The following capabilities are present only as partial implementations, optional adapters, or future work and are not included in the supported preview claim:

1. Live OIDC/SAML provider certification, email delivery/provider lifecycle, enterprise SSO, and production MFA recovery.
2. Live ClamAV daemon/corpus testing, legacy-asset clearance, and production untrusted-upload acceptance.
3. Live S3/S3-compatible, R2/MinIO, GCS, or Azure Blob provider support, including credential model, least-privilege operations, lifecycle, restore, and CDN delivery.
4. Live Stripe processing, production charging, fully accepted refund/return, tax/shipping/coupon, entitlement/download and subscription lifecycle.
5. Full browser/OS/assistive-technology and manual accessibility conformance.
6. Full commerce parity and full community parity (including the incomplete capabilities documented in the manifest and feature matrix).
7. Third-party plugin execution/marketplace and independently validated signed-plugin runtime isolation.
8. External AI-provider use as an approved default or supported provider matrix.
9. Production-scale multi-node realtime, hard revocation SLA, Redis Cluster/failover, service-level guarantees, and distributed recovery commitments.
10. Production load/soak/resource-exhaustion, full PostgreSQL/graph/object-storage backup-restore, measured RPO/RTO, incident/recovery rehearsals, production observability and operations signoff.
11. Independent tenant-isolation review and independent application-security assessment.

These items remain production-certification gates in `RELEASE-MANIFEST.json`, `docs/RELEASE_READINESS.md`, and `docs/RELEASE-EVIDENCE.md`. Their exclusion from a developer-preview scope is **not a pass, waiver, risk acceptance, or evidence completion**.

## 6. Production scope is a separate decision

A production candidate requires a separate approved scope decision and deployment model. Before any production certification work is represented as in scope, the authorized release owner must select:

1. Single-tenant/multi-tenant topology, supported operating systems/runtime and database versions, intended availability, backups, recovery objectives, and named operational ownership.
2. OIDC/SAML identity provider(s), email provider, MFA/recovery requirements, and session/proxy model.
3. Scanner product/version, deployment topology, quarantine and false-positive process, and legacy rescan policy.
4. Specific object-storage provider(s), regions, credential/workload-identity model, encryption, retention, lifecycle, and delivery boundaries.
5. Stripe/test/production payment scope and exact refund, fulfilment, entitlement and subscription behavior.
6. Plugin runtime support, signing/trust/rotation policy, filesystem/network/secret/resource isolation and supported platform.
7. Browser/OS/assistive-technology matrix and accessibility conformance target.
8. Explicit commerce/community feature subset; incomplete capabilities must be excluded or disabled and removed from parity claims.
9. Production observability backend, data classification/residency, access, retention/deletion, delivery reliability, capacity and recovery controls.

Every selected provider and feature must be tested against dedicated non-production accounts/environments with evidence bound to the exact candidate revision. Unselected capabilities must remain disabled or unavailable and be excluded from release claims. A future scope approval does not itself satisfy the independent/provider/operations gates.

## 7. Ownership and approval record

| Field | Value |
|---|---|
| Technical scope | Reconciled recommended 0.6.2 developer-preview scope |
| Scope source | `RELEASE-MANIFEST.json`, `package.json`, `.env.example`, `.github/workflows/ci.yml`, `docs/FEATURE-PARITY.md`, `docs/PLATFORM-FEATURES.md`, mainline run #472 |
| Source revision used for this reconciliation | `36220abf4ebcc629fa616961879f5a2ffe1f847d` |
| Product version / SemVer | `0.6.2`, unreleased, unchanged |
| Decision owner | **Pending named authorized product/release owner** |
| Approval status/date | **Pending; no approval is inferred from this document or CI** |
| GitHub decision record | [Issue #13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) |
| Production decision | **NO-GO / NOT_PRODUCTION_CERTIFIED** |

The recommendation must be explicitly accepted or amended by the authorized release owner, with their identity, authority, decision, and date recorded in issue #13. Until then this is a technical scope proposal, not an adopted company/product decision.

## 8. Release decision

**VirgoScorpio Hub 0.6.2 remains an unreleased expanded developer preview and is NOT_PRODUCTION_CERTIFIED / NO-GO.**

The mainline CI run #472 is successful engineering evidence, not a production approval. The readiness tooling remains fail-closed: current release-readiness still reports 7 PASS, 2 PARTIAL, 1 BLOCKED, and 14 MISSING_EVIDENCE, with `readyForProduction: false`. Independent review, provider, accessibility, product parity, supply-chain, operational, observability, governance and release-owner gates remain separate requirements.

No SemVer increment, release tag, package publication, production deployment, assessor engagement, expenditure, or spending authority is authorized by this scope reconciliation.

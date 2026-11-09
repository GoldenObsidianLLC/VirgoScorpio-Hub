# VirgoScorpio Hub Platform Features — 0.6.2

VirgoScorpio Hub 0.6.2 is an unreleased internal library/media API modularity candidate and expanded developer preview. It builds on the CMS/editor, libraries/media, commerce and membership, site-scoped community, application firewall, AI adapters, cloud adapter and release-engineering foundations. Current default enablement and explicit exclusions are defined in [RELEASE-SCOPE.md](RELEASE-SCOPE.md).

> **Maturity notice:** This is a developer preview, not a completed WordPress/WooCommerce/BuddyPress/Elementor replacement and not a production-certified security platform. A database-backed route is only functional after migrations are applied to a compatible PostgreSQL instance. Provider and cloud integration status is documented separately from configuration acceptance.

## Libraries and media

The unified library supports image, video, audio, document, generic file, and font asset kinds. Each asset has a UUID, owning site, display metadata, byte count, SHA-256 digest, status, version, and visibility flag. Uploads check the file signature instead of trusting the caller's MIME label. SVG is intentionally not accepted as an uploaded image; use the curated icon library for inline SVG.

Document and file uploads currently allow selected formats such as PDF, plain text, JSON, Office Open XML document types, ZIP, and WOFF fonts. The allow-list is deliberately narrow and should be expanded only alongside archive/content scanning and download policy.

Asset history and optimistic version checks are available. Replacement requires `expectedVersion` and keeps the same library category. Deletion is soft-delete/versioned. The API can return private assets only to a caller with the library management capability; public reads require an asset marked public. SHA-256 is checked when reading stored bytes.

Optional image optimization uses Sharp to produce WebP variants. Optional MP4-to-WebM transcode uses FFmpeg without shell invocation, with an input byte ceiling and execution timeout. Optimization creates a derivative and does not overwrite the original. The installed optimizer can decline a conversion if it cannot reduce bytes. Neither optional dependency is guaranteed to be present until the dependency installation has been reproduced and reviewed.

## File, document, and icon libraries

- **File Library:** general approved file types with metadata and version history.
- **Document Library:** approved document types, MIME signature checks, private downloads, metadata, and version history.
- **Icon Library:** curated programmatic SVG icons, with validated options and escaped accessible titles. It is not an untrusted SVG upload/import system.
- **Video in Media Library:** MP4/WebM upload and a `widget.video` page node referencing a library asset. A media transcoding adapter can optionally produce a WebM variant when FFmpeg is installed.
- **Document ID/version controls:** content items expose document/content IDs, schema version, record version, publication timestamp, revision counts, and optimistic concurrency. Library assets have independent version histories; an asset version is not the same as a page-document version.

## Math formula rendering

`POST /api/v1/math/render` accepts a bounded formula and optional display mode. The formula validator rejects dangerous command families and unbalanced braces. With KaTeX installed, rendering uses `trust: false`, strict parsing, expansion/size limits, and HTML+MathML output. Without KaTeX, the runtime emits escaped text rather than pretending to provide typeset mathematics. The TeX checker is a defensive pre-filter, not a complete formal proof that every possible TeX expression is harmless; never enable unrestricted macros or trusted HTML.

## Commerce and memberships

The preview adds product and order data models, bounded cart validation, minor-unit integer arithmetic, stock reservation in the order transaction, idempotency keys, Stripe Checkout sessions, signed/timestamped webhook validation, membership plans, recurring checkout modes, webhook-driven membership updates, and a public published-product/active-plan catalog API.

Public read endpoints:

- `GET /api/v1/public/sites/{siteId}/products`
- `GET /api/v1/public/sites/{siteId}/products/{slug}`
- `GET /api/v1/public/sites/{siteId}/membership-plans`

Authenticated management endpoints are defined in `docs/API-CONTRACTS.md` and `openapi.yaml`.

This is **partial commerce functionality, not WooCommerce parity**. The current implementation includes product/order/cart foundations, integer minor-unit calculations, finite-stock reservations, Stripe Checkout/webhook foundations, provider-state reconciliation and tenant-scoped refund/subscription lifecycle code paths. The sample environment has no Stripe credentials and this candidate has no live Stripe test-mode evidence. Complete tax, shipping, regional pricing, coupon redemption, variable products, returns/chargebacks, invoices, downloadable entitlements, subscription management/dunning/proration, fraud tooling, checkout extensions and accounting integrations remain incomplete or unaccepted. Do not claim live payment or mature-store parity.

## Community

The current site-scoped foundations include profiles and visibility, groups and memberships, friend requests/activity, direct conversations/messages, read markers and message notifications, blocking, report queue/status and moderator hide/restore actions. Message/report rate limits use transaction-scoped advisory locks. This remains **partial and not BuddyPress parity**: group conversations/privacy, forums, complete abuse/appeals, search/discovery, privacy export/deletion and full browser workflows remain incomplete or unaccepted.

## Mega menus

Navigation menus support a presentation configuration including layout, width, columns, mobile behavior, hover/click/focus trigger, image/icon/description toggles, and a featured content reference. Menu items pass the existing navigation validator. Client-side rendering and keyboard/accessibility testing are release gates. This is not a full Elementor or WordPress theme builder.

## Firewall and security

The application firewall can evaluate explicit IP, IPv4 CIDR, path-prefix, and user-agent rules, returning pass/deny/challenge/rate-limit decisions. Rule changes require a privileged capability and emit audit events. Deployment CIDR deny rules can be configured by environment.

This is an **application-layer rule engine**, not a network firewall, managed WAF, bot-management system, DDoS service, geolocation engine, or substitute for a reverse proxy and cloud edge protection. Ensure proxy trust is explicitly configured if the network topology requires it; do not trust arbitrary `X-Forwarded-For` values.

## Cloud compatibility

Object storage adapters cover AWS S3 and S3-compatible endpoints (including deployments such as Cloudflare R2 or MinIO), Google Cloud Storage, and Azure Blob Storage. Configuration records store secret references, not secret values. Actual credentials come from the deployment environment or a supported secret/workload-identity mechanism.

A cloud connection marked `configured` means its configuration passed validation only. It does not mean that object-store permissions, bucket policy, network access, encryption, retention, lifecycle rules, credential resolution, or CDN delivery have been verified. The 0.6.2 sample configuration defaults to local storage. No S3/S3-compatible, R2/MinIO, GCS or Azure provider has been accepted through live least-privilege operations, lifecycle or restore testing; these adapters must not be represented as certified support.

## AI integration

AI can draft page documents, provide constrained content assistance, suggest SEO metadata, translate text, and help with preview/review workflows. AI output remains untrusted and is validated by VirgoScorpio Hub. Publication, billing, permissions, and plugin activation are not granted to AI tools by default. External provider use is disabled unless the operator opts in and configures the appropriate policy.


## 0.6.2 preview posture and current evidence

The committed sample environment keeps local media/library storage, mock-only AI, external AI content off, email disabled, SAML/OIDC unconfigured, realtime and Memgraph disabled, plugin execution disabled, Stripe credentials blank, and ClamAV unset. Remote cloud, external AI, identity, mail, billing, malware-scanner and plugin adapters are not certified merely because they are present. Non-production unscanned assets remain quarantined/non-public; production uploads fail closed when required malware scanning is unavailable.

Mainline [CI run #472](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42535903899) passed all six jobs on `36220abf4ebcc629fa616961879f5a2ffe1f847d`. The dedicated PostgreSQL/Memgraph job passed 79/79 with no skips, verified 18 migrations on fresh install and 18 idempotent skips, and exercised the v0008 upgrade fixture, Memgraph outage/replay and canonical graph rebuild. Browser Chromium smoke passed 9/9; Node 22/24 unit/security checks and EnginEx tests passed; SBOM runtime parity and CodeQL passed. The CI evidence is not full accessibility acceptance or production certification.

See [RELEASE-SCOPE.md](RELEASE-SCOPE.md), [FEATURE-PARITY.md](FEATURE-PARITY.md) and [RELEASE_READINESS.md](RELEASE_READINESS.md) for the precise supported preview, excluded capabilities and remaining production gates.

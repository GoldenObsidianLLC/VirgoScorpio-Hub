# Public Asset Delivery Deployment Contract

**Status:** Required deployment evidence contract; structural validation only.
**Application baseline:** VirgoScorpio Hub `0.6.2` candidate, including PR #99.
**Evidence schema:** `1`
**Default manifest:** `artifacts/evidence/public-asset-delivery.json`

## Purpose and boundary

The application routes public media, library assets, and variants through visibility-checked API reads. Successful byte responses use `Cache-Control: private, no-store`; denied responses are non-cacheable; S3 media objects use private/no-store metadata; and `MEDIA_CDN_PUBLIC=true` fails closed. Those controls do not prove that the selected deployment has a private object origin, that a CDN or reverse proxy bypasses these routes, that origin directives survive every intermediary, or that previously issued direct-CDN URLs have been withdrawn.

This contract records deployment-specific evidence for the selected production topology. It is provider-neutral because the repository does not select a production cloud provider, CDN, or reverse proxy. The manifest must describe the real deployment; it must not be filled with an assumed AWS, Cloudflare, GCS, Azure, or proxy configuration.

The validator is intentionally limited. It validates declarations, typed references, timestamps, source binding, and observed status/header assertions. It does not call provider APIs, retrieve or authenticate evidence references, inspect bucket policies, send probes, purge edge caches, configure infrastructure, or provide production certification. An accepted manifest still requires human review and the independent release/security gates.

## Required evidence

### 1. Bind the declaration to the candidate

Record the production deployment identifier, exact full 40-character Git revision, approval owner, UTC approval timestamp, and change reference. Set `VIRGOSCORPIO_HUB_EXPECTED_SOURCE_REVISION` in the release environment so the CLI checks that the manifest belongs to the candidate being evaluated.

### 2. Identify each delivery component

Identify object storage, the edge/CDN, and any reverse proxy by provider and non-secret service label. Each component needs a typed verification reference. Where no reverse proxy exists, use `provider: "none"`, `service: "none"`, and a `policy:` reference documenting the reviewed absence. Do not put bucket names that are sensitive, endpoints, URLs, access keys, credentials, tokens, signed URLs, or raw provider responses in the manifest.

### 3. Prove the origin is private

The retained evidence must show that anonymous object-origin reads are denied (normally 403 or 404), public access is blocked, bucket/container policy is private, and the only intended read principal is the approved application identity. Record a typed `identity:` reference for that application identity and an `artifact:`, `run:`, or `policy:` reference for the private-origin evidence. Validate both origin policy and effective access using the actual deployment identity; a console screenshot alone is not a substitute for an access-denial probe.

### 4. Prove cache bypass for both public API route families

For each exact route prefix, `/media/` and `/library/public/`, record all of the following:

- Shared-cache mode is `bypass` and no shared cache stores a response.
- The proxy/CDN honors the origin `Cache-Control` directive without rewriting or overriding it.
- Successful asset responses use exactly `private, no-store`.
- Maximum success TTL and negative/error TTL are both zero.
- Direct-object redirects are disabled; byte delivery remains behind the API visibility gate.

The edge and origin probe records must demonstrate successful reads with HTTP 200, `Cache-Control: private, no-store`, and `cacheable: false`. The anonymous object-origin denial probe must record HTTP 403 or 404. Probe both route families and the selected deployment's normal request path, not only a provider console configuration.

### 5. Prove revocation at origin and edge

For a disposable public test asset, record the successful edge/origin reads, withdraw public visibility using the application lifecycle, then verify subsequent origin and edge requests return HTTP 404 with `Cache-Control: private, no-store` and are not cacheable. The test must demonstrate that a previously successful response cannot be retrieved from a browser-facing edge after revocation. Preserve request IDs, timestamps, sanitized logs, and test artifact references without recording asset contents or sensitive response headers.

### 6. Resolve legacy direct-CDN URLs

Select exactly one explicit disposition:

- `none-issued`: provide a current inventory/review record establishing that no pre-hardening direct-CDN URLs were issued.
- `purged`: provide provider purge/invalidation evidence and the UTC completion timestamp. Verify denial at both the edge and origin after the purge.

Do not infer that changing the application to API URLs revokes edge objects or direct object URLs issued by earlier deployments. Until the provider-specific purge and origin privacy checks pass, those URLs remain a deployment risk.

### 7. Assign accountable owners

Use typed `team:` references for a service owner and a security owner. Those owners review the declared topology, evidence, residual risk, and readiness decision. A reference string by itself does not constitute approval.

## Manifest and command

Copy `docs/templates/public-asset-delivery.evidence.template.json` to `artifacts/evidence/public-asset-delivery.json` and replace every placeholder with evidence from the target deployment. The template is deliberately incomplete and must fail validation until populated with real approved evidence.

Run:

```sh
npm run public-assets:validate
```

Or provide a repository-relative manifest path:

```sh
node scripts/validate-public-asset-delivery.js artifacts/evidence/public-asset-delivery.json
```

The default freshness window is 30 days. The validator rejects timestamps outside strict UTC millisecond format, impossible/future timestamps, stale evidence, and probe evidence dated after the approval. The maximum configurable age is bounded at 90 days in the validator API. Unknown fields are rejected so credentials or unreviewed data cannot be smuggled into the manifest.

The CLI prints stable field paths and error codes only. It never prints user-controlled values. Missing production evidence blocks the command, but the production-only manifest is not required for the ordinary unit-test suite. A successful result means only **STRUCTURAL EVIDENCE VALIDATION PASSED**; external references still require human/provider verification.

## Operational limitations and rollout

- This contract does not change application delivery behavior and does not replace live integration tests for each provider in the approved production scope.
- S3-compatible, GCS, and Azure adapter support does not imply that a deployment's origin is private or that edge revocation has been certified.
- A CDN must not serve API responses from a stale cache after public visibility is withdrawn. A zero negative-cache TTL is required as well as zero positive cache TTL.
- Existing deployments that previously enabled `MEDIA_CDN_PUBLIC` must inventory and purge all exposed keys/prefixes with their provider, block public origin access, and verify edge/origin denial. The application cannot revoke URLs or purge a provider cache on its own.
- Reverse-proxy/CDN override behavior, provider IAM, encryption, lifecycle/retention, recovery, and multi-replica storage remain separate production validation tasks.
- No provider-specific infrastructure-as-code, proxy configuration, CDN purge integration, database migration, or runtime code change is introduced by this evidence contract.

## Release relationship

Retain this manifest with the exact candidate's release evidence. It complements the object-storage and operations evidence in `docs/PRODUCTION-CERTIFICATION-PLAN.md`; it does not close independent tenant-isolation issue #14 or independent security issue #25. A passing validator does not change `NOT_PRODUCTION_CERTIFIED`, the production `NO-GO` decision, or any release-readiness report. The release owner must review the external evidence and explicitly accept the selected deployment scope before any certification claim.

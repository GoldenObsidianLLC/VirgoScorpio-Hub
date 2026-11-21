# F1.60 — Firewall Policy Cache and Resource-Boundary Hardening (Candidate Report)

**Date:** 21 November 2026
**Status:** Consolidated candidate; unmerged
**Baseline:** F1.59 main 70e800ad33a6d376388576ce76a608f35c595b64
**Consolidation PR:** [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257)
**Overlapping proposals:** [#268](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/268), [#271](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/271), [#276](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/276)
**Tracking:** [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277), governance [#230](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230)

## Executive summary

The three firewall autofix proposals touched the same shared cache module and should not be independently merged. The consolidated PR #257 now carries the resolved-tenant firewall check plus bounded rule storage/cache, fail-closed policy trust, and generation-safe invalidation. This report documents the candidate branch, not mainline or production acceptance.

## Consolidated source changes

### Tenant-scoped firewall evaluation

PR #257 re-evaluates firewall policy after the site is resolved for public slug routes and normalizes the site ID. A follow-up fixed a compatibility regression where internal AI authorization helpers provided a lightweight request context without a Node socket. Socket/User-Agent access is optional for internal contexts, while public HTTP handlers pass the real request through AI generation and AI task authorization. Existing AI page-draft context tests are retained.

The test fixture no longer assumes untrusted X-Forwarded-For is authoritative. Firewall tests exercise scoped User-Agent rules, a global rule, challenge, rate-limit, path matching, tenant isolation, uppercase tenant normalization, and denial before content retrieval.

### Quota and resource bounds — proposal #268

- Maximum 500 firewall rules per site; maximum 20,000 platform-wide.
- PostgreSQL advisory transaction lock serializes duplicate/quota count and insert.
- Duplicate rules and quota exhaustion return 409 before mutation/audit/cache side effects.
- Cache refresh query has a hard LIMIT, and accepted rows are capped in memory.

### Fail-closed policy refresh — proposal #271

A database-backed dynamic firewall policy is invalid until successfully loaded. Initial refresh failure, refresh failure after a formerly valid cache, and refresh failure after cache invalidation cause dynamic evaluation to deny with firewall-policy-unavailable. Static deployment-deny entries remain checked before dynamic-policy trust. A successful later refresh restores dynamic-policy availability. No-pool mode remains explicit for local/static use.

### Generation-safe invalidation — proposal #276

clearCache() advances a generation and invalidates the current cache. A query result from an older generation is discarded; its completion cannot republish stale allow/deny rules or clear a newer in-flight refresh handle. Same-generation concurrent requests share the refresh. Retry attempts are bounded. A generated test expectation that previously asserted fail-open pass on database error was corrected to assert denial.

## Documentation and inventory

The candidate adds a design, plan, report, and roadmap addendum. Architecture and operations guidance preserve the existing boundary: the built-in firewall is application-level policy, not a managed WAF/edge/DDoS service. The source-anchored tenant-isolation artifacts were regenerated after the request-context and fixture changes: 28 route families, 80 declared route patterns, 22 source files and 59 referenced test files. The generated inventory is a drift-detection/navigation aid, not proof of complete route discovery or independent review.

## Local validation

- Focused firewall, quota, refresh-failure, generation-race and AI request-context tests: **53/53 passed**, zero failures/skips.
- Component-audit transaction tests: **2/2 passed** after the mock PostgreSQL pool was updated for the firewall policy read.
- Tenant inventory tests: **2/2 passed** after regeneration.
- npm run check: **728 tests, 725 passed, 0 failed, 3 conditional skips**; exit code 0.
- git diff --check passed on the implementation and documentation work completed so far.
- The local full suite did not configure a disposable live PostgreSQL/Memgraph environment; local unit/test-harness results are not presented as live integration evidence.

Hosted exact-head validation for the current consolidated head is **pending**. Required Node 22/24, PostgreSQL/Memgraph integration, browser/accessibility, CodeQL and candidate evidence consolidation must pass. Mainline-only lockfile/SBOM attestation is expected only after a merge onto main.

## Review, governance and release boundary

The consolidated branch contains the original PR #257 request-context fix plus quota, fail-closed policy and cache-generation changes proposed separately in #268/#271/#276. All remain subject to independent review; this report does not approve a merge.

Issue #230 remains unresolved. The latest repository settings inspection found no active rulesets and no classic branch protection on main; the direct collaborator listing showed only the owner account. A trusted distinct collaborator must be available and the review policy made enforceable before an ordinary merge. Maintainer comments, generated bot patches, green CI and owner-authored review submissions are not independent approval.

F1.59 is the actual merged runtime baseline on main at 70e800ad33a6d376388576ce76a608f35c595b64; documentation synchronization is separately tracked in [PR #236](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/236). This F1.60 candidate is based on F1.59 runtime and does not claim PR #236 has merged.

Package virgoscorpio-hub@0.6.2 remains private/unreleased. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED. No SemVer increment, release tag, publication or deployment is authorized.
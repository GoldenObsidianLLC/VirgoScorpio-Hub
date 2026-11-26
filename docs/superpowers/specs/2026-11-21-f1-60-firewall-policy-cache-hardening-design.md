# F1.60 — Firewall Policy Cache and Resource-Boundary Hardening

**Status:** Maintainer candidate; unmerged
**Baseline:** F1.59 main 70e800ad33a6d376388576ce76a608f35c595b64
**Consolidation PR:** [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257)
**Overlapping proposals:** [#268](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/268), [#271](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/271), [#276](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/276)
**Tracking:** [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277), parent [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)

## Problem

Three bot-generated changes modify the same firewall policy/cache module. Independently merging them could reintroduce unbounded rule storage, fail-open policy evaluation, or stale cache publication after mutation invalidation. The changes are consolidated in one candidate implementation to preserve a single coherent cache and quota state machine.

## Design

### Bounded rules and cache

- Per-site rule quota: 500.
- Platform-wide rule quota: 20,000.
- Rule creation checks duplicate (site, action, scope, pattern) identity and quotas inside the existing PostgreSQL transaction.
- A transaction advisory lock serializes the quota check and insert across concurrent writers. The lock, counts, duplicate check and insert use the same transaction client.
- Duplicate and quota errors return HTTP 409 before insert, security-event write, or cache invalidation.
- Cache refresh query and accepted in-memory rows are capped at the platform maximum.

### Fail-closed policy validity

- When a PostgreSQL pool is configured, dynamic policy remains invalid until a successful refresh.
- A failed refresh invalidates policy trust even when an older cache was previously valid.
- While policy is invalid, evaluate returns deny with reason firewall-policy-unavailable; it must not pass because the cache is empty or stale.
- Validated deployment static-deny entries are checked before the dynamic policy availability decision and remain effective during database failure.
- No-pool mode remains explicit for local/static use; it is not a production substitute for the persistent policy store.

### Generation-safe invalidation

- Each refresh captures the current generation.
- clearCache increments the generation, expires the cache, detaches the old refresh handle and invalidates database-backed policy trust.
- A result from an old generation is discarded; it cannot publish stale rules, mark policy valid, or clear a newer refresh handle.
- Concurrent evaluations share a refresh in the same generation. Retries after repeated invalidation are bounded.
- The rules accessor follows the same trust boundary and returns no dynamic rules while the backing policy is unavailable.

### Tenant and request identity

- Site-scoped rules are evaluated after the site is resolved and against a normalized site ID.
- The evaluator uses the actual Node socket peer address and request User-Agent when available. X-Forwarded-For is not implicitly trusted.
- Internal authorization helpers may receive a lightweight request context without a Node socket; socket/header metadata is optional. Real HTTP handlers pass the original request through so actual request metadata remains available.
- Missing socket context must not turn valid internal AI authorization paths into HTTP 500 errors.

## Compatibility and security boundaries

- The built-in firewall remains application-level policy, not a managed WAF, edge firewall, DDoS service, or replacement for TLS reverse-proxy configuration.
- Do not infer a trusted proxy chain or accept forwarded client-IP headers without a separately reviewed proxy-trust contract.
- Existing routes, security:manage authorization, response contracts, matching semantics, and F1.36 transaction/audit behavior remain intact. F1.36 still owns atomic rule/security-event mutations and post-commit cache invalidation.
- No schema, migration, public API, dependency, lockfile, package-version or SemVer change is intended.

## Required evidence

Tests must prove quota/duplicate denial has no side effects; lock-before-count-before-insert ordering on one client; the cache limit; fail-closed startup and post-success refresh failures; successful recovery; stale in-flight result discard; shared same-generation refresh; tenant isolation; global/challenge/rate/path behavior; uppercase tenant normalization; and AI request-context compatibility.

The implementation is consolidated in PR #257. PRs #268/#271/#276 overlap on the same firewall module and are not independently safe to merge.
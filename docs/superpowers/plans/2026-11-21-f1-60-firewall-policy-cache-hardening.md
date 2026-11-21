# F1.60 — Firewall Policy Cache and Resource-Boundary Hardening Plan

**Status:** Candidate implementation; local validation complete, hosted exact-head validation pending
**Design:** [F1.60 specification](../specs/2026-11-21-f1-60-firewall-policy-cache-hardening-design.md)
**Consolidation PR:** [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257)
**Tracking:** [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277)

## Goal

Consolidate firewall rule quotas, fail-closed policy refresh, generation-safe cache invalidation, and resolved-tenant request context into one reviewable implementation.

## Work units

### 1. Rule creation quotas

- [x] Export shared per-site (500) and platform (20,000) limits.
- [x] Serialize duplicate/quota validation and insert with a PostgreSQL advisory transaction lock.
- [x] Reject duplicate rules and quota exhaustion before audit/cache side effects.
- [x] Bound both cache query rows and accepted in-memory rows.
- [x] Test duplicate/quota outcomes and lock/count/insert ordering.

### 2. Policy validity

- [x] A database-backed policy starts invalid and becomes valid only after successful refresh.
- [x] Initial refresh failure and later refresh failures fail closed.
- [x] Keep validated static deployment-deny entries effective during database failure.
- [x] Preserve explicit no-pool local/static behavior.
- [x] Test refresh failure, later recovery, retry/backoff and the rules accessor.

### 3. Cache generation

- [x] Capture a generation for each refresh.
- [x] Discard results invalidated by clearCache.
- [x] Prevent old refresh completion from clearing a newer in-flight refresh.
- [x] Share same-generation refresh promises and bound retries after repeated invalidation.
- [x] Replace the bot's contradictory fail-open expectation with a fail-closed assertion.
- [x] Test stale allow/deny, deletion, concurrent refresh and rules() behavior.

### 4. Tenant and request context

- [x] Evaluate public slug rules again after site resolution; normalize site ID.
- [x] Use the socket peer address and User-Agent when the original HTTP request exists.
- [x] Do not treat X-Forwarded-For as trusted by default.
- [x] Pass the real request through AI generation and AI-task authorization.
- [x] Support lightweight internal request contexts without a Node socket.
- [x] Update AI and reusable-component mock PostgreSQL pools for the shared firewall policy query.

### 5. Documentation and validation

- [x] Create design, plan, candidate report and roadmap addendum.
- [x] Update architecture/operations documentation without implying managed-WAF coverage.
- [x] Regenerate tenant-isolation source artifacts.
- [x] Focused firewall/AI suite: 53/53 passed.
- [x] Component audit tests: 2/2 passed; tenant inventory tests: 2/2 passed.
- [x] Full local npm run check: 728 tests, 725 passed, 0 failed, 3 conditional skips.
- [ ] Push local follow-up changes and consolidated commits to PR #257.
- [ ] Pass exact-head Node 22/24, PostgreSQL/Memgraph, browser/accessibility, CodeQL and candidate evidence checks.
- [ ] Obtain trusted independent non-author approval and satisfy #230 before merge.
- [ ] Close or otherwise disposition the overlapping #268/#271/#276 proposals only after the consolidation branch is accepted.

## Release boundary

No version bump, release tag, publication or deployment. A passing candidate CI run is not production certification. Mainline remains NO-GO / NOT_PRODUCTION_CERTIFIED.
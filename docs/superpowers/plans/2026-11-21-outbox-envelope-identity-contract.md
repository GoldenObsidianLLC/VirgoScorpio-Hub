# Outbox Delivery Envelope Identity Contract Implementation Plan

> **For agentic workers:** This plan is executed inline in the isolated worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the validated PostgreSQL outbox envelope the identity authority for every durable delivery handler, with explicit event-family bindings and no delivery-semantics or public-contract changes.

**Architecture:** Define one immutable registry for the currently classified domain event families in `packages/realtime/src/event-contract.js`. A shared binding helper validates duplicated top-level identity fields against the v1 envelope and returns canonicalized payload identity; the row-to-envelope converter applies it once for both durable and compatibility consumers. The graph projector uses the same registry/helper at its direct boundary as defense in depth, while keeping its event-type mismatch contract.

**Tech Stack:** Node.js CommonJS, PostgreSQL, `node:test`, Markdown, GitHub Actions.

**Spec:** GitHub issue [#233](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233); current source-of-truth event contract in `packages/realtime/src/event-contract.js`.
**Execution status:** Implementation commit `ea5c2e58921976d1c4d5c758edc0f436f9a73ae3` and documentation validation commit `f32936e6943397c6573bccfc7512c7d3e1f1f81e` are pushed; [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) is open. Final-head push [#44927650089](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44927650089) and PR [#44927654855](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44927654855) completed successfully. The hosted PostgreSQL 18/Memgraph regression passed, including the tenant identity check. The PR remains unmerged because issue #230's independent reviewer and branch-policy prerequisites are still unmet.

## Global Constraints

- Preserve PostgreSQL as the canonical event source and v1 envelope contract.
- Keep event delivery at-least-once; do not change ordering, consumer-group leases, retries, dead-letter, replay or acknowledgement SQL.
- Bind only explicitly registered top-level identity keys; never recursively interpret arbitrary domain identifiers.
- Content uses payload `id`; taxonomy uses payload `id`; relationships use payload `relationshipId`. `sourceId` and `targetId` remain relationship endpoints, not aggregate identity.
- Validate site and aggregate identity before any handler side effect; compare UUID values case-insensitively and expose normalized envelope IDs.
- Keep F1.59 graph-projector checks as defense in depth.
- No schema, migration, HTTP/API, event schema, dependency, lockfile, package version or SemVer changes.
- Preserve unrelated dirty files in the primary checkout; work only in `.worktrees/outbox-envelope-contract-2026-11-21`.
- Package `0.6.2` remains private/unreleased and production remains NO-GO.

## Review Focus

- Missing or mismatched payload site identity must be rejected before a handler can create a side effect.
- Missing or mismatched content, taxonomy or relationship aggregate identity must be rejected using the correct family key.
- Mixed-case UUID inputs must compare correctly and be rewritten to canonical envelope values without mutating the original payload.
- Unrelated IDs such as relationship `sourceId`, `targetId`, nested metadata IDs and IDs on internal events must not be misclassified.
- Direct graph-projector calls with a separately supplied payload must still reject mismatches before Cypher.

---

### Task 1: Shared identity binding and delivery boundary

**Files:**
- Modify: `packages/realtime/src/event-contract.js`
- Modify: `packages/db/src/outbox-delivery.js`
- Modify: `packages/graph/src/memgraph-store.js`
- Test: `test/outbox-contract.test.js`
- Test: `test/outbox-delivery.test.js`
- Test: `test/memgraph-projector.test.js`

**Interfaces:**
- Produces `DOMAIN_EVENT_DEFINITIONS`, `EVENT_PAYLOAD_IDENTITY_BINDINGS`, and `bindEventPayloadIdentity(envelope, payload?, options?)`.
- `bindEventPayloadIdentity` returns a validated envelope and an immutable shallow copy of the bound payload; unregistered/internal events retain their payload semantics.
- `eventEnvelopeFromOutboxRow(row)` returns a v1 envelope whose registered domain payload identity is validated and normalized.
- Durable delivery handlers retain the existing `{ type, payload, envelope, delivery }` shape; `payload` is the bound envelope payload, never the raw row payload.

- [x] **Step 1: Write focused failing tests.** Cover all three identity families, mismatched/missing site and aggregate IDs, mixed-case UUID normalization, original-payload immutability, unrelated nested and relationship endpoint IDs, and unregistered internal messages.
- [x] **Step 2: Run the focused tests and confirm the new behavior fails for the intended reason.**
  Run: `node --test test/outbox-contract.test.js test/outbox-delivery.test.js test/memgraph-projector.test.js`
  Expected: new identity-binding assertions fail because no shared binding helper exists; existing tests remain otherwise valid.
- [x] **Step 3: Implement the single declarative domain-event definition registry and shared binding helper.** Derive the existing classification map from the definitions to avoid a second event-family registry. Apply binding from `eventEnvelopeFromOutboxRow`.
- [x] **Step 4: Route durable delivery and graph defense-in-depth through the shared helper.** Preserve handler shape, graph error codes, and all delivery SQL/state transitions.
- [x] **Step 5: Re-run focused tests and inspect the exact diff.**
  Run: `node --test test/outbox-contract.test.js test/outbox-delivery.test.js test/memgraph-projector.test.js test/graph-projection-worker.test.js`
  Expected: all focused tests pass; malformed identity never reaches the handler or graph write.

### Task 2: Live integration, architecture documentation and current release report

**Files:**
- Modify: `test/integration/postgres.integration.test.js`
- Create: `docs/security/OUTBOX-CONSUMER-IDENTITY-BOUNDARY.md`
- Modify: `docs/REALTIME-FOUNDATION-F1.md`
- Modify: `docs/REALTIME-AI-ARCHITECTURE.md`
- Modify: `docs/SECURITY-AND-THREAT-MODEL.md`
- Modify: `docs/IMPLEMENTATION-ROADMAP.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Create: `docs/reports/2026-11-21-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md`
- Modify: `docs/README.md` only if required to keep its current-status links coherent.

**Interfaces:**
- PostgreSQL integration exercises the real delivery worker against real outbox rows and checks that handler side effects are suppressed for mismatched identity.
- The security boundary document inventories the one active durable registration and the legacy compatibility entry point, clearly separating the Redis realtime bridge.
- Current release report records the exact source SHA, PR/run evidence, outstanding gates, and an explicit NO-GO / no-SemVer-change decision.

- [x] **Step 1: Add a live PostgreSQL regression first.** Use isolated fixture sites and real outbox rows to prove mismatched tenant/resource identity is rejected before the delivery handler executes; also verify per-consumer-group delivery and unchanged ordering/retry/replay behavior where a deterministic real integration assertion is practical.
- [x] **Step 2: Run the focused integration test.**
  Run: `node --test test/integration/postgres.integration.test.js`
  Local Windows invocation skipped because the database flag/service was not configured; hosted PR workflow #44892475091 executed the regression in live PostgreSQL 18/Memgraph as subtest 24 and passed 181/181 integration tests with zero skips.
- [x] **Step 3: Document the authoritative identity contract and trust-boundary inventory.** Keep architecture, security model, roadmap, changelog and README statements aligned with implemented behavior and issue #233; link rather than copy long duplicate explanations.
- [x] **Step 4: Write and update the dated 21 November release-gate report.** Do not rewrite the historical 20 November snapshot or claim a newly aggregated readiness score without a source-bound F1.59 artifact.
- [x] **Step 5: Verify links, Markdown, JavaScript, and the complete repository check.**
  Run: `npm run check`
  Expected: exit 0, with exact test totals and conditional skips recorded. Run `git diff --check` and the repository's Markdown relative-link validation if available.
- [x] **Step 6: Commit the bounded implementation and documentation.** Do not modify the package version, lockfile, schema or migrations.

## Release and integration boundary

- [x] Opened [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) against `main`, linked issue #233; do not merge it.
- Issue #230 currently blocks ordinary merges because a trusted non-author reviewer and enforceable branch review/CI policy are not yet configured.
- Hosted PR workflow #44892475091 completed successfully: Node 22/24 passed 683/683 Hub and 94/94 EnginEx tests; live PostgreSQL 18/Memgraph passed 181/181 with zero skips; fresh/idempotent migrations passed 18/18; browser/accessibility smoke, CodeQL and candidate evidence consolidation passed. Mainline-only signed SBOM/lockfile attestation was skipped by design and remains a post-merge gate.
- Recompute production readiness only from a freshly consolidated exact-main artifact. F1.59 mainline readiness is the current baseline; the F1.60 PR artifact is candidate-only and cannot replace the exact-main score until merge and post-merge validation. Production remains NO-GO.

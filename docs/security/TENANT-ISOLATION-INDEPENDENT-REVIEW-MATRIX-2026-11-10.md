# VirgoScorpio Hub 0.6.2 — Independent Tenant-Isolation Review Matrix

> **MAINTAINER-PREPARED REVIEW AID ONLY. NOT AN INDEPENDENT ASSESSMENT, SECURITY OPINION, PASS, WAIVER, OR RELEASE EVIDENCE.** An independent reviewer must own route discovery, methodology, test selection, execution, findings, conclusions, and retesting.

**Formal gate:** [Issue #14 — Independent tenant/site isolation and authorization review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14)
**Candidate:** `0.6.2`, private/unreleased developer preview
**Current main:** `eb156b7620929ae94421caf69b4ddb92ed679812`
**Exact-mainline evidence:** [Workflow #517](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42855470069), six jobs passed; live PostgreSQL/Memgraph suite **81/81, zero failures, zero skips**
**Companion:** [Release blocker triage](../reports/RELEASE-BLOCKER-TRIAGE-2026-11-10.md)
**Formal evidence destination after independent completion:** `artifacts/evidence/tenant-isolation-review.json`

## 1. Purpose and evidence boundary

The generated [10 November route/capability inventory](TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md) declares 27 flow families, 78 route patterns, 21 implementation/source files and 41 test references. The catalog is curated maintainer metadata. It is a navigation and drift-detection aid, not proof of complete route discovery, correct authorization, or passing tests.

PR #116 merged a focused two-site same-slug custom-content-type registry/record regression. Workflow #517 passed the live test. This is targeted maintainer regression evidence only. It does not satisfy independent review issue #14 or broader independent security issue #25.

A separate maintainer branch, `security/cloud-connection-tenant-isolation-2026-11-10`, contains additional cloud-connection regression assertions. It is unmerged and not part of the current main SHA or workflow #517. Its focused PostgreSQL test passed **2/2**, and the full local PostgreSQL/Memgraph/Redis runner passed **81/81, zero failures, zero skips** on a disposable local environment; `npm run check` passed **583/586** with zero failures and three Windows-specific skips. These are maintainer-authored checks on a dirty worktree under Node.js 26.12.1, not independent findings or hosted exact-SHA CI. The reviewer must decide whether that branch is in scope and must independently design and execute any tests.

## 2. Independence and safe execution

Before review, record reviewer name/organization/role/qualifications, independence and conflict declaration, agreed scope, dates, access method, environment, and reporting channel. Use synthetic data in a dedicated isolated environment. Never run adversarial cases against production, real customers, or shared staging. Keep credentials, tokens, exploit details, customer data, and sensitive provider configurations out of this repository.

The reviewer must check out the intended target, run `git rev-parse HEAD`, and record the exact full SHA and environment. A report or evidence record for another revision is not transferable. The reviewer must independently enumerate actual route registrations, methods, middleware, worker entry points, scheduled jobs, webhooks, provider callbacks, CLI tools, storage reads, and realtime entry points; then challenge or extend every row below.

## 3. Declared route and flow families

| # | Family | Independent review focus |
|---:|---|---|
| 1 | Health, readiness, metrics, static/admin surfaces | Diagnostics exposure, authentication boundaries, proxy/cache behavior |
| 2 | Authentication, MFA, recovery, federation, sessions | Token audience/state, revocation, cross-site invitation and callback handling |
| 3 | Site directory and creation | Enumeration, bootstrap authority, owner transfer, concurrent ownership |
| 4 | Membership and invitations | Role changes, last-owner rules, reuse/replay, revocation and notification side effects |
| 5 | Site configuration | Design systems, reusable components, templates, taxonomy, relationships, menus, AI policy, graph/cache/outbox effects |
| 6 | Custom content types and records | Same-slug definitions, list/detail/search/count, create/update/deactivate/delete, foreign IDs and versions |
| 7 | Pages, drafts, revisions and workflow | Ownership, publish/approve/restore, concurrency, version history and export |
| 8 | Collaboration sync and operations | Replay, reconnect, sequence ordering, membership revocation and cross-instance state |
| 9 | AI generation and tasks | Context selection, task cursor/payload binding, policy, provider gates, quotas and cancellation |
| 10 | Media upload and read | Site ownership, object keys, upload replacement, deletion and byte isolation |
| 11 | Library assets and versions | Downloads, variants, optimize, malware/quarantine, cleanup and legacy references |
| 12 | Public search/catalog/pages | Public-vs-private publication policy, counts, cache keys and invalidation |
| 13 | Public media/library variants | CDN/proxy rules, private URL revocation, provider IAM and all object variants |
| 14 | Commerce/products/orders/checkout/refunds | Idempotency, stock reservation, payment callbacks, refund, ambiguity and tenant scope |
| 15 | Membership plans/subscriptions | Site-bound plan selection, callbacks, entitlement transition and cancellation |
| 16 | Community profiles/groups/feed/friends | Privacy, membership visibility, group comments, profile and feed filtering |
| 17 | Community conversations/messages/blocks/reports/moderation/notifications | Participant authorization, fanout, abuse transitions and side effects |
| 18 | Plugins | Install/configuration/lifecycle, manifest trust, runner isolation and invocation boundaries |
| 19 | Firewall rules | Global/site precedence, rule management and cache invalidation |
| 20 | Cloud connections | Site-scoped list, credential reference, provider test, disable, health mutation, egress and SSRF controls |
| 21 | Mega menus | Same-slug isolation, optimistic concurrency, render/cache consumers |
| 22 | Stripe webhook callbacks | Signature, tenant metadata binding, duplicate/replay delivery and idempotency |
| 23 | Presence/realtime/SSE/WebSocket | Upgrade authorization, selector conflict, lease, heartbeat, reconnect and subscription revocation |
| 24 | PostgreSQL outbox/workers | Envelope validation, tenant routing, retry/replay, teardown and consumer coverage |
| 25 | Memgraph projection/rebuild | Site-scoped graph IDs, forged/stale events, deletion, replay and canonical rebuild |
| 26 | Redis relay | Site channel separation, hostile service payloads, ACL/failover and stale subscriptions |
| 27 | Library object reconciliation CLI | Traversal, remote orphan detection, retention, races, backup/restore and destructive apply |

This table mirrors the current maintainer inventory only. It is not a substitute for independent route and method discovery.

## 4. Cross-cutting adversarial dimensions

| Dimension | Minimum cases | Evidence oracle |
|---|---|---|
| Identity/session | Anonymous, invalid/expired/revoked session, Site B-only user, disabled user, stale session after membership removal | Established denial code; no identity or session data leak; unchanged membership/session state |
| Principal/capability | Owner, admin, manager, editor, member, author, unrelated user, delegated owner, role combinations | Effective capability at point of use; no privilege or owner transition after denial |
| Site selector | Path-only; path + header/query/body; conflicting, duplicate, malformed, missing, and alternate selectors | Error before tenant reads/writes, provider resolution, event creation or realtime subscription |
| Object identity | Foreign and nonexistent UUIDs, same slug/name in A and B, guessed IDs | Established non-disclosing 404/403; no foreign metadata, configuration or content leak |
| Operation class | List/search/count, detail, create/update, state transition, delete/revoke, export/download, async and realtime | Positive own-site control; before/after snapshots for both tenants and all dependent effects |
| Concurrency/lifecycle | Duplicate requests, stale versions, concurrent owner changes, callback replay, site deletion and restoration | Exactly one valid transition; no cross-tenant mutation or inconsistent effects |
| Storage/provider | Object bytes, versions, variants, secret reference, provider probes, callback and network egress | DB metadata and object hash; invocation count; no provider/secret resolution after denied request |
| Async/graph/cache | Outbox, workers, retry/replay, graph projection, shared cache, CDN and stale authorization | Event, graph, cache and consumer snapshots; invalidation and no stale disclosure |
| Realtime | Presence, SSE, WebSocket, collaboration join/write/replay and reconnect | Redis keys/channels, subscription state, sequence, close code and unaffected tenant control |

## 5. Denial invariants

For every denied cross-site request, check all applicable invariants—not only the HTTP response:

- No tenant row changed, including status, timestamp, version, counter, soft-delete flag, owner or membership.
- No outbox/event/delivery, audit, email, notification, task, webhook receipt, plugin invocation, payment, reservation, or collaboration operation was created.
- No secret reference was resolved, provider adapter initialized, network probe made, or external callback/runner invoked.
- No graph projection, cache invalidation, Redis key/channel/lease, realtime subscription, object bytes, variant, temporary URL, or public visibility changed.
- Error bodies, headers and logs disclose no foreign names, labels, content, credentials, provider config or secret reference beyond the established not-found/forbidden contract.
- Positive controls prove the legitimate Site B actor can still perform the authorized action within Site B.

## 6. Cloud-connection priority walkthrough

Mainline source uses `siteIdFor`, requires `cloud:manage`, and scopes the cloud connection list, test lookup, and disable update with both `site_id` and connection ID. The local maintainer follow-up extends `test/integration/tenant-isolation.integration.test.js` with:

1. A Site B-only actor whose role grants only `cloud:manage`.
2. Site A and Site B synthetic cloud connection records with deliberately unresolved `vault://` credential references; no external provider is contacted.
3. Site B list isolation; foreign Site A `/test` and `/disable` IDs return the existing non-disclosing 404.
4. Header, query, body and duplicate-query selector mismatch rejection, with both tenant rows compared before/after.
5. Positive Site B `/test` and `/disable` controls.

This is unmerged maintainer work and its live assertions remain unexecuted until an approved disposable PostgreSQL environment is supplied. It does not verify real vault integration, provider IAM, real object-store lifecycle, egress/SSRF policy, or live provider acceptance. The independent reviewer should challenge the assumptions and independently design/execute tests.

## 7. Independent reviewer result worksheet

Record, at minimum:

- Exact full commit SHA, branch/tag, repository URL, date, runtime versions, deployment/configuration and test environment.
- Reviewer identity, qualifications, independence statement, conflict declaration, scope and approved test authorization.
- Independently discovered route/handler/worker/callback/CLI inventory, methods, capabilities, data reads, writes and external side effects.
- Per-case preconditions, actor/tenant role, request or action, expected outcome, actual result, logs/DB/object/event snapshots and reproducibility.
- Findings with severity, impact, exploit preconditions, affected versions, remediation, owner, retest result and residual risk.
- Explicit limitations, untested areas, assumptions, evidence hashes and final conclusion.

Only the independent reviewer/authorized gate owner can create or accept `artifacts/evidence/tenant-isolation-review.json`. Do not populate it from maintainer-authored tests, maps or summaries. Keep issue #14 and #25 open until their own independent acceptance criteria are satisfied. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

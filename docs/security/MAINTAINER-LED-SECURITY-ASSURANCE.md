# Maintainer-Led Security Assurance

> **Status:** Active internal engineering control for the restricted VirgoScorpio Hub 0.6.2 developer preview.
> **Assessment type:** Maintainer-authored and automated checks only.
> **Production certification:** **NOT CERTIFIED — NO-GO.**
> **Current main baseline at adoption:** `762e3fbc25f6b98c52815b5653c54fd05826ddb3` (PR #123 merge; mainline workflow #552 passed 7/7 jobs).

## 1. Purpose and decision

Independent tenant-isolation and platform-wide security assessors are not currently available to the project. Development will therefore continue using a documented, maintainer-led assurance process rather than remain indefinitely blocked waiting for an external reviewer.

This is a **development-continuity decision**, not a claim that independent review has occurred, not a substitute for it, and not acceptance of production risk. The separate independent-assessment issues remain open:

- [#14 — Independent tenant/site isolation and authorization review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): **OPEN / NOT PERFORMED**.
- [#25 — Independent platform security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): **OPEN / NOT PERFORMED**.

These issues remain production certification gates, but they do not block ordinary internal software development or isolated, non-production developer-preview testing. Do not close them, populate their independent evidence contracts, or relabel maintainer work as independent assurance.

The supported development boundary remains the one in [Release Scope](../RELEASE-SCOPE.md): private, isolated, self-hosted developer preview with synthetic or non-sensitive test data. This document does not authorize production deployment, public service operation, live customer data, paid work, external assessor engagement, or spending.

## 2. Assurance terminology

Use precise labels in issues, pull requests, reports and evidence:

| Label | Meaning | What it does not mean |
|---|---|---|
| `MAINTAINER_TESTED` | A named maintainer ran a recorded test/check against an exact revision and environment. | Independent review or production acceptance. |
| `AUTOMATED_CI_PASS` | The required automated job completed successfully for the exact source SHA and run attempt. | Complete coverage, absence of vulnerabilities, or certification. |
| `TARGETED_REGRESSION_PASS` | A test verifies a defined threat or failure scenario. | Exhaustive route discovery or proof that adjacent paths are safe. |
| `NOT_RUN` / `SKIPPED` | A check did not execute in that environment. | Pass, absence of a defect, or evidence of completion. |
| `INDEPENDENT_REVIEW_NOT_PERFORMED` | No qualified external assessment was completed. | A waiver, dismissal, risk acceptance, or closed gate. |

Every recorded result should include the exact commit SHA, command or workflow URL, environment, test totals including skips, outcome, limitations and artifact digest where applicable. A report produced on one SHA must not be copied forward as evidence for another SHA.

## 3. Maintainer assurance workflow

Apply these controls to each security-sensitive change and to each candidate baseline.

### 3.1 Source and dependency integrity

- Work from a clean, named branch based on the current maintained `main`.
- Record the exact base SHA and candidate SHA; inspect the complete diff and staged files.
- Preserve pinned submodule commits. Initialize with `git submodule update --init --recursive` when needed; do not advance a submodule as part of unrelated work.
- Keep dependencies and lockfiles unchanged unless the change specifically requires them. For dependency updates, review the full direct/transitive graph and run the supported npm audit/SBOM checks.
- Do not suppress scanners, weaken fail-closed checks, or introduce environment-selected executables or shell interpolation to make a CI job pass.

### 3.2 Tenant and authorization controls

For every site-addressed route or workflow:

- Resolve the selected site through the shared site-context resolver; reject conflicting path/header/query/body selectors before side effects.
- Authenticate the principal and enforce the route's required capability before storage mutations, provider calls, outbox publication, mail intents, audit writes or other side effects.
- Keep tenant predicates in the authoritative store query; do not rely on post-query filtering as the security boundary.
- Preserve non-disclosing responses for foreign identifiers and unavailable resources.
- Verify both positive Site A access and negative Site A-to-Site B denial paths.
- Compare before/after state for relevant tenant-owned records and side-effect stores: memberships, invitations, audit events, mail outbox, object metadata and authorization invalidation where applicable.
- Test concurrency and transaction boundaries for operations whose invariants can be violated by parallel requests.

### 3.3 Regression and integration tests

- Run the smallest affected unit/route test first.
- Add negative-path, capability-ordering, cross-site, no-side-effect, transaction rollback, concurrency and recovery coverage appropriate to the change.
- Regenerate the source-anchored tenant route inventory with `npm run security:tenant-inventory` when a source or test anchor changes, then confirm it is current.
- Run `npm run check` and `npm audit --audit-level=high`.
- The dedicated PostgreSQL/Memgraph/Redis integration workflow must execute against disposable CI services for changes that affect persistence, authorization, outbox, graph projection or recovery. A local test skipped because no database is configured is recorded as **SKIPPED**, not passed.
- Use a disposable database and synthetic principals. Never point destructive setup or fault-injection at production or customer data.

### 3.4 Hosted CI and supply-chain evidence

For a merge candidate, require the supported Node.js matrix, unit/security/dependency jobs, live integration where applicable, browser/accessibility smoke where applicable, CodeQL and consolidated evidence checks. On main, also require exact-main provenance and signed SBOM verification.

Record the workflow URL and exact head SHA. Retain the run-bound artifacts and digests. A branch/PR run that skips main-only signing does not prove mainline attestation. An upload or evidence-aggregation failure remains a failed required check even when test steps themselves passed.

### 3.5 Diff review and evidence hand-off

- Review the resulting diff for duplicated logic, contract drift, accidental scope expansion, insecure fallbacks and mismatches between code, tests and documentation.
- Keep error behavior and response contracts stable unless a separately scoped change deliberately updates them.
- Record uncovered scenarios as explicit limitations or follow-up work; do not silently drop them.
- If the same maintainer authors and checks the change, describe it as maintainer self-review. Do not imply a second reviewer or peer approval.
- Keep formal independent evidence files unpopulated until the corresponding independent assessment actually occurs and is accepted.

## 4. Architecture invariants

The assurance process preserves the existing system boundaries:

- **PostgreSQL is authoritative** for transactional application and tenant state.
- **Memgraph is a rebuildable projection** fed through the PostgreSQL transactional outbox; it is not a source of truth.
- **Redis Pub/Sub and presence are ephemeral** and must not be treated as durable history.
- Site context and capability checks occur before side effects.
- External provider credentials remain unresolved `vault://` references unless a provider has been explicitly configured and qualified. Tests use mocks or disposable test services by default.
- Production malware scanning remains fail-closed when the scanner is unavailable or unconfigured.
- PostgreSQL and object storage do not share an atomic transaction; reconciliation/compensation remains explicit.

Do not create parallel authorization systems, duplicate canonical identifier or transaction helpers, or broad abstractions that erase provider, queue, storage or worker differences.

## 5. Current maintainer-led tenant work

The latest targeted improvement serializes site membership removals on the site's PostgreSQL row before checking the active owner count. This prevents two concurrent site owners from observing the same count and removing each other.

The associated integration regression is designed to prove that two simultaneous owner-removal requests result in exactly one successful removal, one `ERR_VIRGOSCORPIO_HUB_LAST_OWNER` response, one remaining active owner and one matching audit record. The test runs only with the dedicated disposable PostgreSQL integration environment. It must be reported as skipped when that service is unavailable locally.

This remains targeted maintainer evidence, not an exhaustive assessment of all route families or the platform threat model. F1.22 merged in PR #127 at main commit `3c5df47f7a397f76a5368ef7bc036579e5406835`; hosted exact-PR-head #559/#560 and exact-main workflow [#563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056) passed the role-capability matrix, cross-site/disabled-user denials, membership add/remove lifecycle, authenticated in-process SSE revocation, selector-conflict/no-side-effect tests and concurrent-owner regression. The exact-main live PostgreSQL/Memgraph suite passed 85/85 with zero failures/skips; #563 also passed both Node matrices (590/590 each), CodeQL, browser/accessibility (9/9), collaboration Playwright (3/3), main-only attestation and evidence consolidation. GitHub shows no formal review submission for PR #127; this remains maintainer/automation evidence, not independent review.

F1.23 was merged via PR #128 at main 7b3fe3f857bd20bf5d56bcc31a2044a89ffcfbb3. It adds the site-scoped site.invitation_accepted audit event in the same transaction as invitation consumption and membership insertion, carries the HTTP request ID into audit_events.request_id, and leaves authorization invalidation post-commit. Unit tests verify commit ordering, rollback when audit persistence fails, persisted email-verification metadata and rejection of site-owner escalation before database access. The live fixture covers new/existing-account acceptance, cross-site membership preservation, disabled/expired/replayed/concurrent redemption, single-winner audit/invalidation, raw-token exclusion from audit metadata and owner-role escalation rejection. Exact PR-head workflows #566/#567 and docs-final #568/#569 passed; current-main workflow #570 passed all seven jobs, with 90/90 live PostgreSQL/Memgraph integration, Node 22/24 each 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3 and main-only attestation. Local npm run check passed 595 tests (592 passed, 0 failed, 3 Windows-specific skips); local live DB integration remains skipped without a disposable DATABASE_URL. GitHub records no formal PR review submission; this is maintainer/automation evidence, not independent assessment. The existing API has no owner-transfer operation; any future transfer requires authorized product/API scope, explicit last-owner/atomicity/session-revocation design and separate security assessment.

F1.24 merged via PR #129 at main 5929a53a1c551a2fe43bc38e61cb63dbecec52f5. Exact PR-head workflows #572/#573 and exact-main #574 passed 91/91 live PostgreSQL/Memgraph integration with zero failures/skips, including audit trigger failure, transaction rollback, token-digest preservation, no invalidation and same-token retry. Node 22/24, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3, fresh migrations and signed main attestation passed. No formal review submission was recorded; maintainer/automation evidence only. No runtime authorization or schema change was introduced.


The generated tenant inventory lists 27 flow families, 78 declared route patterns, 21 source files and 42 referenced test files; it is a navigation/drift-detection aid, not proof of complete route discovery or independent security acceptance.

## 6. Explicit boundaries and remaining gates

Maintainer-led checks allow development and restricted preview evaluation to continue. They do not authorize production use. The following remain separate:

| Issue | Status | Meaning |
|---|---|---|
| #14 | OPEN / NOT PERFORMED | Independent tenant/site isolation review remains incomplete. |
| #25 | OPEN / NOT PERFORMED | Independent platform-wide security assessment remains incomplete. |
| #23 | OPEN / PARTIAL | Human dependency, license/distribution, provenance and CodeQL acceptance remains outstanding. |
| #13 | OPEN | Authorized 0.6.2 scope/provider decision remains outstanding. |
| #24 | OPEN | Load/soak, fault injection and full backup/restore with measured RPO/RTO remain outstanding. |
| #26 | OPEN | Named operating/release owners and deployment, migration, rollback and recovery rehearsals remain outstanding. |
| #32 | OPEN | Governance and zero-reserve operating/capital controls remain subject to proper governing-authority decisions. |

No issue is closed by this policy. No independent-review evidence file is created or populated. No legal conclusion is made about GPL/LGPL distribution obligations. No assessor, vendor, worker, purchase or spending engagement is authorized.

## 7. SemVer and release policy

This internal assurance policy and compatible concurrency correction do not change the public API, database schema, migrations, provider contract or dependency graph. Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No SemVer increment, release tag, GitHub Release, npm publication or deployment is authorized.

**Final disposition:** Continue internal engineering under maintainer-led controls; retain **NO-GO / NOT_PRODUCTION_CERTIFIED** until all applicable release, operational, governance and independent-assurance gates have genuinely been satisfied and accepted.


F1.25 merged in PR #130 at main 9f8e612c883a78d322d2086b4b08d3438b0b9231. Exact-head #575/#576 and docs-final #577/#578 each passed 92/92 live PostgreSQL/Memgraph tests with zero failures/skips, covering Site B site:manage denial-before-persistence and concurrent same-slug version progression while preserving Site A. Node 22/24 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3 and dependency audits passed. No formal review submission was recorded; maintainer/automation evidence only. This adds no production runtime/schema behavior.

F1.26 merged via PR #131 at main `0748f56e01421d13121ec08f7bc036579e5406835`. Exact PR-head workflows #580/#581 and exact-main #582 passed the Redis 7.4 outage/reconnect Playwright scenario and 92/92 PostgreSQL/Memgraph integration with zero failures/skips. Node 22/24 each passed 594/594; CodeQL, browser/accessibility 9/9, collaboration Playwright 4/4, fresh migrations, main-only signed attestation and evidence consolidation passed. No formal review submission was recorded; maintainer/automation evidence only. Pub/Sub is ephemeral and this does not prove replay/durable delivery of missed messages; PostgreSQL and command/heartbeat reauthorization fallbacks remain essential.

F1.27 is an unmerged maintainer candidate on branch `security/editorial-workflow-role-gates-2026-11-12`, based on main `0748f56e01421d13121ec08f7bc036579e5406835`, under issue #124. The `submit-review` route now reuses `canEditContent` after the site-level capability check, so authors may submit only their own drafts while editors/site owners retain site-wide behavior. The live two-site fixture covers seeded author/editor/owner transitions and asserts denied workflow requests leave content, workflow, audit, outbox and collaboration state unchanged. Focused API tests passed 26/26; local `npm run check` passed 595 tests (592 passed, 0 failed, 3 Windows-specific skips); exact-head hosted PostgreSQL/Memgraph validation remains pending because this host has no disposable DATABASE_URL. No API contract, schema, migration, dependency, provider or package-version change is introduced. This remains maintainer-led evidence, not independent security acceptance.

## 8. F1.28 direct membership audit atomicity — merged mainline evidence

[Issue #139](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/139) is closed by merged [PR #140](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/140), which added direct membership audit atomicity under parent [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). The direct member-add/remove services write matching audit events in the membership transaction through the existing `withTransaction(pool, work)` utility and shared parameterized `insertAuditEvent(queryable, input)` helper. Routes pass the authenticated actor and request ID and no longer issue duplicate audit writes. The per-site last-active-owner row lock and capability/site-context ordering remain unchanged. Authorization invalidation is post-commit and only for real transitions; no-op operations produce neither audit nor invalidation. Invitation acceptance remains atomic and now reuses the shared helper.

The change merged to `main` at `e4712202d3d29c5517e335df658ce5f6d72a25cb` on 14 November 2026. Exact-main [workflow #603](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43535587342) completed successfully with all seven jobs: Node.js 22.23.4/24.22.1 each passed 600/600 Hub tests and 94/94 EnginEx tests; PostgreSQL/Memgraph passed 94/94 with zero skips; 18/18 fresh migrations applied and 18/18 idempotently skipped; browser/accessibility smoke, CodeQL, signed mainline dependency/SBOM attestation and evidence consolidation passed. PostgreSQL-backed collaboration Playwright passed 4/4. The hosted live integration suite explicitly executed the F1.28 fault-injection rollback/retry case.

Local validation: `npm run check` passed 600 tests (597 passed, zero failures, three Windows-specific skips), covering 235 required paths and 249 JavaScript files. The focused live PostgreSQL tenant-membership integration file passed 20/20 with zero skips. The inventory was current (27 flow families, 78 route patterns, 21 source files and 42 test references); `npm audit --audit-level=high` found zero vulnerabilities. The broader local live suite returned 93 pass / 1 fail / 0 skips because a separate Redis-outage recovery scenario timed out while waiting for bridges and the presence client to reconnect within 45 seconds. This local limitation is recorded; the exact-main hosted suite passed 94/94, including Redis outage/recovery.

This remains maintainer implementation/test evidence only. GitHub records no formal review submission on PR #140; merge and automated checks do not replace independent assurance. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED. Parent #124 remains open. Package 0.6.2 remains private/unreleased, with no SemVer, API, schema or migration change.
## 9. F1.29 site-creation audit atomicity candidate (issue #141)

F1.29 is an unmerged maintainer candidate on branch `security/f1-29-site-creation-audit-atomicity-2026-11-14`, based on main `e4712202d3d29c5517e335df658ce5f6d72a25cb`, tracked by [issue #141](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/141) under parent #124. Source inspection found the `POST /api/v1/sites` service committed the site and initial owner membership before a separate route audit call. The candidate moves `site.created` into the same transaction using the existing `withTransaction` and `insertAuditEvent` helpers, threads request correlation through the route, and removes the duplicate audit call. Existing capability checks, developer-token denial-before-body-read, validation and HTTP behavior remain unchanged. The unique-slug conflict translation is limited to the site insert so an audit-table 23505 is not misclassified.

Local candidate evidence: focused auth/API tests passed 43/43 with zero skips; the disposable PostgreSQL 18 tenant-membership integration suite passed 21/21 with zero skips after all 18 migrations were applied; full `npm run check` passed 607 tests (604 pass, 0 fail, 3 platform-specific skips); repository verification passed 235 required paths / 246 JavaScript files; tenant-inventory freshness passed (27 families, 78 patterns, 21 source files, 42 test references); and `npm audit --audit-level=high` found zero vulnerabilities. The database trigger regression verified rollback of the new site and owner membership when `site.created` persistence fails, plus a successful correlated retry.

The branch is pushed as [PR #142](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/142) at candidate commit `7a0f170dc4b704ac7f45a7e2100ffbe70c98c325`; both exact-head push/PR workflows #43558785306 and #43558883401 passed (Node 22/24 each 607/607 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph 95/95 with zero skips; browser/accessibility, CodeQL and evidence consolidation passed). The mainline-only attestation job skipped as expected. No human review has been submitted. This is maintainer/automation evidence only, not independent tenant or platform security acceptance. Issue #141 and parent #124 remain OPEN; independent reviews #14/#25 remain OPEN / NOT PERFORMED. Do not populate independent-review evidence, close an independent gate, update the mainline release manifest with candidate results, or change the production NO-GO decision.

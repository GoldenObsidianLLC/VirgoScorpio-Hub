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

F1.23 was merged via PR #128 at main 7b3fe3f857bd20bf5d56bcc31a2044a89ffcfbb3. It adds the site-scoped site.invitation_accepted audit event in the same transaction as invitation consumption and membership insertion, carries the HTTP request ID into audit_events.request_id, and leaves authorization invalidation post-commit. Unit tests verify commit ordering, rollback when audit persistence fails, persisted email-verification metadata and rejection of site-owner escalation before database access. The live fixture covers new/existing-account acceptance, cross-site membership preservation, disabled/expired/replayed/concurrent redemption, single-winner audit/invalidation, raw-token exclusion from audit metadata and owner-role escalation rejection. Exact PR-head workflows #566/#567 and docs-final #568/#569 passed; current-main workflow #570 passed all seven jobs, with 90/90 live PostgreSQL/Memgraph integration, Node 22/24 each 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3 and main-only attestation. Local npm run check passed 594 tests (591 passed, 0 failed, 3 Windows-specific skips); local live DB integration remains skipped without a disposable DATABASE_URL. GitHub records no formal PR review submission; this is maintainer/automation evidence, not independent assessment. The existing API has no owner-transfer operation; any future transfer requires authorized product/API scope, explicit last-owner/atomicity/session-revocation design and separate security assessment.

F1.24 merged via PR #129 at main 5929a53a1c551a2fe43bc38e61cb63dbecec52f5. Exact PR-head workflows #572/#573 and exact-main #574 passed 91/91 live PostgreSQL/Memgraph integration with zero failures/skips, including audit trigger failure, transaction rollback, token-digest preservation, no invalidation and same-token retry. Node 22/24, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3, fresh migrations and signed main attestation passed. No formal review submission was recorded; maintainer/automation evidence only. No runtime authorization or schema change was introduced.


The generated tenant inventory lists 27 flow families, 78 declared route patterns, 21 source files and 41 referenced test files; it is a navigation/drift-detection aid, not proof of complete route discovery or independent security acceptance.

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

F1.26 is a test-only Redis Pub/Sub re-subscription candidate on branch security/redis-pubsub-resubscribe-2026-11-12 under issue #124. Its gated Playwright test stops/restores only the full-ID-verified disposable redis:7.4-alpine CI service through credential-free loopback Redis, verifies both API bridges reconnect, then proves a new Site A membership revocation reaches the remote subscriber exactly once and closes only the revoked Site A collaboration socket with code 1008 before the test-only 60-second heartbeat. The unaffected Site B socket remains usable and no collaboration history is changed. No production realtime code/API/schema/migration/dependency/provider/package-version change is introduced. Local syntax and focused Redis tests passed; npm run check passed 594 tests (591 passed, 0 failed, 3 Windows-specific skips). The live Redis stop/restore Playwright test is CI-only and exact-head hosted PostgreSQL/Redis/Playwright validation is pending. Pub/Sub is ephemeral: no replay/durable delivery is claimed for messages lost while Redis is unavailable; PostgreSQL remains authoritative and existing command/heartbeat reauthorization fallbacks remain necessary. Human review pending; maintainer evidence only.

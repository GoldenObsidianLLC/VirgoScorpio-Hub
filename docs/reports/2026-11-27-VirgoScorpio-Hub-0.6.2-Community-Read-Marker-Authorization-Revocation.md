# VirgoScorpio Hub 0.6.2 — F1.78 Community Read-Marker Authorization Revocation Implementation Report

**Tracking issue:** [#315](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/315) — closed as completed
**Pull request:** [#316](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/316) — merged
**Final PR head:** 71af5dd0f69497d5791480ea19bdb19589bcc0cd
**Merge / exact main SHA:** 840fd5e5dfbcafba0be5c7c80739c4f17a93682c
**Exact-main workflow:** [#46066130972](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972) — success, 7/7 jobs
**Readiness artifact:** [#15230394562](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972/artifacts/15230394562)
**Package:** virgoscorpio-hub@0.6.2 — private, unreleased

## Finding and reproduction

GET conversation messages previously used request-entry site membership preflight, then independently checked a conversation-member row, updated last_read_at, and selected messages without a transaction-scoped active-site membership check. Conversation membership rows can outlive site membership.

Hosted PostgreSQL barriers reproduced the stale request: pause the real GET handler after siteIdFor authorized membership; delete site_memberships for the actor on the independent database connection; resume the handler. Before the fix, the handler proceeded through the surviving conversation-member row and advanced last_read_at. Pre-fix workflow #46063371203 reported 203 tests, 202 passed, one failed and zero skipped. The failure was the marker-revocation regression.

## Implementation

- GET messages now runs in withTransaction, calls assertActiveSiteMembership first, then locks/revalidates the conversation-member row and updates last_read_at before selecting messages in that same transaction.
- Conversation-read POST now uses the same site-first authorization order and commits last_read_at plus related social_notifications.read_at updates atomically.
- Notification read-all and specific-notification read use transactions and call assertActiveSiteMembership before marker updates.
- The implementation reuses withTransaction, assertActiveSiteMembership and existing site-first lock ordering. No duplicate authorization SQL abstraction or schema/migration change was added.
- HTTP response shapes, actor/site scoping, 403 behavior and non-disclosing 404 behavior are preserved.

## Hosted PostgreSQL regression coverage

1. GET messages after membership revocation: request denied, no messages disclosed, last_read_at unchanged.
2. Conversation-read POST after account disablement: denied, both conversation and related notification markers unchanged.
3. Notification read-all after membership revocation: denied, all unread rows remain unread.
4. Specific-notification read after membership revocation: denied, selected notification remains unread.
5. Active-member positive controls prove updates are scoped to the selected site; other-site conversation and notification snapshots remain unchanged.
6. Forced failure between conversation and notification marker writes proves both updates roll back.

## Local validation

- Focused community suite: 18/18 passed; zero failures/skips.
- Full Hub suite: 1,142 passed / 0 failed / 3 Windows-specific skips (1,145 total).
- node scripts/verify.js: 241 required paths / 316 JavaScript files syntax-checked.
- Tenant-isolation inventory regenerated and --check passed: 28 families / 80 route patterns / 22 source files / 61 test files.
- Source/integration syntax checks and git diff --check passed.

## Hosted validation

Final PR head 71af5dd0f69497d5791480ea19bdb19589bcc0cd passed push #46065565513 and PR-context #46065609242. Both passed Node.js 22.23.4 and 24.22.1 (1,145/1,145 Hub tests each, zero skips), hosted PostgreSQL/Memgraph (203/203, zero failures/skips), browser smoke (9/9), CodeQL and candidate evidence consolidation.

Exact-main workflow #46066130972 passed all seven jobs on merge SHA 840fd5e5dfbcafba0be5c7c80739c4f17a93682c. It passed 22/22 fresh migrations, 22/22 idempotent skips, live Memgraph outage and graph-rebuild probes, signed mainline lockfile/SBOM attestations and source-bound readiness consolidation.

Canonical readiness artifact #15230394562 is source-bound to 840fd5e5dfbcafba0be5c7c80739c4f17a93682c (archive SHA-256 f01b45d329da8d397d6c1f85db6b1e4be1642f89a76200e3926b99a747019322; readiness JSON SHA-256 f3a645148ab2bd806eb823b4c756d72278667e9f4128ddddd4f0e2f334287876; readiness Markdown SHA-256 52011ae4f706c776a1b7ef077d181968b99f9a49627364f8cb56da854fc68c99). Readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

## Review and release boundary

PR #316 recorded one repository-owner COMMENTED self-review under the single-maintainer policy. This is maintainer evidence, not independent approval. Parent issue #124 and independent reviews #14/#25 remain open; human dependency review #23 remains PARTIAL.

Issue #315 was closed after merge. This report covers only community conversation/message and notification read-marker mutations; it does not certify every community workflow. Package 0.6.2 remains private/unreleased. No SemVer bump, tag, GitHub Release, publication, deployment or production promotion is authorized.

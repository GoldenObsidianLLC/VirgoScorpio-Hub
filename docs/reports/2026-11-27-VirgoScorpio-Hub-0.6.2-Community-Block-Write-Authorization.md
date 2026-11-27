# VirgoScorpio Hub 0.6.2 — F1.77 Community Block-Write Authorization Implementation Report

**Tracking issue:** [#312](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/312) — closed as completed
**Pull request:** [#313](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/313) — merged
**Final PR head:** 6aaf9e13d99893fcfc51f3c9f5e256dbc6ca190c
**Merge / exact main SHA:** 06b91c2d3e57120882294679bc1569d6b2a47f0c
**Exact-main CI:** [workflow #46050954042](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46050954042) — success, 7/7 jobs
**Package:** virgoscorpio-hub@0.6.2 — private, unreleased

## Finding

Community block create/delete checked authorization at request entry, but their final mutations used direct pool writes. Block create checked target membership before a separate upsert, and unblock deleted directly after route-entry authorization. A site-membership or account revocation could commit after preflight and before the mutation.

## Implementation

- Added lockActiveSiteParticipants, which locks the site, then participant users and memberships in deterministic UUID order.
- Block creation revalidates actor and target active account/site membership inside the same transaction as the social_blocks upsert.
- Unblock revalidates actor active site membership inside its delete transaction using the existing helper.
- Direct-conversation creation reuses the participant-lock helper while preserving its advisory pair lock and stronger FOR UPDATE row locks.
- Existing 403 actor-denial and generic 404 target-denial behavior remains; no schema, migration, API response, dependency, lockfile or SemVer change.

## Regression coverage

Hosted PostgreSQL covers five deterministic scenarios: actor membership removal after POST body parsing (403/no block row); actor account disablement after POST body parsing (403/no block row); target membership removal after target preflight (generic 404/no block row); actor membership removal before unblock (403/existing block remains); and reciprocal concurrent block requests (both complete without deadlock). Tests reuse createGate() and restore fixture state.

## Local validation

- Focused community suite: 18/18 passed; zero failures/skips.
- Full top-level suite: 1,145 total; 1,142 passed; zero failures; three Windows-specific skips.
- node scripts/verify.js: 241 required paths / 316 JavaScript files syntax-checked.
- Tenant inventory: 28 families / 80 route patterns / 22 source files / 61 referenced test files.
- Source/integration syntax and git diff --check passed.
- Local PostgreSQL was not configured; hosted CI supplies live race evidence.

## Hosted validation

Final PR head 6aaf9e13d99893fcfc51f3c9f5e256dbc6ca190c passed push [#46050444314](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46050444314) and PR-context [#46050450685](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46050450685). Both passed Node 22/24 (1,145/1,145 Hub tests each), PostgreSQL/Memgraph (203/203, zero failures/skips), browser smoke (9/9), CodeQL and candidate evidence consolidation.

Exact-main workflow [#46050954042](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46050954042) passed all seven jobs on merge SHA 06b91c2d3e57120882294679bc1569d6b2a47f0c. It passed 22/22 fresh/idempotent migrations, signed mainline lockfile/SBOM attestations, SBOM parity and source-bound evidence finalization.

Canonical readiness artifact [#15224526916](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46050954042/artifacts/15224526916) is bound to 06b91c2d3e57120882294679bc1569d6b2a47f0c; archive SHA-256 8a9c0bdf1dc62b6ae246aa809ea272810420c520901d7291200b5c3b882f605fe; readiness JSON SHA-256 65338e67128bf3f884a89f511eb7eabacef5e3b02f1f7e04ac3396117eff0a21. It remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

## Review and release boundary

PR #313 recorded one repository-owner COMMENTED self-review under the single-maintainer ruleset. This is maintainer evidence, not independent approval. Parent issue #124 and independent reviews #14/#25 remain open / NOT PERFORMED.

Issue #312 was closed after merge. This report covers only block creation and unblock; it does not certify all community workflows. Package 0.6.2 remains private/unreleased. No SemVer bump, tag, GitHub Release, publication, deployment or production promotion is authorized.

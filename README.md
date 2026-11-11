<a id="readme-top"></a>

<div align="center">

# VirgoScorpio Hub

**A modular Node.js application platform designed to augment human capability through secure, governed human-AI collaboration.**

[![VirgoScorpio Hub](https://img.shields.io/badge/VirgoScorpio%20Hub-v0.6.2-c49a3a)](package.json)
[![EnginEx](https://img.shields.io/badge/EnginEx-v7.0.0-6f42c1)](vendor/enginex/package.json)
[![VirgoScorpio Hub CI](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/workflows/ci.yml)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/License-GPL--2.0--or--later-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.23.4-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[Overview](#overview) · [Capabilities](#capabilities) · [Quick start](#quick-start) · [Architecture](#architecture) · [Documentation](docs/README.md) · [Change record](change.md) · [Governance](GOVERNANCE.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Contributors](CONTRIBUTOR_RECOGNITION.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Research & Collaboration](RESEARCH_COLLABORATION.md)

</div>

> **Project status — 10 November 2026:** VirgoScorpio Hub **0.6.2** remains a private, unreleased self-hosted developer preview; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. Current `main` is `c7653bb433ae8b363925d13babf239e64b2b5125`, where PR [#118](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/118) merged the targeted Site A/B cloud-connection tenant-isolation regression and closed issue #117. Exact-mainline [workflow #522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157) passed all six required jobs: Node.js 22.23.4 and 24.22.1 dependency/unit/security checks, live PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL and consolidated evidence. Workflow success is maintainer CI evidence; it does not satisfy independent reviews or authorize production. F1.20 issue #113 remains CLOSED / ACCEPTED for the restricted developer-preview reliability scope.

The maintainer-generated tenant-isolation inventory declares 27 flow families, 78 route patterns, 21 implementation/source files and 41 referenced test files. PR #118 is now merged at current main `c7653bb433ae8b363925d13babf239e64b2b5125`; its live cloud-connection regression is covered by exact-mainline workflow #522. The regression verifies Site B listing isolation, non-disclosing foreign-ID `test`/`disable` responses, selector-conflict rejection and unchanged tenant rows under a Site B-only `cloud:manage` actor. Local focused PostgreSQL coverage passed **2/2**, the full local PostgreSQL/Memgraph/Redis runner passed **81/81** with zero failures or skips, and `npm run check` passed **583/586** with three Windows-specific platform skips. These are maintainer-authored regression tests, not independent security acceptance. The inventory is a navigation and drift-detection aid, not proof of complete route discovery. Independent tenant-isolation review #14 remains OPEN / NOT PERFORMED, and broader independent security review #25 remains open. The fixtures use unresolved `vault://` references and make no provider network calls.

Outstanding release blockers include #13 (release-scope approval), #14 and #25 (independent security review), #23 (supply-chain review), #24 (load/soak and backup/restore), #26 (operations/rollback ownership) and #32 (governance). The issue #23 candidate branch `security/dependency-supply-chain-review-2026-11-10` passed workflow #524's six non-attestation jobs on its exact code/lockfile SHA; main-only attestation was skipped by design and still requires a successful post-merge mainline run. The formal issue remains OPEN / PARTIAL. F1.20 issue #113 is closed following exact-mainline evidence acceptance. No SemVer increment, release tag, package publication or production deployment is authorized. See the [full 0.6.2 release-gate report](docs/reports/2026-11-10-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md), [current tenant-isolation continuation](docs/reports/2026-11-10-TENANT-ISOLATION-PRE-REVIEW.md), [maintainer supply-chain review](docs/reports/2026-11-10-SUPPLY-CHAIN-REVIEW.md), [release scope](docs/RELEASE-SCOPE.md), [release readiness](docs/RELEASE_READINESS.md), and [release evidence](docs/RELEASE-EVIDENCE.md).

## Table of contents

- [Overview](#overview)
- [Capabilities](#capabilities)
- [Architecture](#architecture)
- [Technology and components](#technology-and-components)
- [Quick start](#quick-start)
- [Configuration and secrets](#configuration-and-secrets)
- [Testing and validation](#testing-and-validation)
- [Documentation map](#documentation-map)
- [Roadmap and readiness](#roadmap-and-readiness)
- [Contributing](#contributing)
- [Security](#security)
- [License, attribution, and project identity](#license-attribution-and-project-identity)
- [Acknowledgements and documentation inspiration](#acknowledgements-and-documentation-inspiration)

## Overview

VirgoScorpio Hub is organized as a modular Node.js repository. Its application layer includes API, administration, MCP, plugin-runner, and worker applications. Shared packages provide domain validation, rendering, identity and authentication helpers, AI-provider adapters, data stores, commerce and checkout workflows, community operations, media and cloud adapters, security controls, and related platform services.

The repository aims to make platform behaviors explicit and testable: validate inputs before side effects, bound resource use, fail closed when security-sensitive configuration is missing, keep transactional state in PostgreSQL, and use graph projections for relationship-oriented queries. Provider integrations and operational controls have different maturity levels; consult the test matrix and release-readiness document before relying on any integration in production.

VirgoScorpio Hub is guided by the [VirgoScorpio Hub Manifesto](VIRGOSCORPIO-HUB-MANIFESTO.md): AI should amplify human capability, preserve creative dignity and meaningful participation, and remain subject to clear human agency and accountable governance. These are product and engineering principles, not promises of employment, income or macroeconomic outcomes. See [Engineering Principles](docs/VIRGOSCORPIO-HUB-PRINCIPLES.md) for the technical interpretation.

## Capabilities

The codebase contains modules and automated tests for the following areas. This list describes implemented code paths and test coverage, **not a claim that every external provider is configured, every workflow is feature-complete, or the platform is production-ready**.

| Area | What to explore |
|---|---|
| Application surfaces | API, admin, MCP, plugin-runner, and worker applications under `apps/`. |
| Content and rendering | Versioned page-document validation, deterministic rendering, safe HTML handling, draft/preview paths, widgets, and library helpers in `packages/`. |
| AI adapters | Mock and external-provider adapters, structured output validation, bounded inputs/outputs, and fail-closed configuration. |
| Identity and access | Identity helpers, password policy, TOTP/MFA utilities, OIDC/SAML modules, and session/CSRF controls. |
| Commerce | Checkout idempotency, Stripe session orchestration, stock reservations, and reconciliation flows. External provider behavior still requires live test evidence. |
| Persistence and projections | PostgreSQL-backed transactional data and outbox-oriented workflows, with Memgraph graph projection support. |
| Community workflows | Bounded and validated conversation, notification, group, and report workflows. |
| Media and cloud adapters | File-signature validation, quarantining, storage adapters, and malware-scanning interfaces that fail closed when required controls are absent. |
| Plugin safety | Manifest validation, provenance helpers, and explicit allow-listing for isolated execution. A real production sandbox still needs independent validation. |
| Observability and release controls | Audit events, bounded configuration, SBOM artifacts, release-readiness checks, and CI workflows. |

## Architecture

The diagram below is a high-level guide to the repository boundaries, not a deployment specification. Optional services and production topology must be configured and verified independently.

```mermaid
flowchart TB
  U[User / Admin / Integration] --> AP[API application]
  U --> UI[Admin surface]
  INT[External clients / MCP] --> MCP[MCP application]
  AP --> PKG[Shared platform packages]
  UI --> AP
  MCP --> PKG
  WK[Worker application] --> PKG
  PKG --> PG[(PostgreSQL\ntransactional records / outbox)]
  PKG --> MG[(Memgraph\ngraph projection)]
  PKG --> EXT[Optional external providers\nAI / Stripe / object storage / email]
  PKG --> SEC[Security controls\nvalidation / limits / scanning / auth]
```

See [Architecture and data flow](docs/ARCHITECTURE.md) for component responsibilities, trust boundaries, and integration notes.

## Technology and components

| Component | Role | Notes |
|---|---|---|
| Node.js | Application runtime | Current supported baseline in project checks: Node.js `>=22.23.4`. |
| npm | Dependency installation and scripts | Prefer `npm ci` for reproducible dependency installation from the lockfile. |
| PostgreSQL | Relational persistence and transactional workflows | Live integration tests use a dedicated `virgoscorpio_hub_test` database; do not point destructive test setup at production data. |
| Memgraph | Graph projection and relationship-oriented operations | Required for live graph integration tests. |
| EnginEx | Separately maintained rendering/runtime project | Git submodule at **vendor/enginex/**; canonical source is [GoldenObsidianLLC/EnginEx](https://github.com/GoldenObsidianLLC/EnginEx). Current original project materials use GPL-2.0-or-later. |
| GitHub Actions | CI and static analysis | The live workflow badge reflects the latest workflow status, not production certification. |

The authoritative dependency declarations and exact scripts are `package.json`, the lockfile, the code under `apps/` and `packages/`, and `.github/workflows/ci.yml`.

## Quick start

### Prerequisites

- Node.js `>=22.23.4` and npm.
- Git.
- PostgreSQL and Memgraph for live database integration tests.
- Additional credentials or external services only for the specific provider-backed workflows you intend to exercise.

### Install and run the baseline checks

```powershell
git clone --recurse-submodules https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub.git
Set-Location VirgoScorpio-Hub
npm ci

# Optional local PostgreSQL and Memgraph services for integration work
docker compose up -d postgres memgraph

npm run check
```

EnginEx is a pinned Git submodule at `vendor/enginex`. The recursive clone checks out the exact commit recorded by VirgoScorpio Hub.

For an existing checkout, inspect `git submodule status --recursive` first. Initialize an uninitialized submodule with `git submodule update --init --recursive`. If a checkout differs from the pinned commit, inspect and preserve local submodule work before changing it; development bootstrap never resets or updates a submodule automatically.

`npm run check` runs the repository's artifact/syntax verification and unit tests. It does not, by itself, validate migrations against a fresh database, external provider credentials, production security, load, backup/restore, or every deployment path.

### Additional test suites

```powershell
# Vendored rendering/runtime test suite
npm --prefix vendor/enginex test

# Browser/editor smoke tests (install the configured Chrome browser channel first)
npm run test:e2e -- --workers=1

# Live PostgreSQL + Memgraph integration suite
npm run test:integration:live

# Dependency audit
npm audit
npm audit --omit=dev
```

The live integration suite expects a dedicated test database named `virgoscorpio_hub_test`, a reachable PostgreSQL instance, and a reachable Memgraph service. Configure the test environment using the repository's current integration-test configuration and keep test data isolated. Follow [Development setup](docs/DEVELOPMENT.md) and [Testing](docs/TESTING.md) for scope and prerequisites.

## Configuration and secrets

- Never commit `.env` files, real credentials, production dumps, signing keys, or private user data.
- Start from the environment/configuration examples present in the repository; do not invent production values to satisfy a test.
- Use fake fixtures that are visibly non-secret and deterministic. Provider-facing tests should mock transport by default; live provider tests must be explicit and opt-in.
- Scan the current tree and Git history before a public release. Example: `gitleaks dir --redact --verbose .` and `gitleaks git --redact --verbose --log-opts="--all"`.
- If a real credential is exposed, revoke or rotate it first. Editing the current file alone does not erase prior commits.

Read [Security policy](SECURITY.md) before reporting vulnerabilities.

## Testing and validation

| Check | Command | What it does not prove |
|---|---|---|
| Artifact and unit checks | `npm run check` | Does not establish production readiness or validate every live integration. |
| EnginEx | `npm --prefix vendor/enginex test` | Does not certify the whole application. |
| Browser smoke tests | `npm run test:e2e -- --workers=1` | Does not replace manual browser/accessibility acceptance. |
| Live database integration | `npm run test:integration:live` | Does not replace fresh-install, upgrade, backup/restore, or load rehearsals. |
| Dependency audit | `npm audit` | Does not find every code, configuration, or supply-chain risk. |
| Secret scanning | `gitleaks dir ...` and `gitleaks git ...` | A clean scan reduces risk but cannot guarantee that every sensitive-data pattern was detected. |
| Consolidated CI evidence | `artifacts/release-readiness-ci.md` in the `virgoscorpio_hub-release-readiness-ci` workflow artifact | Binds producer jobs, source revisions, run attempts, and SHA-256 evidence; remains a CI report, not production certification. |
| Production observability evidence | `npm run observability:deployment:validate` | Checks the approved manifest structure and declared evidence; does not deploy or independently verify providers or external evidence. |

See [Testing and validation](docs/TESTING.md) for the validation matrix and evidence requirements. Treat CI as authoritative for the commit currently under review; local historical results can become stale after changes.

## Documentation map

Start at **[the documentation index](docs/README.md)**.

| Document | Purpose |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Application/package map, data flow, and boundaries. |
| [VirgoScorpio Hub Manifesto](VIRGOSCORPIO-HUB-MANIFESTO.md) | Project mission and human-AI symbiosis vision. |
| [Engineering Principles](docs/VIRGOSCORPIO-HUB-PRINCIPLES.md) | Human agency, consent, accountability and engineering constraints. |
| [Real-Time Foundation 1](docs/REALTIME-FOUNDATION-F1.md) | Developer-preview presence and event streaming foundation, with limitations. |
| [Observability deployment contract](docs/OBSERVABILITY-DEPLOYMENT.md) | Vendor-neutral production OTLP deployment evidence and fail-closed validation. |
| [Contributor quickstart](docs/CONTRIBUTOR-QUICKSTART.md) | First clone, dependency install, basic checks, and service requirements. |
| [Development](docs/DEVELOPMENT.md) | Local setup, configuration, and contributor workflow. |
| [Local Docker resource migration report](docs/reports/2026-11-05-LOCAL-DOCKER-RESOURCE-MIGRATION.md) | Backup checksums, isolated Compose restore, current blockers, and rollback-preservation state. |
| [Testing](docs/TESTING.md) | Test commands, prerequisites, scope, and validation caveats. |
| [Security](docs/SECURITY.md) | Threat assumptions, secret handling, and security-sensitive controls. |
| [Governance](GOVERNANCE.md) | Project stewardship, decision-making, and funding transparency. |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community behavior, reporting, and enforcement. |
| [Contributor Recognition](CONTRIBUTOR_RECOGNITION.md) | How project contributions and collaborators are credited. |
| [Research & Collaboration](RESEARCH_COLLABORATION.md) | Research priorities, technical collaboration, and open engineering questions. |
| [0.6.2 recommended release scope](docs/RELEASE-SCOPE.md) | Default-enabled preview features, optional/unqualified adapters, explicit exclusions, and pending owner sign-off. |
| [Feature coverage matrix](docs/FEATURE-PARITY.md) | Current implementation versus partial and future capabilities. |
| [Release readiness](docs/RELEASE_READINESS.md) | Exact-revision evidence and current certification caveat. |
| [Roadmap](docs/ROADMAP.md) | Staged work grouped by engineering, operations, and release evidence. |
| [Documentation standards](docs/DOCUMENTATION_STANDARDS.md) | How to keep docs concise, accurate, accessible, and maintainable. |
| [Publication checklist](notes/PRE_PUBLICATION_CHECKLIST.md) | Pre-publication review steps. |
| [README inspiration analysis](notes/README_INSPIRATION_ANALYSIS.md) | How the referenced README resources informed this structure. |
| [Changelog](CHANGELOG.md) | Project-level changes recorded by release. |

## Roadmap and readiness

Prioritize verifiable evidence over marketing claims. Outstanding areas include fresh-install and upgrade testing, tenant-isolation review, live identity and provider tests, antivirus integration, browser/accessibility acceptance, commerce/community parity checks, plugin isolation, supply-chain/provenance checks, load and disaster-recovery rehearsals, independent security review, and operational release approval.

The tracked, evidence-based gate list is maintained in [Release readiness](docs/RELEASE_READINESS.md). Do not label the platform production-ready until its required gates have current, reviewable evidence and the release owner explicitly approves the release.

## Contributing

Contributions are welcome. Before opening a pull request:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and preserve existing license/copyright notices.
2. Make the smallest focused change that addresses the issue.
3. Run the relevant test suite(s), then `npm run check` when practical.
4. Update docs and tests when behavior or configuration changes.
5. Never include real credentials, personal data, provider responses containing sensitive information, or unreviewed generated artifacts.

Use the GitHub issue templates for bug reports and feature requests, and use the pull request template to describe validation and risk.

## Security

Please do not publish exploitable details or credentials in public issues. Follow [SECURITY.md](SECURITY.md) for private reporting and safe reproduction guidance.

## License, attribution, and project identity

VirgoScorpio Hub's original project materials are attributed to **Golden Obsidian LLC**, with **Justin Harlan credited as original developer and founder**, subject to the actual ownership and rights applicable to each component. The project is licensed under **GNU GPL version 2 or, at your option, any later version**; see [`LICENSE`](LICENSE), [`COPYRIGHT`](COPYRIGHT), and [`NOTICE.md`](NOTICE.md).

The software license does not grant blanket permission to use the VirgoScorpio Hub or Golden Obsidian LLC names, logos, crest, or branding to imply official endorsement. See [`TRADEMARKS.md`](TRADEMARKS.md). Third-party and vendored components remain subject to their own applicable license terms.

## Acknowledgements and documentation inspiration

The information architecture of this documentation refresh was informed by:

- [Best-README-Template](https://github.com/othneildrew/Best-README-Template): a navigable README structure, clear project summary, setup/usage flow, roadmap, contribution entry points, license, acknowledgements, and reference-style links.
- [awesome-readme](https://github.com/matiassingers/awesome-readme): examples that emphasize visual hierarchy, screenshots or diagrams where available, useful badges, concise introductions, feature examples, architecture explanations, and links to deeper documentation.

This project uses those as **structural inspiration** and original VirgoScorpio Hub-specific wording, not as a copied README template. Screenshots, demos, coverage badges, and benchmarks should be added only when the underlying assets or evidence exist.

<p align="right"><a href="#readme-top">Back to top ↑</a></p>

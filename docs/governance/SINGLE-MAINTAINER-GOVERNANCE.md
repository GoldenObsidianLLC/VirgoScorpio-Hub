# Single-Maintainer Governance

**Effective:** 21 November 2026

**Applies to:** the `main` branch of VirgoScorpio Hub

**Tracking:** [Issue #230](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230)

**GitHub ruleset:** [main — single-maintainer PR and CI guardrails](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/rules/27803491)

## Purpose and assurance boundary

VirgoScorpio Hub is maintained by one person. There is no trusted, qualified second reviewer currently available, and external paid review is not a realistic prerequisite for ordinary development.

The repository therefore uses a **single-maintainer development workflow**: all normal changes enter `main` through pull requests; the maintainer documents a complete self-review; and GitHub requires the configured CI/security checks to pass. The ruleset does not require an external approval.

This is a practical development control, not independent assurance. Maintainer self-review, automated tests, static analysis, and AI-assisted review must never be described as an independent human security assessment.

## Active main-branch ruleset

The active GitHub repository ruleset targets only `refs/heads/main`.

| Control | Configuration |
|---|---|
| Pull request required | Enabled |
| Required independent approvals | 0 (single-maintainer mode) |
| Required Code Owner approval | Disabled |
| Approval of latest push | Not required |
| Review-thread resolution | Required |
| Required checks use current `main` base | Enabled (strict/up-to-date) |
| Force pushes | Blocked |
| Branch deletion | Blocked |
| Bypass actors | None; GitHub reports the current user cannot bypass |
| Merge methods | Merge, squash, and rebase |

The PR requirement blocks routine direct updates to `main`. The ruleset applies to the repository administrator as well; there is no configured administrator or application bypass actor.

### Required pull-request status checks

These exact check contexts are required. The GitHub Actions checks are bound to the GitHub Actions integration (ID `15368`); the separate CodeQL result is bound to GitHub Advanced Security (ID `57789`).

| Required context | Source |
|---|---|
| `Unit, security, and dependency checks (Node 22.23.4)` | GitHub Actions |
| `Unit, security, and dependency checks (Node 24.22.1)` | GitHub Actions |
| `PostgreSQL and Memgraph integration` | GitHub Actions |
| `Browser editor and accessibility smoke tests` | GitHub Actions |
| `CodeQL security analysis` | GitHub Actions |
| `CodeQL` | GitHub Advanced Security |
| `Consolidate candidate CI evidence` | GitHub Actions |

A workflow or job rename is a governance change: update and verify the ruleset's required context before relying on the renamed check. Check names and their producing GitHub App identity must both match.

The mainline-only **Attest dependency lockfile and SBOM** job intentionally skips on pull-request events. It is a post-merge/mainline evidence gate and must not be added to the PR-required context list. Production readiness and release gates are likewise separate from ordinary PR merge checks.

## Maintainer self-review

Complete the **Maintainer self-review** section in the repository pull-request template for every PR. Review the entire diff, not only the changed lines highlighted by GitHub.

The self-review should record that the maintainer considered:

1. Scope, behavior, complete diff, and whether the change is narrowly focused.
2. Authorization, tenant boundaries, identity/session handling, secrets, privacy, and data exposure where relevant.
3. Input validation, failure paths, retries/idempotency, concurrency, and resource limits where relevant.
4. Regression coverage, local checks, hosted CI, and any tests that were skipped or unavailable.
5. Architecture, reusable patterns, documentation, compatibility, database/schema/migration impact, and SemVer impact.
6. Dependency, generated-artifact, licensing, and unrelated-file changes.
7. Known limitations, follow-up issues, and any evidence that remains outstanding.

Mark irrelevant items as not applicable with a brief reason rather than silently omitting them. Security-sensitive work should receive additional adversarial tests, explicit threat-model notes, and focused validation. A green CI run is evidence that configured checks passed; it is not proof of exhaustive security or tenant isolation.

## Production certification remains independent

The development merge policy does not close, weaken, or waive any production assurance gate. In particular:

- [Issue #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): independent tenant-isolation review.
- [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23): qualified human dependency/license review.
- [Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): independent platform security assessment.

Other missing evidence, including live identity-provider and cloud-provider qualification, malware quarantine, payment lifecycle, full product/accessibility acceptance, commerce/community parity, plugin isolation, load and recovery, operations approval, and production observability, remains governed by the release-readiness plan.

Do not treat this document or the active ruleset as a production certification. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED** until the exact-main evidence and all required independent, operational, and product acceptance gates are completed. Package `0.6.2` remains private/unreleased.

## Emergency handling

There is no routine bypass path. For a genuine emergency:

1. Open or update a repository issue describing the incident, urgency, and reason normal PR validation cannot be completed.
2. Preserve the proposed diff, exact commit SHA, available test results, risks, and rollback plan.
3. Make only the minimum temporary ruleset change needed, and record who changed it and when.
4. Restore the active ruleset immediately after the emergency change.
5. Record the resulting commit, validation, restoration time, and any follow-up work in the issue.

Changing or disabling a ruleset is an administrative action and should be auditable. Emergency handling does not waive production certification or independent assurance.

## Repository visibility and plan note

GitHub reported this repository as **public** when the ruleset was configured on 21 November 2026. GitHub makes repository rulesets and protected branches available for public repositories on GitHub Free. This task did not change repository visibility. Do not change the repository's visibility merely to obtain branch protection.

## Policy maintenance

Revisit this policy if a trusted, qualified second maintainer becomes available, the repository visibility or plan changes, or CI contexts/workflows change. Any required approval count increase must be based on an actually available trusted reviewer; never configure a gate that the sole maintainer cannot satisfy.

The authoritative configuration is the active GitHub ruleset linked at the top of this page. The issue #230 checklist tracks verification and documentation follow-up.

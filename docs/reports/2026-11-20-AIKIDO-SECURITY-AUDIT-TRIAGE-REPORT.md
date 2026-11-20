# Aikido Security Audit Triage Report — 20 November 2026

**Repository:** [GoldenObsidianLLC/VirgoScorpio-Hub](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub)
**Audited source baseline:** `main` at `70e800ad33a6d376388576ce76a608f35c595b64` (F1.59 merged)
**Source report:** Aikido Security, *GoldenObsidianLLC: security audit report*, created 20 November 2026 at 21:26 (timezone not stated).
**Disposition:** Aggregate findings recorded; individual finding records still required. No source-level fix or release decision is inferred from aggregate counts.

## 1. Executive summary

Aikido places the company's benchmark in the **top 10% of Aikido accounts** and code repositories in the **top 20%**. The cloud-environment score is **N/A**. These are vendor benchmark indicators, not a security certification, penetration test, or proof that every application and infrastructure control is effective.

The open-issues snapshot lists **17 findings** across the displayed categories: four dependency findings, one secret-history finding, and 12 SAST findings. It reports no Critical findings in the displayed snapshot. The highest open severity shown is High, with three High SAST findings.

| Open finding class | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| SAST | 0 | 3 | 5 | 4 | 12 |
| Secrets in source-code history | 0 | 0 | 0 | 1 | 1 |
| Open-source dependencies | 0 | 0 | 3 | 1 | 4 |
| **Total** | **0** | **3** | **8** | **6** | **17** |

These are Aikido-reported open counts, not independently reproduced findings. The PDF omits individual finding IDs, package names, rule names, CWE/CVE identifiers, affected files/lines, secret types, detection commits, and finding-specific remediation guidance. The counts do not support safe source-level fixes or individual false-positive decisions.

## 2. Rolling three-month activity

| Finding class | New | False positives | Handled |
|---|---:|---:|---:|
| SAST | 40 | 28 | 0 |
| Secrets in source-code history | 1 | 0 | 0 |
| Open-source dependencies | 4 | 0 | 0 |

The 28 SAST false positives are an aggregate historical count, not approval to suppress any of the 12 currently open findings. Each open finding needs an individual fingerprint, evidence, reproducibility assessment, owner, and disposition. The report shows zero handled findings in these three categories for the period.

## 3. Scan coverage and freshness

| Asset or scan class | Reported inventory / cadence | Last occurrence shown |
|---|---|---|
| JavaScript packages | 205 packages; daily | 20 November 2026 |
| GitHub Actions packages | 7 packages; daily | 20 November 2026 |
| Open-source licenses | 212 licenses; weekly | 20 November 2026 |
| Repository SAST | 1 repository; daily | 20 November 2026 |
| Infrastructure as code | Daily | 20 November 2026 |
| Secrets in source-code history | 1 repository; daily | 20 November 2026 |
| Domain surface | 1 domain; daily | **1970-01-01** |

The domain's `1970-01-01` last-occurrence value is anomalous. Verify it against Aikido's detailed run history, asset scope, integration permissions, and timestamp handling. It is not proof of a domain vulnerability or proof that scanning is broken. This is tracked separately in [issue #235](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235).

The PDF does not name the domain or the individual package/license records. Asset-level exports are required before making coverage or remediation claims.

## 4. Priority triage

### P1 — SAST and secret-history findings

[Issue #234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234) tracks the 12 open SAST records and one secret-history record.

1. Export all 13 individual records from Aikido. Preserve scanner fingerprints, repository and exact revision, branch, affected path/line, rule and CWE, severity, first/last seen times, evidence/data-flow excerpt, status, and recommended fix.
2. Reconcile each record against exact source and reproduce it where practical. Record a specific classification: confirmed, false positive, accepted risk, duplicate, or stale/not present. A false-positive disposition requires a technical rationale and reviewer.
3. Prioritize the three High SAST findings. Confirm the source-to-sink path and security boundary, then implement the narrowest reusable fix and focused regression tests. Re-scan the exact remediation revision.
4. Investigate the Low secret-history finding without copying any secret value into GitHub, logs, source code, or artifacts. Establish whether the credential is active or was previously valid. Revoke or rotate promptly if active, verify downstream consumers, and only then consider repository-history remediation.
5. Give all 13 records an owner and evidence-backed disposition. Track confirmed findings in separate, narrowly scoped remediation issues or PRs. Do not weaken or disable scanning to reduce counts.

The supplied PDF alone does not justify a specific code fix, dependency suppression, or credential-rotation claim. The next implementation step is gated on the individual exports.

### P1 — Dependency and SBOM review

The report lists **3 Medium and 1 Low** open dependency findings. [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) owns the human dependency, transitive-package, SBOM, provenance, CodeQL, and license/notice review. Export the four detailed records and reconcile package name, installed/resolved version, dependency path, advisory identifier, fix version, and lockfile impact against the exact mainline lockfile and CycloneDX SBOM. The aggregate PDF does not identify any package or advisory; no package update is proposed from these counts alone.

### P0 — Independent platform security assessment

[Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remains OPEN / NOT PERFORMED. Aikido monitoring and automated CodeQL do not replace an independent application/platform assessment, adversarial tenant-isolation review, human severity review, remediation verification, or authorized risk disposition.

### P1 — Merge governance

[Issue #230](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230) remains OPEN. PR #232 merged without an independent non-author approval: GitHub contains four owner-account COMMENTED review submissions and zero APPROVED submissions. Passing CI is not independent review. A trusted distinct collaborator and enforceable non-author approval are needed before the next non-trivial PR is merged.

## 5. Compliance and control-report interpretation

The OWASP table marks A06 Insecure Design as **“Monitoring, not fully compliant.”** The ISO 27001, ENS, SOC 2, UK Cyber Essentials, CIS AWS/Kubernetes, GDPR, NIS2, and DORA sections contain a mixture of “taken measures” indicators and “Monitoring, not fully compliant” or “No active measures” statuses.

These are Aikido automated-monitoring classifications. This report does not establish formal ISO 27001, ENS, SOC 2, Cyber Essentials, CIS, GDPR, NIS2, or DORA compliance, nor independently test every control's efficacy. Reconcile any compliance claim with actual policy, technical configuration, evidence, scope, and accountable owner.

## 6. Mainline and release boundary

F1.59 merged as PR #232 / issue #231 at main revision `70e800ad33a6d376388576ce76a608f35c595b64`. Exact-main workflow [#833](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44809875826) completed **7/7 jobs successfully**, including Node.js 22.23.4 and 24.22.1 matrices, live PostgreSQL/Memgraph integration, fresh and idempotent migrations, browser/editor smoke, CodeQL, and mainline lockfile/SBOM attestation. The source-bound readiness artifact is #14666785760; archive SHA-256: `dcee92566f66e6bea50e28c301c910f31eac9f51546f63305150a8a9b6a32782`.

| Canonical exact-main readiness | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction=false`; release classification remains `NOT_PRODUCTION_CERTIFIED`; production decision remains **NO-GO**. The audit does not close any missing production evidence gate or partial human-review obligation.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. This audit reconciliation introduces no runtime, schema, migration, HTTP/API, event-schema, dependency, lockfile, or SemVer change. No release tag, GitHub Release, npm publication, or production deployment is authorized.

## 7. Source pages reviewed

- **Page 1:** company benchmark and repository/cloud score.
- **Page 2:** OWASP Top 10 monitoring summary, including A06.
- **Pages 3–34:** ISO 27001, ENS, SOC 2, UK Cyber Essentials, CIS AWS/Kubernetes, GDPR, NIS2, DORA, and related monitoring/control tables.
- **Page 35:** configured scan inventory and last-occurrence dates.
- **Page 36:** rolling three-month finding activity.
- **Page 37:** current open-finding severity snapshot.

**Related tracking:** [#234 SAST/secret triage](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234), [#235 domain scan freshness](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235), [#23 dependency/SBOM review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23), [#25 independent security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25), [#230 review governance](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230), and umbrella [#124 tenant-isolation/security hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).

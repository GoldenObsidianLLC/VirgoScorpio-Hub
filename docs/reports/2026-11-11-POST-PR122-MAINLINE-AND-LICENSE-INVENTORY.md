# 11 November 2026 — Post-PR #122 Mainline and Supply-Chain License Inventory

> **Maintainer evidence and review preparation only.** This report records exact-main CI and a machine-derived license inventory. It is not a legal opinion, independent security assessment, dependency acceptance, production certification, or release authorization.

## 1. Current baseline and decision

PR [#122](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/122) merged as a documentation-only reconciliation at main commit `253ef3a987d7151828cdc971f95f0faaf64a7f36`. It changed no application runtime, dependency manifest or lockfile, API, schema, migration, provider contract, architecture, or package version. PR #122 had no recorded human review submission; its merge must not be represented as independent review or product-owner approval.

The exact-main push workflow [#541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834) completed successfully on that full SHA. All seven jobs passed, including both Node.js matrices, live PostgreSQL/Memgraph/Redis integration, browser/accessibility tests, CodeQL, exact-main signed provenance/SBOM verification, and consolidated evidence (`CI EVIDENCE: PASS`).

Package `virgoscorpio-hub@0.6.2` remains private and unreleased for an isolated self-hosted developer preview. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer bump, tag, publication, deployment, or production-use authorization is implied.

## 2. Exact-main CI and attestation evidence

| Evidence | Exact result |
|---|---|
| Main source revision | `253ef3a987d7151828cdc971f95f0faaf64a7f36` |
| Workflow | [#541 — push to main](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834); run ID `43076849834`; all seven jobs successful |
| Runtime matrix | Node.js 22.23.4 and 24.22.1; 590/590 Hub tests and 94/94 EnginEx tests per runtime; zero npm audit vulnerabilities in both audit scopes |
| CycloneDX inventory | Version 1.5; 200 components; 201 dependency records |
| Live integration | PostgreSQL/Memgraph/Redis suite 82/82; fresh migrations 18/18 applied and idempotent pass 18/18 skipped; PostgreSQL collaboration Playwright 3/3 |
| Browser | Editor/accessibility smoke 9/9 |
| Graph recovery | Real Memgraph outage/outbox replay passed; canonical graph rebuild and repeat determinism passed |
| Static analysis | CodeQL job successful; alert #38 remains previously fixed, not dismissed |
| Evidence aggregation | `CI EVIDENCE: PASS` |

The exact-main signer verified SLSA provenance against `refs/heads/main`, the full source SHA, the repository/workflow certificate identity, and the package-lock and SBOM subject digests. The signed CycloneDX SBOM predicate type is `https://cyclonedx.org/bom`, and its predicate equals the generated SBOM document.

| Signed evidence | Value |
|---|---|
| `package-lock.json` SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |
| CycloneDX SBOM SHA-256 | `ffc009df28f0a01cdeffde597760f7244dff3c42a0a92fc6b7109b2bc0d6ad4a` |
| Attestation artifact | `13882262940` — `virgoscorpio_hub-supply-chain-attestations` |
| Attestation archive digest | `sha256:ecfe525d863e754dfd0d4f3dab6b9955ddbf17d1bd1a444691355614fe6c772c` |
| Artifact retention | Expires 9 February 2027 |
| SLSA provenance transparency entry | [66389823](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66389823) |
| Signed SBOM transparency entry | [66389838](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66389838) |

The separate Node.js 22 dependency-evidence artifact is `13881203245`, named `virgoscorpio_hub-dependency-evidence-node-22.23.4`, with artifact digest `sha256:27230467b8539fceb0d0a4fc5d86f0c4c43c11471833987588f0c638ab6edd2e`. Its embedded generation log records npm 11.19.1, Node.js 22.23.4, the exact lockfile/SBOM digests above, and the component/license counts below.

## 3. Preliminary license inventory — human review required

The retained CycloneDX 1.5 SBOM contains 200 components and 201 dependency records. All 200 components have an identified license expression in the generated SBOM. This is an improvement in inventory completeness, **not** a finding that all components are permissively licensed or that redistribution obligations have been satisfied.

| SBOM license identifier/expression | Components |
|---|---:|
| MIT | 106 |
| Apache-2.0 | 69 |
| LGPL-3.0-or-later | 10 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| ISC | 6 |
| BSD-3-Clause | 2 |
| BlueOak-1.0.0 | 1 |
| 0BSD | 1 |
| GPL-2.0-or-later | 1 |
| **Total** | **200** |

The machine inventory identifies **15 components with GPL/LGPL terms**:

- **LGPL-3.0-or-later — 10 libvips platform packages, version 1.3.4:** `@img/sharp-libvips-darwin-arm64`, `@img/sharp-libvips-darwin-x64`, `@img/sharp-libvips-linux-arm`, `@img/sharp-libvips-linux-arm64`, `@img/sharp-libvips-linux-ppc64`, `@img/sharp-libvips-linux-riscv64`, `@img/sharp-libvips-linux-s390x`, `@img/sharp-libvips-linux-x64`, `@img/sharp-libvips-linuxmusl-arm64`, and `@img/sharp-libvips-linuxmusl-x64`.
- **Combined Apache/LGPL/MIT expressions — 4 Sharp platform packages, version 0.35.5:** `@img/sharp-wasm32`, `@img/sharp-win32-arm64`, `@img/sharp-win32-ia32`, and `@img/sharp-win32-x64`.
- **GPL-2.0-or-later — 1 vendored component:** SBOM component `enginex@7.0.0`, sourced from `vendor/enginex` (the corresponding npm package-lock alias is `enginex-ai-native@7.0.0`).

The package lock also contains a local `node_modules/enginex-ai-native` link entry without its own `license` field. The referenced `vendor/enginex` package carries `GPL-2.0-or-later`; the generated SBOM represents it as one `enginex@7.0.0` component with that license expression. Therefore, the SBOM reports zero components without an identified license, while the lockfile still warrants human inspection of the link/target relationship.

The Sharp/libvips entries are platform-specific optional/native package variants. Their presence in the lockfile/SBOM does not establish that every variant is installed, bundled, or redistributed in every deployment. The qualified reviewer must map actual supported install targets and distribution artifacts, determine which native components are present and how they are linked/used, review the vendored EnginEx relationship, and assess applicable notice, source-offer, modification, and redistribution obligations. Do not suppress optional components from the inventory merely because a single CI runner does not install them.

**No legal conclusion is made here.** A qualified reviewer must assess the exact distribution model and applicable license texts, verify notices/source availability and any linking or modification obligations, and record a reasoned risk disposition. The maintainer inventory is evidence for that review, not acceptance.

## 4. CI action runtime maintenance follow-up

Workflow #541 logs also surfaced a Node.js 20 deprecation warning from the two pinned `actions/download-artifact@v4.3.0` steps in `.github/workflows/ci.yml`. The exact #541 GitHub-hosted runner version was `2.338.2`. The pinned v7.0.0 action manifest declares `runs.using: node24`.

The follow-up maintenance change in the current development branch updates both download steps to `actions/download-artifact@v7.0.0`, pinned to verified commit `37930b1c2abaa49bbe596cd826c3c89aef350131`. The upstream release declares `runs.using: node24`; the pinned tag commit has a verified GitHub signature. The workflow continues using the same artifact names, patterns, output paths, and merge behavior. This changes the CI action runtime only; it does not change application runtime support or package dependencies. Treat this update as pending until the pull-request workflow validates it.

## 5. Remaining acceptance gates

Issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) remains **OPEN / PARTIAL**. A qualified human reviewer still needs to:

1. Review direct and transitive dependency identity, maintenance health, security/advisory disposition, and actual use/distribution.
2. Complete the GPL/LGPL and third-party notice/distribution assessment described above.
3. Review the exact-main #541 provenance/SBOM bundles, source identity, artifact digests, signed predicate and retained evidence.
4. Record a human CodeQL disposition for the exact source revision `253ef3a987d7151828cdc971f95f0faaf64a7f36`.
5. Record reviewer identity, qualifications, independence/conflicts, review date, findings, risk decisions and formal acceptance through the authorized process.

Do not populate `artifacts/evidence/dependency-sbom-codeql.json` or close issue #23 from CI output or this maintainer inventory alone. Independent tenant/site isolation review #14 and broader independent security review #25 remain outstanding; load/restore issue #24, operations issue #26, scope approval #13 and governance/legal authority issue #32 remain separate gates.

## 6. Architecture and SemVer guardrails

This evidence/documentation follow-up does not change architecture: PostgreSQL remains authoritative application state; Memgraph remains a rebuildable projection fed through the PostgreSQL transactional outbox; Redis Pub/Sub/presence remains ephemeral; tenant/site and capability checks remain before side effects; unresolved `vault://` references do not qualify live providers; and production media scanning remains fail-closed.

Keep `0.6.2` private and unreleased. No version bump, tag, publication, deployment, provider qualification, or production certification is authorized by this report.

# F1.68 - Equalize password verification work for unknown and malformed accounts

**Date:** 22 November 2026 (America/Chicago)
**Status:** Implementation candidate; tracked by [issue #295](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/295) on branch security/f1-68-login-timing-oracle-2026-11-22.
**Current main baseline:** fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d (documentation synchronization PR #294).
**Release boundary:** Maintainer-led authentication hardening only; no scanner fingerprint is dispositioned.

## 1. Finding and threat model

The login API already returns the same generic 401 for an unknown account and an invalid password. However, the work performed before that response differed: a missing user or unusable password hash caused verifyPassword to return before invoking scrypt, while an existing account with a valid stored hash performed the expensive scrypt derivation. Repeated unauthenticated requests could compare response latency and infer whether an address had an account.

This is a timing-oracle risk in the password-login path. It is separate from password-reset request timing, federated-login state handling, rate-limit policy, and other authentication controls.

## 2. Implementation

The shared password verifier now parses the existing supported scrypt record and selects either the verified stored parameters or a fixed, structurally valid dummy record.

- The dummy record uses the existing production parameters: N=32768, r=8, p=1, 16-byte salt and 64-byte derived key.
- Missing users, absent hashes, malformed encodings, unsupported parameters and invalid stored hash shapes still perform one scrypt derivation using the fixed dummy record.
- The verifier only returns true when a real stored hash parsed successfully and the derived key matched. Dummy verification can never authenticate a user.
- Base64url hash components are required to be canonical, the stored scrypt parameter strings must exactly match the supported values, and encoded hashes are length-bounded before decoding.
- Candidate password input is bounded to the existing maximum password length before scrypt. Non-string or oversized values use an empty candidate but still perform the same KDF work and are explicitly ineligible for authentication, even if a legacy stored hash were to match the substituted empty candidate.
- Existing generic login failure status/message and the current per-IP/email throttle remain unchanged. MFA reauthentication uses the same verifier and gains the same fail-uniform behavior.
- The KDF function is injectable as an optional verifier argument for deterministic tests; production callers use the default scrypt implementation.

No migration, dependency, API route, response shape, lockfile, package version, or SemVer change.

## 3. Regression coverage

A deterministic regression injects a KDF spy and exercises valid, missing, malformed, oversized-with-missing-hash, oversized-with-valid-hash, and non-string-with-valid-hash inputs. It asserts exactly one derivation per input shape, identical N/r/p/key length/maxmem, the stored salt for a valid hash, the fixed dummy salt for missing/malformed hashes, bounded KDF input, and that oversized/non-string inputs cannot authenticate even if the substituted empty candidate were to match.

The existing password policy/hash round-trip tests remain in place. The production login path still performs verification for both found and absent users because the identity service always passes the optional stored hash to the shared verifier.

## 4. Local validation

| Check | Result |
|---|---|
| Focused auth-security tests | 17/17 passed |
| Full Node.js 26.12.1 npm run check | 810 total; 807 passed; 0 failed; 3 conditional platform skips |
| EnginEx 7.0.0 pinned suite | 94 total; 91 passed; 0 failed; 3 conditional Windows skips |
| Tenant inventory | 28 families / 80 declared route patterns / 22 source files / 61 test files |
| Tenant inventory freshness | PASS |
| git diff --check | PASS |
| Hosted validation | Pending PR |

The inventory was regenerated after the final auth-source change. Current inventory: 28 families / 80 declared route patterns / 22 source files / 61 test files. Source SHA-256: 5738927223a4fe04732978e5833776e8452f02836d49848f846f1e31a2e2772a. Test-reference SHA-256: 17f16b2d2128b39f6fba87a0f44ccad9a71d5f63e9fdad7d9b51e398007e68b3. It remains maintainer-prepared and is not an independent tenant-isolation review.

## 5. Security and release boundary

This change makes the login KDF work uniform for the relevant missing/malformed-hash cases; it does not claim mathematically constant end-to-end response time or eliminate every account-enumeration vector. Network scheduling, database latency, rate limiting, verified-email policy and other authentication flows remain separate concerns.

Related Aikido context: [issue #234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234) and bot proposal [PR #273](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/273). The current implementation is maintainer-led and uses deterministic KDF-spy tests rather than flaky wall-clock thresholds. No exact Aikido fingerprint/rule/CWE/source record has been matched or rescanned; no scanner finding is marked fixed or closed.

Package 0.6.2 remains private and unreleased. Current exact-main readiness is 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE, NOT_PRODUCTION_CERTIFIED / NO-GO. Independent tenant-isolation review #14, qualified dependency/license review #23, and independent platform security assessment #25 remain open. No tag, publication, production certification, deployment or SemVer change is authorized.

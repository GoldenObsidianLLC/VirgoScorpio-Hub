## Summary

Describe the problem and the intended change.

## Change category

- [ ] Bug fix
- [ ] Feature
- [ ] Security / hardening
- [ ] Documentation
- [ ] Dependency / build / CI
- [ ] Other

## Implementation

- Main paths/components changed:
- Important design choices:
- Database/configuration/API compatibility impact:

## Validation

| Command/check | Result | Notes |
|---|---|---|
| `npm run check` | Not run / pass / fail | |
| `npm --prefix vendor/enginex test` | Not run / pass / fail | |
| `npm run test:e2e -- --workers=1` | Not run / pass / fail | |
| `npm run test:integration:live` | Not run / pass / fail | State whether PostgreSQL/Memgraph were live. |
| Secret scan / dependency audit | Not run / pass / fail | |

List any additional checks and clearly state what was not tested.

## Risk and rollout

- Security or tenant-isolation implications:
- Migration/deployment/rollback notes:
- External services or credentials required (never include actual secrets):

## Maintainer self-review (single-maintainer policy)

Complete this section for every PR. This records the maintainer's own review; it is **not** an independent approval.

- [ ] I reviewed the complete diff and confirmed the scope is intentional.
- [ ] I considered authorization, tenant boundaries, identity/session behavior, secrets, privacy, and data exposure where relevant.
- [ ] I considered validation, failure paths, retries/idempotency, concurrency, and resource limits where relevant.
- [ ] I added or updated regression coverage and recorded local/hosted checks, skips, and untested areas.
- [ ] I assessed architecture, documentation, compatibility, database/schema/migration impact, and SemVer impact.
- [ ] I checked dependency, generated-artifact, licensing, and unrelated-file changes.
- [ ] I recorded remaining limitations and follow-up issues; I have not represented self-review or automation as independent assurance.

Mark irrelevant items as N/A with a reason.

## Documentation and release

- [ ] Documentation updated where behavior/setup changed.
- [ ] Tests added or updated where appropriate.
- [ ] No real secrets, private data, or unrelated generated artifacts are included.
- [ ] Third-party license and copyright notices are preserved.
- [ ] Any release-readiness impact is stated.

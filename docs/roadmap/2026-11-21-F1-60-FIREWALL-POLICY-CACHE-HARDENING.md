# F1.60 — Firewall Policy Cache and Resource-Boundary Hardening

**Status:** Maintainer candidate; unmerged
**Baseline:** F1.59 main 70e800ad33a6d376388576ce76a608f35c595b64
**Consolidation PR:** [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257)
**Tracking issue:** [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277)

## Scope

Consolidate four overlapping proposals into one reviewable firewall increment:

- Preserve resolved-tenant firewall evaluation for public slug routes and pass the original request through internal AI authorization contexts.
- Bound firewall rule creation at 500 rules per site and 20,000 rules total, serialize quota checks, and reject duplicates.
- Fail closed when the database-backed dynamic firewall policy cannot be loaded or refreshed.
- Prevent an old in-flight query from republishing stale policy after clearCache() advances its generation.

F1.60 reuses the existing API composition and PostgreSQL transaction seams. It does not introduce a new WAF, proxy trust model, schema, migration, dependency or public endpoint.

## Dependencies and acceptance gates

- Local npm run check: 728 tests, 725 passed, zero failures, three conditional skips.
- Focused firewall/AI suite: 53/53 passed.
- Hosted exact-head candidate CI pending for PR #257.
- Independent non-author review and enforceable branch controls remain blocked by #230.
- F1.59 documentation reconciliation is tracked separately in PR #236.

## Release boundary

Do not merge until the independent-review control is satisfied. No package version change, tag, release, publication or deployment. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.
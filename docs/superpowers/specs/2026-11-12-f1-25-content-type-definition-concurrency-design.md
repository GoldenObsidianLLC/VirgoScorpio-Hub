# F1.25 Site-Scoped Content-Type Definition Concurrency and Role Gate — Design

**Date:** 12 November 2026

**Status:** Test-only maintainer change; exact-head hosted PostgreSQL/Memgraph validation passed on PR head `d37cde71daa84e75a2ad2cae8701c9d98a08a1ca` in workflows #575/#576 (92/92 each, zero failures/skips). Human review remains pending.

**Tracking:** Issue [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). Base main: `5929a53a1c551a2fe43bc38e61cb63dbecec52f5`.

## Problem

The custom content-type registry already scopes definitions by `site_id`, requires `site:manage` for writes, and serializes updates to a site/slug pair with a PostgreSQL transaction advisory lock. Existing live A/B coverage proves same-slug definitions in two sites do not collide and foreign records are hidden, but it does not execute overlapping writes to the same site's slug or exercise the registry write gate with a real lower-privilege member.

Those are focused gaps in the maintainer-generated tenant route inventory for `content-type-registry-and-records`: concurrent version progression and owner/role boundaries.

## Design

Extend the existing disposable-PostgreSQL integration fixture `test/integration/tenant-content-object-isolation.integration.test.js`, reusing its two-site setup, API server, identity service, content store, Site A/Site B same-slug fixture, and synthetic test identities.

### 1. Lower-privilege registry-write denial

- Add a Site B editor test identity with `content:read`, `content:create`, and `content:edit`, but without `site:manage`.
- Authenticate it through the existing identity service.
- Verify registry GET remains available under `content:read`.
- Attempt a valid POST to `/api/v1/content-types` with a unique Site B slug.
- Require `403 ERR_VIRGOSCORPIO_HUB_FORBIDDEN`; query PostgreSQL to prove the denied slug has no definition row and verify the response does not expose definition data.
- Preserve fixture cleanup for the additional role and user.

### 2. Same-site concurrent version progression

Using the existing same-slug positive control (Site A's version 1 and Site B's independently created version 1):

- Issue two Site B admin POST requests concurrently for the same slug, each with a distinct valid definition label.
- Require both responses to succeed and return consecutive versions 2 and 3, without assuming which concurrent request wins the advisory lock first.
- Query all versions. Site B must contain version 1 inactive, version 2 inactive, and version 3 active; exactly one Site B definition for that slug is active.
- The Site B registry read must expose only the version 3 definition and its winning label.
- Site A's same-slug version 1 row must remain active and unchanged; no Site B write may change Site A's row.
- Keep the existing record list/detail and conflicting-selector assertions intact. The current record detail is read before the concurrent definition updates so its positive control continues to validate the originally selected schema revision.

## Security and correctness boundaries

- This validates the existing `site:manage` check and advisory-lock/transaction implementation; it does not modify production authorization or write behavior.
- The tests use only synthetic identities and the disposable PostgreSQL database. No external identity provider, customer data, or provider call is involved.
- Assertions are keyed by `site_id`, slug, version, active state, and the response's winning version; they do not depend on UUID ordering or concurrent request completion order.
- This proves the tested same-site slug write serialization and role-denial paths only. It does not establish exhaustive coverage of every content-type route, all role combinations, definition schema evolution, publication workflows, search/count paths, or independent tenant security review.
- Maintainer-authored regression evidence does not satisfy independent tenant review #14 or platform-wide assessment #25.

## Compatibility and release

Test/documentation/inventory only. No runtime code, API/route contract, database schema, migration, dependency, provider, lockfile, architecture or package-version change. Package `virgoscorpio-hub@0.6.2` remains private/unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, tag, publication, deployment, or issue closure is implied.

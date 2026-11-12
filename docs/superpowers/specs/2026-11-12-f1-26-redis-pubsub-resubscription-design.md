# F1.26 Redis Pub/Sub Re-subscription After Service Restoration — Design

**Date:** 12 November 2026

**Status:** Test-only maintainer candidate implemented; local syntax, focused Redis unit, and full repository checks pass. Exact-head hosted Redis/PostgreSQL/Playwright validation is pending.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). Candidate branch: `security/redis-pubsub-resubscribe-2026-11-12`.

## Problem

The realtime bridge calls `pSubscribe` for presence, authorization, and document patterns when it attaches to its local hub. Its Redis publisher/subscriber clients use the shared reconnect strategy. The intended node-redis behavior is to restore the subscriber's registered patterns when its transport reconnects, but the current cross-node authorization test coverage does not prove that a real subscriber recovers its authorization subscription after the Redis service itself has stopped and restarted.

A bridge reporting ready is not sufficient evidence by itself: the post-reconnect subscription must actually receive a new authorization event on the remote API node.

## Design

Extend the existing PostgreSQL-backed multi-node collaboration Playwright fixture and reuse the existing disposable Redis outage helper. The helper accepts only a credential-free loopback Redis URL and the exact full container ID for the approved `redis:7.4-alpine` test service; it inspects image, ID, and running state before stopping or starting anything. The new scenario is enabled only when CI explicitly sets the integration/outage flags and provides that validated container ID. It does not stop arbitrary Docker containers, remote Redis, or a developer's local service.

The scenario:

1. Creates disposable Site A and Site B records, a Site A owner, a Site A editor to be revoked, and an unrelated Site B editor.
2. Starts two API nodes with separate PostgreSQL pools/stores and one shared loopback Redis URL/channel prefix. Each node uses the normal database-backed identity service and the existing authorization callback.
3. Opens a Site A collaboration WebSocket and an unrelated Site B WebSocket on node B. The test-only heartbeat is extended to 60 seconds so a restored Pub/Sub event can be distinguished from periodic database reauthorization.
4. Stops only the exact prevalidated Redis 7.4 CI container. It waits for both API bridges to become not-ready and verifies that the existing Site A WebSocket remains open while no membership change has been made.
5. Starts that same container, waits for a successful Redis PING, and waits for both API bridges to report ready again. The Site A socket must still be open; no authorization invalidation should have been received by node B.
6. Removes the Site A editor through the real membership DELETE route on node A. The normal identity-service callback publishes the authorization invalidation through Redis.
7. Verifies node B's subscriber callback receives exactly one authorization invalidation and the existing Site A WebSocket closes with policy code `1008` within five seconds—well before the 60-second heartbeat could reauthorize it.
8. Verifies the Site A membership is gone, no collaboration operations were persisted, and the unrelated Site B socket remains usable and answers ping.

The fixture's existing test-only subscriber wrapper counts authorization messages delivered to the local callback. The application subscription, Redis clients, PostgreSQL identity authorization, membership route, and collaboration WebSocket remain the normal code paths.

## Security and correctness boundaries

- The test proves a fresh authorization Pub/Sub event is delivered after the node-redis subscriber reconnects and restores its subscription.
- Pub/Sub is **ephemeral**, not durable. The test does not claim that invalidation messages published while Redis is unavailable are queued, replayed, or delivered after restoration.
- Existing F1.17/F1.18 regressions separately qualify the command/heartbeat PostgreSQL reauthorization fallbacks when an invalidation hint is lost. Redis remains a notification transport; PostgreSQL remains authoritative for membership and session authorization.
- The longer heartbeat is a test-only isolation setting, not a production default or revocation-SLA claim.
- The outage is confined to a full-ID-verified disposable Redis 7.4 CI container bound to a credential-free loopback URL. Cleanup attempts restoration in a `finally` block and reports restoration failure.
- The test does not prove Redis Cluster/failover semantics, network partitions across regions, durable message delivery, load/soak behavior, or production RPO/RTO.
- Maintainer-authored test results do not satisfy independent tenant review #14 or platform-wide assessment #25.

## Compatibility and release

Test and fixture only. No production realtime implementation, API/protocol, schema, migration, dependency, provider contract, lockfile, or package version change. Package `virgoscorpio-hub@0.6.2` remains private/unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release tag, publication, deployment, or issue closure is implied.

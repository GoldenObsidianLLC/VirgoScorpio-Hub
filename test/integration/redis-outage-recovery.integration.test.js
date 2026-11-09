'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('redis');
const { createRealtimeHub } = require('../../packages/realtime/src/event-hub');
const { createRedisRealtimeBridge } = require('../../packages/realtime/src/redis-realtime');
const { createRedisPresenceService } = require('../../packages/realtime/src/redis-presence');
const { createRealtimeMetrics } = require('../../packages/observability/src/metrics');
const {
  validateRedisOutageTarget,
  inspectRedisOutageTarget,
  stopRedisOutageTarget,
  startRedisOutageTarget
} = require('../fixtures/redis-outage-container');

const SITE_A = '11111111-1111-4111-8111-111111111111';
const SITE_B = '22222222-2222-4222-8222-222222222222';
const REDIS_URL = process.env.VIRGOSCORPIO_HUB_TEST_REDIS_URL || '';
const CONTAINER_ID = process.env.VIRGOSCORPIO_HUB_TEST_REDIS_CONTAINER_ID || '';
const enabled = process.env.CI === 'true' &&
  process.env.VIRGOSCORPIO_HUB_RUN_REDIS_OUTAGE_INTEGRATION === 'true';

const target = enabled
  ? validateRedisOutageTarget({ redisUrl: REDIS_URL, containerId: CONTAINER_ID })
  : null;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(label, predicate, timeoutMs = 90_000) {
  const end = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < end) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(label + ' did not complete within ' + Math.round(timeoutMs / 1000) +
    ' seconds' + (lastError?.code ? ' (' + lastError.code + ')' : '') + '.');
}

function createTrackedRedisClientFactory(attempts) {
  let clientIndex = 0;
  return options => {
    const currentIndex = clientIndex++;
    const originalStrategy = options.socket.reconnectStrategy;
    const trackedOptions = {
      ...options,
      socket: {
        ...options.socket,
        reconnectStrategy(retries) {
          if (currentIndex < attempts.length) attempts[currentIndex] += 1;
          return originalStrategy(retries);
        }
      }
    };
    return createClient(trackedOptions);
  };
}

function createHub() {
  return createRealtimeHub({
    authorizeSubscribe: async ({ siteId, topic }) =>
      [SITE_A, SITE_B].includes(siteId) && topic === 'presence'
  });
}

async function subscribe(hub, siteId, principalId) {
  return hub.subscribe({
    principal: { id: principalId },
    siteId,
    topic: 'presence',
    sessionId: randomUUID(),
    expiresAt: new Date(Date.now() + 120_000).toISOString()
  });
}

function reconnectsExceeded(attempts, minimum = 11) {
  return attempts.length === 2 && attempts.every(count => count >= minimum);
}

test('real Redis outage exceeds the old retry cutoff, restores Pub/Sub and refreshes canonical presence', {
  skip: !enabled,
  timeout: 180_000
}, async t => {
  const approved = inspectRedisOutageTarget(target);
  assert.equal(approved.running, true);
  assert.equal(approved.image, 'redis:7.4-alpine');

  const suffix = randomUUID().replaceAll('-', '');
  const channelPrefix = 'virgoscorpio_hub:test:f1-20-outage:' + suffix;
  const presencePrefix = 'virgoscorpio_hub:test:f1-20-presence:' + suffix;
  const metricsA = createRealtimeMetrics();
  const metricsB = createRealtimeMetrics();
  const presenceMetrics = createRealtimeMetrics();
  const clientAttemptsA = [0, 0];
  const clientAttemptsB = [0, 0];
  const hubA = createHub();
  const hubB = createHub();

  let bridgeA;
  let bridgeB;
  let presence;
  let outageStarted = false;
  let localSubscription;
  let remoteSubscription;
  let remoteIterator;

  try {
    bridgeA = await createRedisRealtimeBridge({
      url: REDIS_URL,
      channelPrefix,
      createClient: createTrackedRedisClientFactory(clientAttemptsA),
      metrics: metricsA,
      onError() {}
    });
    bridgeB = await createRedisRealtimeBridge({
      url: REDIS_URL,
      channelPrefix,
      createClient: createTrackedRedisClientFactory(clientAttemptsB),
      metrics: metricsB,
      onError() {}
    });
    await Promise.all([bridgeA.attach(hubA), bridgeB.attach(hubB)]);

    localSubscription = await subscribe(hubA, SITE_A, 'local-observer');
    remoteSubscription = await subscribe(hubB, SITE_A, 'remote-observer');
    const localEvents = localSubscription.events[Symbol.asyncIterator]();
    remoteIterator = remoteSubscription.events[Symbol.asyncIterator]();

    presence = await createRedisPresenceService({
      url: REDIS_URL,
      keyPrefix: presencePrefix,
      leaseMs: 120_000,
      metrics: presenceMetrics
    });
    await Promise.all([
      presence.heartbeat({
        siteId: SITE_A, principalId: 'presence-site-a', sessionId: 'session-a', availability: 'active'
      }),
      presence.heartbeat({
        siteId: SITE_B, principalId: 'presence-site-b', sessionId: 'session-b', availability: 'away'
      })
    ]);

    const initialEventId = randomUUID();
    const initialPublish = await bridgeA.publish({
      siteId: SITE_A,
      topic: 'presence',
      payload: { kind: 'presence.refresh' },
      eventId: initialEventId
    });
    assert.equal(initialPublish.relayPublished, true);
    const initialLocal = await localEvents.next();
    assert.equal(initialLocal.done, false);
    assert.equal(initialLocal.value.eventId, initialEventId);
    const initialRemote = await remoteIterator.next();
    assert.equal(initialRemote.done, false);
    assert.equal(initialRemote.value.eventId, initialEventId);

    outageStarted = true;
    stopRedisOutageTarget(target);
    assert.equal(inspectRedisOutageTarget(target).running, false);

    await waitFor('publisher and subscriber retry attempts beyond the former cutoff', () =>
      reconnectsExceeded(clientAttemptsA) &&
      reconnectsExceeded(clientAttemptsB) &&
      (presenceMetrics.snapshot().counters.redis_reconnect_attempts_total || 0) >= 11
    );

    assert.equal(bridgeA.isReady, false);
    assert.equal(bridgeB.isReady, false);
    assert.equal(metricsA.snapshot().gauges.redis_bridge_degraded, 1);
    assert.equal(metricsB.snapshot().gauges.redis_bridge_degraded, 1);

    const missedEventId = randomUUID();
    const missedPublish = await bridgeA.publish({
      siteId: SITE_A,
      topic: 'presence',
      payload: { kind: 'presence.refresh' },
      eventId: missedEventId
    });
    assert.equal(missedPublish.delivered, 1, 'same-instance delivery remains local-first during the outage');
    assert.equal(missedPublish.relayPublished, false);
    assert.equal(missedPublish.degraded, true);
    const localOutageEvent = await localEvents.next();
    assert.equal(localOutageEvent.done, false);
    assert.equal(localOutageEvent.value.eventId, missedEventId);

    // Keep this read pending across restart. A message queued during downtime
    // would resolve it with the missed ID before the explicit post-recovery event.
    const nextRemoteEvent = remoteIterator.next();
    const noOutageReplay = await Promise.race([
      nextRemoteEvent.then(result => ({ kind: 'event', result })),
      delay(750).then(() => ({ kind: 'timeout' }))
    ]);
    assert.equal(noOutageReplay.kind, 'timeout', 'remote replicas must not receive an outage-time Pub/Sub hint');

    startRedisOutageTarget(target);
    outageStarted = false;

    await waitFor('both Redis bridges and the presence client to reconnect', async () => {
      if (!bridgeA.isReady || !bridgeB.isReady) return false;
      const snapshotA = await presence.list({ siteId: SITE_A, viewerId: 'presence-observer' });
      return snapshotA.some(item => item.userId === 'presence-site-a');
    }, 45_000);

    assert.equal(metricsA.snapshot().gauges.redis_bridge_ready, 1);
    assert.equal(metricsA.snapshot().gauges.redis_bridge_degraded, 0);
    assert.equal(metricsB.snapshot().gauges.redis_bridge_ready, 1);
    assert.equal(metricsB.snapshot().gauges.redis_bridge_degraded, 0);
    assert.ok((metricsA.snapshot().counters.redis_reconnect_attempts_total || 0) >= 22);
    assert.ok((metricsB.snapshot().counters.redis_reconnect_attempts_total || 0) >= 22);
    assert.ok((presenceMetrics.snapshot().counters.redis_reconnect_attempts_total || 0) >= 11);

    const recoveredEventId = randomUUID();
    const recoveredPublish = await bridgeA.publish({
      siteId: SITE_A,
      topic: 'presence',
      payload: { kind: 'presence.refresh' },
      eventId: recoveredEventId
    });
    assert.equal(recoveredPublish.relayPublished, true);
    const recoveredRemote = await nextRemoteEvent;
    assert.equal(recoveredRemote.done, false);
    assert.equal(recoveredRemote.value.eventId, recoveredEventId);
    assert.notEqual(recoveredRemote.value.eventId, missedEventId);

    const snapshotA = await presence.list({ siteId: SITE_A, viewerId: 'presence-observer' });
    const snapshotB = await presence.list({ siteId: SITE_B, viewerId: 'presence-observer' });
    assert.deepEqual(snapshotA.map(item => item.userId), ['presence-site-a']);
    assert.deepEqual(snapshotB.map(item => item.userId), ['presence-site-b']);

    console.log(JSON.stringify({
      scenario: 'real-redis-outage-reconnect-beyond-former-cutoff',
      containerImage: approved.image,
      publisherAndSubscriberAttempts: {
        bridgeA: clientAttemptsA,
        bridgeB: clientAttemptsB
      },
      presenceReconnectAttempts: presenceMetrics.snapshot().counters.redis_reconnect_attempts_total || 0,
      outagePublishRelayDelivered: missedPublish.relayPublished,
      postRecoveryPublishDelivered: recoveredPublish.relayPublished,
      pubsubOutageMessageReplayed: false,
      presenceSiteIsolation: true
    }));
  } finally {
    let restoreError;
    if (outageStarted) {
      try {
        startRedisOutageTarget(target);
        outageStarted = false;
      } catch (error) {
        restoreError = error;
      }
    }
    await presence?.close().catch(() => {});
    localSubscription?.close();
    remoteSubscription?.close();
    hubA.close();
    hubB.close();
    await Promise.allSettled([bridgeA?.close(), bridgeB?.close()]);
    if (restoreError) throw restoreError;
  }
});

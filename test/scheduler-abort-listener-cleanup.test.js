'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForSchedulerInterval } = require('../apps/worker/src/scheduler');

function createAbortSignal({ aborted = false, onAddListener } = {}) {
  const listeners = new Map();
  let isAborted = aborted;
  let addCount = 0;

  const signal = {
    get aborted() { return isAborted; },
    get listenerCount() { return listeners.size; },
    get addCount() { return addCount; },
    addEventListener(type, listener, options = {}) {
      assert.equal(type, 'abort');
      addCount += 1;
      listeners.set(listener, { once: options.once === true });
      onAddListener?.(signal);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort');
      listeners.delete(listener);
    },
    abort() {
      if (isAborted) return;
      isAborted = true;
      for (const [listener, options] of [...listeners.entries()]) {
        if (options.once) listeners.delete(listener);
        listener.call(signal, { type: 'abort', target: signal });
      }
    }
  };

  return signal;
}

function createFakeTimers({ scheduleError = null } = {}) {
  const pending = new Map();
  let nextId = 1;

  return {
    get pendingCount() { return pending.size; },
    setTimeout(callback, delay) {
      if (scheduleError) throw scheduleError;
      const id = nextId++;
      pending.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    runNext() {
      const next = pending.entries().next();
      assert.equal(next.done, false, 'Expected a scheduled timer');
      const [id, timer] = next.value;
      pending.delete(id);
      timer.callback();
      return timer.delay;
    }
  };
}

test('Scheduler interval completion removes its abort listener and timer', async () => {
  const signal = createAbortSignal();
  const timers = createFakeTimers();
  const waiting = waitForSchedulerInterval(signal, 5000, timers);

  assert.equal(signal.listenerCount, 1);
  assert.equal(timers.pendingCount, 1);
  assert.equal(timers.runNext(), 5000);
  await waiting;

  assert.equal(signal.listenerCount, 0);
  assert.equal(timers.pendingCount, 0);
});

test('Scheduler abort clears the pending timer and removes its listener', async () => {
  const signal = createAbortSignal();
  const timers = createFakeTimers();
  const waiting = waitForSchedulerInterval(signal, 5000, timers);

  signal.abort();
  await waiting;

  assert.equal(signal.listenerCount, 0);
  assert.equal(timers.pendingCount, 0);
});

test('Scheduler interval does not register or schedule work for an already-aborted signal', async () => {
  const signal = createAbortSignal({ aborted: true });
  const timers = createFakeTimers();

  await waitForSchedulerInterval(signal, 5000, timers);

  assert.equal(signal.addCount, 0);
  assert.equal(signal.listenerCount, 0);
  assert.equal(timers.pendingCount, 0);
});

test('Repeated scheduler intervals leave no abort listeners or pending timers', async () => {
  const signal = createAbortSignal();
  const timers = createFakeTimers();

  for (let cycle = 0; cycle < 100; cycle += 1) {
    const waiting = waitForSchedulerInterval(signal, 1, timers);
    assert.equal(signal.listenerCount, 1, `cycle ${cycle} should register one transient listener`);
    assert.equal(timers.pendingCount, 1, `cycle ${cycle} should schedule one timer`);

    timers.runNext();
    await waiting;

    assert.equal(signal.listenerCount, 0, `cycle ${cycle} should release its listener`);
    assert.equal(timers.pendingCount, 0, `cycle ${cycle} should release its timer`);
  }

  assert.equal(signal.addCount, 100);
});

test('Scheduler interval releases its abort listener when timer scheduling fails', async () => {
  const signal = createAbortSignal();
  const expectedError = new Error('timer scheduling failed');
  const timers = createFakeTimers({ scheduleError: expectedError });

  await assert.rejects(
    waitForSchedulerInterval(signal, 5000, timers),
    error => error === expectedError
  );

  assert.equal(signal.listenerCount, 0);
  assert.equal(timers.pendingCount, 0);
});

test('Scheduler interval handles abort during listener registration without scheduling a timer', async () => {
  const signal = createAbortSignal({ onAddListener: currentSignal => currentSignal.abort() });
  const timers = createFakeTimers();

  await waitForSchedulerInterval(signal, 5000, timers);

  assert.equal(signal.aborted, true);
  assert.equal(signal.listenerCount, 0);
  assert.equal(timers.pendingCount, 0);
});
test('Scheduler interval resolves with the native AbortController signal', async () => {
  const controller = new AbortController();
  const waiting = waitForSchedulerInterval(controller.signal, 60_000);

  controller.abort();
  await waiting;
});

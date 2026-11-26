'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

/**
 * Tests for the public asset delivery concurrency mitigation.
 *
 * Pentest finding: Unauthenticated public asset downloads can exhaust API memory and storage resources
 *
 * The mitigation introduces a process-wide concurrency limit (PUBLIC_ASSET_MAX_CONCURRENCY) that
 * bounds the number of simultaneous public asset deliveries. This prevents distributed clients from
 * exhausting memory by keeping many large buffers in flight simultaneously.
 */

async function withServer(fn, envExtra = {}, serverOptions = {}) {
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_API_TOKEN: 'test-secret-token',
      AI_PROVIDER: 'mock',
      MAX_REQUEST_BYTES: '16384',
      RATE_LIMIT_MAX_REQUESTS: '100',
      ...envExtra
    },
    logger: { error() {} },
    ...serverOptions
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
}

async function waitForCondition(predicate, description, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for ' + description + '.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(10_000) });
}

test('public media delivery respects concurrency limit and returns 503 when exhausted', async () => {
  const assetId = '11111111-1111-4111-8111-111111111111';
  const largeAsset = Buffer.alloc(1024 * 1024); // 1 MiB asset

  let activeReads = 0;
  let maxConcurrentReads = 0;
  const readPromises = [];
  let completeReadsImmediately = false;

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;

      activeReads++;
      maxConcurrentReads = Math.max(maxConcurrentReads, activeReads);

      // Create a promise that can be completed after the overflow responses arrive.
      return new Promise(resolve => {
        const complete = () => {
          activeReads--;
          resolve({ id: assetId, mime_type: 'image/png', data: largeAsset });
        };
        if (completeReadsImmediately) complete();
        else readPromises.push(complete);
      });
    }
  };

  await withServer(async base => {
    const requests = Array.from({ length: 5 }, () =>
      fetchWithTimeout(base + '/media/' + assetId).then(response => {
        return response;
      })
    );
    let rejectedCount = 0;
    const requestErrors = [];
    const observedRequests = requests.map((request, index) => request.then(response => {
      if (response.status === 503) rejectedCount += 1;
      return response;
    }, error => {
      requestErrors.push({ index, error });
      return null;
    }));

    try {
      // Wait until all overflow requests have actually received 503. A fixed
      // sleep can release the successful reads before every request is accepted,
      // allowing late requests to occupy slots that the test never completes.
      await waitForCondition(
        () => rejectedCount === 3 || requestErrors.length > 0,
        'three public media overflow responses'
      );
      assert.equal(requestErrors.length, 0, requestErrors.map(entry =>
        'request ' + entry.index + ': ' + entry.error.message
      ).join('; '));
      assert.equal(rejectedCount, 3, 'Exactly 3 requests should be rejected with 503');
      assert.equal(readPromises.length, 2, 'Only 2 requests should be reading from storage');

      for (const complete of readPromises.splice(0)) complete();
      const responses = await Promise.all(observedRequests);

      let successCount = 0;
      let rejectedCountFromResponses = 0;
      for (const res of responses) {
        if (res.status === 200) {
          successCount++;
          const buffer = await res.arrayBuffer();
          assert.equal(buffer.byteLength, largeAsset.length);
        } else if (res.status === 503) {
          rejectedCountFromResponses++;
          const json = await res.json();
          assert.equal(json.code, 'ERR_VIRGOSCORPIO_HUB_PUBLIC_ASSET_BUSY');
          assert.equal(res.headers.get('retry-after'), '1');
        }
      }

      assert.equal(successCount, 2, 'Exactly 2 requests should succeed');
      assert.equal(rejectedCountFromResponses, 3, 'Exactly 3 requests should be rejected with 503');
      assert.equal(maxConcurrentReads, 2, 'Maximum concurrent reads should not exceed limit');
    } finally {
      // Ensure a failed assertion cannot leave the test server waiting on a
      // deferred read; any request arriving during teardown completes at once.
      completeReadsImmediately = true;
      for (const complete of readPromises.splice(0)) complete();
      await Promise.allSettled(observedRequests);
    }
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '2' }, { mediaStore });
});

test('public library asset delivery respects concurrency limit', async () => {
  const assetId = '22222222-2222-4222-8222-222222222222';
  const largeAsset = Buffer.alloc(2 * 1024 * 1024); // 2 MiB asset

  let activeReads = 0;
  const readPromises = [];

  const libraryStore = {
    async readPublic(id) {
      if (id !== assetId) return null;

      activeReads++;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          activeReads--;
          resolve({
            id: assetId,
            mime_type: 'application/pdf',
            data: largeAsset
          });
        });
      });

      return promise;
    }
  };

  await withServer(async base => {
    // Set concurrency limit to 3
    const requests = [];

    // Start 6 concurrent requests
    for (let i = 0; i < 6; i++) {
      requests.push(fetch(`${base}/library/public/${assetId}`));
    }

    // Give requests time to hit the server
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have 3 requests in flight (the limit)
    assert.equal(readPromises.length, 3, 'Only 3 requests should be reading from storage');

    // Complete all pending requests
    for (const resolve of readPromises) {
      resolve();
    }

    const responses = await Promise.all(requests);

    let successCount = 0;
    let rejectedCount = 0;

    for (const res of responses) {
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 503) {
        rejectedCount++;
        const json = await res.json();
        assert.equal(json.code, 'ERR_VIRGOSCORPIO_HUB_PUBLIC_ASSET_BUSY');
      }
    }

    assert.equal(successCount, 3, 'Exactly 3 requests should succeed');
    assert.equal(rejectedCount, 3, 'Exactly 3 requests should be rejected');
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '3' }, { libraryStore });
});

test('public library variant delivery respects concurrency limit', async () => {
  const assetId = '33333333-3333-4333-8333-333333333333';
  const variantKey = 'thumbnail';
  const variantData = Buffer.alloc(512 * 1024); // 512 KiB

  const readPromises = [];

  const libraryStore = {
    async readPublicVariant({ assetId: id, variantKey: key }) {
      if (id !== assetId || key !== variantKey) return null;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({
            id: assetId,
            variant_key: variantKey,
            mime_type: 'image/jpeg',
            data: variantData
          });
        });
      });

      return promise;
    }
  };

  await withServer(async base => {
    // Set concurrency limit to 1 (most restrictive)
    const requests = [];

    // Start 3 concurrent requests
    for (let i = 0; i < 3; i++) {
      requests.push(fetch(`${base}/library/public/${assetId}/variants/${variantKey}`));
    }

    // Give requests time to hit the server
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have only 1 request in flight
    assert.equal(readPromises.length, 1, 'Only 1 request should be reading from storage');

    // Complete the request
    readPromises[0]();

    const responses = await Promise.all(requests);

    let successCount = 0;
    let rejectedCount = 0;

    for (const res of responses) {
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 503) {
        rejectedCount++;
      }
    }

    assert.equal(successCount, 1, 'Exactly 1 request should succeed');
    assert.equal(rejectedCount, 2, 'Exactly 2 requests should be rejected');
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '1' }, { libraryStore });
});

test('concurrency slot is released when response finishes', async () => {
  const assetId = '44444444-4444-4444-8444-444444444444';
  const asset = Buffer.alloc(100 * 1024); // 100 KiB

  let readCount = 0;

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;
      readCount++;
      return {
        id: assetId,
        mime_type: 'image/png',
        data: asset
      };
    }
  };

  await withServer(async base => {
    // Set concurrency limit to 1
    // Make first request and wait for it to complete
    const res1 = await fetch(`${base}/media/${assetId}`);
    assert.equal(res1.status, 200);
    await res1.arrayBuffer(); // Consume the response

    // Now make a second request - it should succeed because the slot was released
    const res2 = await fetch(`${base}/media/${assetId}`);
    assert.equal(res2.status, 200);
    await res2.arrayBuffer();

    // Both requests should have succeeded
    assert.equal(readCount, 2, 'Both requests should have been processed');
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '1' }, { mediaStore });
});

test('concurrency slot is released when client disconnects', async () => {
  const assetId = '55555555-5555-4555-8555-555555555555';
  const largeAsset = Buffer.alloc(5 * 1024 * 1024); // 5 MiB

  let readCount = 0;
  const readPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;
      readCount++;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({
            id: assetId,
            mime_type: 'image/png',
            data: largeAsset
          });
        });
      });

      return promise;
    }
  };

  await withServer(async base => {
    // Set concurrency limit to 1
    const controller = new AbortController();

    // Start first request but abort it before completion
    const req1 = fetch(`${base}/media/${assetId}`, { signal: controller.signal });

    // Wait for the request to start
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(readPromises.length, 1, 'First request should be in progress');

    // Abort the first request
    controller.abort();
    await assert.rejects(req1);

    // Wait a bit for the slot to be released
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now start a second request - it should be able to proceed
    const req2 = fetch(`${base}/media/${assetId}`);

    // Wait for second request to start
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(readPromises.length, 2, 'Second request should be in progress after first was aborted');

    // Complete the second request
    readPromises[1]();

    const res2 = await req2;
    assert.equal(res2.status, 200);

    assert.equal(readCount, 2, 'Both requests should have started reading');
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '1' }, { mediaStore });
});

test('concurrency limit can be configured via environment variable', async () => {
  const assetId = '66666666-6666-4666-8666-666666666666';
  const asset = Buffer.alloc(1024);

  const readPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({ id: assetId, mime_type: 'image/png', data: asset });
        });
      });

      return promise;
    }
  };

  // Test with limit of 5
  await withServer(async base => {
    const requests = [];

    for (let i = 0; i < 10; i++) {
      requests.push(fetch(`${base}/media/${assetId}`));
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have 5 requests in flight
    assert.equal(readPromises.length, 5, 'Should respect configured limit of 5');

    // Complete all requests
    for (const resolve of readPromises) {
      resolve();
    }

    await Promise.all(requests);
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '5' }, { mediaStore });
});

test('default concurrency limit is 4 when not configured', async () => {
  const assetId = '77777777-7777-4777-8777-777777777777';
  const asset = Buffer.alloc(1024);

  const readPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({ id: assetId, mime_type: 'image/png', data: asset });
        });
      });

      return promise;
    }
  };

  // Don't set PUBLIC_ASSET_MAX_CONCURRENCY - should default to 4
  await withServer(async base => {
    const requests = [];

    for (let i = 0; i < 15; i++) {
      requests.push(fetch(`${base}/media/${assetId}`));
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have 4 requests in flight (default)
    assert.equal(readPromises.length, 4, 'Should use default limit of 4');

    // Complete all requests
    for (const resolve of readPromises) {
      resolve();
    }

    await Promise.all(requests);
  }, {}, { mediaStore });
});

test('concurrency limit applies independently to media and library routes', async () => {
  const mediaAssetId = '88888888-8888-4888-8888-888888888888';
  const libraryAssetId = '99999999-9999-4999-8999-999999999999';
  const asset = Buffer.alloc(1024);

  const mediaReadPromises = [];
  const libraryReadPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== mediaAssetId) return null;

      const promise = new Promise(resolve => {
        mediaReadPromises.push(() => {
          resolve({ id: mediaAssetId, mime_type: 'image/png', data: asset });
        });
      });

      return promise;
    }
  };

  const libraryStore = {
    async readPublic(id) {
      if (id !== libraryAssetId) return null;

      const promise = new Promise(resolve => {
        libraryReadPromises.push(() => {
          resolve({ id: libraryAssetId, mime_type: 'application/pdf', data: asset });
        });
      });

      return promise;
    }
  };

  await withServer(async base => {
    // Set limit to 2
    const requests = [];

    // Start 3 media requests and 3 library requests
    for (let i = 0; i < 3; i++) {
      requests.push(fetch(`${base}/media/${mediaAssetId}`));
      requests.push(fetch(`${base}/library/public/${libraryAssetId}`));
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // The limit is shared across all public asset routes
    // So we should have 2 total requests in flight
    const totalInFlight = mediaReadPromises.length + libraryReadPromises.length;
    assert.equal(totalInFlight, 2, 'Concurrency limit should be shared across all public asset routes');

    // Complete all requests
    for (const resolve of [...mediaReadPromises, ...libraryReadPromises]) {
      resolve();
    }

    await Promise.all(requests);
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '2' }, { mediaStore, libraryStore });
});

test('404 responses release concurrency slots after lookup', async () => {
  const validAssetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const invalidAssetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const asset = Buffer.alloc(1024);

  const readPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== validAssetId) return null; // Return null for invalid IDs

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({ id: validAssetId, mime_type: 'image/png', data: asset });
        });
      });

      return promise;
    }
  };

  await withServer(async base => {
    // A missing asset must return 404 and release its slot when the response finishes.
    const firstNotFound = await fetch(`${base}/media/${invalidAssetId}`);
    assert.equal(firstNotFound.status, 404);
    await firstNotFound.arrayBuffer();

    const secondNotFound = await fetch(`${base}/media/${invalidAssetId}`);
    assert.equal(secondNotFound.status, 404);
    await secondNotFound.arrayBuffer();

    // The completed 404 responses must not leak the only available slot.
    const validRequest = fetch(`${base}/media/${validAssetId}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(readPromises.length, 1, 'Valid request should acquire the slot after 404 responses finish.');
    readPromises[0]();
    const validResponse = await validRequest;
    assert.equal(validResponse.status, 200);
    await validResponse.arrayBuffer();
  }, { PUBLIC_ASSET_MAX_CONCURRENCY: '1' }, { mediaStore });
});

test('concurrency limit rejects configuration outside the safe range (1-8)', async () => {
  const assetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const asset = Buffer.alloc(1024);

  const readPromises = [];

  const mediaStore = {
    async readPublic(id) {
      if (id !== assetId) return null;

      const promise = new Promise(resolve => {
        readPromises.push(() => {
          resolve({ id: assetId, mime_type: 'image/png', data: asset });
        });
      });

      return promise;
    }
  };

  for (const value of ['0', '9']) {
    assert.throws(
      () => createApiServer({
        env: {
          NODE_ENV: 'test',
          VIRGOSCORPIO_HUB_API_TOKEN: 'test-secret-token',
          AI_PROVIDER: 'mock',
          PUBLIC_ASSET_MAX_CONCURRENCY: value
        },
        logger: { error() {} }
      }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_CONFIG_LIMIT' && error.message.includes('between 1 and 8')
    );
  }
});

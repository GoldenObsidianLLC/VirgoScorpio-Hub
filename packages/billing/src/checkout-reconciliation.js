'use strict';

const {
  releaseOrderStockReservations,
  commitOrderStockReservations
} = require('../../commerce/src/stock-reservations');
const { withTransaction } = require('../../db/src/transaction');

const MAX_BATCH_SIZE = 1_000;
const DEFAULT_BATCH_SIZE = 100;
const RECONCILIATION_RETRY_DELAY_MINUTES = 15;
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
function validateBatchSize(batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    const error = new TypeError(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
    error.code = 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_RECONCILIATION_BATCH';
    throw error;
  }
  return batchSize;
}

async function stripeSessionRequest({ secretKey, sessionId, fetchImpl, method = 'GET', action = '' }) {
  const response = await fetchImpl(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}${action}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });
  let raw;
  try {
    raw = await response.text();
  } catch (cause) {
    const error = new Error('Could not read Stripe Checkout Session response.');
    error.cause = cause;
    throw error;
  }
  if (!response.ok) throw new Error(`Stripe Checkout Session lookup returned HTTP ${response.status}.`);
  let session;
  try { session = JSON.parse(raw); } catch (cause) {
    const error = new Error('Stripe Checkout Session response was not valid JSON.');
    error.cause = cause;
    throw error;
  }
  if (!session || session.id !== sessionId || !['open', 'complete', 'expired'].includes(session.status)
      || !['paid', 'unpaid', 'no_payment_required'].includes(session.payment_status)) {
    throw new Error('Stripe Checkout Session response did not match the requested session or status contract.');
  }
  return session;
}

function getStripeSession(options) {
  return stripeSessionRequest(options);
}

// Ask Stripe to expire a still-open session so that it can no longer be paid; only
// the provider's confirmation (status 'expired') permits the local hold to be released.
function expireStripeSession(options) {
  return stripeSessionRequest({ ...options, method: 'POST', action: '/expire' });
}

// Keep unresolved reservations out of the next scheduler tick. Reuse the
// reservation expiry as a durable retry-after timestamp across worker restarts.
async function deferReservationReconciliation(pool, order) {
  await pool.query(
    `UPDATE commerce_stock_reservations
        SET expires_at=GREATEST(expires_at, now() + ($3::integer * INTERVAL '1 minute'))
      WHERE site_id=$1 AND order_id=$2 AND status='reserved'`,
    [order.site_id, order.order_id, RECONCILIATION_RETRY_DELAY_MINUTES]
  );
}

/**
 * Reconcile expired local inventory holds against Stripe's current session state.
 * A local timer is never sufficient evidence to release stock. Sessions without a
 * provider ID, provider lookup/expiry failures, sessions that remain open after an
 * expiry request, and unpaid completed sessions (including delayed payment methods)
 * retain their holds until Stripe or a definitive webhook establishes the outcome.
 * Only a provider-confirmed expired session releases inventory; a completed paid
 * session commits the reservation. Unknown provider state is an operational exception,
 * not evidence that the payment cannot still settle.
 * Unresolved outcomes advance reservation expiry as a durable 15-minute retry-after.
 */
async function reconcileExpiredStripeCheckouts(pool, {
  secretKey = process.env.STRIPE_SECRET_KEY,
  fetchImpl = globalThis.fetch,
  batchSize = DEFAULT_BATCH_SIZE
} = {}) {
  validateBatchSize(batchSize);
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new TypeError('A PostgreSQL-compatible pool with query and connect is required.');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (typeof secretKey !== 'string' || !/^sk_(test|live)_/.test(secretKey)) {
    return { skipped: true, checked: 0, expired: 0, paid: 0, held: 0, errors: 0, unlinked: 0 };
  }

  const candidates = await pool.query(
    `SELECT o.id AS order_id,o.site_id,o.provider_session_id
       FROM commerce_orders o
      WHERE o.provider='stripe' AND o.status='pending_payment'
        AND EXISTS (
          SELECT 1 FROM commerce_stock_reservations r
           WHERE r.site_id=o.site_id AND r.order_id=o.id
             AND r.status='reserved' AND r.expires_at<=now()
        )
      ORDER BY o.created_at,o.id
      LIMIT $1`,
    [batchSize]
  );

  const summary = { skipped: false, checked: 0, expired: 0, paid: 0, held: 0, errors: 0, unlinked: 0 };
  for (const order of candidates.rows) {
    summary.checked += 1;
    if (typeof order.provider_session_id !== 'string' || !order.provider_session_id) {
      // An absent ID can represent an ambiguous provider outcome. Never guess that
      // Stripe failed; retain the reservation for same-key recovery/manual review.
      await deferReservationReconciliation(pool, order);
      summary.unlinked += 1;
      summary.held += 1;
      continue;
    }

    const sessionOptions = { secretKey, sessionId: order.provider_session_id, fetchImpl };

    let session;
    try {
      session = await getStripeSession(sessionOptions);
      if (session.status === 'open') {
        // Ask Stripe to close the session, but release stock only if Stripe confirms it
        // is expired. A 2xx response that remains open is not terminal evidence.
        session = await expireStripeSession(sessionOptions);
      }
    } catch {
      // Network errors, timeouts, rate limits, provider 5xx responses, and malformed
      // responses all leave the provider outcome unknown. Preserve stock for recovery.
      summary.errors += 1;
      await deferReservationReconciliation(pool, order);
      summary.held += 1;
      continue;
    }

    if (session.status === 'open') {
      await deferReservationReconciliation(pool, order);
      summary.held += 1;
      continue;
    }

    const isExpired = session.status === 'expired' && session.payment_status !== 'paid';
    const isPaid = session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status);
    if (!isExpired && !isPaid) {
      await deferReservationReconciliation(pool, order);
      summary.held += 1;
      continue;
    }

    const outcome = await withTransaction(pool, async client => {
      const current = await client.query(
        `SELECT id,site_id,status,provider_session_id
           FROM commerce_orders
          WHERE site_id=$1 AND id=$2
          FOR UPDATE`,
        [order.site_id, order.order_id]
      );
      const row = current.rows[0];
      if (!row || row.status !== 'pending_payment' || row.provider_session_id !== order.provider_session_id) {
        return 'held';
      }
      if (isExpired) {
        const update = await client.query(
          `UPDATE commerce_orders SET status='failed',updated_at=now()
            WHERE site_id=$1 AND id=$2 AND status='pending_payment'
              AND provider_session_id=$3 RETURNING id`,
          [order.site_id, order.order_id, order.provider_session_id]
        );
        if (!update.rows[0]) return 'held';
        await releaseOrderStockReservations(client, { siteId: order.site_id, orderId: order.order_id, status: 'expired' });
        return 'expired';
      }
      const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : null;
      const update = await client.query(
        `UPDATE commerce_orders SET status='paid',provider='stripe',provider_session_id=$3,
                provider_payment_id=COALESCE($4,provider_payment_id),updated_at=now()
          WHERE site_id=$1 AND id=$2 AND status='pending_payment'
            AND provider_session_id=$3 RETURNING id`,
        [order.site_id, order.order_id, order.provider_session_id, paymentIntent]
      );
      if (!update.rows[0]) return 'held';
      await commitOrderStockReservations(client, { siteId: order.site_id, orderId: order.order_id });
      return 'paid';
    });
    if (outcome === 'expired') summary.expired += 1;
    else if (outcome === 'paid') summary.paid += 1;
    else summary.held += 1;
  }
  return summary;
}

module.exports = { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE, validateBatchSize, reconcileExpiredStripeCheckouts };

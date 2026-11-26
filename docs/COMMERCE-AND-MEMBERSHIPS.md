# Commerce, Billing, and Memberships

## Current scope

The commerce platform includes product records, inventory quantity/status, order and line-item snapshots, checkout idempotency keys, Stripe Checkout creation, timestamped webhook signature verification, payment status updates, membership plans with one-time/month/year intervals, and paid-membership states. The 0.5.1 development increments add tenant-scoped Stripe refunds with durable order-scoped idempotency, integer minor-unit balance reservations, ambiguous-outcome preservation, refund webhook binding, partial/full refund state transitions, and recurring-membership lifecycle reconciliation.

All money is represented in integer minor units (for example cents), never floating point. The checkout code re-reads published product rows inside a transaction, reserves finite stock, writes order snapshots, and releases reserved stock when checkout creation fails. Webhooks use timestamp tolerance and HMAC verification and are recorded by provider/event ID for deduplication.

## Important limits

This implementation does not yet provide the complete operational feature set expected of WooCommerce or a mature billing platform. Before production, complete taxes, shipping calculation, regional rules, coupons/discount calculation and atomic redemption, refund reconciliation/customer workflows and test-mode provider acceptance, returns, invoice/receipt generation, product variation management, digital-entitlement delivery, fulfilment workflows, stock reservation expiry, dispute handling, payment reconciliation, subscription plan changes, billing portal, dunning/retries, cancellation/renewal tests, and customer service/admin experiences.

The coupon table is groundwork only and must not be exposed as supported checkout discount functionality until its lifecycle and race-safe usage counters are implemented.

## Stripe configuration

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHECKOUT_SUCCESS_URL`, and `STRIPE_CHECKOUT_CANCEL_URL` as deployment secrets/configuration. Use test-mode keys and a private test webhook before any live test. Never store raw card details in VirgoScorpio Hub. Card collection belongs to Stripe-hosted Checkout; the application stores references and status only.

### Checkout reservation reconciliation

The worker periodically reconciles expired local inventory holds against the current Stripe Checkout Session. An open session is asked to expire through Stripe; inventory is released only when Stripe returns a valid, matching session with `status: expired` and a non-paid payment status. A completed paid/no-payment-required session commits its reservation. A completed unpaid session can represent a delayed payment method and remains reserved until a definitive asynchronous success/failure event or a later provider read resolves it.

A timeout, network failure, Stripe `429`/`5xx`, malformed/mismatched response, or session that remains open after the expiry request is an unknown outcome, not proof that payment is impossible. Such orders remain `pending_payment` with stock reserved regardless of elapsed local time. For an unresolved outcome, the worker sets the `expires_at` timestamp on still-reserved rows to at least 15 minutes ahead. This is a durable retry-after backoff across worker restarts, not an expiry or release decision; it prevents provider lookups from repeating on every default five-second scheduler tick. A definitive signed webhook can still resolve the order immediately. The scheduler emits `virgoscorpio_hub.scheduler.checkout_reconciliation` records with `errors`, `held`, and `unlinked` counts; investigate recurring errors/unlinked sessions, restore provider connectivity, and reconcile against the current Stripe Dashboard/session and signed webhook history. Do not manually fail an order or release its reservation while the provider outcome could still settle. If payment succeeds after an operational hold has been escalated, reconcile the order and stock before fulfilling; use a refund/exception workflow if inventory can no longer be honored.
### Webhook ingress controls

The inbound Stripe webhook endpoint requires a non-empty `Stripe-Signature` header before reading the request body, applies its dedicated IP budget before buffering, caps the raw body at 2 MiB, and verifies the HMAC against the exact raw bytes before JSON parsing or database processing. `STRIPE_WEBHOOK_RATE_LIMIT_MAX_REQUESTS` defaults to 300 requests per `RATE_LIMIT_WINDOW_MS` window (default 60,000 ms) and accepts 1-10,000. `STRIPE_WEBHOOK_BODY_TIMEOUT_MS` defaults to 10,000 ms and accepts 1,000-60,000 ms. Invalid configuration fails API startup rather than silently disabling the controls.

The rate-limit buckets are bounded and process-local, keyed by the TCP peer address (`req.socket.remoteAddress`); they are not a cluster-wide or globally coordinated limit. Behind a single reverse proxy, requests may therefore share the proxy address and one worker-local bucket. Tune the application budget for that topology and enforce per-client plus aggregate ingress budgets at the trusted edge. The API does not trust forwarded-IP headers as an authentication or rate-limit identity; do not add that trust without an explicit trusted-proxy configuration. The body timeout pauses request consumption and returns HTTP 408 before closing the connection; clients should retry according to Stripe's delivery behavior.

The refund API requires `commerce:manage` on the target site and accepts `amountMinor`, an optional `reason` (`duplicate`, `fraudulent`, or `requested_by_customer`), and a caller-generated `Idempotency-Key` header (the body `idempotencyKey` is also accepted for compatibility). Reuse the same key and parameters after a timeout or unknown outcome; a different amount, currency, or reason under the same key is rejected. Requested/pending/succeeded refunds reserve balance. A full refund changes the order to `refunded` only when succeeded refunds cumulatively cover the order total. Refunds do not automatically restock inventory.

For subscription lifecycle events (`customer.subscription.*` and subscription invoice payment events), the handler uses signed event metadata only to locate the tenant-bound membership, locks that membership row, then retrieves the current Subscription from Stripe before applying status and billing-period fields. This avoids using immutable webhook snapshots or second-resolution `event.created` values as an ordering mechanism. The provider read requires `STRIPE_SECRET_KEY`; transient retrieval failures roll back the event receipt so Stripe can retry. Membership status preserves Stripe's `paused` state separately from cancellation/expiration. Billing-period persistence supports both legacy Subscription-level period fields and Basil's Subscription Item-level fields; for mixed intervals it summarizes to the latest item start and earliest item end.

The webhook endpoint must be reachable by the provider in a real test environment. Test duplicate delivery, out-of-order events, signature failures, delayed/failed payments, checkout expiration, refund creation/update/failure, subscription creation/renewal/cancellation/pause/resume, unknown provider outcomes, and process restarts. A mocked unit suite is not a substitute for an independent Stripe test-mode run with webhook delivery evidence. Do not grant access based solely on a redirect from the checkout page; update access only after verified provider events/state reconciliation.

## Data privacy and access control

Orders, customer emails, billing/shipping addresses, membership status, and activity are tenant-scoped personal data. Enforce capability checks, least privilege, retention, export/deletion rules, and audit trails. Never rely on a client-supplied total, product price, discount, or role.


## 0.5.0 status note

Migration 0007 adds data-model foundations for stock reservations, coupon-redemption records, refunds and downloadable-product entitlements. These tables do not mean the full order, tax, shipping, refund, entitlement delivery or recurring billing state machines are complete. Those remain acceptance-test and implementation gates in `FEATURE-PARITY.md` and `RELEASE-GATE.md`.

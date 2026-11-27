# Supervised mail-worker deployment (systemd reference)

`virgoscorpio-hub-mail-worker.service` is a reference unit for a Linux host using systemd. It is not installed or enabled by this repository change, and it is not a production deployment record.

## Responsibilities

- `npm run start:worker` runs the graph-projection outbox consumer.
- `npm run start:mail-worker` runs `apps/worker/src/mail-worker.js`, which drains both `password_reset_requests` and `mail_outbox`.
- Run the mail worker as a separate supervised process alongside each API deployment tier. Multiple worker instances are supported by PostgreSQL `FOR UPDATE SKIP LOCKED` claims.
- All API and mail-worker instances must use the same PostgreSQL cluster and the same `VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING` value.

## Host preparation

Create a dedicated non-login service account and a root-owned application directory. Install the exact reviewed release commit and its production dependencies into `/opt/virgoscorpio-hub/current`; do not point the unit at a developer checkout.

Create `/etc/virgoscorpio-hub/mail-worker.env` outside the repository. It must be owned by `root`, readable only by root and the service group (`0640` or stricter), and contain the worker's required `DATABASE_URL`, production mail-provider configuration (`VIRGOSCORPIO_HUB_MAIL_PROVIDER`, `VIRGOSCORPIO_HUB_MAIL_FROM`, provider API key), and any configured OTLP export settings. Do not place credentials in this file in Git, the unit file, shell history, or deployment logs. Use the host's approved secret-management process to provision and rotate them.

Set `VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING` consistently on the API and worker (default `5000`, permitted `1..100000`). Verify sender-domain authentication, provider acceptance, bounce handling and alert routing before enabling password reset for public accounts. Never set `VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS=true` in production.

## Install and operate

1. Copy the unit to `/etc/systemd/system/virgoscorpio-hub-mail-worker.service` and inspect every path, account, Node executable and hardening option for the target host.
2. Validate the external environment file and permissions; verify the service account can read the application and environment file but cannot modify the release tree.
3. Run `systemd-analyze verify /etc/systemd/system/virgoscorpio-hub-mail-worker.service`.
4. Run `systemctl daemon-reload`, then `systemctl enable --now virgoscorpio-hub-mail-worker.service`.
5. Check `systemctl status virgoscorpio-hub-mail-worker.service` and `journalctl -u virgoscorpio-hub-mail-worker.service`. The worker emits the structured event `virgoscorpio_hub.password_reset_queue.snapshot` approximately every 30 seconds with bounded `pending`, `processing`, `failedLast24h`, `oldestPendingAgeSeconds` and `queueCapacity` fields; it never includes target addresses or reset URLs.
6. Alert on queue capacity saturation, sustained oldest-pending age, terminal failures, worker restarts and mail-provider delivery/bounce failures. The snapshot is worker-side structured logging, not a substitute for an OTLP backend, alert rules or an operational owner.

## Shutdown and rollback

systemd sends `SIGTERM`; the worker stops its polling loop and closes its PostgreSQL pool and telemetry exporters. A claim interrupted during shutdown becomes eligible for the existing five-minute stale-claim recovery. Roll back the application only to a version compatible with the already-applied additive migration; do not delete or edit migration 0022. Keep the database migration forward-only.

Before real production use, qualify this unit on the target OS image, verify the exact service account and filesystem permissions, prove restart/recovery behavior, and record the approved host-specific runbook and release-owner sign-off.

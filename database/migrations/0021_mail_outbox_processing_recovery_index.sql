-- Keep stale mail-worker lease recovery bounded as the outbox grows.
CREATE INDEX IF NOT EXISTS mail_outbox_processing_recovery_idx
  ON mail_outbox(locked_at, created_at)
  WHERE status='processing' AND locked_at IS NOT NULL;

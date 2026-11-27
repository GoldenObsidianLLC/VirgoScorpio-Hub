-- Durable, bounded handoff for public password-reset requests.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_email text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_requests_status_check CHECK (status IN ('pending','processing','completed','failed')),
  CONSTRAINT password_reset_requests_attempts_check CHECK (attempts BETWEEN 0 AND 8),
  CONSTRAINT password_reset_requests_target_email_check CHECK (target_email IS NULL OR length(target_email) BETWEEN 3 AND 254),
  CONSTRAINT password_reset_requests_lock_check CHECK ((status = 'processing') = (locked_at IS NOT NULL)),
  CONSTRAINT password_reset_requests_processed_check CHECK ((status IN ('completed','failed')) = (processed_at IS NOT NULL)),
  CONSTRAINT password_reset_requests_pending_email_check CHECK (status NOT IN ('pending','processing') OR target_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx ON password_reset_requests(available_at, created_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS password_reset_requests_processing_idx ON password_reset_requests(locked_at, created_at, id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS password_reset_requests_target_created_idx ON password_reset_requests(target_email, created_at DESC) WHERE target_email IS NOT NULL;

-- Durable leases reserve quota while object-storage writes happen without database locks.
CREATE TABLE IF NOT EXISTS library_storage_reservations (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  operation text NOT NULL CHECK (operation IN ('upload','replacement','variant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT library_storage_reservations_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS library_storage_reservations_site_expiry_idx ON library_storage_reservations(site_id, expires_at);

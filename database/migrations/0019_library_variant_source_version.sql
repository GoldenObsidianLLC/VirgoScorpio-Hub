-- Bind every media derivative to the exact source asset version.
-- Historical rows cannot be backfilled safely because their source version was not
-- recorded. NULL therefore means unbound and is excluded from public variant reads.
ALTER TABLE media_variants
  ADD COLUMN IF NOT EXISTS source_version integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'media_variants_source_version_positive'
      AND conrelid = 'media_variants'::regclass
  ) THEN
    ALTER TABLE media_variants
      ADD CONSTRAINT media_variants_source_version_positive
      CHECK (source_version IS NULL OR source_version >= 1);
  END IF;
END
$$;

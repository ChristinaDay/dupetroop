-- Add featured/trending fields to polishes table
-- Admins curate which polishes appear in the "Trending Now" homepage section,
-- optionally attributing them to a community source (Reddit, TikTok, etc.)

ALTER TABLE polishes
  ADD COLUMN is_featured        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN featured_rank      INTEGER,
  ADD COLUMN featured_source_type TEXT CHECK (featured_source_type IN ('reddit', 'instagram', 'tiktok', 'admin')),
  ADD COLUMN featured_source_url  TEXT;

CREATE INDEX idx_polishes_is_featured ON polishes(is_featured) WHERE is_featured = TRUE;

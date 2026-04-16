-- Migration 008: stash item ratings + external polish ratings

-- Allow stash owners to rate polishes they own
ALTER TABLE stash_items
  ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN review_notes TEXT;

-- External ratings scraped from brand/retailer sites
CREATE TABLE polish_external_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polish_id UUID NOT NULL REFERENCES polishes(id) ON DELETE CASCADE,
  source TEXT NOT NULL,          -- internal key, e.g. 'mooncat', 'holotaco', 'sephora'
  source_label TEXT NOT NULL,    -- display label, e.g. 'Mooncat.com'
  rating NUMERIC(3,1) NOT NULL,
  review_count INTEGER,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(polish_id, source)
);

CREATE INDEX idx_external_ratings_polish ON polish_external_ratings(polish_id);

-- RLS: external ratings are public read, service role only for writes
ALTER TABLE polish_external_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "External ratings are publicly readable"
  ON polish_external_ratings FOR SELECT
  USING (true);

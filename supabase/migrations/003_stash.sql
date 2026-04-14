-- ============================================================
-- DupeTroop — Migration 003: User Stash
-- Run in Supabase SQL Editor after 001 and 002
-- ============================================================

CREATE TABLE stash_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  polish_id   UUID NOT NULL REFERENCES polishes(id) ON DELETE CASCADE,
  notes       TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, polish_id)
);

CREATE INDEX idx_stash_user   ON stash_items(user_id);
CREATE INDEX idx_stash_polish ON stash_items(polish_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_stash_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER stash_updated_at
  BEFORE UPDATE ON stash_items
  FOR EACH ROW EXECUTE FUNCTION update_stash_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE stash_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stash_select_own" ON stash_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stash_insert_own" ON stash_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stash_update_own" ON stash_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "stash_delete_own" ON stash_items
  FOR DELETE USING (auth.uid() = user_id);

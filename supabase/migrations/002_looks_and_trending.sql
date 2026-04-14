-- ============================================================
-- DupeTroop — Migration 002: Looks + Trending Curation
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- NEW ENUMS
-- ============================================================

CREATE TYPE look_source_type AS ENUM ('reddit', 'instagram', 'tiktok', 'admin');
CREATE TYPE look_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE component_role AS ENUM ('base', 'topper', 'glitter_topper', 'accent', 'other');

-- ============================================================
-- EXTEND DUPES TABLE (trending/curation fields)
-- ============================================================

ALTER TABLE dupes
  ADD COLUMN is_featured    boolean           NOT NULL DEFAULT false,
  ADD COLUMN featured_rank  int,
  ADD COLUMN source_url     text,
  ADD COLUMN source_type    look_source_type;

CREATE INDEX dupes_featured ON dupes (is_featured, featured_rank)
  WHERE is_featured = true;

-- ============================================================
-- LOOKS (combination recipe / inspiration)
-- ============================================================

CREATE TABLE looks (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The polish you're trying to emulate (e.g. Bloodbender).
  -- NULL for "vibe" looks not tied to a specific polish.
  target_polish_id  uuid          REFERENCES polishes(id) ON DELETE SET NULL,
  name              text          NOT NULL,
  description       text,
  source_url        text,         -- Link to the Reddit post / IG / TikTok
  source_type       look_source_type NOT NULL DEFAULT 'admin',
  is_featured       boolean       NOT NULL DEFAULT false,
  featured_rank     int,
  opinion_count     int           NOT NULL DEFAULT 0,
  created_by        uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  status            look_status   NOT NULL DEFAULT 'pending',
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX looks_target_polish ON looks (target_polish_id);
CREATE INDEX looks_featured ON looks (is_featured, featured_rank)
  WHERE is_featured = true;
CREATE INDEX looks_status ON looks (status);

-- ============================================================
-- LOOK COMPONENTS (ordered recipe steps)
-- ============================================================

CREATE TABLE look_components (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id     uuid           NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  polish_id   uuid           NOT NULL REFERENCES polishes(id),
  step_order  int            NOT NULL,   -- 1 = first applied, 2 = topper, etc.
  role        component_role NOT NULL DEFAULT 'base',
  notes       text,                      -- e.g. "Apply 2 thin coats"
  UNIQUE (look_id, step_order)
);

CREATE INDEX look_components_look ON look_components (look_id);
CREATE INDEX look_components_polish ON look_components (polish_id);

-- ============================================================
-- UPDATED_AT TRIGGER (looks)
-- ============================================================

CREATE OR REPLACE FUNCTION update_looks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER looks_updated_at
  BEFORE UPDATE ON looks
  FOR EACH ROW EXECUTE FUNCTION update_looks_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_components ENABLE ROW LEVEL SECURITY;

-- looks: anyone can read approved looks
CREATE POLICY "looks_public_read" ON looks
  FOR SELECT USING (status = 'approved');

-- looks: authenticated users can insert (pending for moderation)
CREATE POLICY "looks_auth_insert" ON looks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- looks: creator can update their own pending look
CREATE POLICY "looks_owner_update" ON looks
  FOR UPDATE USING (
    created_by = auth.uid()
    AND status = 'pending'
  );

-- looks: moderators/admins can update any look (approve/reject)
CREATE POLICY "looks_mod_update" ON looks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- looks: moderators/admins can delete
CREATE POLICY "looks_mod_delete" ON looks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- look_components: public read (when parent look is approved)
-- We join through looks so unapproved looks' components are not exposed
CREATE POLICY "look_components_public_read" ON look_components
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_components.look_id
      AND looks.status = 'approved'
    )
  );

-- look_components: creator can insert components for their own look
CREATE POLICY "look_components_owner_insert" ON look_components
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_id
      AND looks.created_by = auth.uid()
    )
  );

-- look_components: moderators/admins can insert (for admin creation form)
CREATE POLICY "look_components_mod_insert" ON look_components
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- look_components: owner or mod can delete
CREATE POLICY "look_components_owner_delete" ON look_components
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM looks
      WHERE looks.id = look_id
      AND (
        looks.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('moderator', 'admin')
        )
      )
    )
  );

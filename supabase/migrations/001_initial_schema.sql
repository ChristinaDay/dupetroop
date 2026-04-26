-- ============================================================
-- DupeTroop — Initial Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE finish_category AS ENUM (
  'cream',
  'shimmer',
  'glitter',
  'flakies',
  'duochrome',
  'multichrome',
  'holo',
  'magnetic',
  'jelly',
  'tinted',
  'matte',
  'satin',
  'topper',
  'other'
);

CREATE TYPE color_family AS ENUM (
  'red', 'orange', 'yellow', 'green', 'blue', 'purple',
  'pink', 'neutral', 'white', 'black', 'brown', 'grey',
  'multicolor'
);

CREATE TYPE dupe_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'duplicate'
);

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  role            user_role NOT NULL DEFAULT 'user',
  polish_count    INTEGER NOT NULL DEFAULT 0,
  dupe_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BRANDS
-- ============================================================

CREATE TABLE brands (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT UNIQUE NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  description         TEXT,
  website_url         TEXT,
  logo_url            TEXT,
  is_indie            BOOLEAN NOT NULL DEFAULT TRUE,
  country_of_origin   TEXT,
  price_tier          SMALLINT CHECK (price_tier BETWEEN 1 AND 5),
  -- 1=drugstore, 2=mid-range, 3=indie standard, 4=premium indie, 5=luxury
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COLLECTIONS
-- ============================================================

CREATE TABLE collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT,
  release_year  SMALLINT,
  is_limited    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, slug)
);

-- ============================================================
-- POLISHES
-- ============================================================

CREATE TABLE polishes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID NOT NULL REFERENCES brands(id),
  collection_id     UUID REFERENCES collections(id),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,

  -- Color data
  hex_color         CHAR(7),           -- e.g. '#A3B2C1'
  hex_secondary     CHAR(7),           -- for duochrome shift
  color_family      color_family,

  -- Finish
  finish_category   finish_category NOT NULL,
  finish_notes      TEXT,
  is_topper         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Product info
  bottle_size_ml    NUMERIC(4,1),
  msrp_usd          NUMERIC(6,2),
  product_url       TEXT,
  is_discontinued   BOOLEAN NOT NULL DEFAULT FALSE,
  is_limited        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Images: array of Supabase Storage paths; primary image is images[1]
  images            TEXT[] DEFAULT '{}',

  -- Metadata
  submitted_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  dupe_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brand_id, slug)
);

CREATE INDEX idx_polishes_brand_id ON polishes(brand_id);
CREATE INDEX idx_polishes_collection_id ON polishes(collection_id);
CREATE INDEX idx_polishes_finish_category ON polishes(finish_category);
CREATE INDEX idx_polishes_color_family ON polishes(color_family);
CREATE INDEX idx_polishes_is_discontinued ON polishes(is_discontinued);
CREATE INDEX idx_polishes_fts ON polishes
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL
);

CREATE TABLE polish_tags (
  polish_id UUID NOT NULL REFERENCES polishes(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (polish_id, tag_id)
);

-- ============================================================
-- DUPES
-- ============================================================

CREATE TABLE dupes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- polish_a = original / more well-known / pricier
  -- polish_b = the dupe
  polish_a_id           UUID NOT NULL REFERENCES polishes(id) ON DELETE CASCADE,
  polish_b_id           UUID NOT NULL REFERENCES polishes(id) ON DELETE CASCADE,

  CONSTRAINT no_self_dupe CHECK (polish_a_id != polish_b_id),

  status                dupe_status NOT NULL DEFAULT 'pending',
  submitted_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  rejection_reason      TEXT,

  -- Aggregated scores (updated by trigger)
  avg_color_accuracy    NUMERIC(3,2),
  avg_finish_accuracy   NUMERIC(3,2),
  avg_formula_accuracy  NUMERIC(3,2),
  avg_overall           NUMERIC(3,2),
  opinion_count         INTEGER NOT NULL DEFAULT 0,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate pairs in either direction
CREATE UNIQUE INDEX idx_dupes_unique_pair ON dupes (
  LEAST(polish_a_id::TEXT, polish_b_id::TEXT),
  GREATEST(polish_a_id::TEXT, polish_b_id::TEXT)
);

CREATE INDEX idx_dupes_polish_a ON dupes(polish_a_id);
CREATE INDEX idx_dupes_polish_b ON dupes(polish_b_id);
CREATE INDEX idx_dupes_status ON dupes(status);
CREATE INDEX idx_dupes_avg_overall ON dupes(avg_overall DESC NULLS LAST);

-- ============================================================
-- DUPE OPINIONS (one per user per dupe)
-- ============================================================

CREATE TABLE dupe_opinions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dupe_id           UUID NOT NULL REFERENCES dupes(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Accuracy ratings 1–5
  color_accuracy    SMALLINT NOT NULL CHECK (color_accuracy BETWEEN 1 AND 5),
  finish_accuracy   SMALLINT NOT NULL CHECK (finish_accuracy BETWEEN 1 AND 5),
  formula_accuracy  SMALLINT NOT NULL CHECK (formula_accuracy BETWEEN 1 AND 5),

  -- Notes per dimension
  color_notes       TEXT,
  finish_notes      TEXT,
  formula_notes     TEXT,

  owns_both         BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_votes     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (dupe_id, user_id)
);

CREATE INDEX idx_dupe_opinions_dupe_id ON dupe_opinions(dupe_id);
CREATE INDEX idx_dupe_opinions_user_id ON dupe_opinions(user_id);

-- ============================================================
-- OPINION HELPFULNESS VOTES
-- ============================================================

CREATE TABLE opinion_votes (
  opinion_id  UUID NOT NULL REFERENCES dupe_opinions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_helpful  BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (opinion_id, user_id)
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update dupe aggregate scores when opinions change
CREATE OR REPLACE FUNCTION update_dupe_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_dupe_id UUID;
BEGIN
  v_dupe_id := COALESCE(NEW.dupe_id, OLD.dupe_id);

  UPDATE dupes
  SET
    avg_color_accuracy   = (SELECT AVG(color_accuracy)   FROM dupe_opinions WHERE dupe_id = v_dupe_id),
    avg_finish_accuracy  = (SELECT AVG(finish_accuracy)  FROM dupe_opinions WHERE dupe_id = v_dupe_id),
    avg_formula_accuracy = (SELECT AVG(formula_accuracy) FROM dupe_opinions WHERE dupe_id = v_dupe_id),
    avg_overall          = (SELECT AVG((color_accuracy + finish_accuracy + formula_accuracy) / 3.0)
                             FROM dupe_opinions WHERE dupe_id = v_dupe_id),
    opinion_count        = (SELECT COUNT(*) FROM dupe_opinions WHERE dupe_id = v_dupe_id),
    updated_at           = NOW()
  WHERE id = v_dupe_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dupe_opinion_aggregate
AFTER INSERT OR UPDATE OR DELETE ON dupe_opinions
FOR EACH ROW EXECUTE FUNCTION update_dupe_aggregates();

-- Auto-update helpful_votes count on opinions
CREATE OR REPLACE FUNCTION update_opinion_helpful_votes()
RETURNS TRIGGER AS $$
DECLARE
  v_opinion_id UUID;
BEGIN
  v_opinion_id := COALESCE(NEW.opinion_id, OLD.opinion_id);

  UPDATE dupe_opinions
  SET helpful_votes = (
    SELECT COUNT(*) FROM opinion_votes
    WHERE opinion_id = v_opinion_id AND is_helpful = TRUE
  )
  WHERE id = v_opinion_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opinion_helpful_votes
AFTER INSERT OR UPDATE OR DELETE ON opinion_votes
FOR EACH ROW EXECUTE FUNCTION update_opinion_helpful_votes();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  IF base_username = '' THEN
    base_username := 'user';
  END IF;
  final_username := base_username || '_' || SUBSTR(NEW.id::TEXT, 1, 4);

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || '_' || SUBSTR(NEW.id::TEXT, 1, 4) || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE polishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE polish_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dupes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dupe_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opinion_votes ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Brands & Collections & Tags: public read, admin/mod write
CREATE POLICY "brands_select" ON brands FOR SELECT USING (TRUE);
CREATE POLICY "brands_admin_write" ON brands FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "collections_select" ON collections FOR SELECT USING (TRUE);
CREATE POLICY "collections_admin_write" ON collections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "tags_select" ON tags FOR SELECT USING (TRUE);
CREATE POLICY "tags_admin_write" ON tags FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "polish_tags_select" ON polish_tags FOR SELECT USING (TRUE);
CREATE POLICY "polish_tags_admin_write" ON polish_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

-- Polishes: public read of verified, auth users insert, admin manage
CREATE POLICY "polishes_select" ON polishes FOR SELECT
  USING (is_verified = TRUE OR submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));
CREATE POLICY "polishes_insert" ON polishes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());
CREATE POLICY "polishes_admin_update" ON polishes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

-- Dupes: public read of approved + own, auth insert, admin manage
CREATE POLICY "dupes_select" ON dupes FOR SELECT
  USING (status = 'approved' OR submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));
CREATE POLICY "dupes_insert" ON dupes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());
CREATE POLICY "dupes_admin_update" ON dupes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','moderator')));

-- Opinions
CREATE POLICY "opinions_select" ON dupe_opinions FOR SELECT USING (TRUE);
CREATE POLICY "opinions_insert" ON dupe_opinions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "opinions_update_own" ON dupe_opinions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "opinions_delete_own" ON dupe_opinions FOR DELETE
  USING (auth.uid() = user_id);

-- Opinion votes
CREATE POLICY "votes_select" ON opinion_votes FOR SELECT USING (TRUE);
CREATE POLICY "votes_insert" ON opinion_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_update_own" ON opinion_votes FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "votes_delete_own" ON opinion_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SEED: Initial tags
-- ============================================================

INSERT INTO tags (name, slug) VALUES
  ('Vegan', 'vegan'),
  ('Cruelty-Free', 'cruelty-free'),
  ('5-Free', '5-free'),
  ('10-Free', '10-free'),
  ('Indie Brand', 'indie-brand'),
  ('Limited Edition', 'limited-edition'),
  ('Fan Favorite', 'fan-favorite'),
  ('Discontinued', 'discontinued'),
  ('Topper', 'topper');

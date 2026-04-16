-- Migration 010: three-dimension polish ratings + denormalized avg on polishes

-- Replace single rating column with three dimensions on stash_items
ALTER TABLE stash_items
  DROP COLUMN IF EXISTS rating,
  ADD COLUMN color_rating INTEGER CHECK (color_rating >= 1 AND color_rating <= 5),
  ADD COLUMN finish_rating INTEGER CHECK (finish_rating >= 1 AND finish_rating <= 5),
  ADD COLUMN formula_rating INTEGER CHECK (formula_rating >= 1 AND formula_rating <= 5);

-- Denormalized aggregate columns on polishes (kept in sync by trigger below)
ALTER TABLE polishes
  ADD COLUMN avg_rating NUMERIC(3,2),
  ADD COLUMN avg_color_rating NUMERIC(3,2),
  ADD COLUMN avg_finish_rating NUMERIC(3,2),
  ADD COLUMN avg_formula_rating NUMERIC(3,2),
  ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;

-- Trigger function: recalculate polish rating aggregates
CREATE OR REPLACE FUNCTION update_polish_avg_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_polish_id UUID;
BEGIN
  target_polish_id := COALESCE(NEW.polish_id, OLD.polish_id);

  UPDATE polishes
  SET
    avg_color_rating   = sub.avg_color,
    avg_finish_rating  = sub.avg_finish,
    avg_formula_rating = sub.avg_formula,
    avg_rating         = sub.avg_overall,
    rating_count       = sub.cnt
  FROM (
    SELECT
      AVG(color_rating)                                        AS avg_color,
      AVG(finish_rating)                                       AS avg_finish,
      AVG(formula_rating)                                      AS avg_formula,
      AVG((color_rating + finish_rating + formula_rating) / 3.0) AS avg_overall,
      COUNT(*)                                                 AS cnt
    FROM stash_items
    WHERE polish_id = target_polish_id
      AND status IN ('owned', 'destashed')
      AND color_rating   IS NOT NULL
      AND finish_rating  IS NOT NULL
      AND formula_rating IS NOT NULL
  ) sub
  WHERE id = target_polish_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on any insert/update/delete that could affect ratings
CREATE TRIGGER trg_update_polish_avg_rating
  AFTER INSERT OR UPDATE OR DELETE ON stash_items
  FOR EACH ROW EXECUTE FUNCTION update_polish_avg_rating();

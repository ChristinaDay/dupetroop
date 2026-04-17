-- ============================================================
-- Migration 012: decrement_dupe_count function
-- Run in Supabase SQL Editor
-- ============================================================

-- Atomically decrements dupe_count on a polish row, floored at 0.
-- Called by deleteDupe() when an approved dupe is deleted.
CREATE OR REPLACE FUNCTION decrement_dupe_count(polish_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE polishes SET dupe_count = GREATEST(dupe_count - 1, 0) WHERE id = polish_id;
$$;

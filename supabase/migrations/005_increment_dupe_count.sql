-- ============================================================
-- Migration 005: increment_dupe_count function
-- Run in Supabase SQL Editor after 004_storage.sql
-- ============================================================

-- Atomically increments dupe_count on a polish row.
-- Called by approveDupe() when a dupe submission is approved.
CREATE OR REPLACE FUNCTION increment_dupe_count(polish_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE polishes SET dupe_count = dupe_count + 1 WHERE id = polish_id;
$$;

-- Migration 007: add status to stash_items
-- Tracks whether a polish is owned, wishlisted, or bookmarked

ALTER TABLE stash_items
  ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'
  CHECK (status IN ('owned', 'wishlist', 'bookmarked'));

CREATE INDEX idx_stash_items_user_status ON stash_items(user_id, status);

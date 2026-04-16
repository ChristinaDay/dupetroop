-- Migration 009: add 'destashed' as a valid stash status

ALTER TABLE stash_items
  DROP CONSTRAINT stash_items_status_check;

ALTER TABLE stash_items
  ADD CONSTRAINT stash_items_status_check
  CHECK (status IN ('owned', 'wishlist', 'bookmarked', 'destashed'));

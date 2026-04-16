-- ============================================================
-- STORAGE BUCKETS
-- Run this in the Supabase SQL Editor after 003_stash.sql
-- ============================================================

-- Polish swatch images (publicly readable)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'polish-images',
  'polish-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- User avatars (publicly readable)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE RLS POLICIES — polish-images
-- ============================================================

-- Anyone can read
CREATE POLICY "polish-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'polish-images');

-- Authenticated users can upload
CREATE POLICY "polish-images: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'polish-images');

-- Users can update/delete their own uploads (path starts with their user ID)
CREATE POLICY "polish-images: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'polish-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "polish-images: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'polish-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- STORAGE RLS POLICIES — avatars
-- ============================================================

-- Anyone can read
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can only manage their own avatar (path = {userId}/avatar.{ext})
CREATE POLICY "avatars: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

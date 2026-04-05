-- Blotato Social Manager — Supabase Schema
-- Run this in your Supabase dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS posts_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type           TEXT NOT NULL CHECK (source_type IN ('youtube', 'article', 'pdf', 'email', 'text')),
  source_url            TEXT,
  source_content        TEXT,
  extracted_content     TEXT,
  linkedin_text         TEXT,
  instagram_text        TEXT,
  x_text                TEXT,
  source_file_url       TEXT,   -- Supabase Storage URL for uploaded PDFs
  linkedin_visual_url   TEXT,
  instagram_visual_url  TEXT,
  x_visual_url          TEXT,
  linkedin_blotato_id   TEXT,
  instagram_blotato_id  TEXT,
  x_blotato_id          TEXT,
  linkedin_url          TEXT,
  instagram_url         TEXT,
  x_url                 TEXT,
  status                TEXT DEFAULT 'draft'
                          CHECK (status IN ('draft', 'generating', 'ready', 'publishing', 'published', 'failed')),
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT N/Users/shajeed/Downloads/Blotato Social Manager.pngOW(),
  published_at          TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE posts_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own posts" ON posts_log;
CREATE POLICY "Users can view own posts"
  ON posts_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON posts_log;
CREATE POLICY "Users can insert own posts"
  ON posts_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON posts_log;
CREATE POLICY "Users can update own posts"
  ON posts_log FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON posts_log;
CREATE POLICY "Users can delete own posts"
  ON posts_log FOR DELETE
  USING (auth.uid() = user_id);

-- If posts_log already exists, add the new column with:
-- ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS source_file_url TEXT;

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS posts_log_user_id_created_at
  ON posts_log (user_id, created_at DESC);

-- ── Supabase Storage — Visuals Bucket ──────────────────────────────────────
-- Run this ONCE in your Supabase dashboard → SQL Editor

-- NOTE: The 'Content' bucket must be created manually in Supabase dashboard
-- (Storage → New bucket → name: Content → public: true)
-- OR run the insert below if you haven't created it yet:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('Content', 'Content', true)
-- ON CONFLICT (id) DO NOTHING;

-- Files are stored at: Content/{userId}/{draftId}/{platform}.jpg|mp4

-- Allow authenticated users to upload their own visuals
DROP POLICY IF EXISTS "Users can upload own visuals" ON storage.objects;
CREATE POLICY "Users can upload own visuals"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access (so <img>/<video> src works without auth)
DROP POLICY IF EXISTS "Public can view visuals" ON storage.objects;
CREATE POLICY "Public can view visuals"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'Content');

-- Allow authenticated users to overwrite (upsert) their own visuals
DROP POLICY IF EXISTS "Users can update own visuals" ON storage.objects;
CREATE POLICY "Users can update own visuals"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own visuals
DROP POLICY IF EXISTS "Users can delete own visuals" ON storage.objects;
CREATE POLICY "Users can delete own visuals"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Carousel job history: stores every generated carousel so users can revisit them
CREATE TABLE IF NOT EXISTS carousel_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  job_id        TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'viral',   -- 'viral' | 'standard'
  style         TEXT,
  aspect_ratio  TEXT DEFAULT '3:4',
  image_generator TEXT DEFAULT 'gemini',
  caption       TEXT,
  slides        JSONB NOT NULL DEFAULT '[]',
  content_preview TEXT                           -- first 200 chars of source content
);

ALTER TABLE carousel_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own carousel jobs" ON carousel_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user history lookups
CREATE INDEX IF NOT EXISTS carousel_jobs_user_created
  ON carousel_jobs (user_id, created_at DESC);

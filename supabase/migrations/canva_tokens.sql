-- Run this in your Supabase SQL editor to enable the Canva integration.

-- 1. Canva OAuth tokens (one row per user)
CREATE TABLE IF NOT EXISTS canva_tokens (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE canva_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own canva token"
  ON canva_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add canva_template_id to brand_settings (optional field — stores user's Canva template)
ALTER TABLE brand_settings
  ADD COLUMN IF NOT EXISTS canva_template_id TEXT DEFAULT '';

-- Brand Briefs: stores each user's full brand identity profile
-- Populated via the brand discovery chatbot, editable in /brand

CREATE TABLE IF NOT EXISTS brand_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Identity
  business_name       TEXT DEFAULT '',
  tagline             TEXT DEFAULT '',
  founded             TEXT DEFAULT '',
  location            TEXT DEFAULT '',
  website             TEXT DEFAULT '',
  business_description TEXT DEFAULT '',
  mission             TEXT DEFAULT '',

  -- Target audiences (array of segments)
  -- [{ name: string, description: string, pain_points: string[], goals: string[] }]
  audiences           JSONB DEFAULT '[]',

  -- Brand personality
  personality_words   TEXT[] DEFAULT '{}',
  tone_of_voice       TEXT DEFAULT '',
  brand_character     TEXT DEFAULT '',

  -- Services / products
  -- [{ name: string, description: string, key_message: string, outcome: string }]
  services            JSONB DEFAULT '[]',

  -- Differentiation
  unique_value        TEXT DEFAULT '',

  -- Content strategy
  content_pillars     TEXT[] DEFAULT '{}',
  content_goals       TEXT DEFAULT '',

  -- Voice rules
  always_say          TEXT[] DEFAULT '{}',
  never_say           TEXT[] DEFAULT '{}',
  example_phrases     TEXT[] DEFAULT '{}',

  -- Visual reference images (uploaded by user)
  reference_images    TEXT[] DEFAULT '{}',

  -- Generated markdown brief (same structure as TEKMADEV_BRAND_CONTENT_BRIEF.md)
  generated_brief     TEXT DEFAULT '',
  brief_generated_at  TIMESTAMPTZ,

  -- Chat wizard state
  chat_history        JSONB DEFAULT '[]',
  chat_completed      BOOLEAN DEFAULT FALSE,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brand brief"
  ON brand_briefs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookup by user
CREATE UNIQUE INDEX IF NOT EXISTS brand_briefs_user_id ON brand_briefs (user_id);

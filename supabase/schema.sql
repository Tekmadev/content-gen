-- ═══════════════════════════════════════════════════════════════════════════
-- Content Manager by Tekmadev Innovation Inc. — Full Supabase Schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO USE:
--   FRESH INSTALL  → Run this entire file in Supabase SQL Editor (safe, idempotent)
--   EXISTING DB    → Scroll to the MIGRATION section at the bottom
--
-- Tables:
--   user_profiles        — one row per user, billing + usage
--   credit_transactions  — every credit spend/adjustment (audit log)
--   subscription_events  — billing history (upgrades, cancellations, payments)
--   user_events          — behavioral analytics (logins, funnel, feature adoption)
--   posts_log            — every generated post draft
--   brand_settings       — user's brand kit
--   carousel_jobs        — carousel image generation jobs
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. USER PROFILES ──────────────────────────────────────────────────────
-- One row per user, auto-created on signup via trigger.
-- Central source of truth for billing, usage, and onboarding state.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Onboarding
  onboarding_completed   BOOLEAN      NOT NULL DEFAULT false,
  onboarding_step        TEXT         DEFAULT 'welcome'
                           CHECK (onboarding_step IN ('welcome', 'blotato_key', 'brand_kit', 'completed')),
  agreed_to_terms_at     TIMESTAMPTZ,
  referral_source        TEXT,        -- utm_source or self-reported ("google", "friend", etc.)

  -- Blotato integration
  blotato_api_key        TEXT,

  -- Stripe billing
  stripe_customer_id     TEXT         UNIQUE,
  stripe_subscription_id TEXT         UNIQUE,
  subscription_plan      TEXT         CHECK (subscription_plan IN ('starter', 'pro', 'agency')),
  subscription_status    TEXT         CHECK (subscription_status IN (
                                        'active', 'trialing', 'past_due', 'canceled', 'incomplete'
                                      )),
  subscription_period_end TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ, -- when they first subscribed (not renewal)

  -- Monthly credits — reset on 1st of each month
  -- Plan allowances: starter=60, pro=250, agency=1000
  -- Costs: post_gen=1, visual=3, carousel=8  (future: video=15+)
  credits_used           INT          NOT NULL DEFAULT 0,
  credits_reset_at       TIMESTAMPTZ  NOT NULL DEFAULT date_trunc('month', NOW()),

  -- Aggregate counters (denormalized for fast reads, updated on each action)
  total_posts_generated  INT          NOT NULL DEFAULT 0,
  total_posts_published  INT          NOT NULL DEFAULT 0,
  total_visuals_generated INT         NOT NULL DEFAULT 0,
  total_carousels_generated INT       NOT NULL DEFAULT 0,
  total_credits_ever_used INT         NOT NULL DEFAULT 0,  -- all-time, never resets

  -- Engagement
  last_active_at         TIMESTAMPTZ,
  last_published_at      TIMESTAMPTZ,

  -- Admin flag — bypasses subscription/onboarding enforcement in middleware
  is_admin               BOOLEAN      NOT NULL DEFAULT false,

  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, is_admin)
  VALUES (
    NEW.id,
    NEW.email = 'shajeed0@gmail.com'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. CREDIT TRANSACTIONS ────────────────────────────────────────────────
-- Immutable audit log of every credit deduction or adjustment.
-- Powers: billing disputes, per-feature cost analysis, user history,
--         future admin dashboard (revenue per feature, usage patterns).

CREATE TABLE IF NOT EXISTS credit_transactions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type     TEXT         NOT NULL
                    CHECK (action_type IN ('post_gen', 'visual', 'carousel', 'adjustment', 'refund')),
  credits_deducted INT         NOT NULL,                -- positive = cost, negative = refund/adjustment
  balance_after   INT          NOT NULL,                -- credits_used after this transaction
  plan_at_time    TEXT,                                 -- plan slug at time of action
  draft_id        UUID         REFERENCES posts_log(id) ON DELETE SET NULL,
  notes           TEXT,                                 -- admin notes or error context
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transaction history (for "usage history" page later)
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_created_at
  ON credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS credit_transactions_action_type_created_at
  ON credit_transactions (action_type, created_at DESC);


-- ── 3. SUBSCRIPTION EVENTS ───────────────────────────────────────────────
-- Billing history: every plan change, payment failure, cancellation.
-- Powers: MRR tracking, churn rate, upgrade/downgrade funnel, admin dashboard.

CREATE TABLE IF NOT EXISTS subscription_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type       TEXT         NOT NULL
                     CHECK (event_type IN (
                       'subscribed', 'upgraded', 'downgraded', 'canceled',
                       'reactivated', 'payment_failed', 'payment_recovered',
                       'trial_started', 'trial_ended'
                     )),
  from_plan        TEXT,                                -- null on first subscription
  to_plan          TEXT,
  stripe_event_id  TEXT         UNIQUE,                -- deduplication
  amount_cad_cents INT,                                -- amount charged (for revenue tracking)
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription events" ON subscription_events;
CREATE POLICY "Users can view own subscription events"
  ON subscription_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS subscription_events_user_id_created_at
  ON subscription_events (user_id, created_at DESC);


-- ── 4. USER EVENTS ────────────────────────────────────────────────────────
-- Behavioral analytics log — lightweight event stream.
-- Powers: onboarding funnel, feature adoption, churn signals, admin dashboard.
-- NOTE: service-role only writes to this table (no user policy needed for INSERT).

CREATE TABLE IF NOT EXISTS user_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT         NOT NULL,
  -- e.g. 'signed_up', 'onboarding_completed', 'post_generated', 'post_published',
  --      'visual_generated', 'carousel_generated', 'subscription_started',
  --      'subscription_upgraded', 'page_visited', 'blotato_key_added'
  properties  JSONB        DEFAULT '{}',
  -- e.g. { "plan": "pro", "source_type": "youtube", "platform": "linkedin" }
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own events" ON user_events;
CREATE POLICY "Users can view own events"
  ON user_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_events_user_id_created_at
  ON user_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_events_event_type_created_at
  ON user_events (event_type, created_at DESC);


-- ── 5. POSTS LOG ──────────────────────────────────────────────────────────
-- Every generated post draft, with full publishing metadata.

CREATE TABLE IF NOT EXISTS posts_log (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source
  source_type             TEXT        NOT NULL
                            CHECK (source_type IN ('youtube', 'article', 'pdf', 'email', 'text')),
  source_url              TEXT,
  source_content          TEXT,        -- raw pasted text (email/text mode)
  extracted_content       TEXT,        -- Blotato-extracted content
  source_file_url         TEXT,        -- Supabase Storage URL for uploaded PDFs

  -- Generated copy
  linkedin_text           TEXT,
  instagram_text          TEXT,
  x_text                  TEXT,

  -- Generated visuals
  linkedin_visual_url     TEXT,
  instagram_visual_url    TEXT,
  x_visual_url            TEXT,

  -- Publishing
  linkedin_blotato_id     TEXT,
  instagram_blotato_id    TEXT,
  x_blotato_id            TEXT,
  linkedin_url            TEXT,        -- live post URL after publish
  instagram_url           TEXT,
  x_url                   TEXT,

  -- Per-platform publish errors
  linkedin_publish_error  TEXT,
  instagram_publish_error TEXT,
  x_publish_error         TEXT,

  -- Status & errors
  status                  TEXT        DEFAULT 'draft'
                            CHECK (status IN (
                              'draft', 'generating', 'ready', 'publishing',
                              'published', 'failed', 'publish_failed'
                            )),
  error_message           TEXT,

  -- Performance tracking (for future latency analysis)
  generation_started_at   TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  published_at            TIMESTAMPTZ
);

ALTER TABLE posts_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own posts"   ON posts_log;
CREATE POLICY "Users can view own posts"
  ON posts_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON posts_log;
CREATE POLICY "Users can insert own posts"
  ON posts_log FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON posts_log;
CREATE POLICY "Users can update own posts"
  ON posts_log FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON posts_log;
CREATE POLICY "Users can delete own posts"
  ON posts_log FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS posts_log_user_id_created_at
  ON posts_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_log_status_created_at
  ON posts_log (status, created_at DESC);


-- ── 6. BRAND SETTINGS ────────────────────────────────────────────────────
-- One row per user — brand colors, font, and name for visual generation.

CREATE TABLE IF NOT EXISTS brand_settings (
  user_id                 UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_color           TEXT    NOT NULL DEFAULT '#000000',
  secondary_color         TEXT    NOT NULL DEFAULT '#ffffff',
  accent_color            TEXT    NOT NULL DEFAULT '#F97316',
  background_color        TEXT    NOT NULL DEFAULT '#ffffff',
  text_color              TEXT    NOT NULL DEFAULT '#111111',
  font_family             TEXT    NOT NULL DEFAULT 'Inter',
  brand_name              TEXT    NOT NULL DEFAULT '',
  carousel_image_model    TEXT    NOT NULL DEFAULT 'gemini',
  carousel_custom_prompt  TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own brand settings"   ON brand_settings;
CREATE POLICY "Users can view own brand settings"
  ON brand_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own brand settings" ON brand_settings;
CREATE POLICY "Users can upsert own brand settings"
  ON brand_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own brand settings" ON brand_settings;
CREATE POLICY "Users can update own brand settings"
  ON brand_settings FOR UPDATE USING (auth.uid() = user_id);


-- ── 7. CAROUSEL JOBS ─────────────────────────────────────────────────────
-- Carousel / image generation job batches.

CREATE TABLE IF NOT EXISTS carousel_jobs (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id    UUID    REFERENCES posts_log(id) ON DELETE SET NULL,
  platform    TEXT    NOT NULL
                CHECK (platform IN ('instagram_carousel', 'linkedin_image', 'x_image')),
  style       TEXT    NOT NULL
                CHECK (style IN ('white_card', 'dark_statement', 'gradient_bold', 'cinematic', 'branded_minimal')),
  num_slides  INT     NOT NULL DEFAULT 1,
  slides      JSONB   DEFAULT '[]',   -- [{ number, type, text, url }]
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE carousel_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own carousel jobs"   ON carousel_jobs;
CREATE POLICY "Users can view own carousel jobs"
  ON carousel_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own carousel jobs" ON carousel_jobs;
CREATE POLICY "Users can insert own carousel jobs"
  ON carousel_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own carousel jobs" ON carousel_jobs;
CREATE POLICY "Users can delete own carousel jobs"
  ON carousel_jobs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS carousel_jobs_user_id_created_at
  ON carousel_jobs (user_id, created_at DESC);


-- ── 8. ADMIN VIEWS (for future admin dashboard) ───────────────────────────
-- These are read-only views queryable by service-role key.
-- Frontend admin dashboard will call these via API routes with service-role client.

-- Daily signups + plan breakdown
CREATE OR REPLACE VIEW admin_daily_signups AS
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*)                       AS total_signups,
  COUNT(*) FILTER (WHERE subscription_plan = 'starter') AS starter_count,
  COUNT(*) FILTER (WHERE subscription_plan = 'pro')     AS pro_count,
  COUNT(*) FILTER (WHERE subscription_plan = 'agency')  AS agency_count,
  COUNT(*) FILTER (WHERE subscription_status IN ('active', 'trialing')) AS active_subscribers
FROM user_profiles
GROUP BY 1
ORDER BY 1 DESC;

-- Monthly credit consumption by action type
CREATE OR REPLACE VIEW admin_credit_usage AS
SELECT
  date_trunc('month', created_at) AS month,
  action_type,
  COUNT(*)                        AS num_actions,
  SUM(credits_deducted)           AS total_credits,
  COUNT(DISTINCT user_id)         AS unique_users
FROM credit_transactions
WHERE credits_deducted > 0
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- Current MRR snapshot (active subscribers)
CREATE OR REPLACE VIEW admin_mrr AS
SELECT
  subscription_plan,
  COUNT(*)                   AS subscriber_count,
  CASE subscription_plan
    WHEN 'starter' THEN 1900
    WHEN 'pro'     THEN 5000
    WHEN 'agency'  THEN 12000
    ELSE 0
  END                        AS price_cad_cents,
  COUNT(*) * CASE subscription_plan
    WHEN 'starter' THEN 1900
    WHEN 'pro'     THEN 5000
    WHEN 'agency'  THEN 12000
    ELSE 0
  END                        AS mrr_cad_cents
FROM user_profiles
WHERE subscription_status IN ('active', 'trialing')
GROUP BY subscription_plan;

-- Per-user stats (for admin user list)
CREATE OR REPLACE VIEW admin_user_stats AS
SELECT
  up.user_id,
  au.email,
  up.subscription_plan,
  up.subscription_status,
  up.credits_used,
  up.total_posts_generated,
  up.total_posts_published,
  up.total_visuals_generated,
  up.total_carousels_generated,
  up.total_credits_ever_used,
  up.last_active_at,
  up.created_at,
  up.onboarding_completed,
  up.is_admin,
  up.stripe_customer_id,
  up.subscription_period_end,
  up.subscription_started_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.user_id
ORDER BY up.created_at DESC;


-- ── 9. SUPABASE STORAGE — Content Bucket ──────────────────────────────────
-- Create the bucket manually:
--   Dashboard → Storage → New bucket → Name: "Content" → Public: ON
-- OR run:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('Content', 'Content', true)
-- ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own visuals"   ON storage.objects;
CREATE POLICY "Users can upload own visuals"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public can view visuals"        ON storage.objects;
CREATE POLICY "Public can view visuals"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'Content');

DROP POLICY IF EXISTS "Users can update own visuals"   ON storage.objects;
CREATE POLICY "Users can update own visuals"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own visuals"   ON storage.objects;
CREATE POLICY "Users can delete own visuals"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'Content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION — For databases that already have some tables
-- Run ONLY the blocks that apply to your situation.
-- ═══════════════════════════════════════════════════════════════════════════

-- If user_profiles exists but is missing the new columns:
/*
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_source TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credits_used INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW());
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_posts_generated INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_posts_published INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_visuals_generated INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_carousels_generated INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_credits_ever_used INT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMPTZ;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS usage_post_gens;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS usage_visuals;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS usage_carousels;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS usage_reset_at;
*/

-- If posts_log exists but is missing the new columns:
/*
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS source_file_url TEXT;
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS linkedin_publish_error TEXT;
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS instagram_publish_error TEXT;
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS x_publish_error TEXT;
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ;
ALTER TABLE posts_log ADD COLUMN IF NOT EXISTS generation_completed_at TIMESTAMPTZ;
ALTER TABLE posts_log DROP CONSTRAINT IF EXISTS posts_log_status_check;
ALTER TABLE posts_log ADD CONSTRAINT posts_log_status_check
  CHECK (status IN ('draft', 'generating', 'ready', 'publishing', 'published', 'failed', 'publish_failed'));
*/

-- ── 10. FEEDBACK ─────────────────────────────────────────────────────────
-- User-submitted feedback from the Settings page.
-- Captures identity, device context, and network info for support triage.

CREATE TABLE IF NOT EXISTS feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email            TEXT,
  name             TEXT,
  message          TEXT        NOT NULL,

  -- Device & browser context (from User-Agent + JS navigator APIs)
  user_agent       TEXT,
  platform         TEXT,       -- e.g. "MacIntel", "Win32"
  screen_size      TEXT,       -- e.g. "1920x1080"
  language         TEXT,       -- browser language, e.g. "en-CA"
  timezone         TEXT,       -- e.g. "America/Toronto"
  referrer         TEXT,       -- where they came from (document.referrer)

  -- Network (IP resolved server-side from request headers)
  ip_address       TEXT,

  -- Rating (optional 1-5 star score)
  rating           INT         CHECK (rating BETWEEN 1 AND 5),

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
DROP POLICY IF EXISTS "Users can submit feedback" ON feedback;
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins read via service-role — no SELECT policy needed for users

CREATE INDEX IF NOT EXISTS feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_id    ON feedback (user_id);


-- ── CAROUSEL AI MIGRATION — Run this in Supabase SQL Editor ──────────────
-- Adds carousel AI model selection and custom prompt to brand_settings.
ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS carousel_image_model   TEXT NOT NULL DEFAULT 'gemini';
ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS carousel_custom_prompt  TEXT DEFAULT NULL;


-- ── ADMIN MIGRATION — Run this in Supabase SQL Editor ─────────────────────
-- Step 1: Add is_admin column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Grant admin to shajeed0@gmail.com
UPDATE user_profiles
SET is_admin = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'shajeed0@gmail.com');

-- Step 3: Refresh admin views (re-run the CREATE OR REPLACE VIEW blocks above)
-- or just re-run the full schema.sql — it's idempotent.

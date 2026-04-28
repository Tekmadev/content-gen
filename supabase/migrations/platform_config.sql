-- Platform Config: stores all tuneable platform settings in one place.
-- No model name, credit cost, or plan limit should be hardcoded in application code.
-- Admins update values here — changes take effect within 5 minutes (server cache TTL).

CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT DEFAULT '',
  updated_by  TEXT DEFAULT '',  -- admin email who last changed it
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Only admins can read/write — accessed via service-role key in API routes only
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only" ON platform_config FOR ALL USING (false);

-- ── Seed with production defaults ─────────────────────────────────────────

INSERT INTO platform_config (key, value, description) VALUES

  -- AI models used for each generation task.
  -- Change these to swap models without touching code or deploying.
  ('models', '{
    "post_linkedin":    "claude-opus-4-6",
    "post_instagram":   "claude-opus-4-6",
    "post_x":           "claude-opus-4-6",
    "carousel_slides":  "claude-opus-4-6",
    "carousel_caption": "claude-opus-4-6",
    "brand_chat":       "gemini-2.0-flash",
    "brand_generate":   "gemini-2.0-flash",
    "image_generation": "gemini-2.5-flash-image"
  }', 'AI model used for each generation task. Swap to sonnet/haiku to reduce costs.'),

  -- Credits deducted from user balance per action.
  ('credit_costs', '{
    "post_gen":  1,
    "visual":    3,
    "carousel":  8
  }', 'Credits deducted per user action. Increase to slow heavy usage, decrease to attract users.'),

  -- Monthly credit allowance per subscription plan.
  ('plan_credits', '{
    "starter": 40,
    "pro":     150,
    "agency":  500
  }', 'How many credits each plan gets per month. Update when plans change.'),

  -- API cost reference table — not used in logic, displayed in admin for margin tracking.
  ('api_cost_estimates', '{
    "claude_opus_input_per_mtok":    15.00,
    "claude_opus_output_per_mtok":   75.00,
    "claude_sonnet_input_per_mtok":   3.00,
    "claude_sonnet_output_per_mtok": 15.00,
    "claude_haiku_input_per_mtok":    0.80,
    "claude_haiku_output_per_mtok":   4.00,
    "gemini_flash_image_per_image":   0.04,
    "supadata_per_request":           0.01,
    "ayrshare_monthly_usd":          29.00
  }', 'Estimated USD costs per unit. Update when providers change pricing.')

ON CONFLICT (key) DO NOTHING;

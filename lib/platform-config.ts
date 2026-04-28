/**
 * platform-config.ts
 *
 * Single source of truth for all tuneable platform settings.
 *
 * HOW IT WORKS:
 *   - Reads from the `platform_config` Supabase table (admin-only, service role).
 *   - Results are cached in memory for CACHE_TTL_MS (5 min) so every API request
 *     doesn't hit the DB. Call `invalidateConfigCache()` after an admin update.
 *   - If the DB is unreachable, falls back to DEFAULT_CONFIG — the app never crashes.
 *
 * HOW TO USE:
 *   import { getPlatformConfig } from '@/lib/platform-config'
 *   const config = await getPlatformConfig()
 *   const model = config.models.post_linkedin
 *
 * HOW TO EXTEND:
 *   1. Add a new key to the relevant interface below.
 *   2. Add a default value in DEFAULT_CONFIG.
 *   3. Insert the key into the `platform_config` table via the admin UI or SQL.
 *   Done — no other files need to change.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ──────────────────────────────────────────────────────────────────

/** Which AI model to use for each generation task. */
export interface ModelConfig {
  /** Claude model for LinkedIn post generation */
  post_linkedin: string
  /** Claude model for Instagram caption generation */
  post_instagram: string
  /** Claude model for X/Twitter post generation */
  post_x: string
  /** Claude model for viral carousel slide text generation */
  carousel_slides: string
  /** Claude model for carousel Instagram caption */
  carousel_caption: string
  /** Gemini model for brand discovery chatbot */
  brand_chat: string
  /** Gemini model for brand brief extraction + generation + Claude SVG slides */
  brand_generate: string
  /** Gemini model for carousel image rendering (when using Gemini backend) */
  image_generation: string
  /** OpenAI model for carousel image rendering (when using OpenAI backend) */
  openai_image: string
}

/** Credits deducted from a user's balance per action. */
export interface CreditCosts {
  post_gen: number
  visual:   number
  carousel: number
}

/** Monthly credit allowance per subscription plan. */
export interface PlanCredits {
  starter: number
  creator: number
  pro:     number
  agency:  number
}

/**
 * USD cost reference per unit — for admin margin tracking only.
 * Not used in any billing or credit logic.
 */
export interface ApiCostEstimates {
  [key: string]: number
}

/** Full platform configuration shape. */
export interface PlatformConfig {
  models:             ModelConfig
  credit_costs:       CreditCosts
  plan_credits:       PlanCredits
  api_cost_estimates: ApiCostEstimates
}

// ── Defaults ───────────────────────────────────────────────────────────────
// Used when the DB is empty or unreachable. Keep in sync with the SQL seed.

const DEFAULT_CONFIG: PlatformConfig = {
  models: {
    // ── Claude text models ─────────────────────────────────────────────────
    // Sonnet for high-volume social posts (5x cheaper than Opus, near-identical
    // quality for short-form content). Opus reserved for carousel slides + brand
    // work where viral-grade copywriting and synthesis quality matter.
    post_linkedin:    'claude-sonnet-4-6',
    post_instagram:   'claude-sonnet-4-6',
    post_x:           'claude-sonnet-4-6',
    carousel_slides:  'claude-opus-4-7',
    carousel_caption: 'claude-opus-4-7',
    brand_generate:   'claude-opus-4-7',
    // ── Gemini chat (updated: gemini-2.5-flash, stable production) ─────────
    brand_chat:       'gemini-2.5-flash',
    // ── Gemini image (updated: gemini-3.1-flash-image-preview, Feb 2026) ───
    image_generation: 'gemini-3.1-flash-image-preview',
    // ── OpenAI image (updated: gpt-image-2, April 2026) ────────────────────
    openai_image:     'gpt-image-2',
  },
  credit_costs: {
    post_gen: 1,
    visual:   3,
    carousel: 8,
  },
  plan_credits: {
    starter: 120,    // ~1 post/day, 1 platform, occasional carousel
    creator: 350,    // 3 platforms daily + regular carousels (Most Popular)
    pro:     800,    // heavy publishers, business owners
    agency:  2200,   // multi-brand agencies
  },
  api_cost_estimates: {
    // Claude Opus 4.7 — April 2026 pricing
    claude_opus_input_per_mtok:    15.00,
    claude_opus_output_per_mtok:   75.00,
    // Claude Sonnet 4.6 — Feb 2026 pricing
    claude_sonnet_input_per_mtok:   3.00,
    claude_sonnet_output_per_mtok: 15.00,
    // Claude Haiku 4.5 pricing
    claude_haiku_input_per_mtok:    0.80,
    claude_haiku_output_per_mtok:   4.00,
    // Gemini 3.1 Flash Image Preview (Nano Banana 2) — Feb 2026
    gemini_flash_image_per_image:   0.04,
    // OpenAI gpt-image-2 — April 2026 (medium quality)
    openai_gpt_image_2_per_image:   0.07,
    // Infrastructure
    supadata_per_request:           0.01,
    ayrshare_monthly_usd:          29.00,
  },
}

// ── In-memory cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

let _cache: PlatformConfig | null = null
let _cachedAt = 0

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current platform configuration.
 * Hits the DB at most once every 5 minutes; otherwise returns from memory.
 * Never throws — falls back to DEFAULT_CONFIG on any DB error.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  const now = Date.now()
  if (_cache && now - _cachedAt < CACHE_TTL_MS) return _cache

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('platform_config')
      .select('key, value')

    if (error || !data?.length) {
      _cache = DEFAULT_CONFIG
      _cachedAt = now
      return _cache
    }

    // Deep-merge each DB row over the corresponding default section
    const config: PlatformConfig = {
      models:             { ...DEFAULT_CONFIG.models },
      credit_costs:       { ...DEFAULT_CONFIG.credit_costs },
      plan_credits:       { ...DEFAULT_CONFIG.plan_credits },
      api_cost_estimates: { ...DEFAULT_CONFIG.api_cost_estimates },
    }

    for (const row of data) {
      const key = row.key as keyof PlatformConfig
      if (key in config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config[key] = { ...(config[key] as any), ...(row.value as any) }
      }
    }

    _cache = config
    _cachedAt = now
    return config
  } catch {
    // DB unreachable — use defaults so the app never crashes
    return DEFAULT_CONFIG
  }
}

/**
 * Clears the in-memory cache so the next call re-reads from the DB.
 * Call this immediately after an admin updates the config table.
 */
export function invalidateConfigCache(): void {
  _cache    = null
  _cachedAt = 0
}

/** Returns the cached config synchronously, or null if not yet loaded. */
export function getCachedConfig(): PlatformConfig | null {
  return _cache
}

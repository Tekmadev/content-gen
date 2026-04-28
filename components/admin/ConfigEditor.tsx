'use client'

/**
 * ConfigEditor — Platform Config Admin UI
 *
 * Fully self-contained: owns its own data fetching, state, and save logic.
 * Drop it anywhere — it has zero dependencies on parent page state.
 *
 * Sections rendered:
 *   1. AI Models       — which model handles each task (dropdowns)
 *   2. Credit Costs    — credits deducted per action (number inputs)
 *   3. Plan Credits    — monthly allowance per plan (number inputs)
 *   4. API Cost Reference — USD cost estimates for margin tracking (number inputs)
 *
 * To add a new config key:
 *   1. Add it to the relevant FIELD_META object below.
 *   2. Add a default in lib/platform-config.ts DEFAULT_CONFIG.
 *   3. Seed it in supabase/migrations/platform_config.sql.
 *   Done — no other files change.
 */

import { useState, useEffect, useCallback } from 'react'
import type { PlatformConfig } from '@/lib/platform-config'

// ── Field metadata — edit here to add/rename/describe config keys ──────────

// ── Claude models (for text generation tasks) ─────────────────────────────
// Updated: claude-opus-4-7 (April 2026), claude-sonnet-4-6 (Feb 2026)
const CLAUDE_MODEL_OPTIONS = [
  'claude-opus-4-7',   // Latest (April 2026) — most capable, highest cost
  'claude-sonnet-4-6', // Balanced speed + quality (Feb 2026)
  'claude-haiku-4-5',  // Fastest, lowest cost
]

// ── Gemini chat models (for text / reasoning tasks) ───────────────────────
// gemini-2.5-flash is the stable production pick; gemini-3-flash-preview is newest
const GEMINI_CHAT_MODEL_OPTIONS = [
  'gemini-2.5-flash',        // Stable production — fast multimodal (recommended)
  'gemini-3-flash-preview',  // Latest Gemini 3 (preview, 2026)
  // Note: gemini-2.0-flash is deprecated by Google and no longer available to new users
]

// ── Gemini image-generation models ────────────────────────────────────────
// Updated: gemini-3.1-flash-image-preview = Nano Banana 2 (Feb 2026)
const GEMINI_IMAGE_MODEL_OPTIONS = [
  'gemini-3.1-flash-image-preview',        // Latest — Nano Banana 2 (Feb 2026)
  'gemini-2.5-flash-image',                // Previous — Nano Banana
  'gemini-2.0-flash-exp-image-generation', // Older generation
]

// ── OpenAI image models ───────────────────────────────────────────────────
// Updated: gpt-image-2 (April 2026) is now the latest
const OPENAI_IMAGE_MODEL_OPTIONS = [
  'gpt-image-2', // Latest (April 2026) — reasoning-enhanced
  'gpt-image-1', // Previous generation
  'dall-e-3',    // Legacy
]

// ── Route each config field to the correct picker ─────────────────────────
const GEMINI_CHAT_FIELDS  = new Set(['brand_chat'])
const GEMINI_IMAGE_FIELDS = new Set(['image_generation'])
const OPENAI_FIELDS       = new Set(['openai_image'])

function getModelOptions(fieldKey: string): string[] {
  if (OPENAI_FIELDS.has(fieldKey))       return OPENAI_IMAGE_MODEL_OPTIONS
  if (GEMINI_IMAGE_FIELDS.has(fieldKey)) return GEMINI_IMAGE_MODEL_OPTIONS
  if (GEMINI_CHAT_FIELDS.has(fieldKey))  return GEMINI_CHAT_MODEL_OPTIONS
  return CLAUDE_MODEL_OPTIONS  // default: all Claude text-generation fields
}

const MODEL_FIELDS: Record<keyof PlatformConfig['models'], { label: string; hint: string }> = {
  post_linkedin:    { label: 'LinkedIn posts',        hint: 'Claude model for LinkedIn post text generation' },
  post_instagram:   { label: 'Instagram captions',    hint: 'Claude model for Instagram caption generation' },
  post_x:           { label: 'X / Twitter posts',     hint: 'Claude model for X posts (280-char limit)' },
  carousel_slides:  { label: 'Carousel slide text',   hint: 'Claude model for generating 10 viral slide texts' },
  carousel_caption: { label: 'Carousel caption',      hint: 'Claude model for the carousel Instagram caption' },
  brand_chat:       { label: 'Brand discovery chat',  hint: 'Gemini model for the brand wizard chatbot' },
  brand_generate:   { label: 'Brand brief + SVG',     hint: 'Claude model for brand brief generation and Claude SVG carousel slides' },
  image_generation: { label: 'Gemini image model',    hint: 'Gemini model for carousel image rendering (gemini backend)' },
  openai_image:     { label: 'OpenAI image model',    hint: 'OpenAI model for carousel image rendering (openai backend) — gpt-image-2 is latest (April 2026)' },
}

const CREDIT_COST_FIELDS: Record<keyof PlatformConfig['credit_costs'], { label: string; hint: string }> = {
  post_gen: { label: 'Post generation',   hint: 'Credits deducted when a user generates LinkedIn + Instagram + X posts' },
  visual:   { label: 'Visual generation', hint: 'Credits deducted for a single social image via Blotato template' },
  carousel: { label: 'Carousel',          hint: 'Credits deducted for a full 10-slide carousel with images' },
}

const PLAN_CREDIT_FIELDS: Record<keyof PlatformConfig['plan_credits'], { label: string; hint: string }> = {
  starter: { label: 'Starter plan', hint: 'Monthly credit allowance for Starter subscribers' },
  pro:     { label: 'Pro plan',     hint: 'Monthly credit allowance for Pro subscribers' },
  agency:  { label: 'Agency plan',  hint: 'Monthly credit allowance for Agency subscribers' },
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({ title, icon, description, children }: {
  title: string
  icon: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <h3 className="font-semibold text-[var(--foreground)] text-sm">{title}</h3>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1 ml-6">{description}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function FieldRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-4 items-start">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ModelSelect({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string
  value: string
  onChange: (v: string) => void
}) {
  const options = getModelOptions(fieldKey)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      {options.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
      {/* If the current value isn't in the preset list, still show it */}
      {!options.includes(value) && (
        <option value={value}>{value} (custom)</option>
      )}
    </select>
  )
}

function NumberInput({ value, onChange, min = 0, step = 1 }: {
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full sm:max-w-[200px] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  )
}

function SaveButton({ onClick, saving, dirty }: { onClick: () => void; saving: boolean; dirty: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || !dirty}
      className="flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
    >
      {saving ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Saving…
        </>
      ) : (
        'Save changes'
      )}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ConfigEditor() {
  const [config, setConfig]     = useState<PlatformConfig | null>(null)
  const [draft, setDraft]       = useState<PlatformConfig | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null) // which section is saving
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState<string | null>(null) // which section just saved

  // Load config on mount
  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.ok ? r.json() : null)
      .then((data: PlatformConfig | null) => {
        if (data) { setConfig(data); setDraft(data) }
      })
      .catch(() => setError('Failed to load config'))
      .finally(() => setLoading(false))
  }, [])

  // Save a single section to the API
  const saveSection = useCallback(async (section: keyof PlatformConfig) => {
    if (!draft) return
    setSaving(section)
    setError('')
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, value: draft[section] }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Save failed')
      }
      setConfig((prev) => prev ? { ...prev, [section]: draft[section] } : prev)
      setSaved(section)
      setTimeout(() => setSaved(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }, [draft])

  // Helper: check if a section has unsaved changes
  const isDirty = (section: keyof PlatformConfig) => {
    if (!config || !draft) return false
    return JSON.stringify(config[section]) !== JSON.stringify(draft[section])
  }

  // Patch helpers — update draft without touching other sections
  const patchModels = (key: keyof PlatformConfig['models'], val: string) =>
    setDraft((d) => d ? { ...d, models: { ...d.models, [key]: val } } : d)

  const patchCreditCosts = (key: keyof PlatformConfig['credit_costs'], val: number) =>
    setDraft((d) => d ? { ...d, credit_costs: { ...d.credit_costs, [key]: val } } : d)

  const patchPlanCredits = (key: keyof PlatformConfig['plan_credits'], val: number) =>
    setDraft((d) => d ? { ...d, plan_credits: { ...d.plan_credits, [key]: val } } : d)

  const patchApiCosts = (key: string, val: number) =>
    setDraft((d) => d ? { ...d, api_cost_estimates: { ...d.api_cost_estimates, [key]: val } } : d)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!draft) {
    return <p className="text-sm text-red-500 py-8">{error || 'Could not load configuration.'}</p>
  }

  return (
    <div className="space-y-6">

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── 1. AI Models ── */}
      <SectionCard
        title="AI Models"
        icon="🤖"
        description="Which model handles each generation task. Change to Sonnet/Haiku to reduce costs. Takes effect within 5 minutes."
      >
        {(Object.keys(MODEL_FIELDS) as Array<keyof PlatformConfig['models']>).map((key) => (
          <FieldRow key={key} label={MODEL_FIELDS[key].label} hint={MODEL_FIELDS[key].hint}>
            <ModelSelect
              fieldKey={key}
              value={draft.models[key]}
              onChange={(v) => patchModels(key, v)}
            />
          </FieldRow>
        ))}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <SaveButton
            onClick={() => saveSection('models')}
            saving={saving === 'models'}
            dirty={isDirty('models')}
          />
          {saved === 'models' && <span className="text-xs text-green-500">✓ Saved</span>}
        </div>
      </SectionCard>

      {/* ── 2. Credit Costs ── */}
      <SectionCard
        title="Credit Costs per Action"
        icon="💳"
        description="How many credits are deducted from a user's balance when they trigger each action."
      >
        {(Object.keys(CREDIT_COST_FIELDS) as Array<keyof PlatformConfig['credit_costs']>).map((key) => (
          <FieldRow key={key} label={CREDIT_COST_FIELDS[key].label} hint={CREDIT_COST_FIELDS[key].hint}>
            <NumberInput
              value={draft.credit_costs[key]}
              onChange={(v) => patchCreditCosts(key, v)}
              min={1}
            />
          </FieldRow>
        ))}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <SaveButton
            onClick={() => saveSection('credit_costs')}
            saving={saving === 'credit_costs'}
            dirty={isDirty('credit_costs')}
          />
          {saved === 'credit_costs' && <span className="text-xs text-green-500">✓ Saved</span>}
        </div>
      </SectionCard>

      {/* ── 3. Plan Credits ── */}
      <SectionCard
        title="Monthly Credits per Plan"
        icon="📦"
        description="How many credits each subscription plan receives per month. Takes effect at next billing cycle reset."
      >
        {(Object.keys(PLAN_CREDIT_FIELDS) as Array<keyof PlatformConfig['plan_credits']>).map((key) => (
          <FieldRow key={key} label={PLAN_CREDIT_FIELDS[key].label} hint={PLAN_CREDIT_FIELDS[key].hint}>
            <NumberInput
              value={draft.plan_credits[key]}
              onChange={(v) => patchPlanCredits(key, v)}
              min={1}
            />
          </FieldRow>
        ))}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <SaveButton
            onClick={() => saveSection('plan_credits')}
            saving={saving === 'plan_credits'}
            dirty={isDirty('plan_credits')}
          />
          {saved === 'plan_credits' && <span className="text-xs text-green-500">✓ Saved</span>}
        </div>
      </SectionCard>

      {/* ── 4. API Cost Reference ── */}
      <SectionCard
        title="API Cost Reference (USD)"
        icon="📊"
        description="Reference costs per unit for margin tracking only — not used in billing logic. Update when providers change their pricing."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(draft.api_cost_estimates).map(([key, val]) => (
            <div key={key}>
              <p className="text-xs font-medium text-[var(--foreground)] mb-1">
                {key.replace(/_/g, ' ')}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--muted-foreground)]">$</span>
                <input
                  type="number"
                  value={val}
                  min={0}
                  step={0.01}
                  onChange={(e) => patchApiCosts(key, Number(e.target.value))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <SaveButton
            onClick={() => saveSection('api_cost_estimates')}
            saving={saving === 'api_cost_estimates'}
            dirty={isDirty('api_cost_estimates')}
          />
          {saved === 'api_cost_estimates' && <span className="text-xs text-green-500">✓ Saved</span>}
        </div>
      </SectionCard>

    </div>
  )
}

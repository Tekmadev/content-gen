'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// MVP onboarding flow:
//   1. Welcome + ToS
//   2. About you — name, creator type, primary platform, goals
//   3. Choose a plan — Stripe Checkout
//
// We removed the Blotato API key step — Blotato is admin-only now and
// publishing is no longer a user-facing requirement at signup. The core
// public value is post + carousel generation.

const STEPS = ['Welcome', 'About you', 'Choose plan'] as const

type CreatorType     = 'solo' | 'agency' | 'brand' | 'business' | 'hobbyist' | 'other'
type PrimaryPlatform = 'instagram' | 'linkedin' | 'tiktok' | 'x' | 'youtube' | 'facebook'

const CREATOR_OPTIONS: { value: CreatorType; label: string; icon: string; description: string }[] = [
  { value: 'solo',      label: 'Solo creator',  icon: '✨', description: 'Influencer / personal brand' },
  { value: 'agency',    label: 'Agency',        icon: '🏢', description: 'Manage many clients' },
  { value: 'brand',     label: 'Brand',         icon: '🎨', description: 'In-house team' },
  { value: 'business',  label: 'Small business',icon: '🏪', description: 'Local / online shop' },
  { value: 'hobbyist',  label: 'Hobbyist',      icon: '🎯', description: 'Personal project' },
  { value: 'other',     label: 'Something else',icon: '✏️', description: 'Tell us in feedback' },
]

const PLATFORM_OPTIONS: { value: PrimaryPlatform; label: string; icon: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { value: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { value: 'x',         label: 'X / Twitter', icon: '𝕏' },
  { value: 'youtube',   label: 'YouTube',   icon: '▶️' },
  { value: 'facebook',  label: 'Facebook',  icon: '👥' },
]

const GOAL_OPTIONS = [
  'Save time on content creation',
  'Stay consistent with posting',
  'Grow my audience',
  'Build a recognizable brand',
  'Repurpose content across platforms',
  'Generate ideas when I\'m stuck',
]

interface PlanSummary {
  key: 'starter' | 'creator' | 'pro' | 'agency'
  name: string
  priceCad: number
  credits: number
  tagline: string
  features: string[]
  highlight?: boolean
}

const PLAN_SUMMARIES: PlanSummary[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceCad: 19,
    credits: 120,
    tagline: 'For solo creators dipping their toes in.',
    features: [
      '1 platform of choice',
      '~30 posts / month',
      '1 carousel set / day',
      'Gemini image generator',
    ],
  },
  {
    key: 'creator',
    name: 'Creator',
    priceCad: 49,
    credits: 350,
    tagline: 'Where most active creators live.',
    features: [
      'All 3 platforms',
      '~90 posts / month',
      'Brand voice chat',
      'Gemini + Canva',
    ],
    highlight: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceCad: 99,
    credits: 800,
    tagline: 'Ship more, with premium AI.',
    features: [
      'Everything in Creator',
      '~200 posts / month',
      'OpenAI + Claude SVG',
      'Reference image (AIM)',
      '2 brand profiles',
    ],
  },
  {
    key: 'agency',
    name: 'Agency',
    priceCad: 279,
    credits: 2200,
    tagline: 'Run multiple clients from one seat.',
    features: [
      'Everything in Pro',
      '~550 posts / month',
      '5 brand profiles',
      'Priority support',
    ],
  },
]

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = useRef(createClient()).current

  const [step, setStep]       = useState<0 | 1 | 2>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Step 1: about you
  const [brandName, setBrandName]             = useState('')
  const [creatorType, setCreatorType]         = useState<CreatorType | null>(null)
  const [primaryPlatform, setPrimaryPlatform] = useState<PrimaryPlatform | null>(null)
  const [selectedGoals, setSelectedGoals]     = useState<string[]>([])

  // Redirect if already onboarded.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, brand_name, creator_type, primary_platform, goals')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.onboarding_completed) router.push('/dashboard')
      // If they previously partially filled the form, restore it
      if (data?.brand_name)        setBrandName(data.brand_name)
      if (data?.creator_type)      setCreatorType(data.creator_type as CreatorType)
      if (data?.primary_platform)  setPrimaryPlatform(data.primary_platform as PrimaryPlatform)
      if (Array.isArray(data?.goals)) setSelectedGoals(data.goals as string[])
    }
    check()
    return () => { cancelled = true }
  }, [router, supabase])

  function toggleGoal(g: string) {
    setSelectedGoals((prev) => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  async function handleStep0() {
    setStep(1)
    setError('')
  }

  async function handleStep1() {
    setError('')
    if (!brandName.trim())   { setError('Please enter your name or brand.'); return }
    if (!creatorType)         { setError('Pick the option that fits you best.'); return }
    if (!primaryPlatform)     { setError('Pick your main platform.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/save-profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          brand_name:       brandName.trim(),
          creator_type:     creatorType,
          primary_platform: primaryPlatform,
          goals:            selectedGoals,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save profile')
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function startCheckout(planKey: PlanSummary['key']) {
    setError('')
    setLoading(true)
    try {
      // Mark onboarding complete BEFORE jumping to Stripe so the user lands
      // back on /billing?success=1 already onboarded. If they bail out of
      // Stripe without paying, they still arrive at the dashboard and see
      // the "subscribe to start" CTA — they have 0 credits until they pay.
      await fetch('/api/onboarding/complete', { method: 'POST' })

      const res = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl flex flex-col gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-xs text-[var(--muted)]">Content Manager · Setup</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
                i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-[var(--primary)] text-white' :
                'bg-[var(--border)] text-[var(--muted)]'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-[var(--border)]" />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-6 sm:p-8 flex flex-col gap-6">

          {/* ── Step 0: Welcome + T&C ── */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Welcome to Content Manager</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  AI-powered post and carousel generation by Tekmadev Innovation Inc. Let&apos;s get you set up in 2 minutes.
                </p>
              </div>
              <div className="flex flex-col gap-3 text-sm text-[var(--foreground)]">
                {[
                  ['👤', 'Tell us a bit about you so the AI can match your style'],
                  ['💳', 'Pick a plan that fits your posting frequency'],
                  ['🚀', 'Start generating posts and carousels right away'],
                ].map(([icon, text], i) => (
                  <div key={i} className="flex items-start gap-3 bg-[var(--surface)] rounded-xl px-4 py-3">
                    <span className="text-lg">{icon}</span>
                    <p className="text-sm text-[var(--muted)]">{text}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  By continuing, you confirm you&apos;ve read and agreed to our{' '}
                  <Link href="/terms" target="_blank" className="text-[var(--primary)] underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="/privacy" target="_blank" className="text-[var(--primary)] underline">Privacy Policy</Link>.
                </p>
              </div>
              <button
                onClick={handleStep0}
                className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-semibold hover:bg-[var(--primary-hover)] transition-colors"
              >
                Get Started →
              </button>
            </>
          )}

          {/* ── Step 1: About you ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">A few quick questions</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  This helps the AI generate content that actually sounds like you.
                </p>
              </div>

              {/* Brand / personal name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Your name or brand <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Tekmadev or Jane Smith"
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Creator type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  What best describes you? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CREATOR_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCreatorType(opt.value)}
                      className={`flex flex-col items-start gap-1 p-3 border rounded-xl text-left transition-colors ${
                        creatorType === opt.value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="font-semibold text-xs text-[var(--foreground)]">{opt.label}</span>
                      <span className="text-[10px] text-[var(--muted)]">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary platform */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Where do you post most? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PLATFORM_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrimaryPlatform(opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 border rounded-xl transition-colors ${
                        primaryPlatform === opt.value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-[10px] font-medium text-[var(--foreground)]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals (optional, multi-select) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  What are you hoping to get out of Content Manager? <span className="text-[var(--muted)] font-normal">(pick any)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_OPTIONS.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedGoals.includes(g)
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(0); setError('') }}
                  className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-[var(--surface)] transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStep1}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-xl font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Choose plan ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Pick a plan to start</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  All plans are billed monthly in CAD. Cancel any time from Settings → Billing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PLAN_SUMMARIES.map(plan => (
                  <div
                    key={plan.key}
                    className={`relative flex flex-col gap-3 rounded-2xl border p-5 ${
                      plan.highlight
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-[var(--border)] bg-white'
                    }`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-2.5 left-5 bg-[var(--primary)] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                        Most popular
                      </span>
                    )}

                    <div className="flex items-baseline gap-2">
                      <h3 className="text-lg font-bold text-[var(--foreground)]">{plan.name}</h3>
                      <span className="text-sm text-[var(--muted)]">·</span>
                      <span className="text-sm font-mono text-[var(--muted)]">{plan.credits} credits/mo</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-[var(--foreground)]">${plan.priceCad}</span>
                      <span className="text-xs text-[var(--muted)]">CAD / month</span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{plan.tagline}</p>
                    <ul className="flex flex-col gap-1.5">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-[var(--foreground)]">
                          <span className="text-green-600 shrink-0 mt-0.5">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => startCheckout(plan.key)}
                      disabled={loading}
                      className={`mt-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                        plan.highlight
                          ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                          : 'bg-[var(--foreground)] text-white hover:opacity-90'
                      }`}
                    >
                      {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      Choose {plan.name}
                    </button>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => { setStep(1); setError('') }}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ← Back
                </button>
                <p className="text-xs text-[var(--muted)] text-right">
                  Secure checkout via Stripe. We never see your card.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

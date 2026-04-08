'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { BrandSettings } from '@/lib/types'

const STEPS = ['Welcome', 'Connect Blotato', 'Brand Kit']

const FONT_OPTIONS = [
  'Inter', 'Helvetica Neue', 'Montserrat', 'Playfair Display',
  'Georgia', 'Raleway', 'Roboto', 'Source Serif', 'DM Sans', 'Space Grotesk',
]

const DEFAULT_BRAND: BrandSettings = {
  primary_color:          '#6366f1',
  secondary_color:        '#ffffff',
  accent_color:           '#F97316',
  background_color:       '#ffffff',
  text_color:             '#111111',
  font_family:            'Inter',
  brand_name:             '',
  carousel_image_model:   'gemini',
  carousel_custom_prompt: '',
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Blotato
  const [blotatoKey, setBlotatoKey] = useState('')
  const [validating, setValidating] = useState(false)
  const [keyValid, setKeyValid] = useState(false)

  // Step 2 — Brand
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)

  // Redirect if already onboarded
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.onboarding_completed) router.push('/dashboard')
    }
    check()
  }, [router, supabase])

  async function validateBlotatoKey(key: string) {
    if (!key.trim()) return
    setValidating(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/validate-blotato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setKeyValid(true)
      } else {
        setError(data.error || 'Invalid API key — check your Blotato dashboard and try again.')
        setKeyValid(false)
      }
    } catch {
      setError('Could not validate key — check your internet connection.')
      setKeyValid(false)
    }
    setValidating(false)
  }

  async function handleStep0() {
    // Accept T&C (already shown inline) — just advance
    setStep(1)
  }

  async function handleStep1() {
    if (!keyValid) {
      setError('Please validate your Blotato API key first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/save-blotato-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: blotatoKey }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save key')
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  async function handleStep2() {
    setLoading(true)
    setError('')
    try {
      // Save brand settings
      const brandRes = await fetch('/api/brand-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      if (!brandRes.ok) throw new Error('Failed to save brand settings')

      // Mark onboarding complete
      const doneRes = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!doneRes.ok) throw new Error('Failed to complete onboarding')

      router.push('/billing?onboarding=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  function ColorInput({ label, field }: { label: string; field: keyof BrandSettings }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--muted)]">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brand[field] as string}
            onChange={(e) => setBrand((prev) => ({ ...prev, [field]: e.target.value }))}
            className="w-9 h-9 rounded-lg border border-[var(--border)] cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={brand[field] as string}
            onChange={(e) => setBrand((prev) => ({ ...prev, [field]: e.target.value }))}
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="#000000"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg flex flex-col gap-6">

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
            <div key={i} className="flex items-center gap-2 flex-1">
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
        <div className="bg-white rounded-2xl border border-[var(--border)] p-8 flex flex-col gap-6">

          {/* ── Step 0: Welcome + T&C ── */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Welcome to Content Manager</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  AI-powered social media publishing by Tekmadev Innovation Inc. Let's get you set up in 3 quick steps.
                </p>
              </div>
              <div className="flex flex-col gap-3 text-sm text-[var(--foreground)]">
                {[
                  ['🔑', 'Connect your Blotato API key to publish to your social accounts'],
                  ['🎨', 'Set up your brand kit so AI matches your visual style'],
                  ['💳', 'Choose a plan to start generating content'],
                ].map(([icon, text], i) => (
                  <div key={i} className="flex items-start gap-3 bg-[var(--surface)] rounded-xl px-4 py-3">
                    <span className="text-lg">{icon}</span>
                    <p className="text-sm text-[var(--muted)]">{text}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  By continuing, you confirm that you have read and agreed to our{' '}
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

          {/* ── Step 1: Blotato API Key ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Connect Blotato</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Your Blotato API key lets Content Manager publish to your connected social accounts.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">Blotato API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={blotatoKey}
                    onChange={(e) => { setBlotatoKey(e.target.value); setKeyValid(false); setError('') }}
                    placeholder="blotato_..."
                    className="flex-1 px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <button
                    onClick={() => validateBlotatoKey(blotatoKey)}
                    disabled={validating || !blotatoKey.trim()}
                    className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--surface)] transition-colors disabled:opacity-50 flex-shrink-0 flex items-center gap-2"
                  >
                    {validating && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                    {validating ? 'Checking…' : 'Validate'}
                  </button>
                </div>
                {keyValid && (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <span>✓</span> Key validated — your social accounts are accessible.
                  </p>
                )}
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}
                <p className="text-xs text-[var(--muted)]">
                  Find your API key in the{' '}
                  <a href="https://app.blotato.com/settings" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">
                    Blotato dashboard → Settings → API
                  </a>.
                  Don't have a Blotato account?{' '}
                  <a href="https://blotato.com" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">
                    Sign up free →
                  </a>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(0); setError('') }}
                  className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-[var(--surface)] transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStep1}
                  disabled={loading || !keyValid}
                  className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-xl font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Brand Kit ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Set Up Your Brand Kit</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  These colors and fonts guide AI-generated visuals to match your brand.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">Brand / Company Name</label>
                  <input
                    type="text"
                    value={brand.brand_name}
                    onChange={(e) => setBrand((prev) => ({ ...prev, brand_name: e.target.value }))}
                    placeholder="e.g. Tekmadev"
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Primary Color" field="primary_color" />
                  <ColorInput label="Accent Color" field="accent_color" />
                  <ColorInput label="Background" field="background_color" />
                  <ColorInput label="Text Color" field="text_color" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">Font</label>
                  <select
                    value={brand.font_family}
                    onChange={(e) => setBrand((prev) => ({ ...prev, font_family: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <p className="text-xs text-[var(--muted)]">You can update these anytime in Settings.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(1); setError('') }}
                  className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-sm font-medium hover:bg-[var(--surface)] transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-xl font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Finish Setup →
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

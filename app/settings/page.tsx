'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import UserAvatar from '@/components/UserAvatar'
import type { BrandSettings } from '@/lib/types'

// ── Feedback Modal ────────────────────────────────────────────────────────

function FeedbackModal({
  user,
  onClose,
}: {
  user: { email?: string; user_metadata?: { full_name?: string } } | null
  onClose: () => void
}) {
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) { setError('Please enter your feedback.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message,
          rating,
          // Device context collected client-side
          platform:   navigator.platform,
          screenSize: `${screen.width}x${screen.height}`,
          language:   navigator.language,
          timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
          referrer:   document.referrer || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Send Feedback</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">We read every message — thank you.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--muted)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--foreground)]">Thanks for the feedback!</p>
            <p className="text-sm text-[var(--muted)]">We&apos;ll use it to make Content Manager better.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 p-5">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Star rating */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">How would you rate your experience?</label>
              <div className="flex gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? null : star)}
                    className={`text-2xl transition-transform hover:scale-110 ${
                      rating !== null && star <= rating ? 'text-amber-400' : 'text-gray-200'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">
                Feedback <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what's working, what's broken, or what you'd love to see next…"
                rows={5}
                required
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />
              <p className="text-xs text-[var(--muted)]">{message.length} / 2000 characters</p>
            </div>

            {/* Privacy note */}
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              By submitting, you agree we may collect your name, email, device info, and IP address to process your feedback as described in our{' '}
              <a href="/privacy" target="_blank" className="text-[var(--primary)] underline">Privacy Policy</a>.
            </p>

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? 'Sending…' : 'Send Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

interface Account {
  id: string
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok'
  username: string
  fullname?: string
  displayName?: string
  subAccounts: { id: string; name: string }[]
}

const FONT_OPTIONS = [
  'Inter',
  'Helvetica Neue',
  'Montserrat',
  'Playfair Display',
  'Georgia',
  'Raleway',
  'Roboto',
  'Source Serif',
  'DM Sans',
  'Space Grotesk',
]

const DEFAULT_BRAND: BrandSettings = {
  primary_color:    '#000000',
  secondary_color:  '#ffffff',
  accent_color:     '#F97316',
  background_color: '#ffffff',
  text_color:       '#111111',
  font_family:      'Inter',
  brand_name:       '',
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0077b5',
  instagram: '#e1306c',
  facebook: '#1877f2',
  tiktok: '#010101',
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{
    id?: string
    email?: string
    user_metadata?: { avatar_url?: string; full_name?: string; email?: string }
  } | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [copied, setCopied] = useState(false)

  // Brand settings
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)
  const [brandError, setBrandError] = useState('')

  const loadBrandSettings = useCallback(async () => {
    const res = await fetch('/api/brand-settings')
    if (res.ok) {
      const data = await res.json()
      setBrand({ ...DEFAULT_BRAND, ...data })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadBrandSettings()

    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }, [loadBrandSettings])

  async function saveBrandSettings() {
    setSavingBrand(true)
    setBrandError('')
    setBrandSaved(false)
    try {
      const res = await fetch('/api/brand-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Save failed')
      }
      setBrandSaved(true)
      setTimeout(() => setBrandSaved(false), 3000)
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Save failed')
    }
    setSavingBrand(false)
  }

  async function copyUserId() {
    if (!user) return
    await navigator.clipboard.writeText(user.id ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    if (!acc[a.platform]) acc[a.platform] = []
    acc[a.platform].push(a)
    return acc
  }, {})

  return (
    <AppShell user={user}>
      {feedbackOpen && <FeedbackModal user={user} onClose={() => setFeedbackOpen(false)} />}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <h1 className="text-xl font-semibold">Settings</h1>

        {/* Profile */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Profile</h2>

          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-[var(--foreground)]">
                {user?.user_metadata?.full_name || 'No name'}
              </p>
              <p className="text-sm text-[var(--muted)]">{user?.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Account ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--muted)] truncate font-mono">
                {user?.id ?? '—'}
              </code>
              <button
                onClick={copyUserId}
                className="text-xs text-[var(--primary)] hover:underline flex-shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)] mb-3">
              Authenticated via Google through Supabase. To change your name or profile picture, update your Google account.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Connected Accounts</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Managed via Blotato. Connect or disconnect accounts from your Blotato dashboard.
              </p>
            </div>
            <a
              href="https://app.blotato.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap flex-shrink-0"
            >
              Open Blotato →
            </a>
          </div>

          {loadingAccounts ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--muted)]">Loading accounts…</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <p className="text-sm text-[var(--muted)]">No accounts connected yet.</p>
              <a
                href="https://app.blotato.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--primary)] hover:underline font-medium"
              >
                Connect accounts in Blotato →
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(grouped).map(([platform, accs]) => (
                <div key={platform} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLATFORM_COLORS[platform] ?? '#999' }}
                    />
                    <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pl-4">
                    {accs.map((acc) => (
                      <div key={acc.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 bg-[var(--surface)] rounded-lg px-3 py-2.5">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {acc.fullname || acc.displayName || acc.username}
                            </p>
                            {acc.username && (acc.fullname || acc.displayName) && (
                              <p className="text-xs text-[var(--muted)] truncate">@{acc.username}</p>
                            )}
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Connected" />
                        </div>
                        {acc.subAccounts?.length > 0 && (
                          <div className="pl-3 flex flex-col gap-1">
                            {acc.subAccounts.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2 text-xs text-[var(--muted)] bg-[var(--surface)] rounded-lg px-3 py-2">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {sub.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brand Style */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Brand Style</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              These colors and font are injected into every Nano Banana image generation so all visuals stay on-brand automatically.
            </p>
          </div>

          {/* Preview strip */}
          <div
            className="w-full h-20 rounded-xl flex items-center justify-center text-sm font-semibold border border-[var(--border)] transition-all"
            style={{ backgroundColor: brand.background_color, color: brand.text_color, fontFamily: brand.font_family }}
          >
            <span style={{ color: brand.accent_color, marginRight: 6 }}>✦</span>
            {brand.brand_name || 'Your Brand'} — Preview
          </div>

          {/* Brand name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--foreground)]">Brand / Company Name</label>
            <input
              type="text"
              value={brand.brand_name}
              onChange={(e) => setBrand((b) => ({ ...b, brand_name: e.target.value }))}
              placeholder="e.g. Tekmadev"
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Colors grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { key: 'primary_color',    label: 'Primary Color',    hint: 'Main brand color — buttons, key elements' },
              { key: 'secondary_color',  label: 'Secondary Color',  hint: 'Supporting / contrast color' },
              { key: 'accent_color',     label: 'Accent Color',     hint: 'Highlights, CTAs, decorative details' },
              { key: 'background_color', label: 'Background Color', hint: 'Slide background' },
              { key: 'text_color',       label: 'Text Color',       hint: 'Main body and headline text' },
            ] as { key: keyof BrandSettings; label: string; hint: string }[]).map(({ key, label, hint }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--foreground)]">{label}</label>
                <p className="text-xs text-[var(--muted)]">{hint}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={brand[key] as string}
                      onChange={(e) => setBrand((b) => ({ ...b, [key]: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer p-0.5 bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={brand[key] as string}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                        setBrand((b) => ({ ...b, [key]: val }))
                      }
                    }}
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}

            {/* Font picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">Font Family</label>
              <p className="text-xs text-[var(--muted)]">Typography style for generated visuals</p>
              <select
                value={brand.font_family}
                onChange={(e) => setBrand((b) => ({ ...b, font_family: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {brandError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{brandError}</p>
          )}

          <button
            onClick={saveBrandSettings}
            disabled={savingBrand}
            className="self-start px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            {savingBrand ? 'Saving…' : brandSaved ? '✓ Saved' : 'Save Brand Style'}
          </button>
        </section>

        {/* API Keys info */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Integrations</h2>
          <div className="flex flex-col gap-3">
            {[
              { name: 'Blotato', desc: 'Content extraction, visual generation, and publishing', env: 'BLOTATO_API_KEY' },
              { name: 'Anthropic Claude', desc: 'AI post copy generation', env: 'ANTHROPIC_API_KEY' },
              { name: 'Supabase', desc: 'Database, auth, and file storage', env: 'NEXT_PUBLIC_SUPABASE_URL' },
            ].map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3 bg-[var(--surface)] rounded-lg px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                </div>
                <span className="text-xs font-mono bg-white border border-[var(--border)] rounded px-2 py-1 text-[var(--muted)] flex-shrink-0">
                  {item.env}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            API keys are set as environment variables and never exposed to the browser.
          </p>
        </section>

        {/* Feedback */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Feedback</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Found a bug? Have a feature idea? We&apos;d love to hear from you.
            </p>
          </div>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Send Feedback
          </button>
        </section>
      </div>
    </AppShell>
  )
}

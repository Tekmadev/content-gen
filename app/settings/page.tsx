'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import UserAvatar from '@/components/UserAvatar'
import type { BrandSettings, BrandBrief } from '@/lib/types'
import Link from 'next/link'
import SmartFeedbackModal from '@/components/SmartFeedbackModal'

// ── Legacy Feedback Modal (kept for reference, unused) ────────────────────
// The settings page now uses SmartFeedbackModal — a category-driven smart
// form that captures bug/feature/usability/etc. context. The function below
// is kept so the file still parses if anyone references it; it's no longer
// rendered.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyFeedbackModal({
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
            <p className="text-xs text-[var(--muted)] mt-0.5">We read every message, thank you.</p>
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

// FONT_OPTIONS moved to BrandStyleSection (used on /brand page)

const DEFAULT_BRAND: BrandSettings = {
  primary_color:          '#000000',
  secondary_color:        '#ffffff',
  accent_color:           '#F97316',
  background_color:       '#ffffff',
  text_color:             '#111111',
  font_family:            'Inter',
  brand_name:             '',
  logo_url:               '',
  carousel_image_model:   'gemini',
  carousel_custom_prompt: '',
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
    app_metadata?: { provider?: string }
  } | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [copied, setCopied] = useState(false)

  // Profile editing (email users only)
  const [profileName, setProfileName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Brand brief (from AI wizard)
  const [brief, setBrief] = useState<BrandBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)

  // Brand settings — only used here for Carousel AI section now
  // (Brand Style UI moved to /brand). Carousel AI shares the same brand object + API.
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND)

  // Carousel AI settings
  const [savingCarousel, setSavingCarousel] = useState(false)
  const [carouselSaved, setCarouselSaved] = useState(false)
  const [carouselError, setCarouselError] = useState('')

  const loadBrandSettings = useCallback(async () => {
    const res = await fetch('/api/brand-settings')
    if (res.ok) {
      const data = await res.json()
      setBrand({
        ...DEFAULT_BRAND,
        ...data,
        carousel_custom_prompt: data.carousel_custom_prompt ?? '',
      })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setProfileName(data.user?.user_metadata?.full_name ?? '')
    })
    loadBrandSettings()

    // Load brand brief summary
    fetch('/api/brand-brief')
      .then((r) => r.ok ? r.json() : null)
      .then((data: BrandBrief | null) => { if (data?.chat_completed) setBrief(data) })
      .catch(() => {})
      .finally(() => setBriefLoading(false))

    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }, [loadBrandSettings])

  async function saveProfile() {
    setSavingProfile(true)
    setProfileError('')
    setProfileSaved(false)
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim() },
      })
      if (error) throw error
      setUser((u) => u ? { ...u, user_metadata: { ...u.user_metadata, full_name: data.user?.user_metadata?.full_name } } : u)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Save failed')
    }
    setSavingProfile(false)
  }

  // saveBrandSettings + handleLogoUpload + handleLogoRemove moved to BrandStyleSection (/brand page)

  async function saveCarouselSettings() {
    setSavingCarousel(true)
    setCarouselError('')
    setCarouselSaved(false)
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
      setCarouselSaved(true)
      setTimeout(() => setCarouselSaved(false), 3000)
    } catch (err) {
      setCarouselError(err instanceof Error ? err.message : 'Save failed')
    }
    setSavingCarousel(false)
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
      {feedbackOpen && <SmartFeedbackModal user={user} onClose={() => setFeedbackOpen(false)} />}
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

          {/* Name edit — email users only */}
          {user?.app_metadata?.provider !== 'google' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[var(--foreground)]">Display Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  onClick={saveProfile}
                  disabled={savingProfile || !profileName.trim()}
                  className="px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                >
                  {savingProfile && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {profileSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {profileError && (
                <p className="text-xs text-red-600">{profileError}</p>
              )}
            </div>
          )}

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
            {user?.app_metadata?.provider === 'google' ? (
              <p className="text-xs text-[var(--muted)] mb-3">
                Signed in with Google. To change your name or profile picture, update your Google account.
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)] mb-3">
                Signed in with email and password.
              </p>
            )}
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

        {/* ── Brand Profile (from AI wizard) ── */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Brand Profile</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Your brand identity gathered from the AI brand wizard. Powers all content generation.
              </p>
            </div>
            <Link
              href="/brand"
              className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap flex-shrink-0"
            >
              {brief ? 'Edit profile →' : 'Build profile →'}
            </Link>
          </div>

          {briefLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[var(--muted)]">Loading brand profile…</span>
            </div>
          ) : !brief ? (
            <div className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-[var(--border)] rounded-xl">
              <span className="text-3xl">🎨</span>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">No brand profile yet</p>
                <p className="text-xs text-[var(--muted)] mt-1">Run the brand wizard to build your AI-powered brand identity.</p>
              </div>
              <Link
                href="/brand"
                className="mt-1 px-4 py-2 bg-[var(--primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
              >
                Start brand wizard
              </Link>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Identity row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Business name',   value: brief.business_name },
                  { label: 'Tagline',         value: brief.tagline },
                  { label: 'Location',        value: brief.location },
                  { label: 'Website',         value: brief.website },
                  { label: 'Founded',         value: brief.founded },
                  { label: 'Tone of voice',   value: brief.tone_of_voice },
                ].filter((f) => f.value).map(({ label, value }) => (
                  <div key={label} className="bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5">{label}</p>
                    <p className="text-sm text-[var(--foreground)] leading-snug">{value}</p>
                  </div>
                ))}
              </div>

              {/* Mission / description */}
              {(brief.mission || brief.business_description) && (
                <div className="bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                    {brief.mission ? 'Mission' : 'What we do'}
                  </p>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed">
                    {brief.mission || brief.business_description}
                  </p>
                </div>
              )}

              {/* Personality + Pillars row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {brief.personality_words?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Personality</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brief.personality_words.map((w, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 font-medium">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {brief.content_pillars?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Content Pillars</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brief.content_pillars.map((p, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Services */}
              {brief.services?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Services</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {brief.services.map((svc, i) => (
                      <div key={i} className="bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--foreground)]">{svc.name}</p>
                        {svc.description && <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{svc.description}</p>}
                        {svc.outcome && <p className="text-[11px] text-[var(--primary)] mt-1">→ {svc.outcome}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Always / Never say */}
              {(brief.always_say?.length > 0 || brief.never_say?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {brief.always_say?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-2">✓ Always say</p>
                      <ul className="space-y-1">
                        {brief.always_say.map((s, i) => (
                          <li key={i} className="text-xs text-[var(--foreground)] flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {brief.never_say?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-2">✕ Never say</p>
                      <ul className="space-y-1">
                        {brief.never_say.map((s, i) => (
                          <li key={i} className="text-xs text-[var(--foreground)] flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Target audiences */}
              {brief.audiences?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Target Audiences</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {brief.audiences.map((aud, i) => (
                      <div key={i} className="bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--foreground)]">{aud.name}</p>
                        {aud.description && <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{aud.description}</p>}
                        {aud.pain_points?.length > 0 && (
                          <p className="text-[11px] text-[var(--muted)] mt-1">Pain: {aud.pain_points.slice(0, 2).join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brief.brief_generated_at && (
                <p className="text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-3">
                  Last generated {new Date(brief.brief_generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  <Link href="/brand" className="text-[var(--primary)] hover:underline">View full brief →</Link>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Brand Style — moved to /brand page (Brand Identity).
            Pointer card stays here so users discovering settings know where it went. */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl shrink-0">🎨</div>
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Brand Style</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Logo, brand colors, and font for AI-generated visuals are now managed on the Brand Identity page — alongside your full brand brief.
              </p>
            </div>
          </div>
          <Link
            href="/brand"
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors shrink-0"
          >
            Open Brand →
          </Link>
        </section>

        {/* Carousel AI */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Carousel AI</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Choose the image generation model and optionally write your own prompt to control exactly how slides look.
            </p>
          </div>

          {/* Model picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--foreground)]">Default Image Generator</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { id: 'gemini',     icon: '✦', label: 'Gemini AI',    desc: 'Google AI image generation. Fast, photorealistic.',         available: true },
                { id: 'openai',     icon: '⬡', label: 'DALL-E 3',     desc: 'OpenAI image generation. Vivid, high-fidelity quality.',   available: true },
                { id: 'claude_svg', icon: '◈', label: 'Claude SVG',   desc: 'Vector graphics by Claude. Pixel-perfect brand accuracy.', available: true },
                { id: 'canva',      icon: '🎨', label: 'Canva',        desc: 'Your Canva brand template. Requires connected account.',   available: true },
              ] as { id: string; icon: string; label: string; desc: string; available: boolean }[]).map(({ id, icon, label, desc, available }) => (
                <button
                  key={id}
                  type="button"
                  disabled={!available}
                  onClick={() => setBrand((b) => ({ ...b, carousel_image_model: id as import('@/lib/types').ImageGenerator }))}
                  className={[
                    'text-left p-3 rounded-xl border transition-all',
                    brand.carousel_image_model === id && available
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : 'border-[var(--border)] bg-[var(--surface)]',
                    !available ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[var(--primary)]/50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      <span className="mr-1.5">{icon}</span>{label}
                    </p>
                    {brand.carousel_image_model === id && available ? (
                      <svg className="w-4 h-4 text-[var(--primary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--muted)]">{desc}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--muted)]">This sets your default. You can override per carousel in the Studio.</p>
          </div>

          {/* Custom prompt */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-xs font-medium text-[var(--foreground)]">
                Custom Image Prompt <span className="text-[var(--muted)] font-normal">(optional)</span>
              </label>
              <span className="text-[10px] text-[var(--muted)]">{(brand.carousel_custom_prompt ?? '').length} chars</span>
            </div>
            <textarea
              value={brand.carousel_custom_prompt ?? ''}
              onChange={(e) => setBrand((b) => ({ ...b, carousel_custom_prompt: e.target.value }))}
              rows={9}
              placeholder={`Leave empty to use built-in style prompts.\n\nOr write your own, e.g.:\n\nCreate a professional Instagram carousel slide.\nDisplay this text as the hero element, large and centered:\n"{{text}}"\n\nStyle: Dark background, white bold typography, minimal layout.\nPlatform: {{platform}} · Format: {{ratio}}`}
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y leading-relaxed"
            />
            {/* Variable chips */}
            <div className="flex flex-wrap gap-1.5">
              {['{{text}}', '{{platform}}', '{{ratio}}', '{{slide_number}}', '{{total_slides}}', '{{style}}'].map((v) => (
                <button
                  key={v}
                  type="button"
                  title="Click to insert"
                  onClick={() => setBrand((b) => ({ ...b, carousel_custom_prompt: b.carousel_custom_prompt + v }))}
                  className="text-[10px] font-mono bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Click a variable to insert it. <code className="bg-[var(--surface)] px-1 rounded text-[10px]">{'{{text}}'}</code> is replaced with each slide&apos;s text — always include it.
            </p>
          </div>

          {carouselError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{carouselError}</p>
          )}

          <button
            onClick={saveCarouselSettings}
            disabled={savingCarousel}
            className="self-start px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            {savingCarousel ? 'Saving…' : carouselSaved ? '✓ Saved' : 'Save Carousel AI'}
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

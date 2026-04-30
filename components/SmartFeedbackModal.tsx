'use client'

import { useState, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type Category = 'bug' | 'feature_request' | 'usability' | 'praise' | 'complaint' | 'question' | 'other'
type Severity = 'low' | 'medium' | 'high' | 'critical'
type FeatureArea = 'carousel' | 'posts' | 'brand' | 'billing' | 'auth' | 'dashboard' | 'other'
type UsageFrequency = 'daily' | 'weekly' | 'monthly' | 'rarely'
type CreatorType = 'solo' | 'agency' | 'brand' | 'business' | 'hobbyist' | 'other'

interface Props {
  user: { email?: string; user_metadata?: { full_name?: string } } | null
  onClose: () => void
}

// ── Category metadata for the picker grid ──────────────────────────────────
const CATEGORY_OPTIONS: { value: Category; label: string; icon: string; description: string }[] = [
  { value: 'bug',             label: 'Bug',            icon: '🐛', description: 'Something is broken' },
  { value: 'feature_request', label: 'Feature idea',   icon: '💡', description: 'Wish it could…' },
  { value: 'usability',       label: 'Usability',      icon: '🧭', description: 'Confusing or hard to use' },
  { value: 'praise',          label: 'Compliment',     icon: '🎉', description: 'You love something' },
  { value: 'complaint',       label: 'Complaint',      icon: '😠', description: 'Frustration or problem' },
  { value: 'question',        label: 'Question',       icon: '❓', description: 'Asking for help' },
  { value: 'other',           label: 'Other',          icon: '✏️', description: 'Anything else' },
]

const FEATURE_AREAS: { value: FeatureArea; label: string }[] = [
  { value: 'carousel',  label: 'Carousel Studio' },
  { value: 'posts',     label: 'Posts' },
  { value: 'brand',     label: 'Brand' },
  { value: 'billing',   label: 'Billing' },
  { value: 'auth',      label: 'Sign in / account' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'other',     label: 'Other' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 640)  return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SmartFeedbackModal({ user, onClose }: Props) {
  // Form state
  const [step, setStep] = useState<'category' | 'details'>('category')
  const [category, setCategory] = useState<Category | null>(null)
  const [name, setName]         = useState(user?.user_metadata?.full_name ?? '')
  const [message, setMessage]   = useState('')
  const [rating, setRating]     = useState<number | null>(null)
  const [nps, setNps]           = useState<number | null>(null)

  // Bug-specific
  const [severity, setSeverity]               = useState<Severity | null>(null)
  const [expected, setExpected]               = useState('')
  const [actual, setActual]                   = useState('')
  const [steps, setSteps]                     = useState('')

  // Feature-request-specific
  const [desiredOutcome, setDesiredOutcome]   = useState('')
  const [wouldPayFor, setWouldPayFor]         = useState<boolean | null>(null)

  // Usage / context (asked once, useful for everything)
  const [featureArea, setFeatureArea]         = useState<FeatureArea | null>(null)
  const [usageFrequency, setUsageFrequency]   = useState<UsageFrequency | null>(null)
  const [creatorType, setCreatorType]         = useState<CreatorType | null>(null)
  const [contactBack, setContactBack]         = useState(false)

  // Submission
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  // Auto-derive feature area from current URL on mount (user can override)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    if      (path.startsWith('/carousel')) setFeatureArea('carousel')
    else if (path.startsWith('/posts'))    setFeatureArea('posts')
    else if (path.startsWith('/brand'))    setFeatureArea('brand')
    else if (path.startsWith('/billing'))  setFeatureArea('billing')
    else if (path.startsWith('/login') || path.startsWith('/signup')) setFeatureArea('auth')
    else if (path.startsWith('/dashboard')) setFeatureArea('dashboard')
  }, [])

  function pickCategory(c: Category) {
    setCategory(c)
    setStep('details')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) { setError('Please describe the feedback.'); return }
    if (!category)       { setError('Please pick a category.'); return }

    setLoading(true)
    setError('')

    try {
      const payload = {
        // Core
        category,
        message: message.trim(),
        name: name.trim() || null,
        rating,
        nps_score: nps,

        // Context (every category)
        feature_area:    featureArea,
        usage_frequency: usageFrequency,
        creator_type:    creatorType,
        contact_back:    contactBack,
        current_url:     typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,

        // Bug
        severity:           category === 'bug' ? severity : null,
        expected_behavior:  category === 'bug' ? expected.trim() || null : null,
        actual_behavior:    category === 'bug' ? actual.trim() || null : null,
        steps_to_reproduce: category === 'bug' ? steps.trim() || null : null,

        // Feature request
        desired_outcome: category === 'feature_request' ? desiredOutcome.trim() || null : null,
        would_pay_for:   category === 'feature_request' ? wouldPayFor : null,

        // Device + environment (collected client-side)
        device_type:     detectDeviceType(),
        viewport_width:  typeof window !== 'undefined' ? window.innerWidth  : null,
        viewport_height: typeof window !== 'undefined' ? window.innerHeight : null,
        platform:        typeof navigator !== 'undefined' ? navigator.platform : null,
        screen_size:     typeof screen    !== 'undefined' ? `${screen.width}x${screen.height}` : null,
        language:        typeof navigator !== 'undefined' ? navigator.language : null,
        timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer:        typeof document !== 'undefined' ? document.referrer || null : null,
        app_version:     process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const isBug      = category === 'bug'
  const isFeature  = category === 'feature_request'
  const isPositive = category === 'praise'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Send Feedback</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {step === 'category' ? 'What kind of feedback?' : 'Tell us more — every detail helps'}
            </p>
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
        ) : step === 'category' ? (
          // ─── STEP 1: CATEGORY PICKER ──────────────────────────────────
          <div className="overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pickCategory(opt.value)}
                  className="flex flex-col items-start gap-1 p-3 border border-[var(--border)] rounded-xl text-left hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-semibold text-sm text-[var(--foreground)]">{opt.label}</span>
                  <span className="text-xs text-[var(--muted)]">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // ─── STEP 2: DETAILS FORM ─────────────────────────────────────
          <form onSubmit={submit} className="flex flex-col gap-4 p-5 overflow-y-auto">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Back to category */}
            <button
              type="button"
              onClick={() => setStep('category')}
              className="self-start text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
            >
              ← Change category
              <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-[10px] uppercase">
                {CATEGORY_OPTIONS.find(o => o.value === category)?.label}
              </span>
            </button>

            {/* Message — always shown */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">
                {isBug      ? 'What went wrong?'
                 : isFeature ? 'What would you like?'
                 : isPositive ? 'What do you love?'
                 : 'Your feedback'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  isBug      ? 'Briefly describe the bug…'
                  : isFeature ? 'Describe the feature in plain language…'
                  : isPositive ? 'What part stood out?'
                  : 'Tell us what\'s on your mind…'
                }
                rows={4}
                required
                maxLength={5000}
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />
              <p className="text-xs text-[var(--muted)]">{message.length} / 5000</p>
            </div>

            {/* Feature area — useful for every category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--foreground)]">Which part of the app?</label>
              <select
                value={featureArea ?? ''}
                onChange={e => setFeatureArea((e.target.value || null) as FeatureArea | null)}
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm bg-white"
              >
                <option value="">— pick one —</option>
                {FEATURE_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            {/* ── BUG FIELDS ───────────────────────────────────────── */}
            {isBug && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">How severe?</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['low','medium','high','critical'] as Severity[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(severity === s ? null : s)}
                        className={`px-2 py-2 rounded-md text-xs font-medium border transition-colors capitalize ${
                          severity === s
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">What did you expect to happen?</label>
                  <textarea
                    value={expected}
                    onChange={e => setExpected(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. The carousel should generate 6 slides"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">What actually happened?</label>
                  <textarea
                    value={actual}
                    onChange={e => setActual(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. It returned only 2 slides"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">Steps to reproduce <span className="text-[var(--muted)] font-normal">(optional)</span></label>
                  <textarea
                    value={steps}
                    onChange={e => setSteps(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="1. Go to Carousel Studio&#10;2. Pick Claude SVG&#10;3. Click Generate"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none font-mono"
                  />
                </div>
              </>
            )}

            {/* ── FEATURE REQUEST FIELDS ──────────────────────────── */}
            {isFeature && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">What outcome are you trying to achieve?</label>
                  <textarea
                    value={desiredOutcome}
                    onChange={e => setDesiredOutcome(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. Schedule posts a week in advance so I don't have to log in daily"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">Would you upgrade or pay extra for this?</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { v: true,  l: 'Yes' },
                      { v: false, l: 'No' },
                      { v: null,  l: 'Maybe' },
                    ].map(({v,l}) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setWouldPayFor(v)}
                        className={`px-2 py-2 rounded-md text-xs font-medium border transition-colors ${
                          wouldPayFor === v
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── ALWAYS-ASKED CONTEXT (collapsed at the bottom) ─── */}
            <details className="border border-[var(--border)] rounded-lg p-3">
              <summary className="text-xs font-medium text-[var(--foreground)] cursor-pointer">
                A bit about you (optional, helps us prioritize)
              </summary>
              <div className="flex flex-col gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">What kind of creator are you?</label>
                  <select
                    value={creatorType ?? ''}
                    onChange={e => setCreatorType((e.target.value || null) as CreatorType | null)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-white"
                  >
                    <option value="">— pick one —</option>
                    <option value="solo">Solo creator / influencer</option>
                    <option value="agency">Marketing agency</option>
                    <option value="brand">Brand / startup</option>
                    <option value="business">Small business</option>
                    <option value="hobbyist">Hobbyist</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">How often do you use Content Manager?</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['daily','weekly','monthly','rarely'] as UsageFrequency[]).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setUsageFrequency(usageFrequency === f ? null : f)}
                        className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize ${
                          usageFrequency === f
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">Overall, how likely are you to recommend us? (NPS)</label>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({length: 11}, (_, i) => i).map(score => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setNps(nps === score ? null : score)}
                        className={`w-7 h-7 rounded-md text-xs font-medium border transition-colors ${
                          nps === score
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                {!isBug && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--muted)]">Star rating <span className="font-normal">(optional)</span></label>
                    <div className="flex gap-1">
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
                )}
              </div>
            </details>

            {/* Contact back */}
            <label className="flex items-center gap-2 text-xs text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={contactBack}
                onChange={e => setContactBack(e.target.checked)}
                className="rounded"
              />
              <span>It&apos;s OK to email me a follow-up about this feedback.</span>
            </label>

            {/* Privacy note */}
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              We collect your name, email, device info, IP address, and the page you&apos;re on. See our{' '}
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

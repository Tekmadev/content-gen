'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'

interface Profile {
  subscription_plan: 'starter' | 'creator' | 'pro' | 'agency' | null
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | null
  subscription_period_end: string | null
  credits_used: number
  credits_reset_at: string
}

interface CreditCosts {
  post_gen: number
  visual: number
  carousel: number
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    currency: 'CAD/mo',
    credits: 120,
    features: [
      '120 credits / month',
      '1 platform of choice',
      'Brand voice + style kit',
      'Carousel Studio (occasional)',
    ],
    highlight: false,
  },
  {
    key: 'creator',
    name: 'Creator',
    price: '$49',
    currency: 'CAD/mo',
    credits: 350,
    features: [
      '350 credits / month',
      'All 3 platforms',
      'Carousel Studio (full)',
      'Reference library (10)',
      'Email support (24h)',
    ],
    highlight: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99',
    currency: 'CAD/mo',
    credits: 800,
    features: [
      '800 credits / month',
      'Everything in Creator',
      '2 brand profiles',
      'Priority queue',
      'Priority support (8h)',
    ],
    highlight: false,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '$279',
    currency: 'CAD/mo',
    credits: 2200,
    features: [
      '2,200 credits / month',
      '5 brand profiles',
      '3 team seats',
      'Dedicated success manager',
      'Phone + Slack (4h)',
    ],
    highlight: false,
  },
]

const ADDONS = [
  { key: 'boost',  name: 'Boost',  credits: 50,  price: '$19' },
  { key: 'pulse',  name: 'Pulse',  credits: 200, price: '$59' },
  { key: 'surge',  name: 'Surge',  credits: 500, price: '$129' },
]

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', creator: 'Creator', pro: 'Pro', agency: 'Agency' }
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:     { label: 'Active',      color: 'text-green-700 bg-green-50 border-green-200' },
  trialing:   { label: 'Trial',       color: 'text-blue-700 bg-blue-50 border-blue-200' },
  past_due:   { label: 'Past Due',    color: 'text-orange-700 bg-orange-50 border-orange-200' },
  canceled:   { label: 'Canceled',    color: 'text-red-700 bg-red-50 border-red-200' },
  incomplete: { label: 'Incomplete',  color: 'text-gray-700 bg-gray-50 border-gray-200' },
}

const PLAN_CREDITS: Record<string, number> = { starter: 120, creator: 350, pro: 800, agency: 2200 }

function CreditBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100))
  const remaining = Math.max(0, total - used)
  const isDanger  = pct >= 100
  const isWarning = pct >= 80

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--foreground)]">
          {remaining.toLocaleString()} credits remaining
        </span>
        <span className={`font-semibold ${isDanger ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-[var(--muted)]'}`}>
          {used.toLocaleString()} / {total.toLocaleString()} used
        </span>
      </div>
      <div className="w-full h-3 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
        <div
          className={`h-full rounded-full transition-all ${isDanger ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-[var(--primary)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isDanger && (
        <p className="text-xs text-red-600">You&apos;ve used all your credits this month. Upgrade to continue.</p>
      )}
      {isWarning && !isDanger && (
        <p className="text-xs text-orange-600">Running low — consider upgrading before you hit the limit.</p>
      )}
    </div>
  )
}

function BillingContent() {
  const searchParams = useSearchParams()
  const success    = searchParams.get('success') === '1'
  const canceled   = searchParams.get('canceled') === '1'
  const isOnboarding = searchParams.get('onboarding') === '1'

  const [profile,        setProfile]        = useState<Profile | null>(null)
  const [creditCosts,    setCreditCosts]    = useState<CreditCosts | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading,  setPortalLoading]  = useState(false)
  const [error,          setError]          = useState('')

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then(({ profile: p, creditCosts: cc }) => {
        setProfile(p)
        setCreditCosts(cc)
      })
      .catch(() => setError('Failed to load billing info'))
      .finally(() => setLoading(false))
  }, [success])

  async function startCheckout(planKey: string) {
    setCheckoutLoading(planKey)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setCheckoutLoading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to open portal')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  const hasActiveSub = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
  const currentPlan  = profile?.subscription_plan
  const totalCredits = currentPlan ? PLAN_CREDITS[currentPlan] ?? null : null

  const resetDate = profile?.credits_reset_at
    ? new Date(
        new Date(profile.credits_reset_at).getFullYear(),
        new Date(profile.credits_reset_at).getMonth() + 1,
        1
      ).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })
    : null

  const planOrder = ['starter', 'creator', 'pro', 'agency']

  return (
    <AppShell user={null}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        <div>
          <h1 className="text-xl font-semibold">Billing & Plan</h1>
          {isOnboarding && !hasActiveSub && (
            <p className="text-sm text-[var(--muted)] mt-1">
              Choose a plan to start publishing. You can change or cancel anytime.
            </p>
          )}
        </div>

        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm">
            <svg className="w-5 h-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Subscription activated! You&apos;re all set.
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
            Checkout canceled. Your plan was not changed.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--muted)]">Loading billing info…</span>
          </div>
        ) : (
          <>
            {/* Current plan + credits */}
            {hasActiveSub && profile && totalCredits && (
              <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Current Plan</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-lg font-bold text-[var(--foreground)]">
                        {PLAN_LABELS[currentPlan!] ?? currentPlan}
                      </span>
                      {profile.subscription_status && STATUS_LABELS[profile.subscription_status] && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_LABELS[profile.subscription_status].color}`}>
                          {STATUS_LABELS[profile.subscription_status].label}
                        </span>
                      )}
                    </div>
                    {profile.subscription_period_end && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Renews {new Date(profile.subscription_period_end).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="text-sm text-[var(--primary)] hover:underline font-medium disabled:opacity-50 flex-shrink-0"
                  >
                    {portalLoading ? 'Opening…' : 'Manage subscription →'}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className="font-semibold uppercase tracking-wide">Monthly Credits</span>
                    {resetDate && <span>Resets {resetDate}</span>}
                  </div>
                  <CreditBar used={profile.credits_used} total={totalCredits} />
                </div>

                {creditCosts && (
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'Post generation', cost: creditCosts.post_gen },
                      { label: 'Visual',           cost: creditCosts.visual },
                      { label: 'Carousel',         cost: creditCosts.carousel },
                    ]).map(({ label, cost }) => (
                      <span key={label} className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-[var(--muted)]">
                        {label} = <strong className="text-[var(--foreground)]">{cost} credit{cost !== 1 ? 's' : ''}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!hasActiveSub && !loading && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
                You don&apos;t have an active subscription. Choose a plan below to get started.
              </div>
            )}

            {/* Add-on credit packs — visible only when actively subscribed */}
            {hasActiveSub && (
              <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-4">
                <div>
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">
                    Need more credits?
                  </h2>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Top up any time without changing your plan. Top-up credits roll over for 90 days.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ADDONS.map((pack) => (
                    <div
                      key={pack.key}
                      className="border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2 hover:border-[var(--primary)]/40 transition-colors"
                    >
                      <div className="flex items-baseline justify-between">
                        <p className="font-bold text-[var(--foreground)]">{pack.name}</p>
                        <span className="text-lg font-bold text-[var(--primary)]">{pack.price}</span>
                      </div>
                      <p className="text-sm text-[var(--foreground)]">+{pack.credits} credits</p>
                      <button
                        disabled
                        className="mt-1 w-full py-2 rounded-lg text-xs font-semibold bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)] cursor-not-allowed"
                        title="Coming soon"
                      >
                        Coming soon
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Heavy use every month? Upgrading your plan is usually a better deal per credit.
                </p>
              </section>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = currentPlan === plan.key && hasActiveSub
                const isLoading = checkoutLoading === plan.key
                const currentIdx = currentPlan ? planOrder.indexOf(currentPlan) : -1
                const planIdx    = planOrder.indexOf(plan.key)
                const ctaLabel   = !hasActiveSub
                  ? `Get ${plan.name}`
                  : planIdx > currentIdx
                  ? `Upgrade to ${plan.name}`
                  : `Switch to ${plan.name}`

                return (
                  <div
                    key={plan.key}
                    className={`relative flex flex-col rounded-2xl border p-5 gap-4 ${
                      plan.highlight ? 'border-[var(--primary)] shadow-md' : 'border-[var(--border)]'
                    } ${isCurrent ? 'bg-[var(--surface)]' : 'bg-white'}`}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-[var(--primary)] text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div>
                      <p className="font-bold text-[var(--foreground)]">{plan.name}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold">{plan.price}</span>
                        <span className="text-xs text-[var(--muted)]">{plan.currency}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--primary)] mt-1">
                        {plan.credits.toLocaleString()} credits/mo
                      </p>
                    </div>

                    <ul className="flex flex-col gap-1.5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="text-center text-sm font-medium text-[var(--primary)] bg-[var(--primary)]/10 rounded-lg py-2">
                        Current Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => startCheckout(plan.key)}
                        disabled={!!checkoutLoading || portalLoading}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                          plan.highlight
                            ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                            : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--border)] border border-[var(--border)]'
                        }`}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Loading…
                          </span>
                        ) : ctaLabel}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-[var(--muted)] text-center">
              All plans billed monthly in Canadian dollars (CAD). Cancel anytime.{' '}
              <a href="/terms" className="underline hover:text-[var(--foreground)]">Terms</a>
              {' · '}
              <a href="/privacy" className="underline hover:text-[var(--foreground)]">Privacy</a>
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<AppShell user={null}><div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div></AppShell>}>
      <BillingContent />
    </Suspense>
  )
}

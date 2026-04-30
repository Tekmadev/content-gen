'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import ConfigEditor from '@/components/admin/ConfigEditor'
import CarouselJobsTab from '@/components/admin/CarouselJobsTab'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

interface Kpis {
  totalUsers: number
  activeSubscribers: number
  totalCreditsUsed: number
  totalPostsGenerated: number
  totalMrrCad: number
}

interface Overview {
  kpis: Kpis
  planBreakdown: Record<string, number>
  creditsByType: Record<string, number>
  postsBySource: Record<string, number>
  signupChart: { date: string; signups: number }[]
  creditChart: { date: string; credits: number }[]
  recentEvents: { event_type: string; to_plan: string | null; created_at: string }[]
}

interface FeedbackEntry {
  id: string
  user_id: string | null
  email: string | null
  name: string | null
  message: string
  rating: number | null
  user_agent: string | null
  platform: string | null
  screen_size: string | null
  language: string | null
  timezone: string | null
  referrer: string | null
  ip_address: string | null
  created_at: string
  // ── Smart-form fields ────────────────────────────────────────────────
  category: string | null
  severity: string | null
  feature_area: string | null
  device_type: string | null
  viewport_width: number | null
  viewport_height: number | null
  subscription_plan: string | null
  current_url: string | null
  expected_behavior: string | null
  actual_behavior: string | null
  steps_to_reproduce: string | null
  desired_outcome: string | null
  would_pay_for: boolean | null
  nps_score: number | null
  contact_back: boolean | null
  app_version: string | null
  usage_frequency: string | null
  creator_type: string | null
  status: string | null
  admin_notes: string | null
}

interface AdminUser {
  user_id: string
  email: string
  subscription_plan: string | null
  subscription_status: string | null
  credits_used: number
  total_posts_generated: number
  total_visuals_generated: number
  total_carousels_generated: number
  total_credits_ever_used: number
  last_active_at: string | null
  created_at: string
  onboarding_completed: boolean
  is_admin: boolean
  stripe_customer_id: string | null
  subscription_period_end: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_CREDITS: Record<string, number> = { starter: 120, creator: 350, pro: 800, agency: 2200 }
const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const STATUS_BADGE: Record<string, string> = {
  active:     'bg-green-100 text-green-700',
  trialing:   'bg-blue-100 text-blue-700',
  past_due:   'bg-orange-100 text-orange-700',
  canceled:   'bg-red-100 text-red-700',
  incomplete: 'bg-gray-100 text-gray-600',
}

const EVENT_LABELS: Record<string, string> = {
  subscribed:        '🎉 New subscriber',
  upgraded:          '⬆️ Upgrade',
  downgraded:        '⬇️ Downgrade',
  canceled:          '❌ Canceled',
  payment_failed:    '⚠️ Payment failed',
  payment_recovered: '✅ Payment recovered',
  trial_started:     '🧪 Trial started',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)] mb-3">{children}</h2>
}

// ── User Detail Drawer ─────────────────────────────────────────────────────

function UserDrawer({
  user,
  onClose,
  onAction,
}: {
  user: AdminUser
  onClose: () => void
  onAction: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditMode, setCreditMode] = useState<'grant' | 'revoke' | 'set'>('grant')
  const [creditNote, setCreditNote] = useState('')
  const [planOverride, setPlanOverride] = useState(user.subscription_plan ?? '')
  const [statusOverride, setStatusOverride] = useState(user.subscription_status ?? '')

  const totalCredits = user.subscription_plan ? (PLAN_CREDITS[user.subscription_plan] ?? 0) : 0
  const available   = Math.max(0, totalCredits - user.credits_used)
  const pct = totalCredits > 0 ? Math.min(100, Math.round((user.credits_used / totalCredits) * 100)) : 0

  async function doAction(body: Record<string, unknown>) {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/users/${user.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      setMsg('Done!')
      onAction()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-md bg-white h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="font-semibold text-[var(--foreground)] truncate">{user.email}</p>
            <p className="text-xs text-[var(--muted)]">Joined {new Date(user.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--muted)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5">
          {msg && (
            <div className={`text-sm px-4 py-2.5 rounded-lg ${msg === 'Done!' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {msg}
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {user.subscription_status && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[user.subscription_status] ?? 'bg-gray-100 text-gray-600'}`}>
                {user.subscription_status}
              </span>
            )}
            {user.subscription_plan && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                {user.subscription_plan}
              </span>
            )}
            {user.is_admin && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                Admin
              </span>
            )}
            {!user.onboarding_completed && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                Onboarding incomplete
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Posts generated', value: user.total_posts_generated },
              { label: 'Visuals generated', value: user.total_visuals_generated },
              { label: 'Carousels', value: user.total_carousels_generated },
              { label: 'All-time credits', value: user.total_credits_ever_used },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--surface)] rounded-xl p-3">
                <p className="text-xs text-[var(--muted)]">{label}</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Credit Management ────────────────────────────────────────── */}
          <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="bg-[var(--primary)]/5 px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">Credit Management</p>
                {user.subscription_plan && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {user.subscription_plan} plan · {totalCredits.toLocaleString()} cr/mo
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Big balance display */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Available</p>
                  <p className={`text-2xl font-bold ${available === 0 ? 'text-red-600' : pct >= 80 ? 'text-orange-500' : 'text-green-600'}`}>
                    {available.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Used</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {user.credits_used.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Total/mo</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {totalCredits.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Usage bar */}
              {totalCredits > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                    <span>This month&apos;s usage</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-[var(--primary)]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Quick grant — preset amounts */}
              <div>
                <p className="text-xs font-medium text-[var(--foreground)] mb-1.5">Quick grant</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 50, 100, 500].map((n) => (
                    <button
                      key={n}
                      disabled={loading}
                      onClick={() => doAction({
                        action: 'grant_credits',
                        amount: n,
                        notes: `quick grant +${n}`,
                      })}
                      className="py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick revoke — preset amounts */}
              <div>
                <p className="text-xs font-medium text-[var(--foreground)] mb-1.5">Quick revoke</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 50, 100, 500].map((n) => (
                    <button
                      key={n}
                      disabled={loading || available < n}
                      onClick={() => doAction({
                        action: 'revoke_credits',
                        amount: n,
                        notes: `quick revoke -${n}`,
                      })}
                      title={available < n ? `Only ${available} available` : `Take ${n} credits`}
                      className="py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −{n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount with mode selector */}
              <div>
                <p className="text-xs font-medium text-[var(--foreground)] mb-1.5">Custom amount</p>
                <div className="flex gap-1 bg-[var(--surface)] rounded-lg p-0.5 mb-2 border border-[var(--border)]">
                  {([
                    { id: 'grant',  label: 'Grant',  cls: 'text-green-700' },
                    { id: 'revoke', label: 'Revoke', cls: 'text-red-700' },
                    { id: 'set',    label: 'Set used to', cls: 'text-[var(--foreground)]' },
                  ] as const).map(({ id, label, cls }) => (
                    <button
                      key={id}
                      onClick={() => setCreditMode(id)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        creditMode === id
                          ? `bg-white shadow-sm ${cls}`
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={creditMode === 'set' ? 0 : 1}
                    placeholder={
                      creditMode === 'grant'  ? 'How many to give'
                      : creditMode === 'revoke' ? 'How many to take'
                      : 'New credits_used value'
                    }
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <button
                    disabled={loading || !creditAmount}
                    onClick={() => {
                      const num = Number(creditAmount)
                      if (creditMode === 'grant') {
                        doAction({ action: 'grant_credits', amount: num, notes: creditNote || `granted ${num}` })
                      } else if (creditMode === 'revoke') {
                        doAction({ action: 'revoke_credits', amount: num, notes: creditNote || `revoked ${num}` })
                      } else {
                        doAction({ action: 'set_credits_used', value: num, notes: creditNote || `set to ${num}` })
                      }
                      setCreditAmount('')
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                      creditMode === 'grant'  ? 'bg-green-600 hover:bg-green-700' :
                      creditMode === 'revoke' ? 'bg-red-600 hover:bg-red-700' :
                      'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
                    }`}
                  >
                    {creditMode === 'grant' ? 'Grant' : creditMode === 'revoke' ? 'Revoke' : 'Set'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Reason / note (optional, logged in audit trail)"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Reset button */}
              <button
                disabled={loading || user.credits_used === 0}
                onClick={() => {
                  if (confirm(`Reset ${user.email}'s monthly usage to 0? They'll have full ${totalCredits.toLocaleString()} credits available again this month.`)) {
                    doAction({ action: 'reset_credits', notes: creditNote || 'manual reset' })
                  }
                }}
                className="w-full py-2 text-xs font-medium text-[var(--primary)] border border-dashed border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↺ Reset monthly usage to 0 (full refresh)
              </button>
            </div>
          </div>

          {/* ── Override plan/status ── */}
          <div>
            <p className="text-sm font-semibold mb-2">Override subscription</p>
            <div className="flex gap-2">
              <select
                value={planOverride}
                onChange={e => setPlanOverride(e.target.value)}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              >
                <option value="">No plan</option>
                <option value="starter">Starter</option>
                <option value="creator">Creator</option>
                <option value="pro">Pro</option>
                <option value="agency">Agency</option>
              </select>
              <select
                value={statusOverride}
                onChange={e => setStatusOverride(e.target.value)}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              >
                <option value="">No status</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="canceled">Canceled</option>
              </select>
              <button
                disabled={loading}
                onClick={() => doAction({ action: 'set_plan', plan: planOverride || null, status: statusOverride || null })}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </div>

          {/* ── Danger zone ── */}
          <div className="border border-red-200 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Danger zone</p>
            <button
              disabled={loading}
              onClick={() => doAction({ action: 'reset_onboarding' })}
              className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Reset onboarding
            </button>
            <button
              disabled={loading}
              onClick={() => doAction({ action: 'toggle_admin', is_admin: !user.is_admin })}
              className="w-full py-2 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {user.is_admin ? 'Remove admin access' : 'Grant admin access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'carousels' | 'feedback' | 'config'>('overview')
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [feedbackSearch, setFeedbackSearch] = useState('')
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null)
  const [pageUser, setPageUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; full_name?: string } } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, usersRes, feedbackRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
        fetch('/api/admin/feedback'),
      ])
      if (ovRes.status === 401 || ovRes.status === 403) {
        setError('Access denied. Admin only.')
        setLoading(false)
        return
      }
      setOverview(await ovRes.json())
      setUsers(await usersRes.json())
      setFeedback(await feedbackRes.json())
    } catch {
      setError('Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Fetch current user for AppShell avatar/email
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.email) setPageUser({ email: data.email }) })
      .catch(() => {})
  }, [load])

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <AppShell user={pageUser}>
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell user={pageUser}>
        <div className="flex items-center justify-center py-24">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </AppShell>
    )
  }

  const kpis = overview?.kpis

  // Pie data
  const creditPie = Object.entries(overview?.creditsByType ?? {}).map(([name, value]) => ({
    name: name === 'post_gen' ? 'Post gen' : name === 'visual' ? 'Visual' : 'Carousel',
    value,
  }))
  const sourcePie = Object.entries(overview?.postsBySource ?? {}).map(([name, value]) => ({ name, value }))
  const planPie = Object.entries(overview?.planBreakdown ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  return (
    <AppShell user={pageUser}>
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={() => { load(); setSelectedUser(null) }}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Admin Dashboard</h1>
            <p className="text-sm text-[var(--muted)]">Full system visibility & controls</p>
          </div>
          <div className="flex gap-2">
            {([
              { key: 'overview',  label: 'Overview' },
              { key: 'users',     label: `Users (${users.length})` },
              { key: 'carousels', label: 'Carousels' },
              { key: 'feedback',  label: `Feedback (${feedback.length})` },
              { key: 'config',    label: '⚙️ Config' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && overview && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Total users" value={kpis?.totalUsers ?? 0} />
              <KpiCard label="Active subscribers" value={kpis?.activeSubscribers ?? 0} />
              <KpiCard
                label="MRR"
                value={`$${(kpis?.totalMrrCad ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`}
                sub="CAD / month"
              />
              <KpiCard label="Posts generated" value={kpis?.totalPostsGenerated ?? 0} />
              <KpiCard label="Total credits used" value={(kpis?.totalCreditsUsed ?? 0).toLocaleString()} />
            </div>

            {/* Charts row 1: signups + credits */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <SectionTitle>New signups — last 30 days</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={overview.signupChart}>
                    <defs>
                      <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval={6} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v) => [v, 'Signups']}
                      labelFormatter={l => l}
                    />
                    <Area type="monotone" dataKey="signups" stroke="#6366f1" strokeWidth={2} fill="url(#signupGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <SectionTitle>Credits consumed — last 30 days</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={overview.creditChart}>
                    <defs>
                      <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval={6} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="credits" stroke="#10b981" strokeWidth={2} fill="url(#creditGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts row 2: pies + bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Credit by type */}
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <SectionTitle>Credits by feature (30d)</SectionTitle>
                {creditPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={creditPie} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {creditPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-[var(--muted)] pt-4">No data yet</p>}
              </div>

              {/* Posts by source */}
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <SectionTitle>Posts by source type</SectionTitle>
                {sourcePie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={sourcePie} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {sourcePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-[var(--muted)] pt-4">No data yet</p>}
              </div>

              {/* Plan breakdown bar */}
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <SectionTitle>Active subscribers by plan</SectionTitle>
                {planPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={planPie} barCategoryGap="30%">
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={24} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" name="Subscribers" radius={[6, 6, 0, 0]}>
                        {planPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-[var(--muted)] pt-4">No active subscribers yet</p>}
              </div>
            </div>

            {/* Recent events */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5">
              <SectionTitle>Recent billing events</SectionTitle>
              {overview.recentEvents.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No events yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overview.recentEvents.map((e, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>{EVENT_LABELS[e.event_type] ?? e.event_type} {e.to_plan ? `→ ${e.to_plan}` : ''}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(e.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
            </div>

            {/* Users table */}
            <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                      {['Email', 'Plan', 'Status', 'Credits', 'Posts', 'Visuals', 'Last active', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const total = u.subscription_plan ? (PLAN_CREDITS[u.subscription_plan] ?? 0) : 0
                      const creditPct = total > 0 ? Math.min(100, Math.round((u.credits_used / total) * 100)) : 0
                      return (
                        <tr key={u.user_id} className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                          <td className="px-4 py-3 font-medium max-w-[180px]">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{u.email}</span>
                              {u.is_admin && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Admin</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 capitalize text-[var(--muted)]">{u.subscription_plan ?? '—'}</td>
                          <td className="px-4 py-3">
                            {u.subscription_status ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[u.subscription_status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {u.subscription_status}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[var(--surface)] rounded-full border border-[var(--border)] overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${creditPct >= 100 ? 'bg-red-500' : creditPct >= 80 ? 'bg-orange-400' : 'bg-[var(--primary)]'}`}
                                  style={{ width: `${creditPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-[var(--muted)]">{u.credits_used}/{total || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">{u.total_posts_generated}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{u.total_visuals_generated}</td>
                          <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                            {u.last_active_at
                              ? new Date(u.last_active_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                              : 'Never'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="text-xs font-medium text-[var(--primary)] hover:underline"
                            >
                              Manage →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-[var(--muted)] text-center py-10">No users found.</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'carousels' && (
          <CarouselJobsTab />
        )}

        {activeTab === 'feedback' && (
          <>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by email, name, or message…"
                value={feedbackSearch}
                onChange={e => setFeedbackSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
              />
            </div>

            {feedback.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[var(--border)] flex items-center justify-center py-16">
                <p className="text-sm text-[var(--muted)]">No feedback submitted yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {feedback
                  .filter(f => {
                    const q = feedbackSearch.toLowerCase()
                    return !q || f.email?.toLowerCase().includes(q) || f.name?.toLowerCase().includes(q) || f.message.toLowerCase().includes(q)
                  })
                  .map(f => {
                    const isExpanded = expandedFeedback === f.id
                    return (
                      <div key={f.id} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                        {/* Summary row */}
                        <button
                          onClick={() => setExpandedFeedback(isExpanded ? null : f.id)}
                          className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-[var(--surface)] transition-colors"
                        >
                          {/* Star rating */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-1 w-14">
                            <div className="flex">
                              {[1,2,3,4,5].map(s => (
                                <span key={s} className={`text-sm ${f.rating && s <= f.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                              ))}
                            </div>
                            {f.rating && <span className="text-xs text-[var(--muted)]">{f.rating}/5</span>}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-[var(--foreground)]">{f.name || 'Anonymous'}</span>
                              {f.email && <span className="text-xs text-[var(--muted)]">{f.email}</span>}
                              {f.category && (
                                <span className="text-[10px] uppercase font-bold bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded">
                                  {f.category.replace('_',' ')}
                                </span>
                              )}
                              {f.severity && (
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  f.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  f.severity === 'high'     ? 'bg-orange-100 text-orange-700' :
                                  f.severity === 'medium'   ? 'bg-amber-100 text-amber-700' :
                                                              'bg-slate-100 text-slate-700'
                                }`}>
                                  {f.severity}
                                </span>
                              )}
                              {f.feature_area && (
                                <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  {f.feature_area}
                                </span>
                              )}
                              {f.subscription_plan && (
                                <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                  {f.subscription_plan}
                                </span>
                              )}
                              {f.would_pay_for === true && (
                                <span className="text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  💰 would pay
                                </span>
                              )}
                              {f.contact_back && (
                                <span className="text-[10px] uppercase font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                  📧 contact back
                                </span>
                              )}
                              {f.nps_score != null && (
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  f.nps_score >= 9 ? 'bg-green-100 text-green-700' :
                                  f.nps_score >= 7 ? 'bg-yellow-100 text-yellow-700' :
                                                     'bg-red-100 text-red-700'
                                }`}>
                                  NPS {f.nps_score}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--foreground)] mt-1 line-clamp-2">{f.message}</p>
                          </div>

                          {/* Date + chevron */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                              {new Date(f.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {new Date(f.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <svg className={`w-4 h-4 text-[var(--muted)] transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border)] px-5 py-4 flex flex-col gap-4 bg-[var(--surface)]">
                            {/* Full message */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">Message</p>
                              <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{f.message}</p>
                            </div>

                            {/* Bug-specific fields */}
                            {(f.expected_behavior || f.actual_behavior || f.steps_to_reproduce) && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {f.expected_behavior && (
                                  <div className="bg-white rounded-lg border border-[var(--border)] p-3">
                                    <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-1">Expected</p>
                                    <p className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{f.expected_behavior}</p>
                                  </div>
                                )}
                                {f.actual_behavior && (
                                  <div className="bg-white rounded-lg border border-[var(--border)] p-3">
                                    <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-1">Actual</p>
                                    <p className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{f.actual_behavior}</p>
                                  </div>
                                )}
                                {f.steps_to_reproduce && (
                                  <div className="bg-white rounded-lg border border-[var(--border)] p-3">
                                    <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-1">Steps to reproduce</p>
                                    <p className="text-xs text-[var(--foreground)] whitespace-pre-wrap font-mono">{f.steps_to_reproduce}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Feature-request-specific fields */}
                            {f.desired_outcome && (
                              <div className="bg-white rounded-lg border border-[var(--border)] p-3">
                                <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-1">Desired outcome</p>
                                <p className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{f.desired_outcome}</p>
                              </div>
                            )}

                            {/* User context grid */}
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">User & Device Context</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                  { label: 'Plan',          value: f.subscription_plan },
                                  { label: 'Creator type',  value: f.creator_type },
                                  { label: 'Usage',         value: f.usage_frequency },
                                  { label: 'Page',          value: f.current_url },
                                  { label: 'Device',        value: f.device_type },
                                  { label: 'Viewport',      value: f.viewport_width && f.viewport_height ? `${f.viewport_width}×${f.viewport_height}` : null },
                                  { label: 'IP Address',    value: f.ip_address },
                                  { label: 'Platform',      value: f.platform },
                                  { label: 'Screen',        value: f.screen_size },
                                  { label: 'Language',      value: f.language },
                                  { label: 'Timezone',      value: f.timezone },
                                  { label: 'Referrer',      value: f.referrer || 'Direct' },
                                  { label: 'App version',   value: f.app_version },
                                ].map(({ label, value }) => value ? (
                                  <div key={label} className="bg-white rounded-lg border border-[var(--border)] px-3 py-2">
                                    <p className="text-xs text-[var(--muted)]">{label}</p>
                                    <p className="text-xs font-medium text-[var(--foreground)] truncate mt-0.5" title={value}>{value}</p>
                                  </div>
                                ) : null)}
                              </div>
                            </div>

                            {/* User agent */}
                            {f.user_agent && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">User Agent</p>
                                <p className="text-xs text-[var(--muted)] font-mono break-all">{f.user_agent}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}

        {/* ── Config tab — fully self-contained, no shared state ── */}
        {activeTab === 'config' && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-[var(--foreground)]">Platform Configuration</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Changes take effect within 5 minutes (server cache TTL). No deploy needed.
              </p>
            </div>
            <ConfigEditor />
          </div>
        )}

      </div>
    </AppShell>
  )
}

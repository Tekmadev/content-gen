'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
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

const PLAN_CREDITS: Record<string, number> = { starter: 60, pro: 250, agency: 1000 }
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
  const [creditDelta, setCreditDelta] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [planOverride, setPlanOverride] = useState(user.subscription_plan ?? '')
  const [statusOverride, setStatusOverride] = useState(user.subscription_status ?? '')

  const totalCredits = user.subscription_plan ? (PLAN_CREDITS[user.subscription_plan] ?? 0) : 0
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

          {/* Credit bar */}
          {totalCredits > 0 && (
            <div>
              <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
                <span>Credits this month</span>
                <span>{user.credits_used} / {totalCredits} ({pct}%)</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-[var(--primary)]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <hr className="border-[var(--border)]" />

          {/* ── Adjust credits ── */}
          <div>
            <p className="text-sm font-semibold mb-2">Adjust credits</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="+10 or -5"
                value={creditDelta}
                onChange={e => setCreditDelta(e.target.value)}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <button
                disabled={loading || !creditDelta}
                onClick={() => doAction({ action: 'adjust_credits', amount: Number(creditDelta), notes: creditNote })}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={creditNote}
              onChange={e => setCreditNote(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
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
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview')
  const [pageUser, setPageUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; full_name?: string } } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, usersRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
      ])
      if (ovRes.status === 401 || ovRes.status === 403) {
        setError('Access denied. Admin only.')
        setLoading(false)
        return
      }
      setOverview(await ovRes.json())
      setUsers(await usersRes.json())
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
            {(['overview', 'users'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab === 'overview' ? 'Overview' : `Users (${users.length})`}
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
      </div>
    </AppShell>
  )
}

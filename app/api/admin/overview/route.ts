import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const admin = createAdminClient()

  const [
    { data: profiles },
    { data: creditUsage },
    { data: mrr },
    { data: recentEvents },
    { data: postsByType },
    { data: dailySignups },
  ] = await Promise.all([
    // KPI snapshot
    admin
      .from('user_profiles')
      .select('subscription_plan, subscription_status, total_credits_ever_used, total_posts_generated, total_visuals_generated, total_carousels_generated, created_at'),

    // Credit usage by action type (last 30 days)
    admin
      .from('credit_transactions')
      .select('action_type, credits_deducted, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .gt('credits_deducted', 0),

    // MRR view
    admin.from('admin_mrr').select('*'),

    // Recent subscription events
    admin
      .from('subscription_events')
      .select('event_type, to_plan, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    // Posts by source type (all time)
    admin
      .from('posts_log')
      .select('source_type, created_at'),

    // Daily signups last 30 days
    admin
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  // KPIs
  const totalUsers = profiles?.length ?? 0
  const activeSubscribers = profiles?.filter(p =>
    p.subscription_status === 'active' || p.subscription_status === 'trialing'
  ).length ?? 0
  const totalCreditsUsed = profiles?.reduce((s, p) => s + (p.total_credits_ever_used ?? 0), 0) ?? 0
  const totalPostsGenerated = profiles?.reduce((s, p) => s + (p.total_posts_generated ?? 0), 0) ?? 0

  // MRR total
  const totalMrr = mrr?.reduce((s, r) => s + (r.mrr_cad_cents ?? 0), 0) ?? 0

  // Plan breakdown
  const isActive = (s: string | null) => s === 'active' || s === 'trialing'
  const planBreakdown = {
    starter: profiles?.filter(p => p.subscription_plan === 'starter' && isActive(p.subscription_status)).length ?? 0,
    creator: profiles?.filter(p => p.subscription_plan === 'creator' && isActive(p.subscription_status)).length ?? 0,
    pro:     profiles?.filter(p => p.subscription_plan === 'pro'     && isActive(p.subscription_status)).length ?? 0,
    agency:  profiles?.filter(p => p.subscription_plan === 'agency'  && isActive(p.subscription_status)).length ?? 0,
  }

  // Credit usage by type (last 30 days) → for pie chart
  const creditsByType: Record<string, number> = {}
  for (const tx of creditUsage ?? []) {
    creditsByType[tx.action_type] = (creditsByType[tx.action_type] ?? 0) + tx.credits_deducted
  }

  // Posts by source type → pie chart
  const postsBySource: Record<string, number> = {}
  for (const p of postsByType ?? []) {
    postsBySource[p.source_type] = (postsBySource[p.source_type] ?? 0) + 1
  }

  // Daily signups for sparkline (last 30 days, grouped by day)
  const signupsByDay: Record<string, number> = {}
  for (const p of dailySignups ?? []) {
    const day = p.created_at.slice(0, 10)
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
  }
  // Fill in zeroes for missing days
  const signupChart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    return { date: key, signups: signupsByDay[key] ?? 0 }
  })

  // Credits used per day (last 30 days) → area chart
  const creditsByDay: Record<string, number> = {}
  for (const tx of creditUsage ?? []) {
    const day = tx.created_at.slice(0, 10)
    creditsByDay[day] = (creditsByDay[day] ?? 0) + tx.credits_deducted
  }
  const creditChart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    return { date: key, credits: creditsByDay[key] ?? 0 }
  })

  return NextResponse.json({
    kpis: {
      totalUsers,
      activeSubscribers,
      totalCreditsUsed,
      totalPostsGenerated,
      totalMrrCad: totalMrr / 100,
    },
    planBreakdown,
    creditsByType,
    postsBySource,
    signupChart,
    creditChart,
    recentEvents: recentEvents ?? [],
  })
}

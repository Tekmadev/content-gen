import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/users/[userId] — full profile + recent transactions
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const { userId } = await params
  const admin = createAdminClient()

  const [{ data: profile }, { data: transactions }, { data: posts }] = await Promise.all([
    admin.from('admin_user_stats').select('*').eq('user_id', userId).maybeSingle(),
    admin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('posts_log')
      .select('id, source_type, status, created_at, published_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({ profile, transactions: transactions ?? [], posts: posts ?? [] })
}

// PATCH /api/admin/users/[userId] — admin actions
// Body: { action, ...payload }
// Actions:
//   adjust_credits   { amount: number, notes: string }  — positive or negative delta
//   set_plan         { plan: string | null, status: string }
//   toggle_admin     { is_admin: boolean }
//   reset_onboarding {}
//   add_note         { notes: string }  — writes to credit_transactions as an adjustment record
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  const { userId } = await params
  const body = await request.json()
  const { action } = body
  const admin = createAdminClient()
  const now = new Date().toISOString()

  switch (action) {
    case 'adjust_credits': {
      const amount: number = body.amount ?? 0
      const notes: string = body.notes ?? ''

      const { data: profile } = await admin
        .from('user_profiles')
        .select('credits_used, total_credits_ever_used')
        .eq('user_id', userId)
        .maybeSingle()

      if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const newUsed = Math.max(0, (profile.credits_used ?? 0) + amount)
      const newEver = amount > 0
        ? (profile.total_credits_ever_used ?? 0) + amount
        : profile.total_credits_ever_used ?? 0

      await Promise.all([
        admin.from('user_profiles').update({
          credits_used: newUsed,
          total_credits_ever_used: newEver,
          updated_at: now,
        }).eq('user_id', userId),

        admin.from('credit_transactions').insert({
          user_id: userId,
          action_type: amount >= 0 ? 'adjustment' : 'refund',
          credits_deducted: amount,
          balance_after: newUsed,
          notes: `Admin: ${notes || (amount >= 0 ? 'credit added' : 'credit removed')}`,
        }),
      ])
      return NextResponse.json({ ok: true })
    }

    case 'set_plan': {
      const { plan, status } = body
      await admin.from('user_profiles').update({
        subscription_plan: plan ?? null,
        subscription_status: status ?? null,
        updated_at: now,
      }).eq('user_id', userId)
      return NextResponse.json({ ok: true })
    }

    case 'toggle_admin': {
      const { is_admin } = body
      await admin.from('user_profiles').update({
        is_admin: !!is_admin,
        updated_at: now,
      }).eq('user_id', userId)
      return NextResponse.json({ ok: true })
    }

    case 'reset_onboarding': {
      await admin.from('user_profiles').update({
        onboarding_completed: false,
        onboarding_step: 'welcome',
        updated_at: now,
      }).eq('user_id', userId)
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

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
//   grant_credits     { amount: number, notes: string }  — give N credits (decreases credits_used)
//   revoke_credits    { amount: number, notes: string }  — take N credits (increases credits_used)
//   set_credits_used  { value: number, notes: string }   — set exact value (e.g. 0 for full reset)
//   reset_credits     { notes: string }                  — shortcut: set credits_used = 0
//   set_plan          { plan: string | null, status: string }
//   toggle_admin      { is_admin: boolean }
//   reset_onboarding  {}
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

  /**
   * credits_used is the count of credits CONSUMED this billing period.
   * available = (plan_credits) - credits_used
   *
   * To GRANT credits → decrease credits_used (so they have more available)
   * To REVOKE credits → increase credits_used
   * To SET exactly → set credits_used to specific value
   *
   * All admin credit changes write a row to credit_transactions for audit.
   */
  async function applyCreditsDelta(
    delta: number,           // positive = grant (less used), negative = revoke (more used)
    actionType: 'adjustment' | 'refund',
    notes: string
  ) {
    const { data: profile } = await admin
      .from('user_profiles')
      .select('credits_used, total_credits_ever_used')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Granting (positive delta) DECREASES credits_used. Revoking INCREASES it.
    const newUsed = Math.max(0, (profile.credits_used ?? 0) - delta)

    await Promise.all([
      admin.from('user_profiles').update({
        credits_used: newUsed,
        updated_at: now,
      }).eq('user_id', userId),

      admin.from('credit_transactions').insert({
        user_id: userId,
        action_type: actionType,
        credits_deducted: -delta,  // store as deducted: negative for grant, positive for revoke
        balance_after: newUsed,
        notes: `Admin: ${notes}`,
      }),
    ])

    return NextResponse.json({ ok: true, credits_used: newUsed })
  }

  switch (action) {
    case 'grant_credits': {
      const amount: number = Math.abs(body.amount ?? 0)
      const notes: string = body.notes ?? `granted ${amount} credit${amount !== 1 ? 's' : ''}`
      if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })
      return applyCreditsDelta(amount, 'refund', notes)
    }

    case 'revoke_credits': {
      const amount: number = Math.abs(body.amount ?? 0)
      const notes: string = body.notes ?? `revoked ${amount} credit${amount !== 1 ? 's' : ''}`
      if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })
      return applyCreditsDelta(-amount, 'adjustment', notes)
    }

    case 'set_credits_used': {
      const value: number = Math.max(0, Math.floor(body.value ?? 0))
      const notes: string = body.notes ?? `set credits_used to ${value}`

      const { data: profile } = await admin
        .from('user_profiles')
        .select('credits_used')
        .eq('user_id', userId)
        .maybeSingle()

      if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      const oldUsed = profile.credits_used ?? 0

      await Promise.all([
        admin.from('user_profiles').update({
          credits_used: value,
          updated_at: now,
        }).eq('user_id', userId),

        admin.from('credit_transactions').insert({
          user_id: userId,
          action_type: 'adjustment',
          credits_deducted: value - oldUsed,  // delta from old → new
          balance_after: value,
          notes: `Admin: ${notes}`,
        }),
      ])
      return NextResponse.json({ ok: true, credits_used: value })
    }

    case 'reset_credits': {
      const notes: string = body.notes ?? 'monthly usage reset to 0'
      const { data: profile } = await admin
        .from('user_profiles')
        .select('credits_used')
        .eq('user_id', userId)
        .maybeSingle()
      if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      await Promise.all([
        admin.from('user_profiles').update({
          credits_used: 0,
          credits_reset_at: new Date(Date.now()).toISOString(),
          updated_at: now,
        }).eq('user_id', userId),

        admin.from('credit_transactions').insert({
          user_id: userId,
          action_type: 'refund',
          credits_deducted: -(profile.credits_used ?? 0),
          balance_after: 0,
          notes: `Admin: ${notes}`,
        }),
      ])
      return NextResponse.json({ ok: true, credits_used: 0 })
    }

    // Backward compat — old code/tests may still call adjust_credits with delta logic
    case 'adjust_credits': {
      const amount: number = body.amount ?? 0
      const notes: string = body.notes ?? ''
      if (amount === 0) return NextResponse.json({ error: 'Amount must not be 0' }, { status: 400 })
      // Old behavior: +amount means add to credits_used (revoke). Keep for compat.
      return applyCreditsDelta(-amount, amount >= 0 ? 'adjustment' : 'refund',
        notes || (amount >= 0 ? 'credit removed' : 'credit added'))
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

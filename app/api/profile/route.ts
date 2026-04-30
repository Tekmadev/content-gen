import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserProfile, CREDIT_COSTS } from '@/lib/user-profile'
import { getPlatformConfig } from '@/lib/platform-config'

export async function GET() {
  console.log('[profile] GET request received')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Read live plan credits + credit costs from platform_config (5-min cached)
  const { plan_credits, credit_costs } = await getPlatformConfig()

  const plan = profile.subscription_plan
  const totalCredits = plan ? (plan_credits[plan] ?? null) : null

  // Active add-on packs (unexpired, unrefunded, with credits remaining).
  // Used by /billing to show breakdown like "120 plan + 35 boost (expires Mar 1)".
  const admin = createAdminClient()
  const { data: addonPacks } = await admin
    .from('credit_addon_purchases')
    .select('id, pack_key, pack_size, credits_remaining, amount_cad_cents, expires_at, created_at')
    .eq('user_id', user.id)
    .gt('credits_remaining', 0)
    .is('refunded_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })

  const addonCredits = (addonPacks ?? []).reduce((sum, p) => sum + (p.credits_remaining ?? 0), 0)

  console.log('[profile] userId=%s plan=%s totalCredits=%s addonCredits=%d', user.id, plan, totalCredits, addonCredits)

  return NextResponse.json({
    profile,
    totalCredits,
    creditCosts: credit_costs ?? CREDIT_COSTS,
    addonCredits,
    addonPacks: addonPacks ?? [],
    email: user.email,
  })
}

// PATCH /api/profile — user-editable profile fields
// Currently only supports: starter_platform (the chosen platform for Starter tier)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { starter_platform } = body

  if (starter_platform !== undefined) {
    const valid = ['linkedin', 'instagram', 'x']
    if (starter_platform !== null && !valid.includes(starter_platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('user_profiles')
      .update({ starter_platform, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (error) {
      console.error('[profile PATCH] failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'No supported field provided' }, { status: 400 })
}

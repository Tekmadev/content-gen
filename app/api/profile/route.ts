import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  console.log('[profile] userId=%s plan=%s totalCredits=%s', user.id, plan, totalCredits)

  return NextResponse.json({
    profile,
    totalCredits,
    creditCosts: credit_costs ?? CREDIT_COSTS, // CREDIT_COSTS is the static fallback
    email: user.email,
  })
}

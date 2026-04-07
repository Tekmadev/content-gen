import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile, PLAN_CREDITS, CREDIT_COSTS } from '@/lib/user-profile'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const plan = profile.subscription_plan
  const totalCredits = plan ? PLAN_CREDITS[plan] : null

  return NextResponse.json({
    profile,
    totalCredits,
    creditCosts: CREDIT_COSTS,
    email: user.email,
  })
}

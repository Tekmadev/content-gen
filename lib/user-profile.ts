// Server-side helper — only use in API routes
import { createAdminClient } from '@/lib/supabase/admin'

export interface UserProfile {
  user_id: string
  onboarding_completed: boolean
  onboarding_step: string
  blotato_api_key: string | null
  stripe_customer_id: string | null
  subscription_plan: 'starter' | 'pro' | 'agency' | null
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | null
  subscription_period_end: string | null
  credits_used: number
  credits_reset_at: string
  total_posts_generated: number
  total_posts_published: number
  total_visuals_generated: number
  total_carousels_generated: number
  total_credits_ever_used: number
  last_active_at: string | null
  agreed_to_terms_at: string | null
}

// Monthly credits per plan
export const PLAN_CREDITS: Record<string, number> = {
  starter: 60,
  pro:     250,
  agency:  1000,
}

// Credits consumed per action type
export const CREDIT_COSTS = {
  post_gen:  1,
  visual:    3,
  carousel:  8,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data ?? null
}

export function getBlotatoKey(profile: UserProfile | null): string {
  const key = profile?.blotato_api_key
  if (key) return key
  const envKey = process.env.BLOTATO_API_KEY
  if (envKey) return envKey
  throw new Error('No Blotato API key configured. Please add your key in Settings → Blotato.')
}

export function hasActiveSubscription(profile: UserProfile | null): boolean {
  if (!profile) return false
  return profile.subscription_status === 'active' || profile.subscription_status === 'trialing'
}

// Returns null on success, or an error string if credits are insufficient.
// Also writes to credit_transactions (audit log) and updates aggregate counters.
export async function checkAndDeductCredits(
  userId: string,
  cost: number,
  action: CreditAction,
  draftId?: string
): Promise<string | null> {
  const admin = createAdminClient()
  const profile = await getUserProfile(userId)

  if (!profile) return 'User profile not found.'
  if (!hasActiveSubscription(profile)) return 'No active subscription. Please choose a plan to continue.'

  const plan = profile.subscription_plan
  if (!plan || !PLAN_CREDITS[plan]) return 'No active plan found.'

  const monthlyCredits = PLAN_CREDITS[plan]
  const now = new Date()
  const resetAt = new Date(profile.credits_reset_at)
  const needsReset =
    now.getFullYear() > resetAt.getFullYear() ||
    now.getMonth() > resetAt.getMonth()

  const currentUsed = needsReset ? 0 : (profile.credits_used ?? 0)

  if (currentUsed + cost > monthlyCredits) {
    const remaining = Math.max(0, monthlyCredits - currentUsed)
    return `Not enough credits. This action costs ${cost} credit${cost !== 1 ? 's' : ''} but you only have ${remaining} remaining this month. Upgrade your plan or wait until next month.`
  }

  const newUsed = currentUsed + cost

  // Build the profile update — aggregate counters + credits
  const profileUpdate: Record<string, unknown> = {
    credits_used: newUsed,
    total_credits_ever_used: (profile.total_credits_ever_used ?? 0) + cost,
    last_active_at: now.toISOString(),
    updated_at: now.toISOString(),
  }

  if (needsReset) {
    profileUpdate.credits_reset_at = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    profileUpdate.credits_used = cost  // reset to just this action's cost
  }

  // Increment the appropriate all-time counter
  if (action === 'post_gen')  profileUpdate.total_posts_generated  = (profile.total_posts_generated  ?? 0) + 1
  if (action === 'visual')    profileUpdate.total_visuals_generated = (profile.total_visuals_generated ?? 0) + 1
  if (action === 'carousel')  profileUpdate.total_carousels_generated = (profile.total_carousels_generated ?? 0) + 1

  // Run profile update + credit transaction insert in parallel
  const [profileResult] = await Promise.all([
    admin
      .from('user_profiles')
      .update(profileUpdate)
      .eq('user_id', userId),

    admin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        action_type: action,
        credits_deducted: cost,
        balance_after: needsReset ? cost : newUsed,
        plan_at_time: plan,
        draft_id: draftId ?? null,
      }),
  ])

  if (profileResult.error) {
    console.error('[checkAndDeductCredits] Profile update failed:', profileResult.error.message)
  }

  return null
}

// Record a user behavioral event (fire-and-forget, never blocks the request)
export async function trackEvent(
  userId: string,
  eventType: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('user_events')
    .insert({ user_id: userId, event_type: eventType, properties })
    .then(({ error }) => {
      if (error) console.error('[trackEvent] Failed:', eventType, error.message)
    })
}

// Increment the published post counter + update last_published_at
export async function recordPostPublished(userId: string): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('total_posts_published')
    .eq('user_id', userId)
    .maybeSingle()
  await admin
    .from('user_profiles')
    .update({
      total_posts_published: (profile?.total_posts_published ?? 0) + 1,
      last_published_at: now,
      last_active_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
}

// Server-side helper — only use in API routes
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformConfig } from '@/lib/platform-config'

export interface UserProfile {
  user_id: string
  onboarding_completed: boolean
  onboarding_step: string
  blotato_api_key: string | null
  stripe_customer_id: string | null
  subscription_plan: 'starter' | 'creator' | 'pro' | 'agency' | null
  starter_platform: 'linkedin' | 'instagram' | 'x' | null
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
  is_admin: boolean
}

/**
 * Static fallback values — used only when platform config is unavailable.
 * Live values come from `platform_config` table via getPlatformConfig().
 * Never reference these directly in business logic — use getPlatformConfig() instead.
 */
const FALLBACK_PLAN_CREDITS: Record<string, number> = { starter: 120, creator: 350, pro: 800, agency: 2200 }
const FALLBACK_CREDIT_COSTS = { post_gen: 1, visual: 3, carousel: 8 }

/**
 * Kept for backward compatibility (e.g., billing page credit-cost display).
 * Prefer calling getPlatformConfig().credit_costs for live values.
 */
export const CREDIT_COSTS = FALLBACK_CREDIT_COSTS

export type CreditAction = keyof typeof FALLBACK_CREDIT_COSTS

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

/**
 * Sum of all unexpired, unrefunded add-on credits a user has.
 * Counts only credit_addon_purchases.credits_remaining where expires_at > now()
 * and refunded_at is NULL.
 */
export async function getAddonCreditsBalance(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('credit_addon_purchases')
    .select('credits_remaining')
    .eq('user_id', userId)
    .gt('credits_remaining', 0)
    .is('refunded_at', null)
    .gt('expires_at', new Date().toISOString())

  return (data ?? []).reduce((sum, row) => sum + (row.credits_remaining ?? 0), 0)
}

/**
 * Returns null on success, or an error string if credits are insufficient.
 *
 * Burn order:
 *   1. Subscription credits (credits_used vs plan_credits)
 *   2. Add-on packs (oldest expiry first → FIFO so users don't lose credits to expiration)
 *
 * Writes credit_transactions audit row + decrements credit_addon_purchases when add-ons are used.
 */
export async function checkAndDeductCredits(
  userId: string,
  cost: number,
  action: CreditAction,
  draftId?: string
): Promise<string | null> {
  const admin = createAdminClient()
  const profile = await getUserProfile(userId)

  if (!profile) return 'User profile not found.'

  // Admins bypass subscription and credit checks entirely
  if (profile.is_admin) return null

  if (!hasActiveSubscription(profile)) return 'No active subscription. Please choose a plan to continue.'

  const plan = profile.subscription_plan
  if (!plan) return 'No active plan found.'

  // Read live plan credits from config (5-min cached); fall back to static values
  const { plan_credits } = await getPlatformConfig()
  const monthlyCredits = plan_credits[plan] ?? FALLBACK_PLAN_CREDITS[plan]
  if (!monthlyCredits) return 'No active plan found.'

  const now = new Date()
  const resetAt = new Date(profile.credits_reset_at)
  const needsReset =
    now.getFullYear() > resetAt.getFullYear() ||
    now.getMonth() > resetAt.getMonth()

  const currentUsed = needsReset ? 0 : (profile.credits_used ?? 0)
  const subscriptionAvailable = Math.max(0, monthlyCredits - currentUsed)

  // ── Plan credits cover the whole cost — fast path, no add-on lookup ──
  if (cost <= subscriptionAvailable) {
    const newUsed = currentUsed + cost

    const profileUpdate: Record<string, unknown> = {
      credits_used: newUsed,
      total_credits_ever_used: (profile.total_credits_ever_used ?? 0) + cost,
      last_active_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
    if (needsReset) {
      profileUpdate.credits_reset_at = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      profileUpdate.credits_used = cost
    }

    // Bump all-time per-action counters
    if (action === 'post_gen')  profileUpdate.total_posts_generated  = (profile.total_posts_generated  ?? 0) + 1
    if (action === 'visual')    profileUpdate.total_visuals_generated = (profile.total_visuals_generated ?? 0) + 1
    if (action === 'carousel')  profileUpdate.total_carousels_generated = (profile.total_carousels_generated ?? 0) + 1

    const [profileResult] = await Promise.all([
      admin.from('user_profiles').update(profileUpdate).eq('user_id', userId),
      admin.from('credit_transactions').insert({
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

  // ── Plan credits don't cover the cost — try to make up with add-ons ──
  const addonShortfall = cost - subscriptionAvailable

  // Pull active add-on packs ordered by oldest expiry first (burn FIFO)
  const { data: packs } = await admin
    .from('credit_addon_purchases')
    .select('id, credits_remaining, expires_at')
    .eq('user_id', userId)
    .gt('credits_remaining', 0)
    .is('refunded_at', null)
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: true })

  const addonAvailable = (packs ?? []).reduce((sum, p) => sum + (p.credits_remaining ?? 0), 0)

  if (addonAvailable < addonShortfall) {
    const totalAvailable = subscriptionAvailable + addonAvailable
    return `Not enough credits. This action costs ${cost} credit${cost !== 1 ? 's' : ''} but you only have ${totalAvailable} remaining (${subscriptionAvailable} from your plan, ${addonAvailable} from add-ons). Upgrade your plan or buy a credit pack.`
  }

  // Drain the subscription first (max it out)
  const newUsed = currentUsed + subscriptionAvailable

  const profileUpdate: Record<string, unknown> = {
    credits_used: needsReset ? subscriptionAvailable : newUsed,
    total_credits_ever_used: (profile.total_credits_ever_used ?? 0) + cost,
    last_active_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  if (needsReset) {
    profileUpdate.credits_reset_at = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  if (action === 'post_gen')  profileUpdate.total_posts_generated  = (profile.total_posts_generated  ?? 0) + 1
  if (action === 'visual')    profileUpdate.total_visuals_generated = (profile.total_visuals_generated ?? 0) + 1
  if (action === 'carousel')  profileUpdate.total_carousels_generated = (profile.total_carousels_generated ?? 0) + 1

  // Drain add-on packs FIFO until shortfall is covered
  let remainingShortfall = addonShortfall
  const packUpdates: { id: string; credits_remaining: number }[] = []
  for (const pack of packs ?? []) {
    if (remainingShortfall <= 0) break
    const burn = Math.min(pack.credits_remaining ?? 0, remainingShortfall)
    packUpdates.push({ id: pack.id, credits_remaining: (pack.credits_remaining ?? 0) - burn })
    remainingShortfall -= burn
  }

  // Apply all updates in parallel
  await Promise.all([
    admin.from('user_profiles').update(profileUpdate).eq('user_id', userId),
    ...packUpdates.map((u) =>
      admin.from('credit_addon_purchases')
        .update({ credits_remaining: u.credits_remaining })
        .eq('id', u.id)
    ),
    admin.from('credit_transactions').insert({
      user_id: userId,
      action_type: action,
      credits_deducted: cost,
      balance_after: needsReset ? subscriptionAvailable : newUsed,
      plan_at_time: plan,
      draft_id: draftId ?? null,
      notes: `${subscriptionAvailable} from plan, ${addonShortfall} from add-ons`,
    }),
  ])

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

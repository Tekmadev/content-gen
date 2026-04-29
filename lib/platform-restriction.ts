/**
 * Platform restriction logic for the Starter tier.
 *
 * Starter is "1 platform of choice" — user picks LinkedIn, Instagram, or X
 * during onboarding (or in Settings → Brand) and can only generate/publish
 * to that platform. All other tiers (Creator / Pro / Agency) get all three.
 *
 * The chosen platform is stored on user_profiles.starter_platform, which is
 * only read when subscription_plan === 'starter'. It's ignored on other plans.
 */

import type { UserProfile } from './user-profile'

export type Platform = 'linkedin' | 'instagram' | 'x'

export const ALL_PLATFORMS: Platform[] = ['linkedin', 'instagram', 'x']

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin:  'LinkedIn',
  instagram: 'Instagram',
  x:         'X',
}

/** Default for legacy Starter users who haven't picked a platform yet. */
const STARTER_DEFAULT: Platform = 'linkedin'

/**
 * Returns the list of platforms a user is allowed to generate/publish to.
 * Starter → only their chosen platform.
 * Creator/Pro/Agency → all three.
 * No plan / unknown → all three (UI/middleware gates them elsewhere).
 */
export function getAllowedPlatforms(profile: UserProfile | null | undefined): Platform[] {
  if (!profile) return [...ALL_PLATFORMS]
  if (profile.is_admin) return [...ALL_PLATFORMS]
  if (profile.subscription_plan === 'starter') {
    const chosen = profile.starter_platform ?? STARTER_DEFAULT
    return [chosen]
  }
  return [...ALL_PLATFORMS]
}

/** Returns true if the user can use this specific platform. */
export function canUsePlatform(
  profile: UserProfile | null | undefined,
  platform: Platform
): boolean {
  return getAllowedPlatforms(profile).includes(platform)
}

/** True when restrictions actually apply (i.e. Starter tier). */
export function isPlatformRestricted(profile: UserProfile | null | undefined): boolean {
  if (!profile || profile.is_admin) return false
  return profile.subscription_plan === 'starter'
}

/** Filters a platforms object/array down to what the user is allowed to use. */
export function filterToAllowedPlatforms<T extends Partial<Record<Platform, unknown>>>(
  profile: UserProfile | null | undefined,
  platforms: T
): T {
  const allowed = new Set(getAllowedPlatforms(profile))
  const out = {} as T
  for (const key of Object.keys(platforms) as Platform[]) {
    if (allowed.has(key)) {
      ;(out as Record<string, unknown>)[key] = platforms[key]
    }
  }
  return out
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Allowed enum values — must match user_profiles CHECK constraints.
const CREATOR_TYPES = ['solo','agency','brand','business','hobbyist','other'] as const
const PLATFORMS     = ['instagram','linkedin','tiktok','x','youtube','facebook'] as const

type OneOf<T extends readonly string[]> = T[number]
function pickEnum<T extends readonly string[]>(value: unknown, allowed: T): OneOf<T> | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as OneOf<T>)
    : null
}

// Saves the answers from the "About you" onboarding step. Idempotent — the
// user can hit Back/Continue multiple times without piling up rows.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const brandName       = typeof body.brand_name === 'string' ? body.brand_name.trim().slice(0, 200) : ''
  const creatorType     = pickEnum(body.creator_type,     CREATOR_TYPES)
  const primaryPlatform = pickEnum(body.primary_platform, PLATFORMS)
  const goalsRaw        = Array.isArray(body.goals) ? body.goals : []
  const goals = goalsRaw
    .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    .map((g) => g.trim().slice(0, 80))
    .slice(0, 10)

  // Surface a clear validation error so the UI can show it inline.
  if (!brandName)        return NextResponse.json({ error: 'brand_name is required' }, { status: 400 })
  if (!creatorType)      return NextResponse.json({ error: 'creator_type is required' }, { status: 400 })
  if (!primaryPlatform)  return NextResponse.json({ error: 'primary_platform is required' }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Persist on user_profiles (single source of truth) — upsert because the
  // row may not exist yet right after signup.
  const { error: profileErr } = await admin
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        brand_name: brandName,
        creator_type: creatorType,
        primary_platform: primaryPlatform,
        goals,
        // Default the Starter platform to whatever they picked — Starter is
        // capped to 1 of 3 (instagram/linkedin/x). Other platforms map to
        // instagram as a sensible default and the user can change it later.
        starter_platform:
          primaryPlatform === 'linkedin' ? 'linkedin' :
          primaryPlatform === 'x'        ? 'x' :
          'instagram',
        onboarding_persona_at: now,
        onboarding_step: 'plan',
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )

  if (profileErr) {
    console.error('[onboarding/save-profile] upsert failed:', profileErr.message)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  // Also seed brand_settings with the brand name so the Brand page has
  // something filled in already. This is a soft set — if the row exists
  // and already has a brand_name, leave it alone.
  const { data: existingBrand } = await admin
    .from('brand_settings')
    .select('user_id, brand_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existingBrand) {
    await admin.from('brand_settings').insert({ user_id: user.id, brand_name: brandName })
  } else if (!existingBrand.brand_name) {
    await admin.from('brand_settings').update({ brand_name: brandName }).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}

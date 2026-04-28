/**
 * /api/admin/config
 *
 * GET  — returns the full platform config (all 4 sections merged with defaults)
 * POST — upserts one or more config sections, then invalidates the server cache
 *
 * Protected: caller must be an authenticated admin (is_admin = true in user_profiles).
 *
 * Body for POST:
 *   { section: "models" | "credit_costs" | "plan_credits" | "api_cost_estimates", value: {...} }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformConfig, invalidateConfigCache } from '@/lib/platform-config'
import { getUserProfile } from '@/lib/user-profile'

// ── Auth guard — reused by GET and POST ───────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getUserProfile(user.id)
  if (!profile?.is_admin) return null

  return user
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getPlatformConfig()
  return NextResponse.json(config)
}

// ── POST ───────────────────────────────────────────────────────────────────

const ALLOWED_SECTIONS = ['models', 'credit_costs', 'plan_credits', 'api_cost_estimates'] as const
type Section = typeof ALLOWED_SECTIONS[number]

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { section: Section; value: Record<string, unknown> } = await request.json()

  if (!ALLOWED_SECTIONS.includes(body.section)) {
    return NextResponse.json(
      { error: `Invalid section. Allowed: ${ALLOWED_SECTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  if (!body.value || typeof body.value !== 'object') {
    return NextResponse.json({ error: 'value must be an object' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Merge new values over existing ones (partial update support)
  const { data: existing } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', body.section)
    .maybeSingle()

  const merged = { ...(existing?.value ?? {}), ...body.value }

  const { error } = await admin
    .from('platform_config')
    .upsert(
      {
        key:        body.section,
        value:      merged,
        updated_by: user.email ?? user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Immediately clear the in-memory cache so next request reads fresh values
  invalidateConfigCache()

  return NextResponse.json({ ok: true, section: body.section, value: merged })
}

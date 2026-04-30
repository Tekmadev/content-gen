import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Allowed categorical values — must match the CHECK constraints in the DB.
const CATEGORIES        = ['bug','feature_request','usability','praise','complaint','question','other'] as const
const SEVERITIES        = ['low','medium','high','critical'] as const
const FEATURE_AREAS     = ['carousel','posts','brand','billing','auth','dashboard','other'] as const
const DEVICE_TYPES      = ['mobile','tablet','desktop'] as const
const USAGE_FREQUENCIES = ['daily','weekly','monthly','rarely'] as const
const CREATOR_TYPES     = ['solo','agency','brand','business','hobbyist','other'] as const

type OneOf<T extends readonly string[]> = T[number]

function pickEnum<T extends readonly string[]>(value: unknown, allowed: T): OneOf<T> | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as OneOf<T>)
    : null
}

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

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (message.length > 5000) return NextResponse.json({ error: 'Message too long (max 5000)' }, { status: 400 })

  // Resolve IP from request headers (works on Vercel + reverse proxies)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  // Look up subscription_plan as a snapshot — so we can analyze feedback by tier
  // even after the user changes plans. Single non-blocking query.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle()

  // Numeric coercion + bounds (defense against bad client input)
  const ratingRaw = Number(body.rating)
  const rating = Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? Math.trunc(ratingRaw) : null
  const npsRaw  = Number(body.nps_score)
  const nps     = Number.isFinite(npsRaw) && npsRaw >= 0 && npsRaw <= 10 ? Math.trunc(npsRaw) : null
  const vw      = Number(body.viewport_width)
  const vh      = Number(body.viewport_height)

  const { error } = await admin.from('feedback').insert({
    user_id:            user.id,
    email:              user.email ?? null,
    name:               typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
    message,
    rating,
    user_agent:         userAgent,
    platform:           typeof body.platform === 'string' ? body.platform : null,
    screen_size:        typeof body.screen_size === 'string' ? body.screen_size : (typeof body.screenSize === 'string' ? body.screenSize : null),
    language:           typeof body.language === 'string' ? body.language : null,
    timezone:           typeof body.timezone === 'string' ? body.timezone : null,
    referrer:           typeof body.referrer === 'string' ? body.referrer : null,
    ip_address:         ip,
    // ── Smart-form fields ──────────────────────────────────────────────
    category:           pickEnum(body.category,         CATEGORIES),
    severity:           pickEnum(body.severity,         SEVERITIES),
    feature_area:       pickEnum(body.feature_area,     FEATURE_AREAS),
    device_type:        pickEnum(body.device_type,      DEVICE_TYPES),
    usage_frequency:    pickEnum(body.usage_frequency,  USAGE_FREQUENCIES),
    creator_type:       pickEnum(body.creator_type,     CREATOR_TYPES),
    viewport_width:     Number.isFinite(vw) && vw > 0 && vw < 10000 ? Math.trunc(vw) : null,
    viewport_height:    Number.isFinite(vh) && vh > 0 && vh < 10000 ? Math.trunc(vh) : null,
    subscription_plan:  profile?.subscription_plan ?? null,
    current_url:        typeof body.current_url === 'string' ? body.current_url.slice(0, 500) : null,
    expected_behavior:  typeof body.expected_behavior === 'string' ? body.expected_behavior.slice(0, 2000) : null,
    actual_behavior:    typeof body.actual_behavior === 'string' ? body.actual_behavior.slice(0, 2000) : null,
    steps_to_reproduce: typeof body.steps_to_reproduce === 'string' ? body.steps_to_reproduce.slice(0, 2000) : null,
    desired_outcome:    typeof body.desired_outcome === 'string' ? body.desired_outcome.slice(0, 2000) : null,
    would_pay_for:      typeof body.would_pay_for === 'boolean' ? body.would_pay_for : null,
    nps_score:          nps,
    contact_back:       typeof body.contact_back === 'boolean' ? body.contact_back : null,
    app_version:        typeof body.app_version === 'string' ? body.app_version.slice(0, 100) : null,
    status:             'new',
  })

  if (error) {
    console.error('[feedback] Insert error:', error.message, error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

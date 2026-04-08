import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, message, rating, platform, screenSize, language, timezone, referrer } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Resolve IP from request headers (works on Vercel + any reverse proxy)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    null

  const userAgent = request.headers.get('user-agent') || null

  const admin = createAdminClient()
  const { error } = await admin.from('feedback').insert({
    user_id:     user.id,
    email:       user.email ?? null,
    name:        name?.trim() || null,
    message:     message.trim(),
    rating:      rating ?? null,
    user_agent:  userAgent,
    platform:    platform ?? null,
    screen_size: screenSize ?? null,
    language:    language ?? null,
    timezone:    timezone ?? null,
    referrer:    referrer ?? null,
    ip_address:  ip,
  })

  if (error) {
    console.error('[feedback] Insert error:', error.message)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BrandBrief } from '@/lib/types'

// ── GET — load current user's brand brief ────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('brand_briefs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// ── POST — merge-upsert brand brief (partial updates supported) ───────────────
//
// Reads the existing row, merges the patch over it, then upserts.
// This means callers can send just { chat_history } without wiping other fields.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Partial<BrandBrief> = await request.json()

  // Fetch the existing brief so we can merge instead of replace
  const { data: existing } = await supabase
    .from('brand_briefs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Helper: prefer body[key] if explicitly set, otherwise keep existing, otherwise default
  const pick = <T,>(key: keyof BrandBrief, fallback: T): T => {
    if (body[key] !== undefined) return body[key] as T
    if (existing && existing[key] !== undefined && existing[key] !== null) return existing[key] as T
    return fallback
  }

  const payload = {
    user_id:              user.id,
    business_name:        pick('business_name',        ''),
    tagline:              pick('tagline',              ''),
    founded:              pick('founded',              ''),
    location:             pick('location',             ''),
    website:              pick('website',              ''),
    business_description: pick('business_description', ''),
    mission:              pick('mission',              ''),
    audiences:            pick('audiences',            [] as BrandBrief['audiences']),
    personality_words:    pick('personality_words',    [] as string[]),
    tone_of_voice:        pick('tone_of_voice',        ''),
    brand_character:      pick('brand_character',      ''),
    services:             pick('services',             [] as BrandBrief['services']),
    unique_value:         pick('unique_value',         ''),
    content_pillars:      pick('content_pillars',      [] as string[]),
    content_goals:        pick('content_goals',        ''),
    always_say:           pick('always_say',           [] as string[]),
    never_say:            pick('never_say',            [] as string[]),
    example_phrases:      pick('example_phrases',      [] as string[]),
    reference_images:     pick('reference_images',     [] as string[]),
    generated_brief:      pick('generated_brief',      ''),
    brief_generated_at:   pick('brief_generated_at',   null as string | null),
    chat_history:         pick('chat_history',         [] as BrandBrief['chat_history']),
    chat_completed:       pick('chat_completed',       false),
    updated_at:           new Date().toISOString(),
  }

  const { error } = await supabase
    .from('brand_briefs')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    console.error('[brand-brief POST] upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

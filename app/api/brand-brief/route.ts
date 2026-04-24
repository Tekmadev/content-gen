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

// ── POST — upsert structured brand brief fields ───────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Partial<BrandBrief> = await request.json()

  const payload = {
    user_id:              user.id,
    business_name:        body.business_name        ?? '',
    tagline:              body.tagline               ?? '',
    founded:              body.founded               ?? '',
    location:             body.location              ?? '',
    website:              body.website               ?? '',
    business_description: body.business_description ?? '',
    mission:              body.mission               ?? '',
    audiences:            body.audiences             ?? [],
    personality_words:    body.personality_words     ?? [],
    tone_of_voice:        body.tone_of_voice         ?? '',
    brand_character:      body.brand_character       ?? '',
    services:             body.services              ?? [],
    unique_value:         body.unique_value          ?? '',
    content_pillars:      body.content_pillars       ?? [],
    content_goals:        body.content_goals         ?? '',
    always_say:           body.always_say            ?? [],
    never_say:            body.never_say             ?? [],
    example_phrases:      body.example_phrases       ?? [],
    reference_images:     body.reference_images      ?? [],
    generated_brief:      body.generated_brief       ?? '',
    brief_generated_at:   body.brief_generated_at    ?? null,
    chat_history:         body.chat_history          ?? [],
    chat_completed:       body.chat_completed        ?? false,
    updated_at:           new Date().toISOString(),
  }

  const { error } = await supabase
    .from('brand_briefs')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

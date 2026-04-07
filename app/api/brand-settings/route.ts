import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BrandSettings } from '@/lib/types'

// ── GET — load current user's brand settings ────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('brand_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return defaults if no row yet
  return NextResponse.json(data ?? defaultBrandSettings())
}

// ── POST — upsert brand settings ────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Partial<BrandSettings> = await request.json()

  const settings: BrandSettings & { user_id: string; updated_at: string } = {
    user_id: user.id,
    primary_color:    body.primary_color    ?? '#000000',
    secondary_color:  body.secondary_color  ?? '#ffffff',
    accent_color:     body.accent_color     ?? '#F97316',
    background_color: body.background_color ?? '#ffffff',
    text_color:       body.text_color       ?? '#111111',
    font_family:      body.font_family      ?? 'Inter',
    brand_name:       body.brand_name       ?? '',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('brand_settings')
    .upsert(settings, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(settings)
}

function defaultBrandSettings(): BrandSettings {
  return {
    primary_color:    '#000000',
    secondary_color:  '#ffffff',
    accent_color:     '#F97316',
    background_color: '#ffffff',
    text_color:       '#111111',
    font_family:      'Inter',
    brand_name:       '',
  }
}

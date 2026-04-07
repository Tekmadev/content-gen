import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey }: { apiKey: string } = await request.json()
  if (!apiKey?.trim()) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .upsert(
      { user_id: user.id, blotato_api_key: apiKey.trim(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

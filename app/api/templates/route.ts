import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listTemplates } from '@/lib/blotato'
import { getUserProfile, getBlotatoKey } from '@/lib/user-profile'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getUserProfile(user.id)
  const blotatoKey = getBlotatoKey(profile)

  const templates = await listTemplates(blotatoKey)
  return NextResponse.json(templates)
}

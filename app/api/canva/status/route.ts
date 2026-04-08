// Returns whether the current user has a connected Canva account.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabase
    .from('canva_tokens')
    .select('expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })

  const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false
  return NextResponse.json({ connected: !expired, expires_at: data.expires_at })
}

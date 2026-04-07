import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { apiKey }: { apiKey: string } = await request.json()
  if (!apiKey?.trim()) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  // Validate by calling Blotato /users/me/accounts — if it returns 200, key is valid
  try {
    const res = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
      headers: {
        'Content-Type': 'application/json',
        'blotato-api-key': apiKey.trim(),
      },
    })

    if (res.ok) {
      return NextResponse.json({ valid: true })
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ valid: false, error: 'Invalid API key — please check your Blotato dashboard.' }, { status: 400 })
    }

    return NextResponse.json({ valid: false, error: `Blotato returned status ${res.status}` }, { status: 400 })
  } catch {
    return NextResponse.json({ valid: false, error: 'Could not reach Blotato — check your internet connection.' }, { status: 500 })
  }
}

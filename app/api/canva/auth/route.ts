// Canva Connect OAuth 2.0 with PKCE — Step 1: Initiate authorization
// Generates a code verifier + challenge, stores them in cookies, then
// redirects the user to Canva's authorization page.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize'
const CANVA_SCOPES = 'design:content:read design:content:write asset:read asset:write export:read'

function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const array = new Uint8Array(96)
  crypto.getRandomValues(array)
  return Array.from(array, (v) => chars[v % chars.length]).join('')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.CANVA_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'CANVA_CLIENT_ID is not configured' }, { status: 500 })

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = crypto.randomUUID()

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/canva/callback`

  // Store PKCE verifier + state in short-lived HTTP-only cookies
  const cookieStore = await cookies()
  cookieStore.set('canva_code_verifier', codeVerifier, { httpOnly: true, maxAge: 300, path: '/' })
  cookieStore.set('canva_state', state, { httpOnly: true, maxAge: 300, path: '/' })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: CANVA_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return NextResponse.redirect(`${CANVA_AUTH_URL}?${params.toString()}`)
}

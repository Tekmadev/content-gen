// Canva Connect OAuth 2.0 — Step 2: Handle authorization callback
// Exchanges the code for tokens and stores them in Supabase.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[canva/callback] OAuth error:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=no_code`)
  }

  // Validate PKCE state + retrieve code verifier from cookies
  const cookieStore = await cookies()
  const storedState = cookieStore.get('canva_state')?.value
  const codeVerifier = cookieStore.get('canva_code_verifier')?.value

  if (!storedState || storedState !== returnedState) {
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=invalid_state`)
  }

  if (!codeVerifier) {
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=missing_verifier`)
  }

  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=missing_credentials`)
  }

  // Exchange code for access token
  const redirectUri = `${APP_URL}/api/canva/callback`
  try {
    const tokenRes = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('[canva/callback] Token exchange failed:', errText)
      return NextResponse.redirect(`${APP_URL}/carousel?canva_error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Store tokens in Supabase (service-role — bypasses RLS)
    const adminSupabase = createAdminClient()
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    await adminSupabase
      .from('canva_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token,
          refresh_token: refresh_token ?? null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    // Clear PKCE cookies
    cookieStore.delete('canva_state')
    cookieStore.delete('canva_code_verifier')

    return NextResponse.redirect(`${APP_URL}/carousel?canva=connected`)
  } catch (err) {
    console.error('[canva/callback] Unexpected error:', err)
    return NextResponse.redirect(`${APP_URL}/carousel?canva_error=unexpected`)
  }
}

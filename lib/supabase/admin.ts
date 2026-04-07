import { createClient } from '@supabase/supabase-js'

// Service-role client — ONLY use in server-side code (API routes).
// Bypasses RLS completely. Never expose to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

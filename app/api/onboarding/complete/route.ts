import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { trackEvent } from '@/lib/user-profile'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        onboarding_completed: true,
        onboarding_step: 'completed',
        agreed_to_terms_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  trackEvent(user.id, 'onboarding_completed')

  return NextResponse.json({ ok: true })
}

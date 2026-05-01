import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GDPR / PIPEDA — right to data portability. Returns every row tied to the
// authenticated user as a single JSON file the user can download.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch all user-owned tables in parallel. New tables added to the app
  // should be added here too.
  const [
    profile, brandSettings, brandBriefs, postsLog, carouselJobs,
    feedback, creditTx, addonPurchases,
  ] = await Promise.all([
    admin.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('brand_settings').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('brand_briefs').select('*').eq('user_id', user.id),
    admin.from('posts_log').select('*').eq('user_id', user.id),
    admin.from('carousel_jobs').select('*').eq('user_id', user.id),
    admin.from('feedback').select('*').eq('user_id', user.id),
    admin.from('credit_transactions').select('*').eq('user_id', user.id),
    admin.from('credit_addon_purchases').select('*').eq('user_id', user.id),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    user: {
      id:         user.id,
      email:      user.email,
      created_at: user.created_at,
    },
    profile:                profile.data         ?? null,
    brand_settings:         brandSettings.data   ?? null,
    brand_briefs:           brandBriefs.data     ?? [],
    posts_log:              postsLog.data        ?? [],
    carousel_jobs:          carouselJobs.data    ?? [],
    feedback:               feedback.data        ?? [],
    credit_transactions:    creditTx.data        ?? [],
    credit_addon_purchases: addonPurchases.data  ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="content-manager-export-${user.id}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

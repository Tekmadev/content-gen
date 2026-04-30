import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin-only: list carousel jobs across ALL users with full metadata.
// Supports basic filtering and pagination so the dashboard stays fast as
// the table grows.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit  = Math.min(Number(searchParams.get('limit')  ?? 50), 200)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0)
  const userIdFilter   = searchParams.get('user_id')
  const generatorFilter = searchParams.get('image_generator')
  const modeFilter     = searchParams.get('mode')

  let query = admin
    .from('carousel_jobs')
    .select(`
      id, user_id, draft_id, job_id, created_at, platform, mode, viral_mode,
      style, aspect_ratio, image_generator, caption, slides, content_preview,
      full_content, num_slides, additional_info, aim_image_url, include_logo,
      density, canva_template_id, brand_override, credits_used,
      generation_duration_ms, storage_error_count, storage_errors
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userIdFilter)    query = query.eq('user_id', userIdFilter)
  if (generatorFilter) query = query.eq('image_generator', generatorFilter)
  if (modeFilter)      query = query.eq('mode', modeFilter)

  const { data: jobs, error, count } = await query
  if (error) {
    console.error('[admin/carousel-jobs] fetch failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with user email for display. Single batch lookup keeps it fast.
  const userIds = Array.from(new Set((jobs ?? []).map((j) => j.user_id)))
  const userEmailMap: Record<string, string> = {}
  if (userIds.length > 0) {
    // auth.users is admin-only; createAdminClient uses the service role.
    for (const uid of userIds) {
      const { data: { user: u } } = await admin.auth.admin.getUserById(uid)
      if (u?.email) userEmailMap[uid] = u.email
    }
  }

  const enriched = (jobs ?? []).map((j) => ({
    ...j,
    user_email: userEmailMap[j.user_id] ?? null,
  }))

  return NextResponse.json({
    jobs: enriched,
    total: count ?? 0,
    limit,
    offset,
  })
}

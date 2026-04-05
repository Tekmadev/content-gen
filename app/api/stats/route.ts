import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  const [total, published, ready, failed, generating] = await Promise.all([
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'published'),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'ready'),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'failed'),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['generating', 'publishing']),
  ])

  // Count per-platform publishes
  const [liCount, igCount, xCount] = await Promise.all([
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).not('linkedin_url', 'is', null),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).not('instagram_url', 'is', null),
    supabase.from('posts_log').select('*', { count: 'exact', head: true }).eq('user_id', uid).not('x_url', 'is', null),
  ])

  return NextResponse.json({
    total: total.count ?? 0,
    published: published.count ?? 0,
    ready: ready.count ?? 0,
    failed: failed.count ?? 0,
    generating: generating.count ?? 0,
    platforms: {
      linkedin: liCount.count ?? 0,
      instagram: igCount.count ?? 0,
      x: xCount.count ?? 0,
    },
  })
}

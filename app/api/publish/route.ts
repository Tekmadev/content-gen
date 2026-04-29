import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishPost, pollPost } from '@/lib/blotato'
import { getUserProfile, getBlotatoKey, recordPostPublished, trackEvent } from '@/lib/user-profile'
import { getAllowedPlatforms, filterToAllowedPlatforms, isPlatformRestricted, PLATFORM_LABELS } from '@/lib/platform-restriction'

export const maxDuration = 60
import { appendLog } from '@/lib/posts-log'
import type { PostLogEntry, SourceType } from '@/lib/types'

interface PublishRequest {
  draftId: string
  platforms: {
    linkedin?: { accountId: string; pageId?: string; text: string; visualUrl?: string }
    instagram?: { accountId: string; text: string; visualUrl?: string }
    x?: { accountId: string; text: string; visualUrl?: string }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: PublishRequest = await request.json()
  const { draftId, platforms } = body

  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  const profile = await getUserProfile(user.id)
  const blotatoKey = getBlotatoKey(profile)

  // ── Platform restriction (Starter tier) ─────────────────────────────
  // Block publishes to platforms the user's plan doesn't allow.
  // For Starter, only their chosen platform (linkedin/instagram/x) goes through.
  const allowedSet = new Set(getAllowedPlatforms(profile))
  const requestedPlatforms = Object.keys(platforms ?? {}) as ('linkedin' | 'instagram' | 'x')[]
  const blocked = requestedPlatforms.filter((p) => !allowedSet.has(p))

  if (blocked.length > 0 && isPlatformRestricted(profile)) {
    const blockedLabels = blocked.map((p) => PLATFORM_LABELS[p]).join(', ')
    const allowedLabels = [...allowedSet].map((p) => PLATFORM_LABELS[p]).join(', ')
    return NextResponse.json(
      {
        error: `Your Starter plan only allows publishing to ${allowedLabels}. Upgrade to Creator to unlock ${blockedLabels}.`,
        blocked,
        allowed: [...allowedSet],
        upgradeUrl: '/billing',
      },
      { status: 403 }
    )
  }

  // Strip any disallowed platforms from the request (defensive — shouldn't hit
  // due to the early return above, but keeps the rest of the handler safe).
  const safePlatforms = filterToAllowedPlatforms(profile, platforms)

  await supabase.from('posts_log').update({ status: 'publishing' }).eq('id', draftId)

  const results: Record<string, { submissionId?: string; url?: string; error?: string }> = {}

  // Publish to each platform in parallel
  await Promise.all([
    safePlatforms.linkedin && (async () => {
      const { accountId, pageId, text, visualUrl } = safePlatforms.linkedin!
      const submissionId = await publishPost({
        platform: 'linkedin',
        accountId,
        pageId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
      }, blotatoKey).catch((err: Error) => { results.linkedin = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId, 120_000, blotatoKey).catch((err: Error) => {
          results.linkedin = { error: err.message }
          return null
        })
        results.linkedin = { submissionId, url: result?.url }
      }
    })(),

    safePlatforms.instagram && (async () => {
      const { accountId, text, visualUrl } = safePlatforms.instagram!
      const submissionId = await publishPost({
        platform: 'instagram',
        accountId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
        mediaType: 'IMAGE',
        altText: text.slice(0, 100),
      }, blotatoKey).catch((err: Error) => { results.instagram = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId, 120_000, blotatoKey).catch((err: Error) => {
          results.instagram = { error: err.message }
          return null
        })
        results.instagram = { submissionId, url: result?.url }
      }
    })(),

    safePlatforms.x && (async () => {
      const { accountId, text, visualUrl } = safePlatforms.x!
      const submissionId = await publishPost({
        platform: 'twitter',
        accountId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
      }, blotatoKey).catch((err: Error) => { results.x = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId, 120_000, blotatoKey).catch((err: Error) => {
          results.x = { error: err.message }
          return null
        })
        results.x = { submissionId, url: result?.url }
      }
    })(),
  ].filter(Boolean))

  // Fetch draft for log entry
  const { data: draft } = await supabase
    .from('posts_log')
    .select('*')
    .eq('id', draftId)
    .single()

  // Update Supabase record
  const hasAnySuccess = results.linkedin?.url || results.instagram?.url || results.x?.url
  const allFailed = !hasAnySuccess && (results.linkedin?.error || results.instagram?.error || results.x?.error)

  // Build a readable error summary for allFailed case
  const publishErrors = [
    results.linkedin?.error ? `LinkedIn: ${results.linkedin.error}` : null,
    results.instagram?.error ? `Instagram: ${results.instagram.error}` : null,
    results.x?.error ? `X: ${results.x.error}` : null,
  ].filter(Boolean)

  await supabase
    .from('posts_log')
    .update({
      status: hasAnySuccess ? 'published' : (allFailed ? 'publish_failed' : 'ready'),
      published_at: hasAnySuccess ? new Date().toISOString() : null,
      linkedin_blotato_id: results.linkedin?.submissionId,
      instagram_blotato_id: results.instagram?.submissionId,
      x_blotato_id: results.x?.submissionId,
      linkedin_url: results.linkedin?.url,
      instagram_url: results.instagram?.url,
      x_url: results.x?.url,
      linkedin_publish_error: results.linkedin?.error ?? null,
      instagram_publish_error: results.instagram?.error ?? null,
      x_publish_error: results.x?.error ?? null,
      error_message: allFailed ? publishErrors.join(' | ') : null,
    })
    .eq('id', draftId)

  // Update aggregate counters + track event
  if (hasAnySuccess) {
    const publishedPlatforms = [
      results.linkedin?.url ? 'linkedin' : null,
      results.instagram?.url ? 'instagram' : null,
      results.x?.url ? 'x' : null,
    ].filter(Boolean)
    recordPostPublished(user.id)
    trackEvent(user.id, 'post_published', { draft_id: draftId, platforms: publishedPlatforms })
  }

  // Append to local posts-log.json
  if (hasAnySuccess && draft) {
    const logEntry: PostLogEntry = {
      id: draftId,
      publishedAt: new Date().toISOString(),
      sourceType: draft.source_type as SourceType,
      sourceUrl: draft.source_url,
      linkedinUrl: results.linkedin?.url,
      instagramUrl: results.instagram?.url,
      xUrl: results.x?.url,
      linkedinText: draft.linkedin_text ?? '',
      instagramText: draft.instagram_text ?? '',
      xText: draft.x_text ?? '',
    }
    appendLog(logEntry)
  }

  return NextResponse.json(results)
}

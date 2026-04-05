import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishPost, pollPost } from '@/lib/blotato'
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

  await supabase.from('posts_log').update({ status: 'publishing' }).eq('id', draftId)

  const results: Record<string, { submissionId?: string; url?: string; error?: string }> = {}

  // Publish to each platform in parallel
  await Promise.all([
    platforms.linkedin && (async () => {
      const { accountId, pageId, text, visualUrl } = platforms.linkedin!
      const submissionId = await publishPost({
        platform: 'linkedin',
        accountId,
        pageId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
      }).catch((err: Error) => { results.linkedin = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId).catch((err: Error) => {
          results.linkedin = { error: err.message }
          return null
        })
        results.linkedin = { submissionId, url: result?.url }
      }
    })(),

    platforms.instagram && (async () => {
      const { accountId, text, visualUrl } = platforms.instagram!
      const submissionId = await publishPost({
        platform: 'instagram',
        accountId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
        mediaType: 'IMAGE',
        altText: text.slice(0, 100),
      }).catch((err: Error) => { results.instagram = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId).catch((err: Error) => {
          results.instagram = { error: err.message }
          return null
        })
        results.instagram = { submissionId, url: result?.url }
      }
    })(),

    platforms.x && (async () => {
      const { accountId, text, visualUrl } = platforms.x!
      const submissionId = await publishPost({
        platform: 'twitter',
        accountId,
        text,
        mediaUrls: visualUrl ? [visualUrl] : [],
      }).catch((err: Error) => { results.x = { error: err.message }; return null })

      if (submissionId) {
        const result = await pollPost(submissionId).catch((err: Error) => {
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
  await supabase
    .from('posts_log')
    .update({
      status: hasAnySuccess ? 'published' : 'failed',
      published_at: hasAnySuccess ? new Date().toISOString() : null,
      linkedin_blotato_id: results.linkedin?.submissionId,
      instagram_blotato_id: results.instagram?.submissionId,
      x_blotato_id: results.x?.submissionId,
      linkedin_url: results.linkedin?.url,
      instagram_url: results.instagram?.url,
      x_url: results.x?.url,
    })
    .eq('id', draftId)

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

/**
 * POST /api/extract
 *
 * Creates a draft, deducts credits, then extracts content from the source.
 * Extraction is handled by lib/extractor.ts (Supadata + Gemini — no Blotato dependency).
 *
 * Supported sourceTypes: youtube, tiktok, instagram, article, pdf, email
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractContent } from '@/lib/extractor'
import { checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'
import { getPlatformConfig } from '@/lib/platform-config'
import type { SourceInput } from '@/lib/types'

export const maxDuration = 60

const BUCKET = 'Content'

// Store a copy of PDF files in Supabase Storage so the user can re-download them
async function archivePdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pdfUrl: string,
  userId: string,
  draftId: string
): Promise<string | null> {
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const storagePath = `${userId}/${draftId}/source.pdf`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
    if (error) return null
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SourceInput = await request.json()

  if (!body.sourceType) {
    return NextResponse.json({ error: 'sourceType is required' }, { status: 400 })
  }

  // Create draft first so we can link the credit transaction to it
  const { data: draft, error: dbError } = await supabase
    .from('posts_log')
    .insert({
      user_id: user.id,
      source_type: body.sourceType,
      source_url: body.url,
      source_content: body.text,
      status: 'generating',
      generation_started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json(
      { error: `Database error: ${dbError.message}` },
      { status: 500 }
    )
  }

  // Read live credit cost from platform_config; fall back to static
  const { credit_costs } = await getPlatformConfig()
  const cost = credit_costs.post_gen ?? CREDIT_COSTS.post_gen

  const usageError = await checkAndDeductCredits(user.id, cost, 'post_gen', draft.id)
  if (usageError) {
    await supabase
      .from('posts_log')
      .update({ status: 'failed', error_message: usageError })
      .eq('id', draft.id)
    return NextResponse.json({ error: usageError }, { status: 402 })
  }

  // Archive PDF to Supabase Storage (fire-and-forget — don't block extraction)
  if (body.sourceType === 'pdf' && body.url) {
    archivePdf(supabase, body.url, user.id, draft.id).then((storedUrl) => {
      if (storedUrl) {
        supabase.from('posts_log').update({ source_file_url: storedUrl }).eq('id', draft.id)
      }
    })
  }

  console.log('[extract] start sourceType=%s draftId=%s userId=%s', body.sourceType, draft.id, user.id)

  // Extract content (Supadata for URLs, Gemini for PDFs, passthrough for text)
  let extractionError = ''
  const extracted = await extractContent(body).catch(async (err: Error) => {
    extractionError = err.message
    console.error('[extract] failed sourceType=%s draftId=%s:', body.sourceType, draft.id, err.message)
    await supabase
      .from('posts_log')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', draft.id)
    return null
  })

  if (!extracted) {
    return NextResponse.json(
      { error: `Content extraction failed: ${extractionError}` },
      { status: 500 }
    )
  }

  const contentText = extracted.content || extracted.title || ''
  console.log('[extract] ok — %d chars draftId=%s', contentText.length, draft.id)

  await supabase
    .from('posts_log')
    .update({ extracted_content: contentText })
    .eq('id', draft.id)

  trackEvent(user.id, 'post_generated', { source_type: body.sourceType, draft_id: draft.id })

  return NextResponse.json({ draftId: draft.id, content: contentText })
}

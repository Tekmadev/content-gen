import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractContent } from '@/lib/blotato'
import { getUserProfile, getBlotatoKey, checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'
import type { SourceInput } from '@/lib/types'

export const maxDuration = 60

const BUCKET = 'Content'

async function uploadPdf(
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

  // Create draft record first so we have a draftId to associate with the credit transaction
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
      { error: `Database error: ${dbError.message} — Have you run supabase/schema.sql?` },
      { status: 500 }
    )
  }

  // Check credits + deduct (links transaction to this draft)
  const usageError = await checkAndDeductCredits(user.id, CREDIT_COSTS.post_gen, 'post_gen', draft.id)
  if (usageError) {
    // Roll back draft status so it doesn't clutter the UI
    await supabase.from('posts_log').update({ status: 'failed', error_message: usageError }).eq('id', draft.id)
    return NextResponse.json({ error: usageError }, { status: 402 })
  }

  const profile = await getUserProfile(user.id)
  const blotatoKey = getBlotatoKey(profile)

  // Map 'email' to Blotato's 'text' sourceType
  const blotatoSource: SourceInput = {
    ...body,
    sourceType: body.sourceType === 'email' ? ('text' as SourceInput['sourceType']) : body.sourceType,
  }

  // If PDF, download and store it in Supabase Storage
  if (body.sourceType === 'pdf' && body.url) {
    const storedPdfUrl = await uploadPdf(supabase, body.url, user.id, draft.id)
    if (storedPdfUrl) {
      await supabase.from('posts_log').update({ source_file_url: storedPdfUrl }).eq('id', draft.id)
    }
  }

  let extractionError = ''
  const extracted = await extractContent(blotatoSource, blotatoKey).catch(async (err: Error) => {
    extractionError = err.message
    await supabase
      .from('posts_log')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', draft.id)
    return null
  })

  if (!extracted) {
    return NextResponse.json({ error: `Blotato extraction failed: ${extractionError}` }, { status: 500 })
  }

  const contentText = extracted.content ?? extracted.title ?? ''
  await supabase
    .from('posts_log')
    .update({ extracted_content: contentText })
    .eq('id', draft.id)

  // Fire-and-forget analytics event
  trackEvent(user.id, 'post_generated', { source_type: body.sourceType, draft_id: draft.id })

  return NextResponse.json({ draftId: draft.id, content: contentText })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractContent } from '@/lib/blotato'
import { generateAllPosts } from '@/lib/anthropic'
import type { SourceInput } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { draftId }: { draftId: string } = await request.json()
  if (!draftId) return NextResponse.json({ error: 'draftId is required' }, { status: 400 })

  const { data: draft } = await supabase
    .from('posts_log')
    .select('*')
    .eq('id', draftId)
    .eq('user_id', user.id)
    .single()

  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

  await supabase.from('posts_log').update({ status: 'generating', error_message: null }).eq('id', draftId)

  // If we already have extracted content, skip extraction and go straight to generation
  let content = draft.extracted_content as string | null

  if (!content) {
    const sourceType = draft.source_type as string
    const blotatoSource: SourceInput = {
      sourceType: sourceType === 'email' ? ('text' as SourceInput['sourceType']) : (sourceType as SourceInput['sourceType']),
      url: draft.source_url ?? undefined,
      text: draft.source_content ?? undefined,
    }

    const extracted = await extractContent(blotatoSource).catch(async (err: Error) => {
      await supabase.from('posts_log').update({ status: 'failed', error_message: err.message }).eq('id', draftId)
      return null
    })

    if (!extracted) return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
    content = extracted.content ?? extracted.title ?? ''
    await supabase.from('posts_log').update({ extracted_content: content }).eq('id', draftId)
  }

  const posts = await generateAllPosts(content).catch(async (err: Error) => {
    await supabase.from('posts_log').update({ status: 'failed', error_message: err.message }).eq('id', draftId)
    return null
  })

  if (!posts) return NextResponse.json({ error: 'Generation failed' }, { status: 500 })

  await supabase.from('posts_log').update({
    linkedin_text: posts.linkedin,
    instagram_text: posts.instagram,
    x_text: posts.x,
    status: 'ready',
  }).eq('id', draftId)

  return NextResponse.json({ success: true })
}

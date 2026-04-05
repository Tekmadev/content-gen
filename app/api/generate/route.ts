import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAllPosts } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { draftId, content }: { draftId: string; content: string } = await request.json()

  if (!draftId || !content) {
    return NextResponse.json({ error: 'draftId and content are required' }, { status: 400 })
  }

  // Reset to generating in case this is a retry
  await supabase.from('posts_log').update({ status: 'generating', error_message: null }).eq('id', draftId)

  const posts = await generateAllPosts(content).catch(async (err: Error) => {
    await supabase
      .from('posts_log')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', draftId)
    return null
  })

  if (!posts) {
    return NextResponse.json({ error: 'Post generation failed' }, { status: 500 })
  }

  await supabase
    .from('posts_log')
    .update({
      linkedin_text: posts.linkedin,
      instagram_text: posts.instagram,
      x_text: posts.x,
      status: 'ready',
    })
    .eq('id', draftId)

  return NextResponse.json(posts)
}

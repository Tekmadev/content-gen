/**
 * POST /api/carousel/extract
 *
 * Free content extraction for the Carousel Studio page.
 * Does NOT create a posts_log entry and does NOT deduct post_gen credits —
 * the carousel generation (carousel credits) covers the full workflow.
 *
 * Extraction handled by lib/extractor.ts (Supadata + Gemini — no Blotato dependency).
 * Supported sourceTypes: youtube, tiktok, instagram, article, pdf, email
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractContent } from '@/lib/extractor'
import type { SourceInput } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SourceInput = await request.json()
  if (!body.sourceType) {
    return NextResponse.json({ error: 'sourceType is required' }, { status: 400 })
  }

  console.log('[carousel/extract] sourceType=%s userId=%s', body.sourceType, user.id)

  try {
    const extracted = await extractContent(body)
    const content = extracted.content || extracted.title || ''

    if (!content) {
      return NextResponse.json(
        { error: 'No content could be extracted from this source.' },
        { status: 422 }
      )
    }

    console.log('[carousel/extract] ok — %d chars', content.length)
    return NextResponse.json({ content })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[carousel/extract] error sourceType=%s:', body.sourceType, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Free content extraction for the Carousel Studio page.
// Does NOT create a posts_log entry and does NOT deduct post_gen credits —
// the carousel generation (8 credits) covers the full workflow.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractContent } from '@/lib/blotato'
import { getUserProfile, getBlotatoKey } from '@/lib/user-profile'
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

  const profile = await getUserProfile(user.id)
  const blotatoKey = getBlotatoKey(profile)

  // Map 'email' → Blotato's 'text' sourceType
  const blotatoSource: SourceInput = {
    ...body,
    sourceType: body.sourceType === 'email' ? ('text' as SourceInput['sourceType']) : body.sourceType,
  }

  try {
    const extracted = await extractContent(blotatoSource, blotatoKey)
    const content = extracted.content ?? extracted.title ?? ''

    if (!content) {
      return NextResponse.json({ error: 'No content could be extracted from this source.' }, { status: 422 })
    }

    return NextResponse.json({ content })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}

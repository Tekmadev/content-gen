import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'Content'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storagePath = `${user.id}/avatar.jpg`

  // Check if we already stored this avatar
  const { data: existing } = await supabase.storage.from(BUCKET).list(user.id, {
    search: 'avatar.jpg',
    limit: 1,
  })

  if (existing && existing.length > 0) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return NextResponse.json({ url: data.publicUrl })
  }

  // Download from Google and store it
  const googleUrl = user.user_metadata?.avatar_url as string | undefined
  if (!googleUrl) {
    return NextResponse.json({ url: null })
  }

  try {
    const res = await fetch(googleUrl)
    if (!res.ok) return NextResponse.json({ url: null })
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true })

    if (error) return NextResponse.json({ url: null })

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return NextResponse.json({ url: data.publicUrl })
  } catch {
    return NextResponse.json({ url: null })
  }
}

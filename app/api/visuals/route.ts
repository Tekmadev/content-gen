import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVisual } from '@/lib/blotato'

export const maxDuration = 60

const BUCKET = 'Content'

function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

async function downloadAndStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blobataUrl: string,
  storagePath: string
): Promise<string> {
  // Download the visual from Blotato
  const res = await fetch(blobataUrl)
  if (!res.ok) throw new Error(`Failed to download visual: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? (isVideo(blobataUrl) ? 'video/mp4' : 'image/jpeg')

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    draftId,
    linkedinTemplateId,
    instagramTemplateId,
    xTemplateId,
    content,
  }: {
    draftId: string
    linkedinTemplateId?: string
    instagramTemplateId?: string
    xTemplateId?: string
    content: string
  } = await request.json()

  if (!draftId || !content) {
    return NextResponse.json({ error: 'draftId and content are required' }, { status: 400 })
  }

  const results: {
    linkedin?: string
    instagram?: string
    x?: string
    errors: string[]
  } = { errors: [] }

  const visualJobs = [
    { key: 'linkedin' as const, templateId: linkedinTemplateId, prompt: `LinkedIn post visual: ${content.slice(0, 200)}` },
    { key: 'instagram' as const, templateId: instagramTemplateId, prompt: `Instagram post visual: ${content.slice(0, 200)}` },
    { key: 'x' as const, templateId: xTemplateId, prompt: `X/Twitter post visual: ${content.slice(0, 200)}` },
  ]

  await Promise.all(
    visualJobs.map(async ({ key, templateId, prompt }) => {
      if (!templateId) return
      try {
        const blotatoUrl = await generateVisual(templateId, prompt)
        if (!blotatoUrl) return

        const ext = isVideo(blotatoUrl) ? 'mp4' : 'jpg'
        const storagePath = `${user.id}/${draftId}/${key}.${ext}`
        const storedUrl = await downloadAndStore(supabase, blotatoUrl, storagePath)
        results[key] = storedUrl
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.errors.push(`${key}: ${msg}`)
      }
    })
  )

  const update: Record<string, string> = {}
  if (results.linkedin) update.linkedin_visual_url = results.linkedin
  if (results.instagram) update.instagram_visual_url = results.instagram
  if (results.x) update.x_visual_url = results.x

  if (Object.keys(update).length > 0) {
    await supabase.from('posts_log').update(update).eq('id', draftId)
  }

  return NextResponse.json(results)
}

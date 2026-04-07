import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateVisual } from '@/lib/blotato'
import { getUserProfile, getBlotatoKey, checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'

export const maxDuration = 60

const BUCKET = 'Content'

async function downloadAndStore(
  blotatoUrl: string,
  basePath: string  // path without extension, e.g. "userid/draftid/linkedin"
): Promise<string> {
  const adminSupabase = createAdminClient()

  const res = await fetch(blotatoUrl)
  if (!res.ok) throw new Error(`Failed to download visual: ${res.status}`)

  // Use content-type header to reliably detect video vs image
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const isVid = contentType.startsWith('video/')
  const ext = isVid ? 'mp4' : contentType.includes('png') ? 'png' : 'jpg'
  const storagePath = `${basePath}.${ext}`

  const buffer = Buffer.from(await res.arrayBuffer())

  const { error } = await adminSupabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`)

  const { data } = adminSupabase.storage.from(BUCKET).getPublicUrl(storagePath)
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

  // Deduct credits (visual generation = 3 credits)
  const usageError = await checkAndDeductCredits(user.id, CREDIT_COSTS.visual, 'visual', draftId)
  if (usageError) return NextResponse.json({ error: usageError }, { status: 402 })

  const profile = await getUserProfile(user.id)
  const blotatoKey = getBlotatoKey(profile)

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
        const visual = await generateVisual(templateId, prompt, blotatoKey)
        if (!visual.url) return

        const basePath = `${user.id}/${draftId}/${key}`
        const storedUrl = await downloadAndStore(visual.url, basePath)
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
    await supabase.from('posts_log').update(update).eq('id', draftId).eq('user_id', user.id)
  }

  const generatedPlatforms = Object.keys(update).map((k) => k.replace('_visual_url', ''))
  trackEvent(user.id, 'visual_generated', { draft_id: draftId, platforms: generatedPlatforms })

  return NextResponse.json(results)
}

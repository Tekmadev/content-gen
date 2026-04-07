import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCarousel } from '@/lib/carousel-generator'
import { checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'
import type { CarouselPlatform, CarouselStyle, CarouselSlide, BrandSettings } from '@/lib/types'
import type { AspectRatio } from '@/lib/gemini'

// Carousel generation can take up to 2 minutes (Claude + N Gemini calls in parallel)
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    content,
    platform,
    numSlides,
    style,
    aspectRatio,
    draftId,
  }: {
    content: string
    platform: CarouselPlatform
    numSlides: number
    style: CarouselStyle
    aspectRatio?: AspectRatio
    draftId?: string
  } = body

  if (!content || !platform || !numSlides || !style) {
    return NextResponse.json(
      { error: 'content, platform, numSlides, and style are required' },
      { status: 400 }
    )
  }

  const validPlatforms: CarouselPlatform[] = ['instagram_carousel', 'linkedin_image', 'x_image']
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: `Invalid platform: ${platform}` }, { status: 400 })
  }

  try {
    // Deduct credits (carousel generation = 8 credits)
    const usageError = await checkAndDeductCredits(user.id, CREDIT_COSTS.carousel, 'carousel', draftId)
    if (usageError) return NextResponse.json({ error: usageError }, { status: 402 })

    // ── Load user's brand settings (used to inject colors + font into prompts)
    const { data: brandData } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    const brandSettings: BrandSettings | undefined = brandData ?? undefined

    // ── Generate slides (Claude texts + Gemini images) ─────────────────────
    const generatedSlides = await generateCarousel({
      content,
      platform,
      numSlides: Math.min(Math.max(1, numSlides), 10),
      style,
      aspectRatio,
      brandSettings,
    })

    // ── Upload each image to Supabase Storage (service-role — bypasses RLS) ─
    const adminSupabase = createAdminClient()
    const jobId = crypto.randomUUID()
    const uploadedSlides: (CarouselSlide & { fallbackBase64?: string; fallbackMime?: string })[] = []
    const storageErrors: string[] = []

    for (const slide of generatedSlides) {
      const buffer = Buffer.from(slide.base64, 'base64')
      const ext = slide.mimeType === 'image/png' ? 'png' : 'jpg'
      const storagePath = `${user.id}/carousel/${jobId}/slide_${slide.number}.${ext}`

      const { error: uploadError } = await adminSupabase.storage
        .from('Content')
        .upload(storagePath, buffer, {
          contentType: slide.mimeType,
          upsert: true,
        })

      if (uploadError) {
        // Storage failed — include raw base64 so the frontend can offer a local download
        console.error(`[carousel] Upload failed for slide ${slide.number}:`, uploadError.message)
        storageErrors.push(`Slide ${slide.number}: ${uploadError.message}`)
        uploadedSlides.push({
          number: slide.number,
          type: slide.type,
          text: slide.text,
          url: '',
          fallbackBase64: slide.base64,
          fallbackMime: slide.mimeType,
        })
        continue
      }

      const { data: { publicUrl } } = adminSupabase.storage
        .from('Content')
        .getPublicUrl(storagePath)

      console.log(`[carousel] Slide ${slide.number} uploaded OK → ${publicUrl}`)

      uploadedSlides.push({
        number: slide.number,
        type: slide.type,
        text: slide.text,
        url: publicUrl,
      })
    }

    // ── Optionally attach first image to the linked post draft ─────────────
    if (draftId) {
      const visualUpdate: Record<string, string> = {}
      const firstUrl = uploadedSlides[0]?.url ?? ''

      if (platform === 'instagram_carousel') {
        visualUpdate.instagram_visual_url = firstUrl
      } else if (platform === 'linkedin_image') {
        visualUpdate.linkedin_visual_url = firstUrl
      } else if (platform === 'x_image') {
        visualUpdate.x_visual_url = firstUrl
      }

      if (Object.keys(visualUpdate).length > 0 && firstUrl) {
        await supabase
          .from('posts_log')
          .update(visualUpdate)
          .eq('id', draftId)
          .eq('user_id', user.id) // safety: only update own posts
      }
    }

    trackEvent(user.id, 'carousel_generated', {
      draft_id: draftId,
      platform,
      style,
      num_slides: uploadedSlides.length,
    })

    return NextResponse.json({
      jobId,
      platform,
      style,
      numSlides: uploadedSlides.length,
      slides: uploadedSlides,
      ...(storageErrors.length ? { storageErrors } : {}),
      ...(draftId ? { draftId } : {}),
    })
  } catch (err) {
    console.error('[carousel/generate] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Carousel generation failed' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCarousel, generateViralCarousel, analyzeAimImage } from '@/lib/carousel-generator'
import { generateViralCarouselSlides, generateCarouselCaption } from '@/lib/anthropic'
import { canvaAutofill, canvaExport } from '@/lib/canva'
import { checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'
import type { CarouselPlatform, CarouselStyle, CarouselSlide, BrandSettings } from '@/lib/types'
import type { AspectRatio } from '@/lib/gemini'
import sharp from 'sharp'

// ── Logo overlay ─────────────────────────────────────────────────────────────
// Composites the brand logo onto the bottom-left corner of a slide image.
// Fails gracefully — returns original buffer if anything goes wrong.
async function overlayLogo(slideBuffer: Buffer, logoUrl: string): Promise<Buffer> {
  try {
    const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) })
    if (!logoRes.ok) return slideBuffer
    const logoBuffer = Buffer.from(await logoRes.arrayBuffer())

    const slideMeta = await sharp(slideBuffer).metadata()
    const slideWidth  = slideMeta.width  ?? 1080

    // Logo = 12% of slide width, preserve aspect ratio
    const targetLogoW = Math.round(slideWidth * 0.12)
    const resizedLogo = await sharp(logoBuffer)
      .resize(targetLogoW, null, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    const logoMeta  = await sharp(resizedLogo).metadata()
    const logoWidth = logoMeta.width ?? targetLogoW
    const padding   = Math.round(slideWidth * 0.05)

    // Top-right corner — avoids overlapping content-heavy bottom area
    return await sharp(slideBuffer)
      .composite([{ input: resizedLogo, left: slideWidth - logoWidth - padding, top: padding }])
      .jpeg({ quality: 92 })
      .toBuffer()
  } catch {
    return slideBuffer
  }
}

// Carousel generation can take up to 2 minutes (Claude + N Gemini calls in parallel)
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    // ── Existing params (review page / standard carousel) ───────────────
    content,
    platform,
    numSlides,
    style,
    aspectRatio,
    draftId,
    // ── Viral studio params (all optional) ─────────────────────────────
    viralMode,
    additionalInfo,
    aimImageBase64,
    aimImageMime,
    brandOverride,
    imageGenerator,
    canvaTemplateId,
  }: {
    content: string
    platform?: CarouselPlatform
    numSlides?: number
    style?: CarouselStyle
    aspectRatio?: AspectRatio
    draftId?: string
    viralMode?: boolean
    additionalInfo?: string
    aimImageBase64?: string
    aimImageMime?: string
    brandOverride?: Partial<BrandSettings>
    imageGenerator?: 'gemini' | 'canva'
    canvaTemplateId?: string
  } = body

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const effectivePlatform: CarouselPlatform = viralMode ? 'instagram_carousel' : (platform ?? 'instagram_carousel')
  const validPlatforms: CarouselPlatform[] = ['instagram_carousel', 'linkedin_image', 'x_image']
  if (!validPlatforms.includes(effectivePlatform)) {
    return NextResponse.json({ error: `Invalid platform: ${effectivePlatform}` }, { status: 400 })
  }

  try {
    // Deduct credits (carousel = 8 credits)
    const usageError = await checkAndDeductCredits(user.id, CREDIT_COSTS.carousel, 'carousel', draftId)
    if (usageError) return NextResponse.json({ error: usageError }, { status: 402 })

    // Load + merge brand settings
    const { data: brandData } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const brandSettings: BrandSettings | undefined = brandData
      ? { ...brandData, ...(brandOverride ?? {}) }
      : (brandOverride as BrandSettings | undefined)

    const adminSupabase = createAdminClient()
    const jobId = crypto.randomUUID()

    type UploadedSlide = CarouselSlide & { label?: string; body?: string; fallbackBase64?: string; fallbackMime?: string }
    const uploadedSlides: UploadedSlide[] = []
    const storageErrors: string[] = []
    let caption: string | undefined

    // ── Helper: upload one image buffer to Supabase Storage ────────────
    // On success: stores publicUrl, no base64 in response (saves bandwidth).
    // On failure: stores fallbackBase64 so the frontend can offer a local download.
    async function uploadSlide(
      slideNum: number,
      buffer: Buffer,
      mimeType: string,
      meta: { type: CarouselSlide['type']; text: string; label?: string; body?: string },
      rawBase64: string
    ) {
      // Composite brand logo onto slide if configured
      if (brandSettings?.logo_url) {
        buffer = await overlayLogo(buffer, brandSettings.logo_url)
        mimeType = 'image/jpeg'  // sharp outputs JPEG
      }

      const ext = mimeType === 'image/png' ? 'png' : 'jpg'
      const storagePath = `${user!.id}/carousel/${jobId}/slide_${slideNum}.${ext}`
      const { error: uploadErr } = await adminSupabase.storage
        .from('Content')
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true })

      if (uploadErr) {
        console.error(`[carousel] Upload failed slide ${slideNum}:`, uploadErr.message)
        storageErrors.push(`Slide ${slideNum}: ${uploadErr.message}`)
        // Include raw base64 so the frontend can offer a local download fallback
        uploadedSlides.push({ ...meta, number: slideNum, url: '', fallbackBase64: rawBase64, fallbackMime: mimeType })
        return
      }
      const { data: { publicUrl } } = adminSupabase.storage.from('Content').getPublicUrl(storagePath)
      // No base64 on success — URL is all the frontend needs
      uploadedSlides.push({ ...meta, number: slideNum, url: publicUrl })
    }

    // ──────────────────────────────────────────────────────────────────
    if (viralMode) {
      // ── VIRAL MODE: 10-slide carousel ────────────────────────────────
      if (imageGenerator === 'canva') {
        // Validate Canva template ID
        if (!canvaTemplateId?.trim()) {
          return NextResponse.json({ error: 'canvaTemplateId is required for Canva generation.' }, { status: 400 })
        }

        // Get user's Canva token
        const { data: tokenRow } = await supabase
          .from('canva_tokens')
          .select('access_token, expires_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!tokenRow?.access_token) {
          return NextResponse.json({ error: 'Canva account not connected. Please connect Canva first.' }, { status: 403 })
        }
        if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
          return NextResponse.json({ error: 'Canva token expired. Please reconnect your Canva account.' }, { status: 403 })
        }

        const token = tokenRow.access_token

        // Analyze AIM image if provided
        let aimStyleDescription: string | undefined
        if (aimImageBase64 && aimImageMime) {
          aimStyleDescription = await analyzeAimImage(aimImageBase64, aimImageMime)
        }

        // Generate 10 viral slide texts
        const slides = await generateViralCarouselSlides(
          content, additionalInfo, aimStyleDescription, brandSettings
        )

        // Auto-fill Canva template + export to images
        const designId = await canvaAutofill(token, canvaTemplateId.trim(), slides)
        const exportedUrls = await canvaExport(token, designId)

        // Download exported images and upload to Supabase Storage
        await Promise.all(
          slides.map(async (slide, i) => {
            const url = exportedUrls[i]
            if (!url) { uploadedSlides.push({ number: slide.number, type: 'body', label: slide.label, text: slide.text, body: slide.body, url: '' }); return }
            const imgRes = await fetch(url)
            if (!imgRes.ok) { uploadedSlides.push({ number: slide.number, type: 'body', label: slide.label, text: slide.text, body: slide.body, url: '' }); return }
            const arrayBuf = await imgRes.arrayBuffer()
            const buffer = Buffer.from(arrayBuf)
            const base64 = Buffer.from(arrayBuf).toString('base64')
            await uploadSlide(slide.number, buffer, 'image/jpeg', {
              type: slide.type as CarouselSlide['type'],
              label: slide.label,
              text: slide.text,
              body: slide.body,
            }, base64)
          })
        )

        // Sort by slide number
        uploadedSlides.sort((a, b) => a.number - b.number)

      } else {
        // ── Gemini path ───────────────────────────────────────────────
        const generatedSlides = await generateViralCarousel({
          content,
          additionalInfo,
          aimImageBase64,
          aimImageMime,
          aspectRatio: aspectRatio ?? '3:4',
          style: style ?? 'dark_statement',
          brandSettings,
        })

        await Promise.all(
          generatedSlides.map(async (slide) => {
            const buffer = Buffer.from(slide.base64, 'base64')
            await uploadSlide(slide.number, buffer, slide.mimeType, {
              type: slide.type as CarouselSlide['type'],
              label: slide.label,
              text: slide.text,
              body: slide.body,
            }, slide.base64)
          })
        )

        uploadedSlides.sort((a, b) => a.number - b.number)
      }

      // Generate Instagram caption
      try {
        caption = await generateCarouselCaption(content, uploadedSlides)
      } catch (err) {
        console.error('[carousel/viral] Caption generation failed:', err)
      }

    } else {
      // ── STANDARD MODE: N-slide carousel (review page flow) ───────────
      if (!platform || !numSlides || !style) {
        return NextResponse.json(
          { error: 'platform, numSlides, and style are required for standard mode' },
          { status: 400 }
        )
      }

      const generatedSlides = await generateCarousel({
        content,
        platform: effectivePlatform,
        numSlides: Math.min(Math.max(1, numSlides), 10),
        style,
        aspectRatio,
        brandSettings,
      })

      await Promise.all(
        generatedSlides.map(async (slide) => {
          const buffer = Buffer.from(slide.base64, 'base64')
          await uploadSlide(slide.number, buffer, slide.mimeType, {
            type: slide.type as CarouselSlide['type'],
            text: slide.text,
          }, slide.base64)
        })
      )

      uploadedSlides.sort((a, b) => a.number - b.number)

      // Optionally attach first image to a linked post draft
      if (draftId) {
        const firstUrl = uploadedSlides[0]?.url ?? ''
        const visualUpdate: Record<string, string> = {}
        if (effectivePlatform === 'instagram_carousel') visualUpdate.instagram_visual_url = firstUrl
        else if (effectivePlatform === 'linkedin_image') visualUpdate.linkedin_visual_url = firstUrl
        else if (effectivePlatform === 'x_image') visualUpdate.x_visual_url = firstUrl

        if (Object.keys(visualUpdate).length > 0 && firstUrl) {
          await supabase.from('posts_log').update(visualUpdate).eq('id', draftId).eq('user_id', user.id)
        }
      }
    }

    // Save to history (non-fatal)
    supabase.from('carousel_jobs').insert({
      user_id: user.id,
      job_id: jobId,
      mode: viralMode ? 'viral' : 'standard',
      style: style ?? 'viral',
      aspect_ratio: aspectRatio ?? '3:4',
      image_generator: imageGenerator ?? 'gemini',
      caption: caption ?? null,
      slides: uploadedSlides,
      content_preview: content.slice(0, 200),
    }).then(({ error }) => {
      if (error) console.error('[carousel] History save failed:', error.message)
    })

    trackEvent(user.id, 'carousel_generated', {
      draft_id: draftId,
      platform: effectivePlatform,
      style: style ?? 'viral',
      num_slides: uploadedSlides.length,
      viral_mode: viralMode ?? false,
      image_generator: imageGenerator ?? 'gemini',
    })

    return NextResponse.json({
      jobId,
      platform: effectivePlatform,
      style: style ?? 'viral',
      numSlides: uploadedSlides.length,
      slides: uploadedSlides,
      ...(caption ? { caption } : {}),
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

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCarousel, generateViralCarousel, analyzeAimImage } from '@/lib/carousel-generator'
import { generateViralCarouselSlides, generateCarouselCaption } from '@/lib/anthropic'
import { canvaAutofill, canvaExport } from '@/lib/canva'
import { checkAndDeductCredits, trackEvent, CREDIT_COSTS } from '@/lib/user-profile'
import { getUserBrandBrief, buildBrandVoiceContext } from '@/lib/brand-brief'
import type { CarouselPlatform, CarouselStyle, CarouselSlide, BrandSettings, ImageGenerator } from '@/lib/types'
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
    includeLogo,
    density,
  }: {
    content: string
    platform?: CarouselPlatform
    numSlides?: number    // 4–10 (viral mode), 1–10 (standard mode)
    style?: CarouselStyle
    aspectRatio?: AspectRatio
    draftId?: string
    viralMode?: boolean
    additionalInfo?: string
    aimImageBase64?: string
    aimImageMime?: string
    brandOverride?: Partial<BrandSettings>
    imageGenerator?: ImageGenerator
    canvaTemplateId?: string
    includeLogo?: boolean              // toggle — defaults to true if logo configured
    density?: 'simple' | 'medium' | 'rich'  // Claude SVG: design richness
  } = body

  // Viral mode: slide count is 4–10, defaults to 10
  const viralSlideCount = Math.min(Math.max(4, numSlides ?? 10), 10)

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const effectivePlatform: CarouselPlatform = viralMode ? 'instagram_carousel' : (platform ?? 'instagram_carousel')
  const validPlatforms: CarouselPlatform[] = ['instagram_carousel', 'linkedin_image', 'x_image']
  if (!validPlatforms.includes(effectivePlatform)) {
    return NextResponse.json({ error: `Invalid platform: ${effectivePlatform}` }, { status: 400 })
  }

  const startedAt = Date.now()

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

    // Load brand brief for voice/tone injection into Claude prompts
    const brief = await getUserBrandBrief(user.id)
    const brandBriefContext = buildBrandVoiceContext(brief)

    const adminSupabase = createAdminClient()
    const jobId = crypto.randomUUID()

    // ── Persist AIM reference image to storage (so we can audit it later) ──
    // We never store base64 in the DB — it bloats rows and breaks indexes.
    let aimImageUrl: string | null = null
    if (aimImageBase64 && aimImageMime) {
      try {
        const ext = aimImageMime === 'image/png' ? 'png' : aimImageMime === 'image/webp' ? 'webp' : 'jpg'
        const aimPath = `${user.id}/carousel/${jobId}/aim_reference.${ext}`
        const aimBuffer = Buffer.from(aimImageBase64, 'base64')
        const { error: aimUploadErr } = await adminSupabase.storage
          .from('Content')
          .upload(aimPath, aimBuffer, { contentType: aimImageMime, upsert: true })
        if (!aimUploadErr) {
          aimImageUrl = adminSupabase.storage.from('Content').getPublicUrl(aimPath).data.publicUrl
        } else {
          console.error('[carousel] AIM image upload failed:', aimUploadErr.message)
        }
      } catch (err) {
        console.error('[carousel] AIM image persist error:', err)
      }
    }

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
      // Composite brand logo onto slide if user enabled it AND a logo is configured.
      // Default behavior when includeLogo is undefined: overlay if logo exists
      // (preserves prior automatic behavior). When explicitly false, skip overlay.
      const shouldOverlay = (includeLogo ?? true) && !!brandSettings?.logo_url
      if (shouldOverlay) {
        buffer = await overlayLogo(buffer, brandSettings!.logo_url!)
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

        // Generate viral slide texts (4–10 slides, configurable)
        const slides = await generateViralCarouselSlides(content, {
          numSlides: viralSlideCount,
          additionalInfo,
          aimStyleDescription,
          brandSettings,
          brandBriefContext,
        })

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
        // ── Gemini / OpenAI DALL-E 3 / Claude SVG path ───────────────
        // (Canva is handled above — imageGenerator here is never 'canva')
        const backend = imageGenerator ?? 'gemini'
        const generatedSlides = await generateViralCarousel({
          content,
          numSlides: viralSlideCount,
          additionalInfo,
          aimImageBase64,
          aimImageMime,
          aspectRatio: aspectRatio ?? '3:4',
          style: style ?? 'modern',
          brandSettings,
          brandBriefContext,
          imageGenerator: backend,
          density: density ?? 'medium',
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

    // Save to history. Awaiting so any schema/RLS error surfaces in the response
    // instead of silently failing in a fire-and-forget .then() — that's how this
    // bug existed for a while and history showed empty even after generations.
    // Use admin client to bypass RLS edge cases (user_id is set explicitly).
    const generationDurationMs = Date.now() - startedAt
    const { error: historySaveError } = await adminSupabase.from('carousel_jobs').insert({
      user_id:                user.id,
      draft_id:               draftId ?? null,
      platform:               effectivePlatform,             // NOT NULL in schema
      job_id:                 jobId,
      mode:                   viralMode ? 'viral' : 'standard',
      viral_mode:             !!viralMode,
      style:                  style ?? 'viral',
      aspect_ratio:           aspectRatio ?? '3:4',
      image_generator:        imageGenerator ?? 'gemini',
      caption:                caption ?? null,
      slides:                 uploadedSlides,
      content_preview:        content.slice(0, 200),
      full_content:           content,                       // store the whole prompt
      num_slides:             uploadedSlides.length,
      additional_info:        additionalInfo ?? null,
      aim_image_url:          aimImageUrl,
      include_logo:           includeLogo ?? null,
      density:                density ?? null,
      canva_template_id:      canvaTemplateId ?? null,
      brand_override:         brandOverride ?? null,
      credits_used:           CREDIT_COSTS.carousel,
      generation_duration_ms: generationDurationMs,
      storage_error_count:    storageErrors.length,
      storage_errors:         storageErrors.length > 0 ? storageErrors : null,
    })
    if (historySaveError) {
      // Don't fail the user-facing request — the slides are already generated
      // and uploaded. Just log loudly so the issue is visible.
      console.error('[carousel] History save failed:', historySaveError.message, historySaveError)
    } else {
      console.log(
        `[carousel] History saved: jobId=${jobId} slides=${uploadedSlides.length} ` +
        `gen=${imageGenerator ?? 'gemini'} mode=${viralMode ? 'viral' : 'standard'} ` +
        `duration=${generationDurationMs}ms`
      )
    }

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

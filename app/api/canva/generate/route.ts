// Standalone Canva generation endpoint — useful for testing Canva connectivity.
// The main carousel flow goes through /api/carousel/generate with viralMode + imageGenerator='canva'.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAimImage } from '@/lib/carousel-generator'
import { generateViralCarouselSlides } from '@/lib/anthropic'
import { canvaAutofill, canvaExport } from '@/lib/canva'
import type { BrandSettings, CarouselSlide } from '@/lib/types'

export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tokenRow } = await supabase
    .from('canva_tokens')
    .select('access_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'Canva account not connected.' }, { status: 403 })
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Canva token expired. Please reconnect.' }, { status: 403 })
  }

  const {
    content,
    additionalInfo,
    aimImageBase64,
    aimImageMime,
    brandSettings,
    canvaTemplateId,
    jobId,
  }: {
    content: string
    additionalInfo?: string
    aimImageBase64?: string
    aimImageMime?: string
    brandSettings?: BrandSettings
    canvaTemplateId: string
    jobId: string
  } = await request.json()

  if (!canvaTemplateId) {
    return NextResponse.json({ error: 'canvaTemplateId is required.' }, { status: 400 })
  }

  try {
    const token = tokenRow.access_token

    let aimStyleDescription: string | undefined
    if (aimImageBase64 && aimImageMime) {
      aimStyleDescription = await analyzeAimImage(aimImageBase64, aimImageMime)
    }

    const slides = await generateViralCarouselSlides(content, additionalInfo, aimStyleDescription, brandSettings)

    const designId = await canvaAutofill(token, canvaTemplateId, slides)
    const exportedUrls = await canvaExport(token, designId)

    const adminSupabase = createAdminClient()
    const uploadedSlides: (CarouselSlide & { label?: string })[] = []

    await Promise.all(
      slides.map(async (slide, i) => {
        const url = exportedUrls[i]
        if (!url) return
        const imgRes = await fetch(url)
        if (!imgRes.ok) {
          uploadedSlides.push({ number: slide.number, type: 'body', label: slide.label, text: slide.text, url: '' })
          return
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const storagePath = `${user.id}/carousel/${jobId}/slide_${slide.number}.jpg`

        const { error } = await adminSupabase.storage
          .from('Content')
          .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

        if (error) {
          console.error(`[canva/generate] Storage upload failed slide ${slide.number}:`, error.message)
          uploadedSlides.push({ number: slide.number, type: 'body', label: slide.label, text: slide.text, url: '' })
          return
        }

        const { data: { publicUrl } } = adminSupabase.storage.from('Content').getPublicUrl(storagePath)
        uploadedSlides.push({
          number: slide.number,
          type: slide.type as CarouselSlide['type'],
          label: slide.label,
          text: slide.text,
          url: publicUrl,
        })
      })
    )

    uploadedSlides.sort((a, b) => a.number - b.number)

    return NextResponse.json({ slides: uploadedSlides, designId })
  } catch (err) {
    console.error('[canva/generate] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Canva generation failed' },
      { status: 500 }
    )
  }
}

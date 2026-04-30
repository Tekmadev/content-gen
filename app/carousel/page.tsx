'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import { CAROUSEL_STYLES, stylesForGenerator } from '@/lib/carousel-styles'
import type { BrandSettings, CarouselSlide, CarouselStyle, ImageGenerator, SourceType } from '@/lib/types'
import type { AspectRatio } from '@/lib/gemini'

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_TYPES: { value: SourceType; label: string; placeholder: string; isText?: boolean }[] = [
  { value: 'youtube',   label: 'YouTube',   placeholder: 'https://youtube.com/watch?v=...' },
  { value: 'tiktok',    label: 'TikTok',    placeholder: 'https://www.tiktok.com/@user/video/...' },
  { value: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/reel/...' },
  { value: 'article',   label: 'Article',   placeholder: 'https://example.com/article' },
  { value: 'pdf',       label: 'PDF URL',   placeholder: 'https://example.com/document.pdf' },
  { value: 'email',     label: 'Paste Text', placeholder: 'Paste your content here…', isText: true },
]

const RATIO_OPTIONS: { value: AspectRatio; label: string; dims: string; note: string }[] = [
  { value: '3:4', label: '3:4', dims: '1080×1440', note: 'Recommended' },
  { value: '1:1', label: '1:1', dims: '1080×1080', note: 'Square' },
  { value: '4:5', label: '4:5', dims: '1080×1350', note: 'Portrait' },
]

const GENERATION_STEPS = [
  'Analyzing inspiration image',
  'Writing viral slide texts',
  'Crafting Instagram caption',
  'Generating slide images',
  'Saving to your library',
]

// Slide count bounds for the viral studio
const MIN_SLIDES = 4
const MAX_SLIDES = 10

const SLIDE_TYPE_COLORS: Record<string, string> = {
  hook:          'bg-red-100 text-red-700',
  rehook:        'bg-orange-100 text-orange-700',
  pain:          'bg-yellow-100 text-yellow-700',
  value:         'bg-blue-100 text-blue-700',
  turning_point: 'bg-purple-100 text-purple-700',
  takeaway:      'bg-green-100 text-green-700',
  cta:           'bg-[var(--primary)]/10 text-[var(--primary)]',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudioSlide extends CarouselSlide {
  label?: string
  body?: string
  fallbackBase64?: string
  fallbackMime?: string
}

interface StudioResult {
  jobId: string
  slides: StudioSlide[]
  caption?: string
  storageErrors?: string[]
}

interface CarouselJob {
  id: string
  job_id: string
  created_at: string
  mode: string
  style?: string
  aspect_ratio?: string
  image_generator?: string
  caption?: string
  slides: StudioSlide[]
  content_preview?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CarouselStudioPage() {
  return (
    <Suspense>
      <CarouselStudioContent />
    </Suspense>
  )
}

function CarouselStudioContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{
    email?: string
    user_metadata?: { avatar_url?: string; full_name?: string }
  } | null>(null)

  // ── Source ────────────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<SourceType>('youtube')
  const [sourceInput, setSourceInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedContent, setExtractedContent] = useState('')
  const [extractError, setExtractError] = useState('')

  // ── Customize ─────────────────────────────────────────────────────────────
  const [aimImageBase64, setAimImageBase64] = useState<string | null>(null)
  const [aimImageMime, setAimImageMime] = useState('image/jpeg')
  const [aimImagePreview, setAimImagePreview] = useState<string | null>(null)
  const [additionalInfo, setAdditionalInfo] = useState('')

  // ── Brand ─────────────────────────────────────────────────────────────────
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null)
  const [showBrandOverride, setShowBrandOverride] = useState(false)
  const [brandOverride, setBrandOverride] = useState<Partial<BrandSettings>>({})

  // ── Generator ─────────────────────────────────────────────────────────────
  const [imageGenerator, setImageGenerator] = useState<ImageGenerator>('gemini')
  const [canvaConnected, setCanvaConnected] = useState(false)
  const [canvaTemplateId, setCanvaTemplateId] = useState('')
  const [style, setStyle] = useState<CarouselStyle>('modern')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4')
  const [numSlides, setNumSlides] = useState<number>(10)
  // Whether to overlay the user's brand logo on each generated slide.
  // Defaults to ON when a logo exists; user can opt out per-carousel.
  const [includeLogo, setIncludeLogo] = useState(true)

  // When the generator changes, pick a valid style (Claude SVG only supports infographic)
  useEffect(() => {
    const allowed = stylesForGenerator(imageGenerator)
    if (!allowed.includes(style)) {
      setStyle(allowed[0])
    }
  }, [imageGenerator, style])

  // ── Generation state ──────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(-1)
  const [generateError, setGenerateError] = useState('')

  // ── Results ───────────────────────────────────────────────────────────────
  const [result, setResult] = useState<StudioResult | null>(null)
  const [caption, setCaption] = useState('')

  // ── History ───────────────────────────────────────────────────────────────
  const [rightTab, setRightTab] = useState<'preview' | 'history'>('preview')
  const [history, setHistory] = useState<CarouselJob[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    fetch('/api/brand-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setBrandSettings(d))
      .catch(() => {})

    fetch('/api/canva/status')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.connected && setCanvaConnected(true))
      .catch(() => {})

    fetch('/api/carousel/history')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.jobs && setHistory(d.jobs))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [supabase])

  // Handle Canva redirect params
  useEffect(() => {
    if (searchParams.get('canva') === 'connected') {
      setCanvaConnected(true)
      setImageGenerator('canva')
      router.replace('/carousel')
    }
    const canvaError = searchParams.get('canva_error')
    if (canvaError) {
      setGenerateError(`Canva connection failed: ${canvaError.replace(/_/g, ' ')}`)
      router.replace('/carousel')
    }
  }, [searchParams, router])

  // Animate generation steps while generating
  useEffect(() => {
    if (!generating) { setGenerationStep(-1); return }
    setGenerationStep(0)
    const timings = [0, 4000, 6000, 8000, 55000]
    const timers = timings.map((t, i) => setTimeout(() => setGenerationStep(i), t))
    return () => timers.forEach(clearTimeout)
  }, [generating])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const activeSource = SOURCE_TYPES.find((s) => s.value === sourceType)!
  const isTextSource = activeSource.isText
  const hasContent = isTextSource ? sourceInput.trim().length > 0 : extractedContent.length > 0

  async function handleExtract() {
    if (!sourceInput.trim()) return
    setExtracting(true)
    setExtractError('')
    setExtractedContent('')

    try {
      const res = await fetch('/api/carousel/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          sourceType === 'email'
            ? { sourceType: 'email', text: sourceInput }
            : { sourceType, url: sourceInput }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtractedContent(data.content)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  function handleAimImageUpload(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setAimImagePreview(dataUrl)
      setAimImageMime(file.type || 'image/jpeg')
      // Strip the data:image/...;base64, prefix
      setAimImageBase64(dataUrl.split(',')[1] ?? null)
    }
    reader.readAsDataURL(file)
  }

  function handleAimDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleAimImageUpload(file)
  }

  async function handleGenerate() {
    const content = isTextSource ? sourceInput.trim() : extractedContent
    if (!content) return
    if (imageGenerator === 'canva' && !canvaTemplateId.trim()) {
      setGenerateError('Enter your Canva template ID before generating.')
      return
    }

    setGenerating(true)
    setGenerateError('')
    setResult(null)
    setCaption('')

    try {
      const res = await fetch('/api/carousel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          viralMode: true,
          numSlides,
          additionalInfo: additionalInfo.trim() || undefined,
          aimImageBase64: aimImageBase64 ?? undefined,
          aimImageMime: aimImageBase64 ? aimImageMime : undefined,
          brandOverride: Object.keys(brandOverride).length > 0 ? brandOverride : undefined,
          imageGenerator,
          canvaTemplateId: imageGenerator === 'canva' ? canvaTemplateId.trim() : undefined,
          style,
          aspectRatio,
          includeLogo,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      const studioResult = data as StudioResult
      setResult(studioResult)
      if (data.caption) setCaption(data.caption)
      setRightTab('preview')
      // Prepend to local history so it shows instantly without a refetch
      setHistory((prev) => [{
        id: data.jobId,
        job_id: data.jobId,
        created_at: new Date().toISOString(),
        mode: 'viral',
        style: data.style,
        aspect_ratio: aspectRatio,
        image_generator: imageGenerator,
        caption: data.caption,
        slides: studioResult.slides,
        content_preview: (isTextSource ? sourceInput : extractedContent).slice(0, 200),
      }, ...prev])
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(slide: StudioSlide) {
    const a = document.createElement('a')
    if (slide.fallbackBase64) {
      a.href = `data:${slide.fallbackMime ?? 'image/jpeg'};base64,${slide.fallbackBase64}`
      a.download = `slide_${slide.number}.${slide.fallbackMime === 'image/png' ? 'png' : 'jpg'}`
      a.click()
    } else {
      // Fetch as blob — cross-origin URLs ignore the download attribute and open a new tab instead
      try {
        const res = await fetch(slide.url)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        a.href = objectUrl
        a.download = `slide_${slide.number}.jpg`
        a.click()
        URL.revokeObjectURL(objectUrl)
      } catch {
        window.open(slide.url, '_blank')
      }
    }
  }

  function handleDownloadAll() {
    result?.slides.forEach((slide, i) => setTimeout(() => handleDownload(slide), i * 300))
  }

  async function handleDeleteJob(id: string) {
    setHistory((prev) => prev.filter((j) => j.id !== id))
    await fetch(`/api/carousel/history?id=${id}`, { method: 'DELETE' })
  }

  function restoreJob(job: CarouselJob) {
    setResult({ jobId: job.job_id, slides: job.slides, caption: job.caption })
    setCaption(job.caption ?? '')
    setRightTab('preview')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell user={user}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Carousel Studio</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Turn any content into a viral Instagram carousel (4–10 slides) — written in your brand voice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">

          {/* ── Left Panel: Config ── */}
          <div className="flex flex-col gap-4">

            {/* 1. Source */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-sm text-[var(--foreground)]">1. Source Content</h2>

              {/* Source type tabs */}
              <div className="grid grid-cols-4 gap-1.5">
                {SOURCE_TYPES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { setSourceType(s.value); setSourceInput(''); setExtractedContent(''); setExtractError('') }}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      sourceType === s.value
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'bg-white text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              {isTextSource ? (
                <textarea
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder={activeSource.placeholder}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                      placeholder={activeSource.placeholder}
                      className="flex-1 px-3 py-2.5 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <button
                      onClick={handleExtract}
                      disabled={extracting || !sourceInput.trim()}
                      className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                    >
                      {extracting ? <><LoadingSpinner />Extracting…</> : 'Extract'}
                    </button>
                  </div>
                  {extractError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{extractError}</p>
                  )}
                  {extractedContent && (
                    <div className="text-xs text-[var(--muted)] bg-[var(--surface)] rounded-xl px-3 py-2.5 leading-relaxed border border-[var(--border)]">
                      <span className="text-xs font-semibold text-green-600 block mb-1">Content extracted</span>
                      <p className="line-clamp-4">{extractedContent.slice(0, 300)}…</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Customize */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-sm text-[var(--foreground)]">2. Customize</h2>

              {/* AIM image */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Inspiration Image <span className="text-[var(--muted)] font-normal">(optional)</span>
                </label>
                <p className="text-xs text-[var(--muted)]">Upload an example carousel slide to guide the visual style.</p>

                {aimImagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
                    <img src={aimImagePreview} alt="AIM reference" className="w-full h-32 object-cover" />
                    <button
                      onClick={() => { setAimImagePreview(null); setAimImageBase64(null) }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleAimDrop}
                    className="flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--primary)]/50 hover:bg-[var(--surface)] transition-colors"
                  >
                    <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-[var(--muted)]">Drag & drop or click to upload</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleAimImageUpload(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {/* Additional context */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Additional Context <span className="text-[var(--muted)] font-normal">(optional)</span>
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Any extra info for Claude — target audience, key message, tone, specific points to include…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            {/* 3. Brand Identity */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-[var(--foreground)]">3. Brand Identity</h2>
                <button
                  onClick={() => setShowBrandOverride(!showBrandOverride)}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  {showBrandOverride ? 'Hide overrides' : 'Override for this carousel'}
                </button>
              </div>

              {/* Current brand preview */}
              {brandSettings ? (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[brandSettings.primary_color, brandSettings.secondary_color, brandSettings.accent_color, brandSettings.background_color].map((c, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-[var(--border)]" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-xs text-[var(--muted)]">{brandSettings.font_family}</span>
                  {brandSettings.brand_name && (
                    <span className="text-xs font-medium text-[var(--foreground)]">{brandSettings.brand_name}</span>
                  )}
                  <a href="/brand" className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline">Edit</a>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  No brand settings found. <a href="/brand" className="underline text-[var(--primary)]">Set them on the Brand page →</a>
                </p>
              )}

              {/* Logo overlay toggle — visible only when a logo is configured */}
              {brandSettings?.logo_url && (
                <label className="flex items-center gap-3 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--primary)]/40 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={brandSettings.logo_url} alt="Brand logo" className="max-w-full max-h-full object-contain p-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--foreground)]">Place logo on slides</p>
                    <p className="text-[11px] text-[var(--muted)]">{includeLogo ? 'Logo will appear in the top-right of every slide' : 'Slides will be generated without your logo'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    className="sr-only peer"
                  />
                  {/* Toggle switch */}
                  <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)] flex-shrink-0">
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${includeLogo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                </label>
              )}

              {/* Per-carousel overrides */}
              {showBrandOverride && (
                <div className="flex flex-col gap-3 pt-1 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)]">Override colors/font for this carousel only.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'primary_color',    label: 'Primary' },
                        { key: 'background_color', label: 'Background' },
                        { key: 'text_color',       label: 'Text' },
                        { key: 'accent_color',     label: 'Accent' },
                      ] as { key: keyof BrandSettings; label: string }[]
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(brandOverride[key] as string) ?? (brandSettings?.[key] as string) ?? '#000000'}
                          onChange={(e) => setBrandOverride((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-[var(--border)]"
                        />
                        <span className="text-xs text-[var(--muted)]">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--muted)]">Font</label>
                    <select
                      value={(brandOverride.font_family as string) ?? brandSettings?.font_family ?? 'Inter'}
                      onChange={(e) => setBrandOverride((prev) => ({ ...prev, font_family: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      {['Inter', 'Helvetica Neue', 'Montserrat', 'Playfair Display', 'Georgia', 'Raleway', 'Roboto', 'DM Sans', 'Space Grotesk'].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Image Generator */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <div>
                <h2 className="font-semibold text-sm text-[var(--foreground)]">4. Image Generator</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Choose how slide visuals are created.</p>
              </div>

              {/* 4-option picker */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'gemini' as ImageGenerator,
                      icon: '✦',
                      label: 'Gemini AI',
                      desc: 'Google AI image generation',
                    },
                    {
                      id: 'openai' as ImageGenerator,
                      icon: '⬡',
                      label: 'DALL-E 3',
                      desc: 'OpenAI — vivid quality',
                    },
                    {
                      id: 'claude_svg' as ImageGenerator,
                      icon: '◈',
                      label: 'Claude SVG',
                      desc: 'Vector graphics — brand-perfect',
                    },
                    {
                      id: 'canva' as ImageGenerator,
                      icon: '🎨',
                      label: 'Canva',
                      desc: 'Your brand template',
                    },
                  ] as { id: ImageGenerator; icon: string; label: string; desc: string; badge?: string }[]
                ).map(({ id, icon, label, desc, badge }) => (
                  <button
                    key={id}
                    onClick={() => setImageGenerator(id)}
                    className={`flex flex-col gap-1 py-3 px-3 rounded-xl border text-left transition-all ${
                      imageGenerator === id
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-base">{icon}</span>
                      {badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full leading-none">
                          {badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[var(--foreground)]">{label}</span>
                    <span className="text-[11px] text-[var(--muted)] leading-tight">{desc}</span>
                  </button>
                ))}
              </div>

              {/* Style picker — shown for all AI image generators */}
              {(imageGenerator === 'gemini' || imageGenerator === 'openai' || imageGenerator === 'claude_svg') && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-[var(--foreground)]">Visual Style</label>
                  <p className="text-[11px] text-[var(--muted)]">
                    {imageGenerator === 'claude_svg'
                      ? 'Claude SVG only supports infographic styles (text + shapes, no photographic backgrounds).'
                      : 'Image-rich styles use a topic-relevant background. Infographic styles are pure text + shapes.'}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {stylesForGenerator(imageGenerator).map((s) => {
                      const info = CAROUSEL_STYLES[s]
                      return (
                        <button
                          key={s}
                          onClick={() => setStyle(s)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            style === s
                              ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                              : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                          }`}
                        >
                          <StyleSwatch styleKey={s} brandSettings={brandSettings} />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[var(--foreground)]">{info.label}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                info.kind === 'image-rich'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {info.kind === 'image-rich' ? 'IMAGE' : 'INFO'}
                              </span>
                            </div>
                            <span className="text-xs text-[var(--muted)] line-clamp-1">{info.description}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {imageGenerator === 'claude_svg' && (
                    <p className="text-[11px] text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 leading-relaxed">
                      ◈ Claude generates pure SVG code for each slide — pixel-perfect brand colors, no AI hallucinations. Best for precision, brand-consistent graphics.
                    </p>
                  )}
                  {imageGenerator === 'openai' && (
                    <p className="text-[11px] text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 leading-relaxed">
                      ⬡ Requires <code className="font-mono">OPENAI_API_KEY</code> in your environment. Outputs 1024px images — sizes auto-mapped to nearest supported ratio.
                    </p>
                  )}
                </div>
              )}

              {/* Canva section */}
              {imageGenerator === 'canva' && (
                <div className="flex flex-col gap-3">
                  {canvaConnected ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-green-600 font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Canva connected
                      </span>
                      <button
                        onClick={async () => {
                          await fetch('/api/canva/disconnect', { method: 'POST' })
                          setCanvaConnected(false)
                        }}
                        className="text-[var(--muted)] hover:text-red-500 underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <a
                      href="/api/canva/auth"
                      className="w-full py-2.5 text-sm font-medium text-center bg-[#7B3FE4] text-white rounded-xl hover:opacity-90 transition-opacity block"
                    >
                      Connect Canva Account
                    </a>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--foreground)]">Brand Template ID</label>
                    <input
                      type="text"
                      value={canvaTemplateId}
                      onChange={(e) => setCanvaTemplateId(e.target.value)}
                      placeholder="e.g. OAFDMxMvS3E"
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                      Template must have 10 pages with text fields named{' '}
                      <code className="bg-[var(--surface)] px-1 py-0.5 rounded text-[10px]">slide_1</code>–<code className="bg-[var(--surface)] px-1 py-0.5 rounded text-[10px]">slide_10</code>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Slide Count — 4 to 10 slider */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-[var(--foreground)]">5. Slide Count</h2>
                <span className="text-sm font-bold text-[var(--primary)]">{numSlides} slides</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                More slides = deeper story. Hook + Pain + CTA always present; rehook, AHA, takeaway, and extra value scale up automatically.
              </p>
              <input
                type="range"
                min={MIN_SLIDES}
                max={MAX_SLIDES}
                step={1}
                value={numSlides}
                onChange={(e) => setNumSlides(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-[var(--surface)] rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--muted)] font-medium px-1">
                {Array.from({ length: MAX_SLIDES - MIN_SLIDES + 1 }, (_, i) => i + MIN_SLIDES).map((n) => (
                  <span key={n} className={n === numSlides ? 'text-[var(--primary)] font-bold' : ''}>{n}</span>
                ))}
              </div>
            </div>

            {/* 6. Aspect Ratio */}
            {imageGenerator !== 'canva' && (
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3">
                <h2 className="font-semibold text-sm text-[var(--foreground)]">6. Aspect Ratio</h2>
                <div className="grid grid-cols-3 gap-2">
                  {RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${
                        aspectRatio === opt.value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                      }`}
                    >
                      <RatioBox ratio={opt.value} active={aspectRatio === opt.value} />
                      <span className="text-xs font-bold text-[var(--foreground)]">{opt.label}</span>
                      <span className="text-[10px] text-[var(--muted)]">{opt.dims}</span>
                      {opt.note === 'Recommended' && (
                        <span className="text-[10px] text-green-600 font-medium">{opt.note}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !hasContent || (imageGenerator === 'canva' && !canvaConnected) || (imageGenerator === 'canva' && !canvaTemplateId.trim())}
              className="w-full py-4 px-4 bg-[var(--primary)] text-white rounded-2xl font-semibold text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <><LoadingSpinner /><span>Generating carousel…</span></>
              ) : (
                <><span>✦</span><span>Generate {numSlides}-Slide Carousel</span></>
              )}
            </button>

            {generateError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {generateError}
              </div>
            )}
          </div>

          {/* ── Right Panel ── */}
          <div className="flex flex-col gap-4">

            {/* Tab bar */}
            <div className="flex gap-1 bg-white rounded-xl border border-[var(--border)] p-1">
              {(['preview', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${
                    rightTab === tab
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {tab === 'history' ? `History (${history.length})` : 'Preview'}
                </button>
              ))}
            </div>

            {rightTab === 'preview' && (<>

            {/* Empty state */}
            {!result && !generating && (
              <div className="flex-1 bg-white rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-3xl mb-4">🎠</div>
                <p className="font-semibold text-[var(--foreground)]">Your carousel will appear here</p>
                <p className="text-sm text-[var(--muted)] mt-1 max-w-xs leading-relaxed">
                  Add your content on the left, then click Generate. Claude writes the slide texts in your brand voice, then your chosen generator creates the images.
                </p>
                <div className="mt-6 flex flex-col gap-2 text-left w-full max-w-xs">
                  {['HOOK — pattern interrupt', 'REHOOK — open loop', 'PAIN — relatable story', 'VALUE × 4 — key insights', 'AHA MOMENT — turning point', 'TAKEAWAY — clear action', 'CTA — drive engagement'].map((s) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]/30 flex-shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {generating && (
              <div className="flex-1 bg-white rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
                <div className="relative mb-8">
                  <div className="w-16 h-16 rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
                </div>
                <p className="font-semibold text-[var(--foreground)] mb-6">Building your viral carousel…</p>
                <div className="flex flex-col gap-3 w-full max-w-xs text-left">
                  {GENERATION_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                        generationStep === i
                          ? 'text-[var(--primary)] font-medium'
                          : generationStep > i
                          ? 'text-green-600'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {generationStep > i ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : generationStep === i ? (
                          <div className="w-3 h-3 rounded-full bg-[var(--primary)] animate-pulse" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border-2 border-[var(--border)]" />
                        )}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--muted)] mt-8">This takes 30–90 seconds</p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="flex flex-col gap-4">

                {/* Storage warning */}
                {result.storageErrors?.length ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-amber-800">
                      Images generated but could not be saved to storage — download them before leaving.
                    </p>
                  </div>
                ) : null}

                {/* Caption card */}
                <div className="bg-white rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Instagram Caption</h3>
                    <button
                      onClick={() => navigator.clipboard.writeText(caption)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    placeholder="Caption will appear here after generation…"
                  />
                </div>

                {/* Slides header */}
                <div className="bg-white rounded-2xl border border-[var(--border)] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {result.slides.length} slides generated
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">Saved to your content library</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadAll}
                      className="px-3 py-2 text-xs font-medium text-[var(--foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] transition-colors"
                    >
                      ↓ Download all
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="px-3 py-2 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                </div>

                {/* Slide grid — responsive: 1 col mobile, 2 tablet, 3+ desktop.
                    Compact tile rendering so users can see all slides at once
                    on desktop without scrolling through huge previews. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {result.slides.map((slide) => (
                    <div key={slide.number} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col">
                      {/* Image */}
                      <div className={`relative bg-gray-100 overflow-hidden ${aspectClass(aspectRatio)}`}>
                        {(slide.url || slide.fallbackBase64) ? (
                          <img
                            src={
                              slide.url ||
                              `data:${slide.fallbackMime ?? 'image/jpeg'};base64,${slide.fallbackBase64}`
                            }
                            alt={`Slide ${slide.number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">No image</div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                          {slide.number}/{result.slides.length}
                        </div>
                      </div>

                      {/* Slide info */}
                      <div className="p-2.5 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {slide.label && (
                            <span className={`inline-block self-start text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SLIDE_TYPE_COLORS[slide.type] ?? 'bg-gray-100 text-gray-600'}`}>
                              {slide.label}
                            </span>
                          )}
                          <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2 leading-relaxed">{slide.text}</p>
                          {slide.body && (
                            <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">{slide.body}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDownload(slide)}
                          className="flex-shrink-0 p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                          title="Download"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </>)}

            {/* ── History Tab ── */}
            {rightTab === 'history' && (
              <div className="flex flex-col gap-3">
                {historyLoading ? (
                  <div className="bg-white rounded-2xl border border-[var(--border)] flex items-center justify-center p-12 min-h-[300px]">
                    <div className="w-8 h-8 rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-2xl mb-3">🕓</div>
                    <p className="font-semibold text-sm text-[var(--foreground)]">No carousels yet</p>
                    <p className="text-xs text-[var(--muted)] mt-1">Your generated carousels will appear here.</p>
                  </div>
                ) : (
                  history.map((job) => {
                    const firstSlide = job.slides?.[0]
                    const thumb = firstSlide?.url || (firstSlide?.fallbackBase64
                      ? `data:${(firstSlide as StudioSlide).fallbackMime ?? 'image/jpeg'};base64,${(firstSlide as StudioSlide).fallbackBase64}`
                      : null)
                    const date = new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    return (
                      <div key={job.id} className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden flex gap-0">
                        {/* Thumbnail */}
                        <div className="w-20 flex-shrink-0 bg-gray-100 relative">
                          {thumb ? (
                            <img src={thumb} alt="First slide" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🎠</div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 p-3 flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">{date}</span>
                            <span className="text-[10px] text-[var(--muted)]">{job.slides.length} slides</span>
                          </div>
                          {job.content_preview && (
                            <p className="text-xs text-[var(--foreground)] font-medium line-clamp-1">{job.content_preview}</p>
                          )}
                          {job.caption && (
                            <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">{job.caption}</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => restoreJob(job)}
                              className="flex-1 py-1.5 text-[11px] font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleDeleteJob(job.id)}
                              className="px-2.5 py-1.5 text-[11px] text-[var(--muted)] border border-[var(--border)] rounded-lg hover:text-red-500 hover:border-red-200 transition-colors"
                              title="Delete"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RatioBox({ ratio, active }: { ratio: AspectRatio; active: boolean }) {
  const dims: Record<AspectRatio, { w: number; h: number }> = {
    '1:1':  { w: 24, h: 24 },
    '16:9': { w: 28, h: 16 },
    '4:3':  { w: 26, h: 20 },
    '3:4':  { w: 20, h: 27 },
    '4:5':  { w: 22, h: 27 },
    '2:1':  { w: 28, h: 14 },
  }
  const { w, h } = dims[ratio] ?? { w: 24, h: 24 }
  return (
    <div
      style={{ width: w, height: h }}
      className={`rounded-sm border-2 transition-colors ${
        active ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--muted)]/40 bg-[var(--surface)]'
      }`}
    />
  )
}

function StyleSwatch({ styleKey, brandSettings }: { styleKey: CarouselStyle; brandSettings?: BrandSettings | null }) {
  if (styleKey === 'brand_colors' && brandSettings) {
    return (
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-[var(--border)]"
        style={{ backgroundColor: brandSettings.background_color }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: brandSettings.accent_color }} />
        <div className="w-4 h-1.5 rounded ml-1" style={{ backgroundColor: brandSettings.text_color }} />
      </div>
    )
  }

  const swatches: Record<Exclude<CarouselStyle, 'brand_colors'>, React.ReactNode> = {
    // Infographic
    white_card: (
      <div className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center flex-shrink-0">
        <div className="w-5 h-1.5 bg-gray-900 rounded" />
      </div>
    ),
    dark_statement: (
      <div className="w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center flex-shrink-0">
        <div className="w-5 h-1.5 bg-white rounded" />
      </div>
    ),
    // Image-rich (new)
    modern: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-slate-200">
        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-slate-900/60 to-transparent" />
        <div className="w-5 h-1.5 bg-white rounded relative z-10" />
      </div>
    ),
    minimal: (
      <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-1 bg-stone-700 rounded" />
      </div>
    ),
    bold: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-700 via-rose-600 to-orange-600 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/30" />
        <div className="w-5 h-1.5 bg-yellow-300 rounded relative z-10" />
      </div>
    ),
    futuristic: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-700 via-purple-600 to-fuchsia-500 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="w-5 h-1.5 bg-cyan-300 rounded shadow-[0_0_4px_rgba(103,232,249,0.8)]" />
      </div>
    ),
    playful: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-300 via-amber-200 to-emerald-300 flex items-center justify-center flex-shrink-0">
        <div className="w-5 h-1.5 bg-rose-700 rounded" />
      </div>
    ),
    // Legacy (kept for old saved jobs)
    gradient_bold: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
        <div className="w-5 h-1.5 bg-white rounded" />
      </div>
    ),
    cinematic: (
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/40" />
        <div className="w-5 h-1.5 bg-white rounded relative z-10" />
      </div>
    ),
    branded_minimal: (
      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-l" />
        <div className="w-4 h-1.5 bg-gray-900 rounded ml-1" />
      </div>
    ),
  }
  return swatches[styleKey as Exclude<CarouselStyle, 'brand_colors'>] ?? null
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function aspectClass(ratio: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    '1:1':  'aspect-square',
    '16:9': 'aspect-video',
    '4:3':  'aspect-[4/3]',
    '3:4':  'aspect-[3/4]',
    '4:5':  'aspect-[4/5]',
    '2:1':  'aspect-[2/1]',
  }
  return map[ratio] ?? 'aspect-[3/4]'
}

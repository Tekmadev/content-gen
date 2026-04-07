'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import { CAROUSEL_STYLES } from '@/lib/carousel-styles'
import type { PostDraft, CarouselPlatform, CarouselStyle, CarouselSlide } from '@/lib/types'
import type { AspectRatio } from '@/lib/gemini'

// ── Platform config ─────────────────────────────────────────────────────────

interface RatioOption {
  value: AspectRatio
  label: string
  dims: string      // human-readable pixel dimensions
  orientation: string
}

const PLATFORM_RATIOS: Record<CarouselPlatform, RatioOption[]> = {
  instagram_carousel: [
    { value: '3:4',  label: '3:4',  dims: '1080×1440', orientation: 'Portrait (Recommended)' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '4:5',  label: '4:5',  dims: '1080×1350', orientation: 'Portrait' },
  ],
  linkedin_image: [
    { value: '16:9', label: '16:9', dims: '1920×1080', orientation: 'Landscape (Recommended)' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '4:5',  label: '4:5',  dims: '1080×1350', orientation: 'Portrait' },
  ],
  x_image: [
    { value: '16:9', label: '16:9', dims: '1280×720',  orientation: 'Landscape (Recommended)' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '2:1',  label: '2:1',  dims: '1500×750',  orientation: 'Wide Banner' },
  ],
}

const DEFAULT_RATIO: Record<CarouselPlatform, AspectRatio> = {
  instagram_carousel: '3:4',
  linkedin_image:     '16:9',
  x_image:            '16:9',
}

// CSS aspect-ratio class per ratio value
function aspectClass(ratio: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    '1:1':  'aspect-square',
    '16:9': 'aspect-video',
    '4:3':  'aspect-[4/3]',
    '3:4':  'aspect-[3/4]',
    '4:5':  'aspect-[4/5]',
    '2:1':  'aspect-[2/1]',
  }
  return map[ratio] ?? 'aspect-video'
}

const PLATFORMS: {
  value: CarouselPlatform
  label: string
  icon: string
  description: string
  maxSlides: number
}[] = [
  {
    value: 'instagram_carousel',
    label: 'Instagram Carousel',
    icon: '📸',
    description: 'Multi-slide carousel post',
    maxSlides: 10,
  },
  {
    value: 'linkedin_image',
    label: 'LinkedIn Image',
    icon: '💼',
    description: 'Single image post',
    maxSlides: 1,
  },
  {
    value: 'x_image',
    label: 'X / Twitter Image',
    icon: '𝕏',
    description: 'Single image post',
    maxSlides: 1,
  },
]

const STYLE_KEYS = Object.keys(CAROUSEL_STYLES) as CarouselStyle[]

// ── Result type ──────────────────────────────────────────────────────────────

interface GenerationResult {
  jobId: string
  platform: CarouselPlatform
  style: CarouselStyle
  numSlides: number
  slides: CarouselSlide[]
  draftId?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CarouselPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{
    email?: string
    user_metadata?: { avatar_url?: string; full_name?: string }
  } | null>(null)

  // Source
  const [sourceMode, setSourceMode] = useState<'post' | 'text'>('post')
  const [posts, setPosts] = useState<PostDraft[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [manualContent, setManualContent] = useState('')

  // Config
  const [platform, setPlatform] = useState<CarouselPlatform>('instagram_carousel')
  const [numSlides, setNumSlides] = useState(5)
  const [style, setStyle] = useState<CarouselStyle>('dark_statement')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4')

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [attachingDraftId, setAttachingDraftId] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [attachSuccess, setAttachSuccess] = useState('')

  // Load user + recent posts
  const loadPosts = useCallback(async () => {
    const res = await fetch('/api/posts?limit=20')
    if (res.ok) setPosts(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadPosts()
  }, [loadPosts, supabase])

  // When platform changes — reset slides and default aspect ratio
  useEffect(() => {
    const p = PLATFORMS.find((pl) => pl.value === platform)
    if (p && p.maxSlides === 1) setNumSlides(1)
    setAspectRatio(DEFAULT_RATIO[platform])
  }, [platform])

  const selectedDraft = posts.find((p) => p.id === selectedDraftId)
  const activePlatform = PLATFORMS.find((p) => p.value === platform)!

  function getContent(): string {
    if (sourceMode === 'text') return manualContent.trim()
    if (selectedDraft) {
      return (
        selectedDraft.extracted_content ||
        selectedDraft[`${platform === 'instagram_carousel' ? 'instagram' : platform === 'linkedin_image' ? 'linkedin' : 'x'}_text` as keyof PostDraft] as string ||
        selectedDraft.source_content ||
        ''
      )
    }
    return ''
  }

  async function handleGenerate() {
    const content = getContent()
    if (!content) {
      setError(sourceMode === 'post' ? 'Select a post first.' : 'Enter some content first.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setAttachSuccess('')

    try {
      const res = await fetch('/api/carousel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform,
          numSlides,
          style,
          aspectRatio,
          ...(sourceMode === 'post' && selectedDraftId ? { draftId: selectedDraftId } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setResult(data as GenerationResult)
      if (sourceMode === 'post' && selectedDraftId) {
        setAttachingDraftId(selectedDraftId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleAttach(draftId: string) {
    if (!result) return
    setAttaching(true)
    setAttachSuccess('')

    try {
      const res = await fetch('/api/carousel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: getContent(),
          platform: result.platform,
          numSlides: result.numSlides,
          style: result.style,
          draftId,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Attach failed')
      }
      setAttachSuccess(`Images attached to post successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attach failed')
    } finally {
      setAttaching(false)
    }
  }

  function handleDownload(slide: CarouselSlide) {
    const a = document.createElement('a')
    if (slide.fallbackBase64) {
      a.href = `data:${slide.fallbackMime ?? 'image/jpeg'};base64,${slide.fallbackBase64}`
      a.download = `slide_${slide.number}.${slide.fallbackMime === 'image/png' ? 'png' : 'jpg'}`
    } else {
      a.href = slide.url
      a.download = `slide_${slide.number}.jpg`
      a.target = '_blank'
    }
    a.click()
  }

  function handleDownloadAll() {
    result?.slides.forEach((slide, i) => {
      setTimeout(() => handleDownload(slide), i * 300)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell user={user}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Visual Creator</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Generate carousel slides and social images using Nano Banana (Gemini) — styled to your brand voice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">

          {/* ── Left Panel: Config ── */}
          <div className="flex flex-col gap-5">

            {/* Source */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-sm">1. Source Content</h2>

              {/* Mode tabs */}
              <div className="flex gap-2">
                {(['post', 'text'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSourceMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      sourceMode === m
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'bg-white text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {m === 'post' ? 'From Post' : 'Enter Text'}
                  </button>
                ))}
              </div>

              {sourceMode === 'post' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--muted)]">Select a post draft</label>
                  <select
                    value={selectedDraftId}
                    onChange={(e) => setSelectedDraftId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                  >
                    <option value="">— Select a post —</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.source_type.toUpperCase()} ·{' '}
                        {(p.source_url || p.source_content || '').slice(0, 55)}
                        {' · '}
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                  </select>
                  {selectedDraft && (
                    <p className="text-xs text-[var(--muted)] bg-[var(--surface)] rounded-lg px-3 py-2 leading-relaxed line-clamp-3">
                      {selectedDraft.extracted_content?.slice(0, 200) || selectedDraft.source_content?.slice(0, 200) || 'No content preview'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--muted)]">Paste content or write your idea</label>
                  <textarea
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Paste your content, article excerpt, or describe the message for your slides..."
                    rows={5}
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              )}
            </div>

            {/* Platform */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-sm">2. Platform</h2>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map((pl) => (
                  <button
                    key={pl.value}
                    onClick={() => setPlatform(pl.value)}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      platform === pl.value
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                    }`}
                  >
                    <span className="text-lg leading-none mt-0.5">{pl.icon}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[var(--foreground)]">{pl.label}</span>
                      <span className="text-xs text-[var(--muted)]">{pl.description}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Aspect ratio selector */}
              <div className="flex flex-col gap-2 pt-1">
                <label className="text-xs font-medium text-[var(--foreground)]">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORM_RATIOS[platform].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${
                        aspectRatio === opt.value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                      }`}
                    >
                      {/* Visual ratio preview box */}
                      <div className="flex items-center justify-center w-10 h-10">
                        <RatioBox ratio={opt.value} active={aspectRatio === opt.value} />
                      </div>
                      <span className="text-xs font-bold text-[var(--foreground)]">{opt.label}</span>
                      <span className="text-xs text-[var(--muted)] leading-tight">{opt.dims}</span>
                      <span className="text-xs text-[var(--muted)] leading-tight">{opt.orientation}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide count (only for carousel) */}
              {platform === 'instagram_carousel' && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--foreground)]">Number of slides</label>
                    <span className="text-sm font-bold text-[var(--primary)]">{numSlides}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={numSlides}
                    onChange={(e) => setNumSlides(Number(e.target.value))}
                    className="w-full accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)]">
                    <span>2 slides</span>
                    <span>10 slides</span>
                  </div>
                </div>
              )}
            </div>

            {/* Style */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4">
              <h2 className="font-semibold text-sm">3. Visual Style</h2>
              <div className="flex flex-col gap-2">
                {STYLE_KEYS.map((s) => {
                  const info = CAROUSEL_STYLES[s]
                  return (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        style === s
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface)]'
                      }`}
                    >
                      <StyleSwatch styleKey={s} />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium text-[var(--foreground)]">{info.label}</span>
                        <span className="text-xs text-[var(--muted)] line-clamp-2">{info.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 px-4 bg-[var(--primary)] text-white rounded-2xl font-semibold text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span>Generating with Nano Banana…</span>
                </>
              ) : (
                <>
                  <span>✦</span>
                  <span>
                    Generate {platform === 'instagram_carousel' ? `${numSlides} Slides` : 'Image'}
                  </span>
                </>
              )}
            </button>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>

          {/* ── Right Panel: Preview ── */}
          <div className="flex flex-col gap-5">
            {!result && !loading && (
              <div className="flex-1 bg-white rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-3xl mb-4">
                  🖼️
                </div>
                <p className="font-medium text-[var(--foreground)]">Your images will appear here</p>
                <p className="text-sm text-[var(--muted)] mt-1 max-w-xs">
                  Configure your settings on the left and click Generate.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex-1 bg-white rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
                </div>
                <p className="font-semibold text-[var(--foreground)]">Generating your visuals…</p>
                <div className="flex flex-col gap-1.5 mt-3 text-sm text-[var(--muted)] text-left">
                  <p>① Claude is writing slide texts</p>
                  <p>② Nano Banana is rendering images</p>
                  <p>③ Uploading to your content library</p>
                </div>
                <p className="text-xs text-[var(--muted)] mt-4">This takes 30–60 seconds</p>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-4">

                {/* Storage failure warning */}
                {(result as GenerationResult & { storageErrors?: string[] }).storageErrors?.length ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-amber-800">Images generated but could not be saved to storage — download them below before leaving this page.</p>
                    {(result as GenerationResult & { storageErrors?: string[] }).storageErrors!.map((e, i) => (
                      <p key={i} className="text-xs text-amber-700">{e}</p>
                    ))}
                  </div>
                ) : null}

                {/* Result header */}
                <div className="bg-white rounded-2xl border border-[var(--border)] p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {result.slides.length} {result.slides.length === 1 ? 'image' : 'slides'} generated
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {PLATFORMS.find((p) => p.value === result.platform)?.label} ·{' '}
                      {CAROUSEL_STYLES[result.style].label}
                    </p>
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
                      disabled={loading}
                      className="px-3 py-2 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                    >
                      ↺ Regenerate
                    </button>
                  </div>
                </div>

                {/* Slide grid */}
                <div
                  className={`grid gap-3 ${
                    result.slides.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2'
                  }`}
                >
                  {result.slides.map((slide) => (
                    <div
                      key={slide.number}
                      className="bg-white rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
                    >
                      {/* Image */}
                      <div className={`relative bg-gray-100 overflow-hidden ${aspectClass(aspectRatio)}`}>
                        <img
                          src={slide.url || (slide.fallbackBase64 ? `data:${slide.fallbackMime ?? 'image/jpeg'};base64,${slide.fallbackBase64}` : '')}
                          alt={`Slide ${slide.number}: ${slide.text}`}
                          className="w-full h-full object-cover"
                        />
                        {result.slides.length > 1 && (
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                            {slide.number}/{result.slides.length}
                          </div>
                        )}
                      </div>
                      {/* Slide info + actions */}
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="inline-block text-xs font-medium text-[var(--primary)] capitalize mb-0.5">{slide.type}</span>
                          <p className="text-xs text-[var(--muted)] truncate">{slide.text}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(slide)}
                          className="flex-shrink-0 p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded-lg transition-colors"
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attach to post */}
                <div className="bg-white rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Attach to a post</h3>
                  <p className="text-xs text-[var(--muted)]">
                    Link the first image to a post draft so it appears in the review page.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={attachingDraftId}
                      onChange={(e) => setAttachingDraftId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white"
                    >
                      <option value="">— Select a post —</option>
                      {posts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.source_type.toUpperCase()} ·{' '}
                          {(p.source_url || p.source_content || '').slice(0, 45)} ·{' '}
                          {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => attachingDraftId && handleAttach(attachingDraftId)}
                      disabled={!attachingDraftId || attaching}
                      className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {attaching ? 'Attaching…' : 'Attach'}
                    </button>
                  </div>
                  {attachSuccess && (
                    <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      {attachSuccess}
                      {' '}
                      <button
                        className="underline"
                        onClick={() => router.push(`/review?draftId=${attachingDraftId}`)}
                      >
                        Go to review →
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ── Ratio Box — visual representation of an aspect ratio ────────────────────

function RatioBox({ ratio, active }: { ratio: AspectRatio; active: boolean }) {
  // Map ratio to approximate w×h for the preview box (max 28px in either dimension)
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

// ── Style Swatch ─────────────────────────────────────────────────────────────

function StyleSwatch({ styleKey }: { styleKey: CarouselStyle }) {
  const swatches: Record<CarouselStyle, React.ReactNode> = {
    white_card: (
      <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center flex-shrink-0">
        <div className="w-6 h-1.5 bg-gray-900 rounded" />
      </div>
    ),
    dark_statement: (
      <div className="w-10 h-10 rounded-lg bg-[#111] flex items-center justify-center flex-shrink-0">
        <div className="w-6 h-1.5 bg-white rounded" />
      </div>
    ),
    gradient_bold: (
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
        <div className="w-6 h-1.5 bg-white rounded" />
      </div>
    ),
    cinematic: (
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/40" />
        <div className="w-6 h-1.5 bg-white rounded relative z-10" />
      </div>
    ),
    branded_minimal: (
      <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-l" />
        <div className="w-5 h-1.5 bg-gray-900 rounded ml-1" />
      </div>
    ),
  }
  return swatches[styleKey]
}

// ── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import { CAROUSEL_STYLES } from '@/lib/carousel-styles'
import type { PostDraft, BlotatoAccount, BlotatoTemplate, CarouselStyle, CarouselSlide, CarouselPlatform } from '@/lib/types'
import type { AspectRatio } from '@/lib/gemini'

interface AccountWithSubs extends BlotatoAccount {
  subAccounts: { id: string; name: string }[]
}

const PLATFORM_CONFIG = {
  linkedin:  { label: 'LinkedIn',   color: '#0077b5', maxChars: 3000 },
  instagram: { label: 'Instagram',  color: '#e1306c', maxChars: 2200 },
  x:         { label: 'X / Twitter', color: '#000000', maxChars: 280  },
} as const

type Platform = keyof typeof PLATFORM_CONFIG
type VisualType = 'none' | 'image' | 'video'
type VisualSource = 'blotato' | 'nanobana'

const PLATFORM_TO_CAROUSEL: Record<Platform, CarouselPlatform> = {
  instagram: 'instagram_carousel',
  linkedin:  'linkedin_image',
  x:         'x_image',
}

const CAROUSEL_STYLE_KEYS = Object.keys(CAROUSEL_STYLES) as CarouselStyle[]

interface RatioOption { value: AspectRatio; label: string; dims: string; orientation: string }

const PLATFORM_RATIOS: Record<Platform, RatioOption[]> = {
  instagram: [
    { value: '3:4',  label: '3:4',  dims: '1080×1440', orientation: 'Portrait ✓' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '4:5',  label: '4:5',  dims: '1080×1350', orientation: 'Portrait' },
  ],
  linkedin: [
    { value: '16:9', label: '16:9', dims: '1920×1080', orientation: 'Landscape ✓' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '4:5',  label: '4:5',  dims: '1080×1350', orientation: 'Portrait' },
  ],
  x: [
    { value: '16:9', label: '16:9', dims: '1280×720',  orientation: 'Landscape ✓' },
    { value: '1:1',  label: '1:1',  dims: '1080×1080', orientation: 'Square' },
    { value: '2:1',  label: '2:1',  dims: '1500×750',  orientation: 'Wide' },
  ],
}

const DEFAULT_RATIO: Record<Platform, AspectRatio> = {
  instagram: '3:4',
  linkedin:  '16:9',
  x:         '16:9',
}

function ratioAspectClass(ratio: AspectRatio): string {
  const map: Record<AspectRatio, string> = {
    '1:1': 'aspect-square', '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',  '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',  '2:1': 'aspect-[2/1]',
  }
  return map[ratio] ?? 'aspect-video'
}

function ReviewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draftId')
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{ email?: string; user_metadata?: Record<string, string> } | null>(null)
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [texts, setTexts] = useState({ linkedin: '', instagram: '', x: '' })
  const [visuals, setVisuals] = useState({ linkedin: '', instagram: '', x: '' })
  const [accounts, setAccounts] = useState<AccountWithSubs[]>([])
  const [templates, setTemplates] = useState<BlotatoTemplate[]>([])

  const [selectedAccounts, setSelectedAccounts] = useState<Record<Platform, string>>({ linkedin: '', instagram: '', x: '' })
  const [selectedSubAccounts, setSelectedSubAccounts] = useState<Record<Platform, string>>({ linkedin: '', instagram: '', x: '' })
  const [selectedTemplates, setSelectedTemplates] = useState<Record<Platform, string>>({ linkedin: '', instagram: '', x: '' })
  const [visualTypes, setVisualTypes] = useState<Record<Platform, VisualType>>({ linkedin: 'none', instagram: 'none', x: 'none' })
  const [checkedPlatforms, setCheckedPlatforms] = useState<Record<Platform, boolean>>({ linkedin: true, instagram: true, x: true })

  const [publishResults, setPublishResults] = useState<Record<Platform, { url?: string; error?: string; published?: boolean }>>({
    linkedin: {}, instagram: {}, x: {}
  })
  const [publishingPlatform, setPublishingPlatform] = useState<Platform | 'all' | null>(null)
  const [generatingVisual, setGeneratingVisual] = useState<Platform | null>(null)
  const [visualErrors, setVisualErrors] = useState<Record<Platform, string>>({ linkedin: '', instagram: '', x: '' })
  const [retrying, setRetrying] = useState(false)

  // ── Nano Banana carousel state ─────────────────────────────────────────────
  const [visualSources, setVisualSources] = useState<Record<Platform, VisualSource>>({ linkedin: 'blotato', instagram: 'blotato', x: 'blotato' })
  const [carouselStyles, setCarouselStyles] = useState<Record<Platform, CarouselStyle>>({ linkedin: 'dark_statement', instagram: 'dark_statement', x: 'dark_statement' })
  const [carouselSlideCounts, setCarouselSlideCounts] = useState<Record<Platform, number>>({ linkedin: 1, instagram: 5, x: 1 })
  const [carouselAspectRatios, setCarouselAspectRatios] = useState<Record<Platform, AspectRatio>>(DEFAULT_RATIO)
  const [carouselResults, setCarouselResults] = useState<Record<Platform, CarouselSlide[]>>({ linkedin: [], instagram: [], x: [] })
  const [generatingCarousel, setGeneratingCarousel] = useState<Platform | null>(null)
  const [carouselErrors, setCarouselErrors] = useState<Record<Platform, string>>({ linkedin: '', instagram: '', x: '' })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDraft = useCallback(async () => {
    if (!draftId) return
    const res = await fetch('/api/posts')
    if (!res.ok) return
    const posts: PostDraft[] = await res.json()
    const found = posts.find((p) => p.id === draftId)
    if (!found) { setError('Draft not found'); setLoading(false); return }
    setDraft(found)
    setTexts({
      linkedin: found.linkedin_text ?? '',
      instagram: found.instagram_text ?? '',
      x: found.x_text ?? '',
    })
    setVisuals({
      linkedin: found.linkedin_visual_url ?? '',
      instagram: found.instagram_visual_url ?? '',
      x: found.x_visual_url ?? '',
    })
    setPublishResults({
      linkedin: found.linkedin_url ? { url: found.linkedin_url, published: true } : {},
      instagram: found.instagram_url ? { url: found.instagram_url, published: true } : {},
      x: found.x_url ? { url: found.x_url, published: true } : {},
    })
    setCheckedPlatforms({
      linkedin: !found.linkedin_url,
      instagram: !found.instagram_url,
      x: !found.x_url,
    })
    setLoading(false)
  }, [draftId])

  useEffect(() => {
    if (!draftId) { router.push('/dashboard'); return }
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    Promise.all([
      loadDraft(),
      fetch('/api/accounts').then((r) => r.json()).then((d) => setAccounts(Array.isArray(d) ? d : [])).catch(() => {}),
      fetch('/api/templates').then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}),
    ])
  }, [draftId, router, loadDraft])

  useEffect(() => {
    if (!accounts.length) return
    const auto: Record<Platform, string> = { linkedin: '', instagram: '', x: '' }
    accounts.forEach((a) => {
      if (a.platform === 'linkedin' && !auto.linkedin) auto.linkedin = a.id
      if (a.platform === 'instagram' && !auto.instagram) auto.instagram = a.id
      if (a.platform === 'twitter' && !auto.x) auto.x = a.id
    })
    setSelectedAccounts(auto)
  }, [accounts])

  async function handleRetry() {
    if (!draftId) return
    setRetrying(true)
    const res = await fetch('/api/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId }),
    })
    if (res.ok) {
      setLoading(true)
      await loadDraft()
    }
    setRetrying(false)
  }

  async function generateVisualForPlatform(platform: Platform) {
    if (!draftId || !draft?.extracted_content) return
    const templateId = selectedTemplates[platform]
    if (!templateId) return
    setGeneratingVisual(platform)
    setVisualErrors((prev) => ({ ...prev, [platform]: '' }))
    try {
      const res = await fetch('/api/visuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          content: draft.extracted_content,
          linkedinTemplateId: platform === 'linkedin' ? templateId : undefined,
          instagramTemplateId: platform === 'instagram' ? templateId : undefined,
          xTemplateId: platform === 'x' ? templateId : undefined,
        }),
      })
      const data = await res.json()
      // data[platform] is the stored Supabase URL, data.errors has any failures
      if (data[platform]) {
        setVisuals((prev) => ({ ...prev, [platform]: data[platform] }))
      } else {
        const errMsg = data.errors?.find((e: string) => e.startsWith(platform))
          ?? data.errors?.[0]
          ?? 'Visual generation failed — check your template in Blotato'
        setVisualErrors((prev) => ({ ...prev, [platform]: errMsg }))
      }
    } catch {
      setVisualErrors((prev) => ({ ...prev, [platform]: 'Network error generating visual' }))
    }
    setGeneratingVisual(null)
  }

  async function handleGenerateCarousel(platform: Platform) {
    const content = draft?.extracted_content || texts[platform]
    if (!content) return
    setGeneratingCarousel(platform)
    setCarouselErrors((prev) => ({ ...prev, [platform]: '' }))
    try {
      const res = await fetch('/api/carousel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform: PLATFORM_TO_CAROUSEL[platform],
          numSlides: carouselSlideCounts[platform],
          style: carouselStyles[platform],
          aspectRatio: carouselAspectRatios[platform],
          draftId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const slides: CarouselSlide[] = data.slides ?? []
      setCarouselResults((prev) => ({ ...prev, [platform]: slides }))
      // Auto-set first slide as the visual
      if (slides[0]) setVisuals((prev) => ({ ...prev, [platform]: slides[0].url }))
    } catch (err) {
      setCarouselErrors((prev) => ({ ...prev, [platform]: err instanceof Error ? err.message : 'Generation failed' }))
    }
    setGeneratingCarousel(null)
  }

  async function publishPlatform(platform: Platform) {
    if (!draftId || !selectedAccounts[platform] || !texts[platform]) return
    setPublishingPlatform(platform)

    const platformData: Record<string, unknown> = {}
    platformData[platform] = {
      accountId: selectedAccounts[platform],
      pageId: selectedSubAccounts[platform] || undefined,
      text: texts[platform],
      visualUrl: visualTypes[platform] !== 'none' ? (visuals[platform] || undefined) : undefined,
    }

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, platforms: platformData }),
    })
    const data = await res.json()
    setPublishResults((prev) => ({
      ...prev,
      [platform]: data[platform] ?? { error: 'Publish failed' },
    }))
    setPublishingPlatform(null)
  }

  async function publishSelected() {
    if (!draftId) return
    const toPublish = (Object.keys(checkedPlatforms) as Platform[]).filter(
      (p) => checkedPlatforms[p] && !publishResults[p]?.published && selectedAccounts[p] && texts[p]
    )
    if (!toPublish.length) return
    setPublishingPlatform('all')

    const platforms: Record<string, unknown> = {}
    toPublish.forEach((p) => {
      platforms[p] = {
        accountId: selectedAccounts[p],
        pageId: selectedSubAccounts[p] || undefined,
        text: texts[p],
        visualUrl: visualTypes[p] !== 'none' ? (visuals[p] || undefined) : undefined,
      }
    })

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, platforms }),
    })
    const data = await res.json()
    setPublishResults((prev) => {
      const updated = { ...prev }
      toPublish.forEach((p) => { updated[p] = data[p] ?? { error: 'Publish failed' } })
      return updated
    })
    setPublishingPlatform(null)
  }

  function getAccountsForPlatform(platform: Platform) {
    const map: Record<Platform, string> = { linkedin: 'linkedin', instagram: 'instagram', x: 'twitter' }
    return accounts.filter((a) => a.platform === map[platform])
  }

  function getSubAccountsForSelected(platform: Platform) {
    const acc = accounts.find((a) => a.id === selectedAccounts[platform])
    return acc?.subAccounts ?? []
  }

  const anyCheckedUnpublished = (Object.keys(checkedPlatforms) as Platform[]).some(
    (p) => checkedPlatforms[p] && !publishResults[p]?.published
  )
  const allPublished = (['linkedin', 'instagram', 'x'] as Platform[]).every((p) => publishResults[p]?.published)

  if (loading) {
    return (
      <AppShell user={user}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--muted)]">Loading draft…</span>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell user={user}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center flex flex-col gap-4 items-center">
            <p className="text-red-600">{error}</p>
            <button onClick={() => router.push('/posts')} className="text-[var(--primary)] underline text-sm">
              Back to posts
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  // Failed state — only block if we have NO generated texts yet
  const hasTexts = !!(draft?.linkedin_text || draft?.instagram_text || draft?.x_text)
  if (draft?.status === 'failed' && !hasTexts) {
    return (
      <AppShell user={user}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/posts')} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              ← All Posts
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-red-200 p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-[var(--foreground)]">Generation failed</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {draft.error_message || 'An error occurred during content generation.'}
                </p>
              </div>
            </div>

            {/* Source info */}
            <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Source</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white border border-[var(--border)] rounded px-2 py-0.5 capitalize font-medium">
                  {draft.source_type}
                </span>
              </div>
              {draft.source_url && (
                <a
                  href={draft.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--primary)] hover:underline break-all"
                >
                  {draft.source_url}
                </a>
              )}
              {draft.source_content && (
                <p className="text-sm text-[var(--foreground)] line-clamp-4 leading-relaxed">
                  {draft.source_content}
                </p>
              )}
              {draft.extracted_content && (
                <details className="mt-1">
                  <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)]">
                    View extracted content
                  </summary>
                  <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed whitespace-pre-wrap line-clamp-10">
                    {draft.extracted_content}
                  </p>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {retrying ? 'Retrying…' : 'Retry Generation →'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 py-2.5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                New Post
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell user={user}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/posts')}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← All Posts
            </button>
            <span className="text-[var(--border)]">|</span>
            <span className="font-semibold text-sm">Review & Publish</span>
          </div>
          <div className="flex items-center gap-3">
            {!allPublished && (
              <button
                onClick={publishSelected}
                disabled={publishingPlatform !== null || !anyCheckedUnpublished}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {publishingPlatform === 'all' ? 'Publishing…' : 'Publish Selected →'}
              </button>
            )}
            {allPublished && (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium w-full sm:w-auto"
              >
                All Published — New Post
              </button>
            )}
          </div>
        </div>

        {/* Source info bar */}
        {draft && (
          <div className="bg-white rounded-xl border border-[var(--border)] px-4 py-3 flex items-start gap-3 flex-wrap">
            <span className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-0.5 capitalize font-medium flex-shrink-0">
              {draft.source_type}
            </span>
            {draft.source_url ? (
              <a
                href={draft.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--primary)] hover:underline truncate flex-1 min-w-0"
              >
                {draft.source_url}
              </a>
            ) : draft.source_content ? (
              <span className="text-xs text-[var(--muted)] truncate flex-1 min-w-0">
                {draft.source_content.slice(0, 120)}…
              </span>
            ) : null}
            <span className="text-xs text-[var(--muted)] flex-shrink-0">
              {new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Platform cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['linkedin', 'instagram', 'x'] as Platform[]).map((platform) => {
            const config = PLATFORM_CONFIG[platform]
            const platformAccounts = getAccountsForPlatform(platform)
            const subAccounts = getSubAccountsForSelected(platform)
            const charCount = texts[platform].length
            const overLimit = charCount > config.maxChars
            const result = publishResults[platform]
            const isPublished = result?.published
            const isPublishing = publishingPlatform === platform || publishingPlatform === 'all'
            const isGeneratingThisVisual = generatingVisual === platform

            return (
              <div
                key={platform}
                className={`bg-white rounded-xl border flex flex-col gap-4 p-4 sm:p-5 transition-colors ${
                  isPublished ? 'border-green-300 bg-green-50/30' :
                  result?.error ? 'border-red-300' :
                  'border-[var(--border)]'
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  {!isPublished && (
                    <input
                      type="checkbox"
                      checked={checkedPlatforms[platform]}
                      onChange={(e) => setCheckedPlatforms((prev) => ({ ...prev, [platform]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-[var(--primary)] flex-shrink-0"
                    />
                  )}
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
                  <span className="font-semibold text-sm">{config.label}</span>
                  {isPublished && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-700 font-medium">
                      Published
                      {result.url && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline ml-1">View →</a>
                      )}
                    </span>
                  )}
                </div>

                {isPublished ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-3">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-green-800">Published successfully</p>
                        {result.url && (
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 underline">
                            View post →
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)]">Other platforms can still be published below.</p>
                  </div>
                ) : (
                  <>
                    {/* Account */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--muted)]">Account</label>
                      {platformAccounts.length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          No {config.label} account connected in Blotato.
                        </p>
                      ) : (
                        <>
                          <select
                            value={selectedAccounts[platform]}
                            onChange={(e) => setSelectedAccounts((prev) => ({ ...prev, [platform]: e.target.value }))}
                            className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="">Select account</option>
                            {platformAccounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.displayName || a.username || a.id}</option>
                            ))}
                          </select>
                          {subAccounts.length > 0 && (
                            <select
                              value={selectedSubAccounts[platform]}
                              onChange={(e) => setSelectedSubAccounts((prev) => ({ ...prev, [platform]: e.target.value }))}
                              className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            >
                              <option value="">Personal profile</option>
                              {subAccounts.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </>
                      )}
                    </div>

                    {/* Visual */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[var(--muted)]">Visual</label>
                        <div className="flex gap-1">
                          {(['none', 'image', 'video'] as VisualType[]).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setVisualTypes((prev) => ({ ...prev, [platform]: type }))}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                visualTypes[platform] === type
                                  ? 'bg-[var(--primary)] text-white'
                                  : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'
                              }`}
                            >
                              {type === 'none' ? 'None' : type === 'image' ? 'Image' : 'Video'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {visualTypes[platform] === 'image' && (
                        <div className="flex flex-col gap-3">

                          {/* Source toggle: Blotato vs Nano Banana */}
                          <div className="flex gap-0.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">
                            {(['blotato', 'nanobana'] as VisualSource[]).map((src) => (
                              <button
                                key={src}
                                onClick={() => setVisualSources((prev) => ({ ...prev, [platform]: src }))}
                                className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                                  visualSources[platform] === src
                                    ? 'bg-white shadow-sm text-[var(--foreground)]'
                                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                                }`}
                              >
                                {src === 'blotato' ? 'Blotato Template' : '✦ Nano Banana'}
                              </button>
                            ))}
                          </div>

                          {/* ── Blotato Template section ── */}
                          {visualSources[platform] === 'blotato' && (
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={selectedTemplates[platform]}
                                onChange={(e) => setSelectedTemplates((prev) => ({ ...prev, [platform]: e.target.value }))}
                                className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                              >
                                <option value="">
                                  {templates.length ? 'Select template' : 'No templates — add in Blotato first'}
                                </option>
                                {templates.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                              {selectedTemplates[platform] && (
                                <button
                                  type="button"
                                  onClick={() => generateVisualForPlatform(platform)}
                                  disabled={isGeneratingThisVisual}
                                  className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50 text-left flex items-center gap-1.5"
                                >
                                  {isGeneratingThisVisual && (
                                    <span className="inline-block w-3 h-3 border border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                                  )}
                                  {isGeneratingThisVisual ? 'Generating…' : visuals[platform] ? 'Regenerate visual' : 'Generate visual'}
                                </button>
                              )}
                              {visualErrors[platform] && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                                  {visualErrors[platform]}
                                </p>
                              )}
                            </div>
                          )}

                          {/* ── Nano Banana section ── */}
                          {visualSources[platform] === 'nanobana' && (
                            <div className="flex flex-col gap-3">

                              {/* Aspect ratio picker */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs text-[var(--muted)]">Aspect Ratio</span>
                                <div className="flex gap-1.5 flex-wrap">
                                  {PLATFORM_RATIOS[platform].map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={() => setCarouselAspectRatios((prev) => ({ ...prev, [platform]: opt.value }))}
                                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs transition-all flex-1 min-w-0 ${
                                        carouselAspectRatios[platform] === opt.value
                                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]'
                                          : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/40'
                                      }`}
                                    >
                                      <span className="font-bold">{opt.label}</span>
                                      <span className="text-xs leading-tight opacity-70">{opt.dims}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Style picker */}
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs text-[var(--muted)]">Style</span>
                                <div className="flex flex-col gap-1">
                                  {CAROUSEL_STYLE_KEYS.map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => setCarouselStyles((prev) => ({ ...prev, [platform]: s }))}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
                                        carouselStyles[platform] === s
                                          ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]'
                                          : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/40'
                                      }`}
                                    >
                                      <StyleDot styleKey={s} />
                                      <span className="font-medium">{CAROUSEL_STYLES[s].label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Slide count (Instagram only) */}
                              {platform === 'instagram' && (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--muted)]">Slides</span>
                                    <span className="text-xs font-bold text-[var(--primary)]">{carouselSlideCounts[platform]}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={2}
                                    max={10}
                                    value={carouselSlideCounts[platform]}
                                    onChange={(e) => setCarouselSlideCounts((prev) => ({ ...prev, [platform]: Number(e.target.value) }))}
                                    className="w-full accent-[var(--primary)]"
                                  />
                                  <div className="flex justify-between text-xs text-[var(--muted)]">
                                    <span>2</span><span>10 slides</span>
                                  </div>
                                </div>
                              )}

                              {/* Generate button */}
                              <button
                                onClick={() => handleGenerateCarousel(platform)}
                                disabled={generatingCarousel === platform}
                                className="w-full py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {generatingCarousel === platform ? (
                                  <>
                                    <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    Generating…
                                  </>
                                ) : (
                                  <>✦ {carouselResults[platform].length > 0 ? 'Regenerate' : 'Generate'} {platform === 'instagram' ? `${carouselSlideCounts[platform]} Slides` : 'Image'}</>
                                )}
                              </button>

                              {carouselErrors[platform] && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                                  {carouselErrors[platform]}
                                </p>
                              )}

                              {/* Generated slides grid */}
                              {carouselResults[platform].length > 0 && (
                                <div className="flex flex-col gap-2">
                                  <span className="text-xs text-[var(--muted)]">
                                    {carouselResults[platform].length === 1 ? 'Generated image — click to use' : `${carouselResults[platform].length} slides — click any to set as visual`}
                                  </span>
                                  <div className={`grid gap-1.5 ${carouselResults[platform].length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {carouselResults[platform].map((slide) => {
                                      const imgSrc = slide.url || (slide.fallbackBase64 ? `data:${slide.fallbackMime ?? 'image/jpeg'};base64,${slide.fallbackBase64}` : '')
                                      return (
                                      <button
                                        key={slide.number}
                                        onClick={() => slide.url && setVisuals((prev) => ({ ...prev, [platform]: slide.url }))}
                                        disabled={!slide.url}
                                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                                          visuals[platform] === slide.url
                                            ? 'border-[var(--primary)] shadow-md'
                                            : slide.url ? 'border-transparent hover:border-[var(--primary)]/50' : 'border-amber-300 cursor-default'
                                        }`}
                                      >
                                        <img
                                          src={imgSrc}
                                          alt={`Slide ${slide.number}`}
                                          className={`w-full object-cover ${ratioAspectClass(carouselAspectRatios[platform])}`}
                                        />
                                        {!slide.url && slide.fallbackBase64 && (
                                          <div className="absolute bottom-1 left-1 right-1">
                                            <a
                                              href={imgSrc}
                                              download={`slide_${slide.number}.${slide.fallbackMime === 'image/png' ? 'png' : 'jpg'}`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="block text-center text-xs bg-amber-600 text-white rounded py-0.5 px-1"
                                            >
                                              ↓ Save (not in storage)
                                            </a>
                                          </div>
                                        )}
                                        {carouselResults[platform].length > 1 && (
                                          <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                                            {slide.number}
                                          </div>
                                        )}
                                        {visuals[platform] === slide.url && (
                                          <div className="absolute top-1 right-1 bg-[var(--primary)] text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                                            ✓ In use
                                          </div>
                                        )}
                                      </button>
                                      )
                                    })}
                                  </div>
                                  <p className="text-xs text-[var(--muted)] italic">
                                    {visuals[platform]
                                      ? `Slide selected. Only 1 image will be posted — pick the best one.`
                                      : 'Click a slide to select it as your post image.'}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Active visual preview */}
                          {visuals[platform] && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-[var(--muted)]">Selected visual</span>
                              <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black">
                                {/\.(mp4|webm|mov)(\?|$)/i.test(visuals[platform]) ? (
                                  <video src={visuals[platform]} controls className="w-full h-full object-contain" />
                                ) : (
                                  <img src={visuals[platform]} alt={`${config.label} visual`} className="w-full h-full object-contain" />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {visualTypes[platform] === 'video' && (
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={selectedTemplates[platform]}
                            onChange={(e) => setSelectedTemplates((prev) => ({ ...prev, [platform]: e.target.value }))}
                            className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="">
                              {templates.length ? 'Select template' : 'No templates — add in Blotato first'}
                            </option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {selectedTemplates[platform] && (
                            <button
                              type="button"
                              onClick={() => generateVisualForPlatform(platform)}
                              disabled={isGeneratingThisVisual}
                              className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50 text-left flex items-center gap-1.5"
                            >
                              {isGeneratingThisVisual && (
                                <span className="inline-block w-3 h-3 border border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                              )}
                              {isGeneratingThisVisual ? 'Generating…' : visuals[platform] ? 'Regenerate video' : 'Generate video'}
                            </button>
                          )}
                          {visualErrors[platform] && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                              {visualErrors[platform]}
                            </p>
                          )}
                          {visuals[platform] && (
                            <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black">
                              <video src={visuals[platform]} controls className="w-full h-full object-contain" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={texts[platform]}
                        onChange={(e) => setTexts((prev) => ({ ...prev, [platform]: e.target.value }))}
                        rows={8}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent leading-relaxed ${
                          overLimit ? 'border-red-400' : 'border-[var(--border)]'
                        }`}
                        placeholder={`${config.label} post text…`}
                      />
                      <div className={`text-xs text-right ${overLimit ? 'text-red-600' : 'text-[var(--muted)]'}`}>
                        {charCount} / {config.maxChars}
                      </div>
                    </div>

                    {/* Publish button */}
                    <button
                      onClick={() => publishPlatform(platform)}
                      disabled={isPublishing || !selectedAccounts[platform] || !texts[platform] || overLimit}
                      className="w-full py-2 border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPublishing && (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      )}
                      {isPublishing ? `Publishing ${config.label}…` : `Publish ${config.label} only`}
                    </button>

                    {/* Publish error */}
                    {result?.error && !isPublished && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                        <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs text-red-700 leading-relaxed">{result.error}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Partial publish hint */}
        {!allPublished && (['linkedin', 'instagram', 'x'] as Platform[]).some((p) => publishResults[p]?.published) && (
          <p className="text-sm text-center text-[var(--muted)]">
            Come back anytime to publish remaining platforms. Your draft is saved.
          </p>
        )}
      </div>
    </AppShell>
  )
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewPageInner />
    </Suspense>
  )
}

// ── Style dot swatch ──────────────────────────────────────────────────────────

function StyleDot({ styleKey }: { styleKey: CarouselStyle }) {
  const dots: Record<CarouselStyle, string> = {
    // Infographic
    white_card:      'bg-white border border-gray-300',
    dark_statement:  'bg-[#111]',
    brand_colors:    'bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)]',
    // Image-rich (new)
    modern:          'bg-gradient-to-br from-slate-300 to-slate-600',
    minimal:         'bg-stone-100 border border-stone-300',
    bold:            'bg-gradient-to-br from-red-700 to-orange-600',
    futuristic:      'bg-gradient-to-br from-indigo-600 to-fuchsia-500',
    playful:         'bg-gradient-to-br from-pink-300 via-amber-200 to-emerald-300',
    // Legacy
    gradient_bold:   'bg-gradient-to-br from-blue-600 to-purple-600',
    cinematic:       'bg-gradient-to-br from-gray-600 to-gray-900',
    branded_minimal: 'bg-orange-500',
  }
  return <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dots[styleKey]}`} />
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import type { PostDraft, BlotatoAccount, BlotatoTemplate } from '@/lib/types'

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

export default function ReviewPage() {
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
  const [retrying, setRetrying] = useState(false)

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
    if (res.ok) {
      const data = await res.json()
      if (data[platform]) setVisuals((prev) => ({ ...prev, [platform]: data[platform] }))
    }
    setGeneratingVisual(null)
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

  // Failed state — show source info + retry
  if (draft?.status === 'failed') {
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
                  {result?.error && !isPublished && (
                    <span className="ml-auto text-xs text-red-600 truncate max-w-[120px]" title={result.error}>
                      {result.error}
                    </span>
                  )}
                </div>

                {isPublished ? (
                  <p className="text-xs text-[var(--muted)] italic">
                    Published. Come back to publish other platforms.
                  </p>
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
                              <option key={a.id} value={a.id}>{a.fullname || a.username || a.id}</option>
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

                      {visualTypes[platform] !== 'none' && (
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
                              className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50 text-left"
                            >
                              {isGeneratingThisVisual ? 'Generating…' : visuals[platform] ? 'Regenerate visual' : 'Generate visual'}
                            </button>
                          )}

                          {visuals[platform] && (
                            <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black">
                              {/\.(mp4|webm|mov)(\?|$)/i.test(visuals[platform]) ? (
                                <video src={visuals[platform]} controls className="w-full h-full object-contain" />
                              ) : (
                                <img src={visuals[platform]} alt={`${config.label} visual`} className="w-full h-full object-contain" />
                              )}
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
                      className="w-full py-2 border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isPublishing ? `Publishing ${config.label}…` : `Publish ${config.label} only`}
                    </button>
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

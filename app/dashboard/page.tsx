'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import type { PostDraft, SourceType } from '@/lib/types'

const SOURCE_TYPES: { value: SourceType; label: string; placeholder: string; isText?: boolean }[] = [
  { value: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/watch?v=...' },
  { value: 'article', label: 'Article', placeholder: 'https://example.com/article' },
  { value: 'pdf', label: 'PDF URL', placeholder: 'https://example.com/document.pdf' },
  { value: 'email', label: 'Email / Text', placeholder: 'Paste your content here...', isText: true },
]

const STEPS = ['Extracting content', 'Generating posts', 'Creating visuals']

interface Stats {
  total: number
  published: number
  ready: number
  failed: number
  generating: number
  platforms: { linkedin: number; instagram: number; x: number }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; full_name?: string } } | null>(null)
  const [sourceType, setSourceType] = useState<SourceType>('youtube')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(-1)
  const [error, setError] = useState('')
  const [recentPosts, setRecentPosts] = useState<PostDraft[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const fetchRecentPosts = useCallback(async () => {
    const res = await fetch('/api/posts?limit=5')
    if (res.ok) setRecentPosts(await res.json())
  }, [])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats')
    if (res.ok) setStats(await res.json())
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchRecentPosts()
    fetchStats()
  }, [fetchRecentPosts, fetchStats])

  // Poll while any post is in a non-terminal state
  useEffect(() => {
    const hasActive = recentPosts.some(
      (p) => p.status === 'generating' || p.status === 'publishing'
    )
    if (!hasActive) return
    const id = setInterval(() => { fetchRecentPosts(); fetchStats() }, 3000)
    return () => clearInterval(id)
  }, [recentPosts, fetchRecentPosts, fetchStats])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setStep(0)

    try {
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          sourceType === 'email'
            ? { sourceType: 'email', text: input }
            : { sourceType, url: input }
        ),
      })
      if (!extractRes.ok) throw new Error((await extractRes.json()).error)
      const { draftId, content } = await extractRes.json()

      setStep(1)
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, content }),
      })
      if (!generateRes.ok) throw new Error((await generateRes.json()).error)

      setStep(2)
      await fetch('/api/visuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          content,
          linkedinTemplateId: process.env.NEXT_PUBLIC_BLOTATO_LINKEDIN_TEMPLATE_ID,
          instagramTemplateId: process.env.NEXT_PUBLIC_BLOTATO_INSTAGRAM_TEMPLATE_ID,
          xTemplateId: process.env.NEXT_PUBLIC_BLOTATO_X_TEMPLATE_ID,
        }),
      })

      await Promise.all([fetchRecentPosts(), fetchStats()])
      router.push(`/review?draftId=${draftId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
      setStep(-1)
      fetchRecentPosts()
      fetchStats()
    }
  }

  const activeSource = SOURCE_TYPES.find((s) => s.value === sourceType)!

  const statusConfig: Record<string, { label: string; cls: string }> = {
    published: { label: 'Published', cls: 'bg-green-100 text-green-700' },
    ready: { label: 'Ready', cls: 'bg-blue-100 text-blue-700' },
    generating: { label: 'Generating…', cls: 'bg-yellow-100 text-yellow-700' },
    publishing: { label: 'Publishing…', cls: 'bg-yellow-100 text-yellow-700' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  }

  return (
    <AppShell user={user}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, cls: 'text-[var(--foreground)]' },
              { label: 'Published', value: stats.published, cls: 'text-green-600' },
              { label: 'Ready', value: stats.ready, cls: 'text-blue-600' },
              { label: 'Failed', value: stats.failed, cls: 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-[var(--border)] px-4 py-4 flex flex-col gap-0.5">
                <span className={`text-2xl font-bold ${s.cls}`}>{s.value}</span>
                <span className="text-xs text-[var(--muted)]">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Generate form */}
        <div className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold">Generate Posts</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Turn any content into LinkedIn, Instagram, and X posts.
            </p>
          </div>

          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <div className="flex gap-2 flex-wrap">
              {SOURCE_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { setSourceType(s.value); setInput('') }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sourceType === s.value
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {activeSource.isText ? (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeSource.placeholder}
                rows={5}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                disabled={loading}
              />
            ) : (
              <input
                type="url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeSource.placeholder}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                disabled={loading}
              />
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            {loading && step >= 0 && (
              <div className="flex flex-col gap-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      i < step ? 'bg-green-500' : i === step ? 'bg-[var(--primary)] animate-pulse' : 'bg-[var(--border)]'
                    }`}>
                      {i < step && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${
                      i === step ? 'text-[var(--primary)] font-medium' :
                      i < step ? 'text-green-600' : 'text-[var(--muted)]'
                    }`}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white rounded-lg font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Posts →'}
            </button>
          </form>
        </div>

        {/* Recent posts */}
        {recentPosts.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent</h2>
              <button
                onClick={() => router.push('/posts')}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {recentPosts.slice(0, 5).map((post) => {
                const sc = statusConfig[post.status] ?? statusConfig.draft
                const canOpen = post.status !== 'generating' && post.status !== 'publishing'
                return (
                  <button
                    key={post.id}
                    onClick={() => canOpen && router.push(`/review?draftId=${post.id}`)}
                    disabled={!canOpen}
                    className="py-3 flex items-center justify-between gap-4 text-left hover:bg-[var(--surface)] -mx-2 px-2 rounded-lg transition-colors disabled:cursor-default"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium capitalize">{post.source_type}</span>
                      <span className="text-xs text-[var(--muted)] truncate max-w-[220px] sm:max-w-xs">
                        {post.source_url || post.source_content?.slice(0, 60) || '—'}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sc.cls}`}>
                      {sc.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

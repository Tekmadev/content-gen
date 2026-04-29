'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import type { PostDraft } from '@/lib/types'

const STATUS_FILTERS = ['all', 'ready', 'published', 'failed', 'publish_failed', 'generating'] as const
type Filter = typeof STATUS_FILTERS[number]
type SortKey = 'newest' | 'oldest' | 'platform'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  published:     { label: 'Published',      cls: 'bg-green-100 text-green-700' },
  ready:         { label: 'Ready',          cls: 'bg-blue-100 text-blue-700' },
  generating:    { label: 'Generating…',    cls: 'bg-yellow-100 text-yellow-700' },
  publishing:    { label: 'Publishing…',    cls: 'bg-yellow-100 text-yellow-700' },
  failed:        { label: 'Failed',         cls: 'bg-red-100 text-red-700' },
  publish_failed:{ label: 'Publish Failed', cls: 'bg-orange-100 text-orange-700' },
  draft:         { label: 'Draft',          cls: 'bg-gray-100 text-gray-600' },
}

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: '#0077b5',
  instagram: '#e1306c',
  x: '#000000',
}

export default function PostsPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{ email?: string; user_metadata?: Record<string, string> } | null>(null)
  const [posts, setPosts] = useState<PostDraft[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')

  // Ref mirror of `posts` so the polling effect can read latest without re-mounting.
  const postsRef = useRef<PostDraft[]>([])
  postsRef.current = posts

  // Tracks consecutive fetch failures — if too many, stop polling to avoid spamming a
  // dead server (which lights up the Next.js dev overlay with "Failed to fetch" errors).
  const failCountRef = useRef(0)
  const MAX_CONSECUTIVE_FAILURES = 3

  const fetchPosts = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/posts', { signal })
      if (!res.ok) return
      const data: PostDraft[] = await res.json()
      // Only update state if the data actually changed — avoids unnecessary re-renders
      const sig = (arr: PostDraft[]) =>
        arr.map((p) => `${p.id}:${p.status}:${p.linkedin_url ?? ''}:${p.instagram_url ?? ''}:${p.x_url ?? ''}`).join('|')
      if (sig(data) !== sig(postsRef.current)) {
        setPosts(data)
      }
      failCountRef.current = 0  // reset on success
    } catch (err) {
      // AbortError is expected on unmount/HMR — don't surface it.
      if (err instanceof Error && err.name === 'AbortError') return
      // Use console.warn (not error) so the Next.js dev overlay doesn't pop up
      // for transient network blips.
      failCountRef.current += 1
      if (failCountRef.current <= MAX_CONSECUTIVE_FAILURES) {
        console.warn('[posts] fetch failed (will retry):', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load — once. AbortController cleans up any in-flight fetch on unmount.
  useEffect(() => {
    const ac = new AbortController()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchPosts(ac.signal)
    return () => ac.abort()
  }, [fetchPosts, supabase])

  // Polling — set up ONCE on mount, runs every 3s, fetches only if there's an active
  // post AND we haven't hit the failure ceiling. Reads from postsRef so the effect
  // never re-mounts (and the interval doesn't churn).
  useEffect(() => {
    const id = setInterval(() => {
      if (failCountRef.current >= MAX_CONSECUTIVE_FAILURES) return
      const hasActive = postsRef.current.some(
        (p) => p.status === 'generating' || p.status === 'publishing'
      )
      if (hasActive) fetchPosts()
    }, 3000)
    return () => clearInterval(id)
  }, [fetchPosts])

  async function handleRetry(postId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setRetrying(postId)
    await fetch('/api/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId: postId }),
    })
    await fetchPosts()
    setRetrying(null)
    router.push(`/review?draftId=${postId}`)
  }

  const sortedPosts = [...posts].sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    // platform: published ones first, grouped by which platforms are done
    const aScore = (a.linkedin_url ? 4 : 0) + (a.instagram_url ? 2 : 0) + (a.x_url ? 1 : 0)
    const bScore = (b.linkedin_url ? 4 : 0) + (b.instagram_url ? 2 : 0) + (b.x_url ? 1 : 0)
    return bScore - aScore
  })

  const filtered = sortedPosts.filter((p) => {
    const matchesFilter = filter === 'all' || p.status === filter
    const term = search.toLowerCase()
    const matchesSearch = !term || (
      (p.source_url ?? '').toLowerCase().includes(term) ||
      (p.source_content ?? '').toLowerCase().includes(term) ||
      (p.source_type ?? '').toLowerCase().includes(term) ||
      (p.linkedin_text ?? '').toLowerCase().includes(term) ||
      (p.instagram_text ?? '').toLowerCase().includes(term) ||
      (p.x_text ?? '').toLowerCase().includes(term)
    )
    return matchesFilter && matchesSearch
  })

  function publishedPlatforms(post: PostDraft) {
    return [
      post.linkedin_url ? 'linkedin' : null,
      post.instagram_url ? 'instagram' : null,
      post.x_url ? 'x' : null,
    ].filter(Boolean) as string[]
  }

  return (
    <AppShell user={user}>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h1 className="text-xl font-semibold">All Posts</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors w-full sm:w-auto text-center"
          >
            + New Post
          </button>
        </div>

        {/* Search + filters + sort */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                    filter === f
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {f === 'publish_failed' ? 'Publish Failed' : f}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] bg-white flex-shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="platform">By platform</option>
            </select>
          </div>
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted)] text-sm">
            {search || filter !== 'all' ? 'No posts match your filters.' : 'No posts yet — generate your first one!'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((post) => {
              const sc = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.draft
              const platforms = publishedPlatforms(post)
              const isActive = post.status === 'generating' || post.status === 'publishing'
              const preview = post.linkedin_text || post.instagram_text || post.x_text

              return (
                <button
                  key={post.id}
                  onClick={() => !isActive && router.push(`/review?draftId=${post.id}`)}
                  disabled={isActive}
                  className="bg-white rounded-xl border border-[var(--border)] p-4 sm:p-5 flex flex-col gap-3 text-left hover:border-[var(--primary)] hover:shadow-sm transition-all disabled:cursor-default disabled:opacity-80 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {post.source_type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>
                          {sc.label}
                        </span>
                        {platforms.length > 0 && (
                          <div className="flex items-center gap-1">
                            {platforms.map((p) => (
                              <div
                                key={p}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: PLATFORM_ICONS[p] }}
                                title={p}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] truncate max-w-xs sm:max-w-lg">
                        {post.source_url || post.source_content?.slice(0, 80) || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap flex-shrink-0 text-right">
                      <span className="block">{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="block">{new Date(post.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </span>
                  </div>

                  {/* Text preview */}
                  {preview && (
                    <p className="text-sm text-[var(--foreground)] line-clamp-2 leading-relaxed">
                      {preview}
                    </p>
                  )}

                  {/* Extraction/generation failure */}
                  {post.status === 'failed' && (
                    <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600 truncate">
                        {post.error_message || 'Extraction or generation failed'}
                      </p>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleRetry(post.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRetry(post.id, e as never)}
                        aria-disabled={retrying === post.id}
                        className={`text-xs font-medium text-red-700 hover:underline flex-shrink-0 cursor-pointer ${retrying === post.id ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {retrying === post.id ? 'Retrying…' : 'Retry →'}
                      </span>
                    </div>
                  )}

                  {/* Publish failure — content is fine, publishing failed */}
                  {post.status === 'publish_failed' && (
                    <div className="flex flex-col gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-orange-700">Publishing failed — content is ready</p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); router.push(`/review?draftId=${post.id}`) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); router.push(`/review?draftId=${post.id}`) } }}
                          className="text-xs font-medium text-orange-800 hover:underline shrink-0 cursor-pointer"
                        >
                          Retry publish →
                        </span>
                      </div>
                      {(post.linkedin_publish_error || post.instagram_publish_error || post.x_publish_error) && (
                        <div className="flex flex-col gap-0.5">
                          {post.linkedin_publish_error && (
                            <p className="text-xs text-orange-600">LinkedIn: {post.linkedin_publish_error}</p>
                          )}
                          {post.instagram_publish_error && (
                            <p className="text-xs text-orange-600">Instagram: {post.instagram_publish_error}</p>
                          )}
                          {post.x_publish_error && (
                            <p className="text-xs text-orange-600">X: {post.x_publish_error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visual thumbnails */}
                  {(post.linkedin_visual_url || post.instagram_visual_url || post.x_visual_url) && (
                    <div className="flex gap-2">
                      {[post.linkedin_visual_url, post.instagram_visual_url, post.x_visual_url]
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((url, i) => (
                          <div key={i} className="w-14 h-10 rounded-md overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex-shrink-0">
                            {/\.(mp4|webm|mov)/i.test(url!) ? (
                              <video src={url!} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={url!} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

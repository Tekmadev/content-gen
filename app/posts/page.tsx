'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import type { PostDraft } from '@/lib/types'

const STATUS_FILTERS = ['all', 'ready', 'published', 'failed', 'generating'] as const
type Filter = typeof STATUS_FILTERS[number]

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  published: { label: 'Published', cls: 'bg-green-100 text-green-700' },
  ready:     { label: 'Ready', cls: 'bg-blue-100 text-blue-700' },
  generating:{ label: 'Generating…', cls: 'bg-yellow-100 text-yellow-700' },
  publishing:{ label: 'Publishing…', cls: 'bg-yellow-100 text-yellow-700' },
  failed:    { label: 'Failed', cls: 'bg-red-100 text-red-700' },
  draft:     { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
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

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/posts')
    if (res.ok) setPosts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchPosts()
  }, [fetchPosts])

  // Poll while any post is active
  useEffect(() => {
    const hasActive = posts.some((p) => p.status === 'generating' || p.status === 'publishing')
    if (!hasActive) return
    const id = setInterval(fetchPosts, 3000)
    return () => clearInterval(id)
  }, [posts, fetchPosts])

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

  const filtered = posts.filter((p) => {
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

        {/* Search + filters */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white text-[var(--muted)] border border-[var(--border)] hover:text-[var(--foreground)]'
                }`}
              >
                {f}
              </button>
            ))}
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
                    <span className="text-xs text-[var(--muted)] whitespace-nowrap flex-shrink-0">
                      {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Text preview */}
                  {preview && (
                    <p className="text-sm text-[var(--foreground)] line-clamp-2 leading-relaxed">
                      {preview}
                    </p>
                  )}

                  {/* Error + retry */}
                  {post.status === 'failed' && (
                    <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600 truncate">
                        {post.error_message || 'Generation failed'}
                      </p>
                      <button
                        onClick={(e) => handleRetry(post.id, e)}
                        disabled={retrying === post.id}
                        className="text-xs font-medium text-red-700 hover:underline flex-shrink-0 disabled:opacity-50"
                      >
                        {retrying === post.id ? 'Retrying…' : 'Retry →'}
                      </button>
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

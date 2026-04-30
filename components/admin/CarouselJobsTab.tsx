'use client'

import { useEffect, useState, useCallback } from 'react'

// All carousel-related fields we now persist. Mirrors the SELECT in
// /api/admin/carousel-jobs/route.ts.
interface CarouselJob {
  id: string
  user_id: string
  user_email: string | null
  draft_id: string | null
  job_id: string
  created_at: string
  platform: string
  mode: string | null
  viral_mode: boolean | null
  style: string
  aspect_ratio: string | null
  image_generator: string | null
  caption: string | null
  slides: Array<{ number: number; url: string; type?: string; text?: string; label?: string; body?: string }> | null
  content_preview: string | null
  full_content: string | null
  num_slides: number
  additional_info: string | null
  aim_image_url: string | null
  include_logo: boolean | null
  density: string | null
  canva_template_id: string | null
  brand_override: Record<string, unknown> | null
  credits_used: number | null
  generation_duration_ms: number | null
  storage_error_count: number | null
  storage_errors: string[] | null
}

interface Response {
  jobs: CarouselJob[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 25

export default function CarouselJobsTab() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [generatorFilter, setGeneratorFilter] = useState<string>('')
  const [modeFilter, setModeFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (generatorFilter) params.set('image_generator', generatorFilter)
      if (modeFilter)      params.set('mode', modeFilter)

      const res = await fetch(`/api/admin/carousel-jobs?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      const json = (await res.json()) as Response
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load carousel jobs')
    } finally {
      setLoading(false)
    }
  }, [offset, generatorFilter, modeFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-[var(--border)] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted)] font-medium">Generator</label>
          <select
            value={generatorFilter}
            onChange={(e) => { setGeneratorFilter(e.target.value); setOffset(0) }}
            className="text-sm border border-[var(--border)] rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">All</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="claude_svg">Claude SVG</option>
            <option value="canva">Canva</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted)] font-medium">Mode</label>
          <select
            value={modeFilter}
            onChange={(e) => { setModeFilter(e.target.value); setOffset(0) }}
            className="text-sm border border-[var(--border)] rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">All</option>
            <option value="viral">Viral</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-[var(--muted)]">
          {loading ? 'Loading…' : `${total.toLocaleString()} total jobs`}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* Job list */}
      <div className="flex flex-col gap-3">
        {(data?.jobs ?? []).map((job) => {
          const expanded = expandedId === job.id
          const created = new Date(job.created_at)
          return (
            <div key={job.id} className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
              {/* Row header */}
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : job.id)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--muted)]/5 transition-colors"
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted)]/10 border border-[var(--border)]">
                  {job.slides?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.slides[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">∅</div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">
                      {job.user_email ?? job.user_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[var(--primary)]">
                      {job.image_generator ?? 'gemini'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[var(--muted)]">
                      {job.mode ?? '—'}
                    </span>
                    {job.viral_mode && (
                      <span className="text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded">
                        VIRAL
                      </span>
                    )}
                    {job.aim_image_url && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        REF IMG
                      </span>
                    )}
                    {job.additional_info && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        +INSTR
                      </span>
                    )}
                    {(job.storage_error_count ?? 0) > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        {job.storage_error_count} ERR
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate mt-0.5">
                    {job.content_preview ?? '(no preview)'}
                  </div>
                </div>

                {/* Numbers */}
                <div className="hidden sm:flex flex-col items-end text-right shrink-0">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {job.num_slides} slides · {job.style}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {job.generation_duration_ms ? `${(job.generation_duration_ms / 1000).toFixed(1)}s` : '—'}
                    {job.credits_used != null ? ` · ${job.credits_used}cr` : ''}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {created.toLocaleString()}
                  </span>
                </div>

                <span className="text-xs text-[var(--muted)] shrink-0">{expanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div className="border-t border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--muted)]/5">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <KV label="Job ID"          value={job.job_id} mono />
                    <KV label="Platform"        value={job.platform} />
                    <KV label="Style"           value={job.style} />
                    <KV label="Aspect"          value={job.aspect_ratio ?? '—'} />
                    <KV label="Density"         value={job.density ?? '—'} />
                    <KV label="Logo overlay"    value={job.include_logo == null ? '—' : job.include_logo ? 'Yes' : 'No'} />
                    <KV label="Canva template"  value={job.canva_template_id ?? '—'} mono />
                    <KV label="Draft linked"    value={job.draft_id ? 'Yes' : 'No'} />
                    <KV label="User ID"         value={job.user_id} mono />
                    <KV label="Created"         value={created.toLocaleString()} />
                    <KV label="Duration"        value={job.generation_duration_ms ? `${job.generation_duration_ms} ms` : '—'} />
                    <KV label="Credits used"    value={job.credits_used != null ? `${job.credits_used}` : '—'} />
                  </div>

                  {/* AIM reference */}
                  {job.aim_image_url && (
                    <div>
                      <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Reference image (AIM)</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={job.aim_image_url}
                        alt="AIM reference"
                        className="max-w-xs rounded-lg border border-[var(--border)]"
                      />
                    </div>
                  )}

                  {/* Additional instructions */}
                  {job.additional_info && (
                    <div>
                      <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Additional instructions</div>
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-white border border-[var(--border)] rounded-lg p-2">
                        {job.additional_info}
                      </pre>
                    </div>
                  )}

                  {/* Full content */}
                  <div>
                    <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Prompt content</div>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-white border border-[var(--border)] rounded-lg p-2 max-h-48 overflow-auto">
                      {job.full_content ?? job.content_preview ?? '(empty)'}
                    </pre>
                  </div>

                  {/* Caption */}
                  {job.caption && (
                    <div>
                      <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Generated caption</div>
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-white border border-[var(--border)] rounded-lg p-2 max-h-48 overflow-auto">
                        {job.caption}
                      </pre>
                    </div>
                  )}

                  {/* Brand override */}
                  {job.brand_override && Object.keys(job.brand_override).length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Brand override (per-job)</div>
                      <pre className="text-xs font-mono bg-white border border-[var(--border)] rounded-lg p-2 max-h-48 overflow-auto">
                        {JSON.stringify(job.brand_override, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Storage errors */}
                  {job.storage_errors && job.storage_errors.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-red-700 uppercase mb-1">Storage errors</div>
                      <ul className="text-xs font-mono bg-red-50 border border-red-200 text-red-700 rounded-lg p-2">
                        {job.storage_errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Slides grid */}
                  {job.slides && job.slides.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-[var(--muted)] uppercase mb-2">Slides ({job.slides.length})</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {job.slides.map((s) => (
                          <div key={s.number} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[var(--border)] bg-white">
                            {s.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.url} alt={`slide ${s.number}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">no image</div>
                            )}
                            <span className="absolute top-1 left-1 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                              {s.number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!loading && (data?.jobs?.length ?? 0) === 0 && (
          <div className="text-center text-sm text-[var(--muted)] py-8">No carousel jobs match these filters.</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="text-sm px-3 py-1.5 rounded-md border border-[var(--border)] bg-white disabled:opacity-50"
          >
            ← Prev
          </button>
          <span className="text-xs text-[var(--muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="text-sm px-3 py-1.5 rounded-md border border-[var(--border)] bg-white disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-[var(--muted)]">{label}</div>
      <div className={`text-xs text-[var(--foreground)] ${mono ? 'font-mono' : ''} truncate`} title={value}>
        {value}
      </div>
    </div>
  )
}

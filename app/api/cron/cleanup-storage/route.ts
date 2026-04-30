/**
 * Silent storage cleanup cron — runs nightly to keep storage costs from
 * compounding as users generate more content over time.
 *
 * Triggered by Vercel Cron (see vercel.json) at 03:00 UTC daily.
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header.
 * Vercel Cron automatically attaches this header from the CRON_SECRET env var.
 *
 * What it deletes (90-day retention):
 *   - posts_log.linkedin_visual_url / instagram_visual_url / x_visual_url
 *     for entries created >90 days ago
 *   - carousel_jobs created >90 days ago (file + DB row)
 *
 * What it preserves FOREVER:
 *   - Brand reference images (Content/brand-refs/...)
 *   - Brand logos
 *   - Avatars
 *   - All text content (posts_log rows minus visual URLs, brand_briefs, etc.)
 *
 * Cancelled accounts: TODO — handle 30-day grace period delete in a separate pass.
 *
 * The job is idempotent — running it twice is safe (second run finds nothing
 * to delete because URLs are already null and old jobs are gone).
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Allow up to 5 minutes — large cleanups can take a while
export const maxDuration = 300

const BUCKET = 'Content'
const RETENTION_DAYS = 90

// Maximum files to delete per cron run (safety against runaway deletions).
// At 1000 files/day cap, full cleanup of any backlog still completes within
// ~30 days even on the most active accounts. Tune up if needed.
const MAX_DELETIONS_PER_RUN = 5000

interface CleanupReport {
  ok: boolean
  dryRun: boolean
  cutoffDate: string
  postsScanned: number
  postVisualsDeleted: number
  carouselJobsScanned: number
  carouselFilesDeleted: number
  carouselJobRowsDeleted: number
  bytesFreedEstimate: number
  errors: string[]
  durationMs: number
}

/**
 * Extract the storage path-inside-bucket from a Supabase public URL.
 * Example input:  https://abc.supabase.co/storage/v1/object/public/Content/userId/draftId/linkedin.jpg
 * Example output: userId/draftId/linkedin.jpg
 *
 * Returns null if the URL doesn't match the expected pattern (e.g. external CDN).
 */
function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

/**
 * Skip-list: paths we never delete even if they match an old timestamp.
 * Defense-in-depth in case a brand asset URL ever leaked into posts_log.
 */
function isProtectedPath(path: string): boolean {
  return (
    path.startsWith('brand-refs/') ||  // user-uploaded brand reference images
    path.includes('/logo/') ||          // brand logos
    path.includes('/avatars/') ||       // user avatars
    path.includes('/brand-logos/')      // legacy brand logo path
  )
}

export async function GET(request: Request) {
  const startedAt = Date.now()

  // ── Auth: only allow Vercel Cron or callers with the right secret ────
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Optional dry-run mode for safe inspection ────────────────────────
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoff.toISOString()

  const report: CleanupReport = {
    ok: true,
    dryRun,
    cutoffDate: cutoffIso,
    postsScanned: 0,
    postVisualsDeleted: 0,
    carouselJobsScanned: 0,
    carouselFilesDeleted: 0,
    carouselJobRowsDeleted: 0,
    bytesFreedEstimate: 0,
    errors: [],
    durationMs: 0,
  }

  const admin = createAdminClient()

  // Track deletions across both passes to enforce MAX_DELETIONS_PER_RUN
  let totalDeletions = 0

  try {
    // ── PASS 1: Old post visuals ───────────────────────────────────────
    // Find posts_log entries older than cutoff that still have visual URLs.
    // Null out the URLs and delete the underlying files.
    const { data: oldPosts, error: postsErr } = await admin
      .from('posts_log')
      .select('id, linkedin_visual_url, instagram_visual_url, x_visual_url')
      .lt('created_at', cutoffIso)
      .or('linkedin_visual_url.not.is.null,instagram_visual_url.not.is.null,x_visual_url.not.is.null')
      .limit(2000)

    if (postsErr) report.errors.push(`posts_log query: ${postsErr.message}`)

    if (oldPosts) {
      report.postsScanned = oldPosts.length

      const filesToDelete: string[] = []
      const idsByColumn: { id: string; col: 'linkedin_visual_url' | 'instagram_visual_url' | 'x_visual_url' }[] = []

      for (const row of oldPosts) {
        for (const col of ['linkedin_visual_url', 'instagram_visual_url', 'x_visual_url'] as const) {
          const path = pathFromPublicUrl(row[col])
          if (path && !isProtectedPath(path)) {
            filesToDelete.push(path)
            idsByColumn.push({ id: row.id, col })
          }
        }
      }

      // Cap deletions for safety
      const capped = filesToDelete.slice(0, MAX_DELETIONS_PER_RUN - totalDeletions)
      const cappedIds = idsByColumn.slice(0, capped.length)

      if (capped.length > 0 && !dryRun) {
        // Bulk-delete from Storage in batches of 200 (Supabase API limit)
        for (let i = 0; i < capped.length; i += 200) {
          const batch = capped.slice(i, i + 200)
          const { error } = await admin.storage.from(BUCKET).remove(batch)
          if (error) report.errors.push(`storage.remove batch ${i}: ${error.message}`)
        }

        // Null out URLs in posts_log — group by post id + column
        const updatesByRow = new Map<string, Partial<Record<string, null>>>()
        for (const { id, col } of cappedIds) {
          const existing = updatesByRow.get(id) ?? {}
          existing[col] = null
          updatesByRow.set(id, existing)
        }
        for (const [id, update] of updatesByRow.entries()) {
          const { error } = await admin.from('posts_log').update(update).eq('id', id)
          if (error) report.errors.push(`posts_log update ${id}: ${error.message}`)
        }
      }

      report.postVisualsDeleted = capped.length
      totalDeletions += capped.length
      // Rough estimate: 200KB avg per visual
      report.bytesFreedEstimate += capped.length * 200_000
    }

    // ── PASS 2: Old carousel jobs ──────────────────────────────────────
    // Each job has a slides JSONB array with file URLs. Delete all files
    // for the job, then delete the job row itself.
    if (totalDeletions < MAX_DELETIONS_PER_RUN) {
      const { data: oldJobs, error: jobsErr } = await admin
        .from('carousel_jobs')
        .select('id, user_id, slides')
        .lt('created_at', cutoffIso)
        .limit(500)

      if (jobsErr) report.errors.push(`carousel_jobs query: ${jobsErr.message}`)

      if (oldJobs) {
        report.carouselJobsScanned = oldJobs.length

        const filesToDelete: string[] = []
        const jobIdsToDelete: string[] = []

        for (const job of oldJobs) {
          if (totalDeletions + filesToDelete.length >= MAX_DELETIONS_PER_RUN) break

          const slides = (job.slides ?? []) as Array<{ url?: string }>
          let jobHasFiles = false

          for (const slide of slides) {
            const path = pathFromPublicUrl(slide.url)
            if (path && !isProtectedPath(path)) {
              filesToDelete.push(path)
              jobHasFiles = true
            }
          }

          // Even if a job has no files, still drop the row to clean up the table
          if (jobHasFiles || slides.length > 0) {
            jobIdsToDelete.push(job.id)
          }
        }

        const capped = filesToDelete.slice(0, MAX_DELETIONS_PER_RUN - totalDeletions)

        if (capped.length > 0 && !dryRun) {
          // Bulk-delete files
          for (let i = 0; i < capped.length; i += 200) {
            const batch = capped.slice(i, i + 200)
            const { error } = await admin.storage.from(BUCKET).remove(batch)
            if (error) report.errors.push(`storage.remove carousel batch ${i}: ${error.message}`)
          }
        }

        // Delete carousel_jobs rows whose files we cleaned up (or that had no files)
        if (jobIdsToDelete.length > 0 && !dryRun) {
          const { error } = await admin
            .from('carousel_jobs')
            .delete()
            .in('id', jobIdsToDelete)
          if (error) report.errors.push(`carousel_jobs delete: ${error.message}`)
        }

        report.carouselFilesDeleted = capped.length
        report.carouselJobRowsDeleted = dryRun ? 0 : jobIdsToDelete.length
        totalDeletions += capped.length
        // Carousel slides ~150KB avg
        report.bytesFreedEstimate += capped.length * 150_000
      }
    }
  } catch (err) {
    report.ok = false
    report.errors.push(err instanceof Error ? err.message : String(err))
  }

  report.durationMs = Date.now() - startedAt

  console.log(
    `[cleanup-storage] dryRun=%s scanned posts=%d carousels=%d, deleted post visuals=%d carousel files=%d job rows=%d, ~%dMB freed, %dms, %d errors`,
    dryRun,
    report.postsScanned,
    report.carouselJobsScanned,
    report.postVisualsDeleted,
    report.carouselFilesDeleted,
    report.carouselJobRowsDeleted,
    Math.round(report.bytesFreedEstimate / 1_000_000),
    report.durationMs,
    report.errors.length
  )

  return NextResponse.json(report, { status: report.ok ? 200 : 500 })
}

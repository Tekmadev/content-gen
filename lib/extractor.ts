/**
 * Content Extractor — Blotato-independent extraction layer
 *
 * Replaces lib/blotato.ts extractContent() for all source types.
 * Routing by source type:
 *   youtube / tiktok / instagram  → Supadata transcript API
 *   article                       → Supadata web scrape
 *   pdf                           → Gemini inline PDF understanding
 *   text / email                  → passthrough (no network call)
 *
 * To add a new source type:
 *   1. Add it to ExtractionSourceType below
 *   2. Add a case in extractContent()
 *   Done — no other files change.
 */

import { Supadata } from '@supadata/js'
import type { Transcript } from '@supadata/js'

// ── Types ───────────────────────────────────────────────────────────────────

export type ExtractionSourceType =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'article'
  | 'pdf'
  | 'text'
  | 'email'

export interface ExtractionResult {
  content: string
  title?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSupadata(): Supadata {
  const key = process.env.SUPADATA_API_KEY
  if (!key) throw new Error('SUPADATA_API_KEY is not set. Add it to your .env.local file.')
  return new Supadata({ apiKey: key })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Flatten a Supadata Transcript into a plain string */
function flattenTranscript(transcript: Transcript): string {
  if (typeof transcript.content === 'string') return transcript.content
  return transcript.content.map((chunk) => chunk.text).join(' ')
}

/**
 * Poll a Supadata async transcript job until complete or timeout.
 * Returns plain text transcript on success.
 */
async function pollTranscriptJob(
  client: Supadata,
  jobId: string,
  maxWaitMs = 120_000
): Promise<string> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await sleep(3_000)
    const result = await client.transcript.getJobStatus(jobId)
    if (result.status === 'completed' && result.result) {
      return flattenTranscript(result.result)
    }
    if (result.status === 'failed') {
      throw new Error('Transcript job failed on Supadata.')
    }
  }
  throw new Error('Transcript extraction timed out (120 s).')
}

// ── Source-specific extractors ───────────────────────────────────────────────

/**
 * YouTube / TikTok / Instagram
 * Uses Supadata's unified transcript endpoint (text=true returns a plain string directly).
 * Falls back to polling if Supadata returns a job ID for longer content.
 */
async function extractTranscript(url: string): Promise<ExtractionResult> {
  const client = getSupadata()
  const result = await client.transcript({ url, text: true })

  // Supadata returns JobId ({ jobId }) for very long content, Transcript otherwise
  if ('jobId' in result) {
    const content = await pollTranscriptJob(client, result.jobId)
    return { content }
  }

  return { content: flattenTranscript(result) }
}

/**
 * Article URLs — Supadata web scrape.
 * Returns the full article text and page title.
 */
async function extractArticle(url: string): Promise<ExtractionResult> {
  const client = getSupadata()
  const scraped = await client.web.scrape(url)
  const content = scraped.content
  if (!content) throw new Error('No content could be scraped from this URL.')
  return { content, title: scraped.name || undefined }
}

/**
 * PDF — Gemini inline document understanding.
 * Downloads the PDF, sends it as base64 to Gemini, returns extracted text.
 * Uses gemini-2.0-flash (cheapest, fast, good at document extraction).
 */
async function extractPdf(pdfUrl: string): Promise<ExtractionResult> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not set.')

  const pdfRes = await fetch(pdfUrl)
  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF (${pdfRes.status}): ${pdfUrl}`)

  const buffer = Buffer.from(await pdfRes.arrayBuffer())
  const base64 = buffer.toString('base64')

  const model = 'gemini-2.0-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                text: 'Extract and return ALL the text content from this document. Return only the extracted text — no commentary, no markdown formatting, no headings added by you.',
              },
            ],
          },
        ],
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini PDF extraction failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Gemini returned no text from this PDF.')

  return { content: text }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract content from any supported source.
 *
 * Drop-in replacement for extractContent() from lib/blotato.ts.
 * Throws on failure — callers should catch and handle.
 */
export async function extractContent(source: {
  sourceType: ExtractionSourceType | string
  url?: string
  text?: string
}): Promise<ExtractionResult> {
  const { sourceType, url, text } = source

  // ── Text / Email — no network call needed ─────────────────────────────────
  if (sourceType === 'text' || sourceType === 'email') {
    if (!text?.trim()) throw new Error('Text content is required for text/email sources.')
    return { content: text.trim() }
  }

  if (!url?.trim()) throw new Error(`A URL is required for source type "${sourceType}".`)

  // ── Video / audio transcript ───────────────────────────────────────────────
  if (
    sourceType === 'youtube' ||
    sourceType === 'tiktok' ||
    sourceType === 'instagram'
  ) {
    return extractTranscript(url)
  }

  // ── Article / blog post ───────────────────────────────────────────────────
  if (sourceType === 'article') {
    return extractArticle(url)
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (sourceType === 'pdf') {
    return extractPdf(url)
  }

  throw new Error(`Unsupported source type: "${sourceType}".`)
}

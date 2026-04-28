/**
 * OpenAI Image Generation — gpt-image-2
 *
 * Uses OpenAI's latest image model (gpt-image-2, released April 21, 2026).
 * gpt-image-2 integrates O-series reasoning before generating — it plans,
 * researches, and reasons about image structure before rendering.
 *
 * API surface (same as gpt-image-1, backward-compatible):
 *   - Sizes:   1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape) | auto
 *   - Quality: auto | high | medium | low
 *   - Always returns base64 PNG — no response_format needed
 *   - No revised_prompt in response
 *
 * The model name is read from platform_config (models.openai_image)
 * so it can be swapped in the admin panel without a redeploy.
 * Default fallback: 'gpt-image-2'
 *
 * Requires: OPENAI_API_KEY environment variable
 */

import { getPlatformConfig } from './platform-config'

const OPENAI_BASE = 'https://api.openai.com/v1'

function getHeaders() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set. Add it to your Vercel environment variables.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  }
}

/**
 * gpt-image-2 supported sizes (identical to gpt-image-1, backward-compatible).
 * NOTE: These differ from DALL-E 3 (which used 1024x1792 for portrait).
 */
type GPTImageSize =
  | '1024x1024'   // square
  | '1024x1536'   // portrait  (replaces dall-e-3's 1024x1792)
  | '1536x1024'   // landscape (replaces dall-e-3's 1792x1024)
  | 'auto'

function mapAspectRatio(ratio: string): GPTImageSize {
  const portrait  = ['3:4', '4:5', '9:16', '2:3']
  const landscape = ['16:9', '4:3', '2:1', '3:2']
  if (portrait.includes(ratio))  return '1024x1536'
  if (landscape.includes(ratio)) return '1536x1024'
  return '1024x1024' // square (1:1) or unknown
}

export interface OpenAIImageResult {
  data: string        // base64-encoded PNG
  mimeType: 'image/png'
}

/**
 * Generate a single image with gpt-image-2 (or whichever model is configured).
 * Returns base64 PNG data — ready for Buffer.from(data, 'base64').
 *
 * Model is read from platform_config (models.openai_image → default: 'gpt-image-2').
 */
export async function generateImageWithOpenAI(
  prompt: string,
  aspectRatio: string = '1:1',
  quality: 'auto' | 'high' | 'medium' | 'low' = 'high'
): Promise<OpenAIImageResult> {
  const { models } = await getPlatformConfig()
  const model = models.openai_image ?? 'gpt-image-2'
  const size  = mapAspectRatio(aspectRatio)

  console.log('[openai-image] model=%s size=%s quality=%s', model, size, quality)

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality,
      // gpt-image-2 returns b64_json by default — no response_format needed
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI image generation failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  const b64  = json.data?.[0]?.b64_json

  if (!b64) {
    throw new Error(
      'OpenAI returned no image data. ' +
      'Check your OPENAI_API_KEY, billing status, and that you have access to gpt-image-2.'
    )
  }

  return { data: b64, mimeType: 'image/png' }
}

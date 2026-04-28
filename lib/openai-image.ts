/**
 * OpenAI DALL-E 3 Image Generation
 *
 * Used as an alternative image backend for carousel slides.
 * DALL-E 3 produces vivid, high-fidelity images with strong prompt adherence.
 *
 * Size mapping:
 *   portrait (3:4, 4:5, 9:16)  → 1024×1792
 *   landscape (16:9, 2:1, 4:3) → 1792×1024
 *   square (1:1)               → 1024×1024
 *
 * Requires: OPENAI_API_KEY environment variable
 */

const OPENAI_BASE = 'https://api.openai.com/v1'

function getHeaders() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set. Add it to your environment variables.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  }
}

/** DALL-E 3 only supports these three sizes */
type DallESize = '1024x1024' | '1024x1792' | '1792x1024'

function mapAspectRatio(ratio: string): DallESize {
  const portraitRatios = ['3:4', '4:5', '9:16', '2:3']
  const landscapeRatios = ['16:9', '4:3', '2:1', '3:2']
  if (portraitRatios.includes(ratio)) return '1024x1792'
  if (landscapeRatios.includes(ratio)) return '1792x1024'
  return '1024x1024' // square (1:1)
}

export interface OpenAIImageResult {
  data: string         // base64-encoded image
  mimeType: 'image/png'
  revisedPrompt?: string
}

/**
 * Generate a single image with DALL-E 3.
 * Returns base64 PNG data. Never returns URLs (avoids expiry issues).
 */
export async function generateImageWithOpenAI(
  prompt: string,
  aspectRatio: string = '1:1',
  quality: 'standard' | 'hd' = 'hd'
): Promise<OpenAIImageResult> {
  const size = mapAspectRatio(aspectRatio)

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      response_format: 'b64_json',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DALL-E 3 image generation failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  const item = json.data?.[0]

  if (!item?.b64_json) {
    throw new Error('OpenAI returned no image data. Check your API key and billing status.')
  }

  return {
    data: item.b64_json,
    mimeType: 'image/png',
    revisedPrompt: item.revised_prompt,
  }
}

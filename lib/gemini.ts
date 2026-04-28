/**
 * Nano Banana — Google Gemini Image Generation Client
 *
 * The image generation model is read from platform_config at runtime,
 * so it can be swapped without a deploy. Default: gemini-2.5-flash-image.
 */
import { getPlatformConfig } from '@/lib/platform-config'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getHeaders() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
  }
}

export type AspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '4:5' | '2:1'

export interface GeminiImageResult {
  data: string     // base64-encoded image
  mimeType: string // 'image/png' or 'image/jpeg'
}

/**
 * Generate a single image using Nano Banana (Gemini image generation).
 * Returns base64 image data ready to be saved to storage.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = '1:1'
): Promise<GeminiImageResult> {
  const { models } = await getPlatformConfig()
  const model = models.image_generation
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini image generation failed (${res.status}): ${err}`)
  }

  const data = await res.json()

  const parts: Array<{
    text?: string
    inlineData?: { data: string; mimeType: string }
  }> = data.candidates?.[0]?.content?.parts ?? []

  const imagePart = parts.find((p) => p.inlineData)
  if (!imagePart?.inlineData) {
    const textPart = parts.find((p) => p.text)
    throw new Error(
      `No image returned from Gemini. Response: ${textPart?.text ?? JSON.stringify(data).slice(0, 200)}`
    )
  }

  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  }
}

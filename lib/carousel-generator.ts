// Carousel Generator — combines Claude (slide texts) + Nano Banana (images)
// Pipeline: extracted content → Claude generates N slide texts → Gemini renders N images

import Anthropic from '@anthropic-ai/sdk'
import { generateImage, type AspectRatio } from './gemini'
import { CAROUSEL_STYLES } from './carousel-styles'
import type { CarouselPlatform, CarouselStyle, BrandSettings } from './types'

export type { CarouselPlatform, CarouselStyle }
export { CAROUSEL_STYLES }

// ── Types ──────────────────────────────────────────────────────────────────

export type SlideType = 'hook' | 'body' | 'insight' | 'cta'

export interface SlideSpec {
  number: number
  type: SlideType
  text: string
}

export interface GeneratedSlide extends SlideSpec {
  base64: string
  mimeType: string
}

export interface CarouselConfig {
  content: string              // extracted content or post text
  platform: CarouselPlatform
  numSlides: number            // 1–10
  style: CarouselStyle
  aspectRatio?: AspectRatio    // override default per-platform ratio
  brandSettings?: BrandSettings // optional — inject exact brand colors + font
}

// ── Brand Voice (mirrors anthropic.ts) ────────────────────────────────────

const BRAND_VOICE_RULES = `
WRITING RULES FOR SLIDE TEXT:
- Short sentences. Direct. Clear.
- No emojis, no hashtags, no asterisks, no semicolons
- No adjectives or adverbs
- Active voice only
- Every word must earn its place
- Maximum 12 words per slide (hard limit)

BANNED WORDS: unlock, discover, revolutionize, game-changer, powerful, cutting-edge,
remarkable, boost, dive deep, craft, imagine, leverage, harness, groundbreaking
`

// ── Slide Text Generation via Claude ──────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

function buildSlideTextPrompt(config: CarouselConfig): string {
  const platformLabel =
    config.platform === 'instagram_carousel'
      ? 'Instagram carousel'
      : config.platform === 'linkedin_image'
      ? 'LinkedIn single image'
      : 'X/Twitter single image'

  const slideStructure =
    config.numSlides === 1
      ? '1 slide: a single powerful statement or key insight from the content (max 12 words).'
      : `${config.numSlides} slides with this structure:
- Slide 1 (hook): Bold statement that stops the scroll. Pain-driven or surprising. Max 10 words.
- Slides 2–${config.numSlides - 1} (body/insight): One insight per slide. Short, punchy. Max 12 words each.
- Slide ${config.numSlides} (cta): One clear direct action. Max 8 words. No question marks.`

  return `You are generating text for ${platformLabel} image slides.

${BRAND_VOICE_RULES}

SLIDE STRUCTURE:
${slideStructure}

SOURCE CONTENT:
${config.content}

OUTPUT FORMAT — return ONLY a valid JSON array, no markdown, no explanation:
[
  {"number": 1, "type": "hook", "text": "..."},
  {"number": 2, "type": "body", "text": "..."}
]

Types must be one of: hook, body, insight, cta
Generate exactly ${config.numSlides} slide(s) now:`
}

async function generateSlideTexts(config: CarouselConfig): Promise<SlideSpec[]> {
  const client = getAnthropicClient()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildSlideTextPrompt(config) }],
  })

  const raw = (message.content[0] as { text: string }).text.trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Claude did not return valid JSON for slide texts. Got: ${raw.slice(0, 200)}`)

  const slides = JSON.parse(match[0]) as SlideSpec[]
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('Claude returned an empty slide array')
  }

  return slides
}

// ── Image Prompt Builder ───────────────────────────────────────────────────

function buildBrandSection(brand: BrandSettings): string {
  const fontNote = FONT_DESCRIPTIONS[brand.font_family] ?? `a clean, modern typeface similar to ${brand.font_family}`
  return `
BRAND IDENTITY — follow these EXACTLY and do not deviate:
- Primary color: ${brand.primary_color}
- Secondary color: ${brand.secondary_color}
- Accent color: ${brand.accent_color}
- Background color: ${brand.background_color}
- Text color: ${brand.text_color}
- Typography: ${fontNote}
${brand.brand_name ? `- Brand: ${brand.brand_name}` : ''}

CRITICAL: Use ONLY these exact brand colors. Do not introduce any other colors.
All text must use the specified text color. Background must use the specified background color.
The accent color can be used for highlight elements, underlines, or decorative details.`
}

// Human-readable font descriptions so Gemini understands the visual intent
const FONT_DESCRIPTIONS: Record<string, string> = {
  'Inter':             'Inter — clean, modern, geometric sans-serif, highly readable',
  'Helvetica Neue':    'Helvetica Neue — classic neutral sans-serif, professional and timeless',
  'Montserrat':        'Montserrat — bold geometric sans-serif, strong headlines, modern feel',
  'Playfair Display':  'Playfair Display — elegant high-contrast serif, editorial and premium',
  'Georgia':           'Georgia — classic readable serif, trustworthy and authoritative',
  'Raleway':           'Raleway — elegant thin sans-serif with stylish details, refined look',
  'Roboto':            'Roboto — neutral clean sans-serif, tech-forward and approachable',
  'Source Serif':      'Source Serif — readable humanist serif, editorial and warm',
  'DM Sans':           'DM Sans — friendly rounded sans-serif, contemporary and approachable',
  'Space Grotesk':     'Space Grotesk — quirky geometric sans-serif, distinctive and modern',
}

// Human-readable format label per platform + ratio
function formatLabel(platform: CarouselPlatform, ratio: AspectRatio): string {
  const RATIO_DIMS: Record<AspectRatio, string> = {
    '1:1':  '1080×1080 square',
    '16:9': '1920×1080 landscape',
    '4:3':  '1440×1080 landscape',
    '3:4':  '1080×1440 portrait',
    '4:5':  '1080×1350 portrait',
    '2:1':  '1500×750 wide banner',
  }
  const platformLabel =
    platform === 'instagram_carousel' ? 'Instagram carousel'
    : platform === 'linkedin_image'   ? 'LinkedIn post'
    :                                   'X/Twitter post'
  return `${platformLabel}, ${ratio} format (${RATIO_DIMS[ratio] ?? ratio})`
}

function buildImagePrompt(
  slide: SlideSpec,
  style: CarouselStyle,
  totalSlides: number,
  platform: CarouselPlatform,
  ratio: AspectRatio,
  brandSettings?: BrandSettings
): string {
  // ── Custom prompt override ─────────────────────────────────────────────
  const customPrompt = brandSettings?.carousel_custom_prompt?.trim()
  if (customPrompt) {
    return customPrompt
      .replace(/\{\{text\}\}/g, slide.text)
      .replace(/\{\{platform\}\}/g, formatLabel(platform, ratio))
      .replace(/\{\{ratio\}\}/g, ratio)
      .replace(/\{\{slide_number\}\}/g, String(slide.number))
      .replace(/\{\{total_slides\}\}/g, String(totalSlides))
      .replace(/\{\{style\}\}/g, style)
  }

  // ── Built-in style prompt ──────────────────────────────────────────────
  const { imagePromptDesc } = CAROUSEL_STYLES[style]
  const label = formatLabel(platform, ratio)

  const slideIndicator =
    totalSlides > 1 ? `\n- Add small subtle text "${slide.number}/${totalSlides}" at the bottom-right corner` : ''

  const brandSection = brandSettings ? buildBrandSection(brandSettings) : ''

  return `Create a professional social media visual for a ${label}.

VISUAL STYLE BASE:
${imagePromptDesc}
${brandSection}

TEXT TO DISPLAY (must be the hero element — large, bold, centered, clearly readable):
"${slide.text}"

DESIGN REQUIREMENTS:
- Text must dominate the composition — large and bold
- Center the text both horizontally and vertically
- Keep it minimal — no clutter, no stock photo people, no logos${slideIndicator}
- High production quality suitable for professional social media marketing
- Do NOT include any watermarks or brand names in the visible design

Generate the image now.`
}

// ── Claude-written image prompt (Anthropic mode) ──────────────────────────
// Claude generates a detailed, creative image generation prompt for Gemini to render.
// This often produces better results because Claude understands context and
// can write more specific, nuanced prompts than the built-in templates.

async function generateImagePromptWithClaude(
  slide: SlideSpec,
  style: CarouselStyle,
  totalSlides: number,
  platform: CarouselPlatform,
  ratio: AspectRatio,
  brandSettings?: BrandSettings
): Promise<string> {
  const client = getAnthropicClient()
  const { label: styleLabel, description: styleDesc } = CAROUSEL_STYLES[style]
  const platformLabel = formatLabel(platform, ratio)
  const brandSection = brandSettings ? buildBrandSection(brandSettings) : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are writing a detailed image generation prompt for an AI image generator (Gemini).

Platform: ${platformLabel}
Visual style: ${styleLabel} — ${styleDesc}
${brandSection}

The text that MUST appear in the image (large, bold, centered, clearly readable):
"${slide.text}"
${totalSlides > 1 ? `\nAlso add a subtle slide counter "${slide.number}/${totalSlides}" at the bottom-right corner.` : ''}

Write a single detailed image generation prompt that specifies:
- Exact background (colors, texture, gradient — be specific with hex codes if applicable)
- Typography placement and weight for the main text
- Layout, composition, and spacing
- Lighting, mood, and atmosphere
- Any decorative elements or accents

Rules:
- The text must be the dominant element — do not bury it
- No stock photo people, no watermarks
- Output ONLY the prompt — no explanation, no markdown, no preamble`,
    }],
  })

  return (message.content[0] as { text: string }).text.trim()
}

// ── Main Export: generateCarousel ─────────────────────────────────────────

/**
 * Full pipeline:
 * 1. Claude generates concise, brand-voice slide texts
 * 2. Nano Banana (Gemini) renders each slide as an image
 * Returns base64 image data for each slide (caller handles storage upload).
 */
export async function generateCarousel(config: CarouselConfig): Promise<GeneratedSlide[]> {
  const clampedSlides = Math.min(Math.max(1, config.numSlides), 10)
  const effectiveConfig = { ...config, numSlides: clampedSlides }

  // Step 1: Generate slide texts via Claude
  const slideSpecs = await generateSlideTexts(effectiveConfig)

  // Step 2: Determine aspect ratio — use override if provided, else platform default
  const defaultRatio: AspectRatio =
    config.platform === 'instagram_carousel' ? '3:4' : '16:9'
  const aspectRatio: AspectRatio = config.aspectRatio ?? defaultRatio

  // Step 3: Generate images in parallel via the configured model
  const imageModel = config.brandSettings?.carousel_image_model ?? 'gemini'

  const generatedSlides = await Promise.all(
    slideSpecs.map(async (slide) => {
      const prompt = buildImagePrompt(slide, config.style, clampedSlides, config.platform, aspectRatio, config.brandSettings)

      let imageData: { data: string; mimeType: string }

      if (imageModel === 'anthropic') {
        // Claude writes a detailed creative prompt → Gemini renders it
        const claudePrompt = await generateImagePromptWithClaude(
          slide, config.style, clampedSlides, config.platform, aspectRatio, config.brandSettings
        )
        imageData = await generateImage(claudePrompt, aspectRatio)
      } else if (imageModel === 'gemini') {
        imageData = await generateImage(prompt, aspectRatio)
      } else {
        // Future models (OpenAI DALL-E, Stable Diffusion, etc.) plug in here
        throw new Error(`Image model "${imageModel}" is not yet supported.`)
      }

      return {
        ...slide,
        base64: imageData.data,
        mimeType: imageData.mimeType,
      }
    })
  )

  return generatedSlides
}

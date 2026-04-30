// Carousel Generator — Claude (slide texts) + pluggable image backends
// Backends: Gemini (default) | OpenAI DALL-E 3 | Claude SVG | Canva (handled in API route)
// Pipeline: extracted content → Claude generates slide texts → selected backend renders images

import Anthropic from '@anthropic-ai/sdk'
import { generateImage, type AspectRatio } from './gemini'
import { generateImageWithOpenAI } from './openai-image'
import { generateViralCarouselSVG } from './claude-svg'
import { CAROUSEL_STYLES } from './carousel-styles'
import { generateViralCarouselSlides } from './anthropic'
import { getPlatformConfig } from './platform-config'
import type { CarouselPlatform, CarouselStyle, BrandSettings, ImageGenerator, ViralSlide } from './types'

export type { CarouselPlatform, CarouselStyle, ViralSlide }
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
  const { models } = await getPlatformConfig()
  const message = await client.messages.create({
    model: models.carousel_slides ?? 'claude-opus-4-7',
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

CRITICAL: Use ONLY these exact brand colors. Do not introduce any other colors.
All text must use the specified text color. Background must use the specified background color.
The accent color can be used for highlight elements, underlines, or decorative details.
DO NOT render any logos, icons, monograms, or brand marks anywhere in the design — leave all corners clean.`
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
  const imagePromptDesc = style === 'brand_colors' && brandSettings
    ? `Background: ${brandSettings.background_color}. Text: ${brandSettings.text_color}. Accent elements in ${brandSettings.accent_color}. Primary highlights in ${brandSettings.primary_color}. Clean minimal layout.`
    : CAROUSEL_STYLES[style].imagePromptDesc
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
- Keep it minimal — no clutter, no stock photo people
- DO NOT render any logos, icons, monograms, symbols, or brand marks anywhere — keep all corners empty${slideIndicator}
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
  const { models } = await getPlatformConfig()
  const { label: styleLabel, description: styleDesc } = CAROUSEL_STYLES[style]
  const platformLabel = formatLabel(platform, ratio)
  const brandSection = brandSettings ? buildBrandSection(brandSettings) : ''

  const message = await client.messages.create({
    model: models.carousel_slides ?? 'claude-opus-4-7',
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
// ── Viral Carousel Config ─────────────────────────────────────────────────

export interface ViralCarouselConfig {
  content: string
  numSlides?: number         // 4–10, defaults to 10
  additionalInfo?: string
  aimImageBase64?: string    // reference image uploaded by user
  aimImageMime?: string      // mime type of the AIM image
  aspectRatio?: AspectRatio
  style?: CarouselStyle
  brandSettings?: BrandSettings
  brandBriefContext?: string | null
  /** Which image backend to use. Defaults to 'gemini'. Canva is handled in the API route. */
  imageGenerator?: Exclude<ImageGenerator, 'canva'>
  /** Claude SVG only: how visually rich the design should be. */
  density?: 'simple' | 'medium' | 'rich'
}

export interface GeneratedViralSlide extends ViralSlide {
  base64: string
  mimeType: string
}

// ── AIM Image Analysis (Claude Vision) ───────────────────────────────────

/**
 * Analyze a reference image with Claude Vision and return a visual style description.
 * This description is injected into Gemini prompts so generated slides match the AIM style.
 */
export async function analyzeAimImage(
  base64: string,
  mimeType: string
): Promise<string> {
  const client = getAnthropicClient()
  const { models } = await getPlatformConfig()
  const message = await client.messages.create({
    model: models.brand_generate ?? 'claude-opus-4-7',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        },
        {
          type: 'text',
          text: 'Analyze this carousel slide image and describe its visual style concisely. Focus on: background colors/textures, typography weight and style, color palette (include hex if visible), layout/composition, mood. This description will guide AI image generation to replicate this look. Be specific, max 120 words, no preamble.',
        },
      ],
    }],
  })
  return (message.content[0] as { text: string }).text.trim()
}

// ── Viral Carousel Image Prompt Builder ──────────────────────────────────

function buildViralImagePrompt(
  slide: ViralSlide,
  totalSlides: number,
  platform: CarouselPlatform,
  ratio: AspectRatio,
  aimStyleDescription?: string,
  brandSettings?: BrandSettings,
  style?: CarouselStyle,
  topicContext?: string
): string {
  const label = formatLabel(platform, ratio)
  const brandSection = brandSettings ? buildBrandSection(brandSettings) : ''
  const styleDef = style ? CAROUSEL_STYLES[style] : undefined
  const isImageRich = styleDef?.kind === 'image-rich'

  const styleDesc = style
    ? (style === 'brand_colors' && brandSettings
        ? `Background: ${brandSettings.background_color}. Text: ${brandSettings.text_color}. Accent elements in ${brandSettings.accent_color}. Primary highlights in ${brandSettings.primary_color}. Clean minimal layout.`
        : CAROUSEL_STYLES[style].imagePromptDesc)
    : ''
  const aimSection = aimStyleDescription
    ? `\nVISUAL STYLE REFERENCE (match this aesthetic closely):\n${aimStyleDescription}`
    : ''
  const bodyText = slide.body?.trim()

  // For image-rich styles, inject topic context so the background imagery
  // visually represents what the carousel is about (not just abstract decoration).
  const topicSection = isImageRich && topicContext
    ? `\nTOPIC CONTEXT — the carousel is about:\n"${topicContext.slice(0, 280)}"\nThe background imagery MUST visually reinforce this topic. Choose subjects, scenes, or symbolic visuals directly relevant to it.\n`
    : ''

  return `Create a professional Instagram carousel slide for a ${label}.

${styleDesc ? `BASE STYLE:\n${styleDesc}` : ''}
${topicSection}${brandSection}${aimSection}

TYPOGRAPHIC LAYOUT — follow this hierarchy EXACTLY:
1. HEADLINE (dominant element): Large, bold, heavy-weight typography. Left-aligned or centered. 2–4 lines max.
   Text: "${slide.text}"
${bodyText ? `2. BODY TEXT (below headline): Smaller font (about 35–45% of headline size), lighter weight, same alignment. 1–2 lines.
   Text: "${bodyText}"` : ''}
3. SLIDE COUNTER: Small, subtle "${slide.number}/${totalSlides}" at the bottom-right corner.

LAYOUT RULES:
- Generous padding on all sides (minimum 8–10% of slide width)
- Clear visual separation between headline and body (spacing, not dividers)
- DO NOT show any slide type labels (no "HOOK", "REHOOK", "VALUE", etc.)
- DO NOT render any logos, icons, monograms, symbols, or brand marks anywhere — keep all corners empty
- Negative space is intentional — do not fill every inch
- No watermarks, no decorative borders on the outer edge
- ${isImageRich ? 'Background imagery must serve the topic, not distract from the text — text remains the dominant element with a subtle dark gradient overlay if needed for legibility' : 'Pure infographic — no photographic background, just the styled background described above'}
- High production quality for professional social media

Generate the image now.`
}

// ── Main Export: generateViralCarousel ───────────────────────────────────

/**
 * Full viral carousel pipeline:
 * 1. Optionally analyze AIM reference image with Claude Vision
 * 2. Claude generates 10 viral slide texts (hook → rehook → pain → value × 4 → AHA → takeaway → CTA)
 * 3. Gemini renders each slide as an image in parallel
 */
export async function generateViralCarousel(config: ViralCarouselConfig): Promise<GeneratedViralSlide[]> {
  const platform: CarouselPlatform = 'instagram_carousel'
  const ratio: AspectRatio = config.aspectRatio ?? '3:4'
  const style = config.style ?? 'modern'
  const backend = config.imageGenerator ?? 'gemini'
  const numSlides = Math.min(Math.max(4, config.numSlides ?? 10), 10)

  // Claude SVG can't render photographic backgrounds — force an infographic
  // style if the user picked an image-rich one for SVG mode.
  const styleDef = CAROUSEL_STYLES[style]
  const effectiveStyle: CarouselStyle =
    backend === 'claude_svg' && styleDef.kind === 'image-rich' ? 'dark_statement' : style

  console.log('[carousel-generator] backend=%s style=%s ratio=%s slides=%d', backend, effectiveStyle, ratio, numSlides)

  // Step 1: Analyze AIM reference image if provided (all backends benefit from this)
  let aimStyleDescription: string | undefined
  if (config.aimImageBase64 && config.aimImageMime) {
    aimStyleDescription = await analyzeAimImage(config.aimImageBase64, config.aimImageMime)
  }

  // Step 2: Generate N viral slide texts via Claude
  const slides = await generateViralCarouselSlides(config.content, {
    numSlides,
    additionalInfo: config.additionalInfo,
    aimStyleDescription,
    brandSettings: config.brandSettings,
    brandBriefContext: config.brandBriefContext,
  })

  // The first ~280 chars of source content gives Gemini/OpenAI the topic
  // context they need to produce relevant background imagery for image-rich styles.
  const topicContext = config.content.slice(0, 280)

  // Step 3: Render images — route to the selected backend
  let generated: GeneratedViralSlide[]

  if (backend === 'claude_svg') {
    // ── Claude SVG: code-based, pixel-perfect, brand-accurate ────────────
    const svgSlides = await generateViralCarouselSVG(slides, ratio, effectiveStyle, config.brandSettings, config.density ?? 'medium')
    generated = svgSlides as GeneratedViralSlide[]

  } else if (backend === 'openai') {
    // ── OpenAI DALL-E / gpt-image: vivid, photorealistic ─────────────────
    generated = await Promise.all(
      slides.map(async (slide) => {
        const prompt = buildViralImagePrompt(slide, slides.length, platform, ratio, aimStyleDescription, config.brandSettings, effectiveStyle, topicContext)
        const imageData = await generateImageWithOpenAI(prompt, ratio)
        return { ...slide, base64: imageData.data, mimeType: imageData.mimeType }
      })
    )

  } else {
    // ── Gemini (default): AI image generation ─────────────────────────────
    generated = await Promise.all(
      slides.map(async (slide) => {
        const prompt = buildViralImagePrompt(slide, slides.length, platform, ratio, aimStyleDescription, config.brandSettings, effectiveStyle, topicContext)
        const imageData = await generateImage(prompt, ratio)
        return { ...slide, base64: imageData.data, mimeType: imageData.mimeType }
      })
    )
  }

  return generated
}

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

      if (imageModel === 'openai') {
        imageData = await generateImageWithOpenAI(prompt, aspectRatio)
      } else {
        // gemini (default) — claude_svg not available in standard mode
        imageData = await generateImage(prompt, aspectRatio)
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

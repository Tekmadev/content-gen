/**
 * Claude SVG Carousel Generator
 *
 * Claude generates complete SVG code for each carousel slide —
 * no AI image generation, no raster models. The result is:
 *   - Pixel-perfect brand color accuracy (no hallucinated shades)
 *   - Clean, scalable vector typography
 *   - Fully deterministic layout
 *   - Zero dependency on image generation APIs
 *
 * Pipeline:
 *   1. Claude receives slide text + brand colors + style → returns SVG code
 *   2. sharp converts SVG → PNG buffer (for Supabase Storage)
 *
 * Ideal for: brand-strict carousels, consistent multi-slide sets, Tekmadev style.
 *
 * Font note: On Vercel's Linux runtime, sans-serif maps to DejaVu Sans —
 * clean, professional, similar to Helvetica Neue.
 */

import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import type { ViralSlide, CarouselStyle, BrandSettings } from './types'
import type { AspectRatio } from './gemini'
import { CAROUSEL_STYLES } from './carousel-styles'
import { getPlatformConfig } from './platform-config'

// ── Canvas dimensions ────────────────────────────────────────────────────────

const CANVAS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '3:4': { w: 1080, h: 1440 },
  '4:5': { w: 1080, h: 1350 },
  '16:9': { w: 1920, h: 1080 },
  '4:3': { w: 1440, h: 1080 },
  '2:1': { w: 1500, h: 750 },
}

// ── Built-in style themes (for non-brand_colors styles) ──────────────────────

type StyleTheme = {
  bg: string
  text: string
  accent: string
  subtext?: string // if undefined, uses accent at 70% opacity
  gradient?: { from: string; to: string }
}

const STYLE_THEMES: Record<CarouselStyle, StyleTheme> = {
  // Infographic
  white_card:      { bg: '#FFFFFF', text: '#0F0F0F', accent: '#0F0F0F', subtext: '#555555' },
  dark_statement:  { bg: '#0F0F0F', text: '#FFFFFF', accent: '#FFFFFF', subtext: '#AAAAAA' },
  brand_colors:    { bg: '#0F0F0F', text: '#FFFFFF', accent: '#F97316', subtext: '#BBBBBB' },
  // Image-rich (Claude SVG falls back to these flat themes — actual photographic
  // backgrounds aren't possible in SVG mode, but the theme gives a sensible look)
  modern:          { bg: '#1F2937', text: '#FFFFFF', accent: '#E5E7EB', subtext: '#D1D5DB',
                     gradient: { from: '#0F172A', to: '#334155' } },
  minimal:         { bg: '#FAFAF9', text: '#1C1917', accent: '#A8A29E', subtext: '#57534E' },
  bold:            { bg: '#7F1D1D', text: '#FFFFFF', accent: '#FDE047', subtext: '#FECACA',
                     gradient: { from: '#7F1D1D', to: '#EA580C' } },
  futuristic:      { bg: '#1E1B4B', text: '#FFFFFF', accent: '#67E8F9', subtext: '#C7D2FE',
                     gradient: { from: '#3730A3', to: '#9333EA' } },
  playful:         { bg: '#FEF3C7', text: '#9F1239', accent: '#F472B6', subtext: '#7C2D12',
                     gradient: { from: '#FECDD3', to: '#FDE68A' } },
  // Legacy
  gradient_bold:   { bg: '#1a1a2e', text: '#FFFFFF', accent: '#7C3AED', subtext: '#C4B5FD',
                     gradient: { from: '#1a1a2e', to: '#4C1D95' } },
  cinematic:       { bg: '#111827', text: '#FFFFFF', accent: '#F59E0B', subtext: '#9CA3AF' },
  branded_minimal: { bg: '#FFFFFF', text: '#0F0F0F', accent: '#F97316', subtext: '#666666' },
}

// ── Client ───────────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildSvgPrompt(
  slide: ViralSlide,
  totalSlides: number,
  ratio: AspectRatio,
  style: CarouselStyle,
  brandSettings?: BrandSettings
): string {
  const dims = CANVAS[ratio] ?? CANVAS['3:4']
  const theme = STYLE_THEMES[style]
  const isLandscape = dims.w > dims.h

  // Resolve colors: brand_colors overrides use actual brand palette
  const bg      = style === 'brand_colors' && brandSettings ? brandSettings.background_color : theme.bg
  const text    = style === 'brand_colors' && brandSettings ? brandSettings.text_color       : theme.text
  const accent  = style === 'brand_colors' && brandSettings ? brandSettings.accent_color     : theme.accent
  const subtext = style === 'brand_colors' && brandSettings ? brandSettings.text_color       : (theme.subtext ?? accent)

  const pad = 80 // padding from edges in px
  const counterX = dims.w - pad
  const counterY = dims.h - pad + 20

  // Headline font size scales by canvas width
  const headlineFontSize = dims.w >= 1440 ? 112 : 96
  const bodyFontSize = dims.w >= 1440 ? 56 : 48
  const lineHeight = Math.round(headlineFontSize * 1.2)
  const bodyLineHeight = Math.round(bodyFontSize * 1.3)
  const maxCharsPerLine = isLandscape ? 28 : 18

  const styleDesc = CAROUSEL_STYLES[style].description
  const hasBody = !!slide.body?.trim()

  const gradientDef = theme.gradient
    ? `<defs><linearGradient id="grad" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0%" stop-color="${theme.gradient.from}"/><stop offset="100%" stop-color="${theme.gradient.to}"/></linearGradient></defs>`
    : ''
  const bgFill = theme.gradient ? 'url(#grad)' : bg

  return `You are generating a professional social media carousel slide as valid SVG code.

SLIDE ${slide.number}/${totalSlides}  •  TYPE: ${slide.type.toUpperCase()}
STYLE: ${styleDesc}

CANVAS: ${dims.w}×${dims.h}px — use viewBox="0 0 ${dims.w} ${dims.h}"

COLORS:
  Background: ${bg}  →  rect fill="${bgFill}"
  Headline: ${text}
  Body/subtext: ${subtext}
  Accent: ${accent}

TYPOGRAPHY:
  Headline font: ${headlineFontSize}px, font-weight="800", fill="${text}"
  Body font: ${bodyFontSize}px, font-weight="400", fill="${subtext}"
  Counter: 30px, font-weight="400", fill="${accent}", opacity="0.5"
  Use: font-family="'DejaVu Sans', 'Liberation Sans', 'Arial', sans-serif"
  (CRITICAL: do NOT use 'Helvetica Neue' or other macOS-only fonts — they are not
  installed on the server and will render as empty boxes. The above stack works.)

CONTENT:
  Headline: "${slide.text}"
${hasBody ? `  Body: "${slide.body}"` : '  (no body text for this slide)'}

TEXT WRAPPING (CRITICAL — SVG has no automatic wrapping):
  • Max ${maxCharsPerLine} characters per line (break at word boundaries)
  • Use <tspan x="${pad}" dy="0"> for first line, dy="${lineHeight}" for subsequent lines
  • Estimate: count characters in the text, split into chunks of ${maxCharsPerLine} chars max at spaces
  • Start headline around y=${Math.round(dims.h * 0.38)} for vertical centering
${hasBody ? `  • Body text starts ${Math.round(headlineFontSize * 1.6)}px below last headline line
  • Body tspan dy="${bodyLineHeight}"` : ''}

DESIGN RULES:
  1. Padding: minimum ${pad}px from all edges
  2. Accent bar: a horizontal rect, ~6px tall, ~${Math.round(dims.w * 0.06)}px wide, ${accent} fill, positioned 40px ABOVE the headline start
  3. Slide counter: "${slide.number}/${totalSlides}" at x="${counterX}" y="${counterY}", text-anchor="end"
  4. No logos, no icons, no external resources, no clip-path with URLs
  5. Return ONLY the raw SVG — no markdown fences, no explanation
  6. Must start with <svg and end with </svg>

${gradientDef ? `PRE-BUILT GRADIENT DEF TO USE:\n${gradientDef}\n` : ''}
Generate the complete, valid SVG now:`
}

// ── SVG → PNG conversion ─────────────────────────────────────────────────────

/**
 * Defensive sanitizer: even if Claude ignored our font instructions, force
 * the SVG to use only fonts that exist on the server (Vercel Linux ships with
 * DejaVu Sans + Liberation Sans via fontconfig). Replace any specific font
 * references with the safe stack so text always renders.
 */
function sanitizeSvgFonts(svg: string): string {
  // Replace any font-family attribute or CSS property with the safe stack
  const safeStack = `'DejaVu Sans', 'Liberation Sans', sans-serif`
  let out = svg.replace(
    /font-family\s*=\s*"[^"]*"/gi,
    `font-family="${safeStack}"`
  )
  out = out.replace(
    /font-family\s*=\s*'[^']*'/gi,
    `font-family="${safeStack}"`
  )
  out = out.replace(
    /font-family\s*:\s*[^;"}]+/gi,
    `font-family: ${safeStack}`
  )
  return out
}

/**
 * Replace common Unicode characters that often render as tofu boxes in
 * server-side SVG rendering. Keeps text readable but ASCII-safe.
 */
function sanitizeTextForSvg(svg: string): string {
  return svg
    .replace(/[‘’]/g, "'")    // curly single quotes → straight
    .replace(/[“”]/g, '"')    // curly double quotes → straight
    .replace(/[–—]/g, '-')    // en-dash / em-dash → hyphen
    .replace(/…/g, '...')          // ellipsis → three dots
    .replace(/ /g, ' ')            // non-breaking space → regular space
}

async function svgToPng(svgCode: string): Promise<Buffer> {
  // sharp uses librsvg under the hood — handles SVG natively on Linux/Vercel.
  // We sanitize fonts + text characters to maximize the chance the renderer
  // can find glyphs for everything (otherwise tofu boxes ▯ appear).
  const safeSvg = sanitizeTextForSvg(sanitizeSvgFonts(svgCode))
  return sharp(Buffer.from(safeSvg, 'utf-8'))
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer()
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface SVGSlideResult {
  svgCode: string
  pngBuffer: Buffer
  mimeType: 'image/png'
}

/**
 * Generate a single carousel slide as SVG → PNG.
 * Uses the platform-configured Claude model (falls back to claude-opus-4-7).
 */
export async function generateSVGSlide(
  slide: ViralSlide,
  totalSlides: number,
  ratio: AspectRatio,
  style: CarouselStyle,
  brandSettings?: BrandSettings
): Promise<SVGSlideResult> {
  const client = getClient()
  const { models } = await getPlatformConfig()

  // Use brand_generate model (good reasoning for code) or fall back
  const model = models.brand_generate ?? 'claude-opus-4-7'

  const message = await client.messages.create({
    model,
    max_tokens: 3000,  // SVG for 10-slide can be verbose
    messages: [{
      role: 'user',
      content: buildSvgPrompt(slide, totalSlides, ratio, style, brandSettings),
    }],
  })

  const raw = (message.content[0] as { text: string }).text.trim()

  // Strip markdown fences if Claude wrapped it anyway
  const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/i)
  if (!svgMatch) {
    throw new Error(
      `Claude did not return valid SVG for slide ${slide.number}/${totalSlides}. ` +
      `Response preview: ${raw.slice(0, 150)}`
    )
  }

  const svgCode = svgMatch[0]

  // Validate it's parseable before attempting sharp conversion
  if (!svgCode.includes('viewBox') && !svgCode.includes('width')) {
    throw new Error(`SVG missing viewBox for slide ${slide.number} — layout will be broken`)
  }

  const pngBuffer = await svgToPng(svgCode)

  return { svgCode, pngBuffer, mimeType: 'image/png' }
}

/**
 * Generate all slides for a viral carousel using Claude SVG.
 * Runs in parallel (concurrency capped at 5 to avoid rate limit).
 */
export async function generateViralCarouselSVG(
  slides: ViralSlide[],
  ratio: AspectRatio,
  style: CarouselStyle,
  brandSettings?: BrandSettings
): Promise<Array<ViralSlide & { base64: string; mimeType: string }>> {
  const CONCURRENCY = 5
  const results: Array<ViralSlide & { base64: string; mimeType: string }> = []

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < slides.length; i += CONCURRENCY) {
    const batch = slides.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (slide) => {
        const result = await generateSVGSlide(slide, slides.length, ratio, style, brandSettings)
        return {
          ...slide,
          base64: result.pngBuffer.toString('base64'),
          mimeType: result.mimeType,
        }
      })
    )
    results.push(...batchResults)
  }

  return results
}

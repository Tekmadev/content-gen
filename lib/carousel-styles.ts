// carousel-styles.ts — client-safe constants for carousel visual styles.
// Imported by both the client page and the server-side carousel-generator.

import type { CarouselStyle } from './types'

export interface CarouselStyleDef {
  label: string
  description: string
  imagePromptDesc: string
  /**
   * 'infographic' = pure text/shapes (works for Claude SVG + Gemini/OpenAI minimal mode).
   * 'image-rich'  = topic-relevant photographic/illustrative background (Gemini/OpenAI/Canva only).
   */
  kind: 'infographic' | 'image-rich'
}

export const CAROUSEL_STYLES: Record<CarouselStyle, CarouselStyleDef> = {

  // ── Infographic styles (text-focused) ───────────────────────────────────
  white_card: {
    kind: 'infographic',
    label: 'Clean White',
    description: 'Minimal white background with bold black typography. Editorial.',
    imagePromptDesc:
      'Pure white background (#FFFFFF). Bold black sans-serif typography (Inter Bold or Helvetica Neue). Clean minimal layout. No decorations. Editorial feel.',
  },
  dark_statement: {
    kind: 'infographic',
    label: 'Dark Statement',
    description: 'Dark background, white text. High contrast and dramatic.',
    imagePromptDesc:
      'Very dark background (#0F0F0F or #111111). Bold white sans-serif typography. High contrast. Dramatic and powerful. Minimal decorative elements.',
  },
  brand_colors: {
    kind: 'infographic',
    label: 'Brand Colors',
    description: 'Uses your saved brand palette and font. Consistent on-brand.',
    imagePromptDesc:
      'Professional slide design using exact brand identity colors. Clean minimal layout with strong typographic hierarchy.',
  },

  // ── Image-rich styles (topic-relevant background imagery) ───────────────
  modern: {
    kind: 'image-rich',
    label: 'Modern',
    description: 'Sleek photographic background with elegant text overlay.',
    imagePromptDesc:
      'Modern, contemporary photographic background that visually represents the slide topic. Clean composition with depth — soft natural lighting, professional staging. Subtle dark gradient overlay (bottom 40%) for text legibility. Refined sans-serif typography. Glass morphism / frosted panel optional behind text. Premium editorial aesthetic.',
  },
  minimal: {
    kind: 'image-rich',
    label: 'Minimal',
    description: 'Plenty of white space, subtle imagery, refined typography.',
    imagePromptDesc:
      'Minimalist photographic composition with abundant negative space. Soft, monochromatic or pastel-toned imagery related to the topic. Light, airy mood. Refined sans-serif typography. Generous padding. No clutter. Editorial / Kinfolk aesthetic.',
  },
  bold: {
    kind: 'image-rich',
    label: 'Bold',
    description: 'High-contrast dramatic imagery with heavy typography.',
    imagePromptDesc:
      'Dramatic, high-contrast photographic background relevant to the slide topic. Cinematic lighting, deep shadows, strong focal point. Heavy weight sans-serif typography in white or yellow (#FFD700). Strong visual hierarchy. Punchy, magazine-cover energy.',
  },
  futuristic: {
    kind: 'image-rich',
    label: 'Futuristic',
    description: 'Sci-fi tech aesthetic with neon accents.',
    imagePromptDesc:
      'Futuristic sci-fi background — abstract tech imagery, gradient mesh (electric blue, deep purple, magenta), glowing geometric shapes or particle effects. Glass refraction. Subtle grid lines. Modern geometric or monospace typography. Cyberpunk / Apple keynote aesthetic.',
  },
  playful: {
    kind: 'image-rich',
    label: 'Playful',
    description: 'Vibrant colors, fun illustrations, energetic mood.',
    imagePromptDesc:
      'Playful illustrated background — vibrant flat colors, fun rounded shapes, energetic composition. Hand-drawn or geometric illustration style relevant to the topic. Bright accent palette (coral, mint, lavender, sunshine yellow). Round, friendly typography (DM Sans or similar). Joyful, approachable mood.',
  },

  // ── Legacy styles (kept for old saved jobs — hidden from new UI) ────────
  gradient_bold: {
    kind: 'image-rich',
    label: 'Gradient Bold',
    description: 'Vibrant gradient background with white text.',
    imagePromptDesc:
      'Vibrant gradient background (deep blue to purple, or rich orange to coral). Bold white sans-serif typography. Modern and energetic feel. Clean layout.',
  },
  cinematic: {
    kind: 'image-rich',
    label: 'Cinematic',
    description: 'Moody photographic background with text overlay.',
    imagePromptDesc:
      'Cinematic photographic background — blurred, moody, dark-toned environment. Semi-transparent dark overlay panel behind text. White typography on top. Atmospheric.',
  },
  branded_minimal: {
    kind: 'infographic',
    label: 'Branded Minimal',
    description: 'Warm orange accents on white. Clean professional branding.',
    imagePromptDesc:
      'White background with warm orange (#F97316) accent elements. Bold dark typography. Professional and branded. Clean layout.',
  },
}

/** Style keys to surface in the new UI — drops legacy keys */
export const ACTIVE_STYLES: CarouselStyle[] = [
  'modern', 'minimal', 'bold', 'futuristic', 'playful',  // image-rich first
  'white_card', 'dark_statement', 'brand_colors',         // infographic
]

/** Filter style keys by what the chosen generator supports */
export function stylesForGenerator(generator: 'gemini' | 'openai' | 'claude_svg' | 'canva'): CarouselStyle[] {
  if (generator === 'claude_svg') {
    // Claude SVG can only render text + simple shapes, not photographic backgrounds
    return ACTIVE_STYLES.filter((s) => CAROUSEL_STYLES[s].kind === 'infographic')
  }
  return ACTIVE_STYLES
}

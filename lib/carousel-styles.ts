// carousel-styles.ts — client-safe constants for carousel visual styles
// Imported by both the client page and the server-side carousel-generator.

import type { CarouselStyle } from './types'

export const CAROUSEL_STYLES: Record<
  CarouselStyle,
  { label: string; description: string; imagePromptDesc: string }
> = {
  white_card: {
    label: 'Clean White',
    description: 'Minimalist white background with bold black typography. Clean, editorial, professional.',
    imagePromptDesc:
      'Pure white background (#FFFFFF). Bold black sans-serif typography (like Inter Bold or Helvetica Neue). Clean minimal layout. No decorations. Editorial feel.',
  },
  dark_statement: {
    label: 'Dark Statement',
    description: 'Dark background with white text. High contrast, dramatic, powerful.',
    imagePromptDesc:
      'Very dark background (#0F0F0F or #111111). Bold white sans-serif typography. High contrast. Dramatic and powerful. Minimal decorative elements.',
  },
  gradient_bold: {
    label: 'Gradient Bold',
    description: 'Vibrant gradient background with white text. Modern and energetic.',
    imagePromptDesc:
      'Vibrant gradient background (deep blue to purple, or rich orange to coral). Bold white sans-serif typography. Modern and energetic feel. Clean layout.',
  },
  cinematic: {
    label: 'Cinematic',
    description: 'Moody photographic background with text overlay. Atmospheric and immersive.',
    imagePromptDesc:
      'Cinematic photographic background — blurred, moody, dark-toned environment (office, city, abstract). Semi-transparent dark overlay panel behind text. White typography on top. Atmospheric.',
  },
  branded_minimal: {
    label: 'Branded Minimal',
    description: 'Warm orange accents on white. Clean professional branding.',
    imagePromptDesc:
      'White background with warm orange (#F97316) accent elements — thin border, accent line, or subtle color block. Bold dark typography. Professional and branded. Clean layout.',
  },
}

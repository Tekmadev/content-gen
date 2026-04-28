import Anthropic from '@anthropic-ai/sdk'
import { getPlatformConfig } from '@/lib/platform-config'
import type { ViralSlide, BrandSettings } from './types'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

// Brand voice: content_style_brief_tekmadev_2026.md + Prompts/Instagram (default).md
const BRAND_VOICE = `
CORE PRINCIPLE
Content must feel: Real. Intentional. Human. Simple.
Avoid anything that feels overproduced, generic, template-based, or artificial.
Rule: Clarity over complexity. If it is not instantly understood, it fails.

WRITING RULES
- Short sentences. Direct tone. Clear language.
- Use "you" — speak directly to the reader.
- Use statements, not questions.
- One idea per post. Do not try to teach everything.
- Active voice only. No passive voice.
- No emojis. No semicolons. No asterisks.
- No adjectives or adverbs.
- No fluff. No long paragraphs.
- Remove anything unnecessary. Every line must earn attention.

BANNED WORDS
can, may, just, that, very, really, literally, actually, certainly, probably, basically,
could, maybe, delve, embark, enlightening, shed light, craft, crafting, imagine, realm,
game-changer, unlock, discover, skyrocket, revolutionize, disruptive, utilize, dive deep,
tapestry, illuminate, unveil, pivotal, enrich, intricate, hence, furthermore, however,
harness, exciting, groundbreaking, cutting-edge, remarkable, in summary, in conclusion,
moreover, boost, powerful, ever-evolving, overproduced, generic

CONTENT ANGLES (pick the one that fits best)
- Pain: expose a hidden problem the reader has (missed calls, lost leads, broken systems)
- Truth: reveal why businesses fail or what most people get wrong
- Reframe: shift the reader's perspective on a common belief
- System: show a process or structure that solves a clear problem

POST TYPES (pick the one that fits best)
- Authority: teach one clear insight
- Contrarian: challenge a common belief (e.g. "You don't need more leads")
- Problem Awareness: highlight a hidden or ignored problem
- System Thinking: show a process or structure
`

// Post structure for social content (adapted from carousel structure in brand brief)
const POST_STRUCTURE = `
STRUCTURE (adapt for single post, not literal carousel slides)
1. Hook (first line, 5-8 words): Strong statement or pain-point. No build-up. No context. Hit hard.
   Examples: "You're losing clients and don't know it." / "Your business model is broken."
2. Body: Break down the problem or insight. Short lines. One idea per line.
3. Insight/Reframe: Shift their thinking. New perspective. Keep it clear.
4. Solution or takeaway: One clear idea. Not a pitch.
5. CTA (last line): Direct action statement. Not a question.
   Examples: "Fix your system." / "Stop waiting for more leads." / "Audit your process today."
`

export async function generateLinkedInPost(extractedContent: string, brandBriefContext?: string | null): Promise<string> {
  const client = getClient()
  const { models } = await getPlatformConfig()
  const voiceSection = brandBriefContext
    ? `The following is the brand identity of the business you are writing for. Write in their voice, for their audience, aligned with their content pillars and personality:\n\n${brandBriefContext}\n\nALSO follow these universal content quality rules:\n${BRAND_VOICE}`
    : BRAND_VOICE

  const message = await client.messages.create({
    model: models.post_linkedin,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are writing a LinkedIn post for a business brand.

${voiceSection}

${POST_STRUCTURE}

LINKEDIN RULES
- Length: 150–300 words
- Slightly more professional tone — still simple and direct
- Use line breaks generously for readability
- No hashtags
- Pick one Content Angle and one Post Type from above that best fits the source

Source content:
${extractedContent}

Write the LinkedIn post now. Output only the post text, nothing else.`,
      },
    ],
  })

  return (message.content[0] as { text: string }).text.trim()
}

export async function generateInstagramPost(extractedContent: string, brandBriefContext?: string | null): Promise<string> {
  const client = getClient()
  const { models } = await getPlatformConfig()
  const voiceSection = brandBriefContext
    ? `The following is the brand identity of the business you are writing for. Write in their voice, for their audience, aligned with their content pillars and personality:\n\n${brandBriefContext}\n\nALSO follow these universal content quality rules:\n${BRAND_VOICE}`
    : BRAND_VOICE

  const message = await client.messages.create({
    model: models.post_instagram,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are writing an Instagram caption for a business brand.

${voiceSection}

${POST_STRUCTURE}

INSTAGRAM RULES (2025–2026 algorithm)
- Length: 80–150 words
- NO hashtags. Hashtags no longer drive reach on Instagram. Omit them entirely.
- The algorithm rewards: saves, shares (DMs), comments, and time spent reading.
  Write content people want to save for later or send to someone.
- Hook (first 5–8 words): must stop the scroll. Pain-driven or contrarian.
  The hook is what shows before "more" — make it impossible to ignore.
- Body: break down the insight or problem. Short lines. One idea per line.
  Dense value. Every sentence should make the reader nod or think.
- End with a save-driving CTA. Examples:
  "Save this before you forget."
  "Send this to someone who needs it."
  "Screenshot this and keep it."
- Pick one Content Angle and one Post Type from above that best fits the source

Source content:
${extractedContent}

Write the Instagram caption now. No hashtags. Output only the caption text, nothing else.`,
      },
    ],
  })

  return (message.content[0] as { text: string }).text.trim()
}

export async function generateXPost(extractedContent: string, brandBriefContext?: string | null): Promise<string> {
  const client = getClient()
  const { models } = await getPlatformConfig()
  const voiceSection = brandBriefContext
    ? `The following is the brand identity of the business you are writing for. Write in their voice, for their audience, aligned with their content pillars and personality:\n\n${brandBriefContext}\n\nALSO follow these universal content quality rules:\n${BRAND_VOICE}`
    : BRAND_VOICE

  const message = await client.messages.create({
    model: models.post_x,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are writing an X (Twitter) post for a business brand.

${voiceSection}

X RULES
- Maximum 280 characters — count carefully
- Short. Punchy. High frequency style.
- Lead with the most painful or surprising point
- No hashtags
- No build-up — the first word should hit
- End with a direct statement, not a question

Source content:
${extractedContent}

Write the X post now. Output only the post text, nothing else. Must be under 280 characters.`,
      },
    ],
  })

  return (message.content[0] as { text: string }).text.trim()
}

export async function generateAllPosts(extractedContent: string, brandBriefContext?: string | null) {
  const [linkedin, instagram, x] = await Promise.all([
    generateLinkedInPost(extractedContent, brandBriefContext),
    generateInstagramPost(extractedContent, brandBriefContext),
    generateXPost(extractedContent, brandBriefContext),
  ])
  return { linkedin, instagram, x }
}

// ── Viral Carousel Studio ──────────────────────────────────────────────────

/**
 * Build the slide structure prompt dynamically based on slide count (4–10).
 * Hook + Pain + CTA are always present. Value scales with slide count;
 * Rehook / AHA / Takeaway are added back in as count grows.
 */
type ViralSlideType = 'hook' | 'rehook' | 'pain' | 'value' | 'turning_point' | 'takeaway' | 'cta'

interface SlidePlanItem {
  number: number
  type: ViralSlideType
  label: string
  description: string
}

function planViralSlides(numSlides: number): SlidePlanItem[] {
  const n = Math.min(Math.max(4, numSlides), 10)
  const plan: Omit<SlidePlanItem, 'number'>[] = []

  // Always: HOOK
  plan.push({
    type: 'hook',
    label: 'HOOK',
    description: 'Pattern interrupt. Bold, controversial, curiosity-driven statement that makes the reader feel "Wait… what?". 5–10 words.',
  })

  // 5+: REHOOK (open loop, builds curiosity)
  if (n >= 5) {
    plan.push({
      type: 'rehook',
      label: 'REHOOK',
      description: 'Open loop. Add intrigue without giving the answer. Tease the outcome. Make them NEED the next slide.',
    })
  }

  // Always: PAIN (relatable starting point)
  plan.push({
    type: 'pain',
    label: 'RELATABLE PAIN',
    description: 'Short relatable situation or story start. "Most people think…" OR "I used to…" OR "Everyone does this wrong…".',
  })

  // VALUE slides scale with size: 4→1, 5→1, 6→1, 7→2, 8→2, 9→3, 10→4
  const valueCount = n <= 6 ? 1 : n === 7 ? 2 : n === 8 ? 2 : n === 9 ? 3 : 4
  for (let i = 1; i <= valueCount; i++) {
    plan.push({
      type: 'value',
      label: valueCount > 1 ? `VALUE ${i}` : 'VALUE',
      description: `One key insight. Break expectations, reveal step-by-step. Mix storytelling and actionable value.`,
    })
  }

  // 6+: AHA MOMENT (turning point)
  if (n >= 6) {
    plan.push({
      type: 'turning_point',
      label: 'AHA MOMENT',
      description: 'The save-worthy realization. Reveal the key shift in perspective. Make it feel like a moment of clarity.',
    })
  }

  // 8+: TAKEAWAY (clear actionable steps)
  if (n >= 8) {
    plan.push({
      type: 'takeaway',
      label: 'TAKEAWAY',
      description: 'Clear, practical steps the reader can apply immediately.',
    })
  }

  // Always: CTA
  plan.push({
    type: 'cta',
    label: 'CTA',
    description: 'Engagement trigger. Strong direct call to action — "Save this", "Send to someone who needs it", "Follow for more".',
  })

  return plan.map((p, i) => ({ ...p, number: i + 1 }))
}

function buildViralStructurePrompt(plan: SlidePlanItem[]): string {
  const lines = [`CAROUSEL STRUCTURE (exactly ${plan.length} slides):`]
  for (const item of plan) {
    lines.push(`Slide ${item.number} – ${item.label}: ${item.description}`)
  }
  return lines.join('\n\n')
}

function buildViralOutputExample(plan: SlidePlanItem[]): string {
  return '[\n' + plan.map((p) =>
    `  {"number": ${p.number}, "type": "${p.type}", "label": "${p.label}", "text": "Bold headline here.", "body": "Supporting sentence."}`
  ).join(',\n') + '\n]'
}

/**
 * Generates N viral carousel slides (4–10) using the user's proven carousel structure.
 * Slide count adapts the structure: hook + pain + CTA always present;
 * rehook/aha/takeaway/extra-value scale up as N grows.
 */
export async function generateViralCarouselSlides(
  content: string,
  options: {
    numSlides?: number
    additionalInfo?: string
    aimStyleDescription?: string
    brandSettings?: BrandSettings
    brandBriefContext?: string | null
  } = {}
): Promise<ViralSlide[]> {
  const {
    numSlides = 10,
    additionalInfo,
    aimStyleDescription,
    brandSettings,
    brandBriefContext,
  } = options

  const client = getClient()
  const { models } = await getPlatformConfig()

  const plan = planViralSlides(numSlides)
  const structurePrompt = buildViralStructurePrompt(plan)
  const outputExample = buildViralOutputExample(plan)

  const brandContext = brandBriefContext
    ? `\nBRAND IDENTITY — write every slide in this brand's voice, for their audience:\n${brandBriefContext}`
    : brandSettings?.brand_name
    ? `\nBRAND: ${brandSettings.brand_name} — write in a voice that fits this brand.`
    : ''

  const aimContext = aimStyleDescription
    ? `\nVISUAL STYLE REFERENCE: The user wants the slides to feel like: ${aimStyleDescription}`
    : ''

  const extraContext = additionalInfo?.trim()
    ? `\nADDITIONAL CONTEXT FROM USER: ${additionalInfo.trim()}`
    : ''

  const message = await client.messages.create({
    model: models.carousel_slides,
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `You are a world-class viral content strategist who creates highly addictive Instagram carousel posts using psychology, storytelling, and curiosity loops.

Your goal is to turn any topic into a scroll-stopping, binge-worthy carousel that maximizes saves, shares, and comments.

CORE PRINCIPLE:
Every carousel must feel like a story unfolding — not just information.
Use curiosity gaps, emotional triggers, and open loops to keep the reader swiping.

${BRAND_VOICE}

${structurePrompt}

WRITING STYLE:
- Short, sharp sentences. No fluff.
- Conversational, slightly dramatic tone.
- Write like you're talking to one person.
- Every line creates momentum.
- No emojis, no hashtags, no asterisks.
- Active voice only.

SLIDE TEXT RULES:
- "text" = the bold HEADLINE — max 8 words, punchy, scroll-stopping. This is the giant text on the slide.
- "body" = 1–2 supporting sentences that expand on the headline. Max 25 words. Conversational. Adds context or creates curiosity.

PSYCHOLOGICAL TRIGGERS TO USE: curiosity gap, pattern interrupt, social proof, FOMO, contrarian ideas, fast rewards.
${brandContext}${aimContext}${extraContext}

SOURCE CONTENT TO BASE THE CAROUSEL ON:
${content}

OUTPUT FORMAT — return ONLY a valid JSON array of ${plan.length} objects, no markdown, no explanation:
${outputExample}

Generate all ${plan.length} slides now. Make each slide scroll-stopping.`,
    }],
  })

  const raw = (message.content[0] as { text: string }).text.trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Claude did not return valid JSON for viral slides. Got: ${raw.slice(0, 200)}`)

  const slides = JSON.parse(match[0]) as ViralSlide[]
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('Claude returned an empty slide array')
  }

  return slides
}

/**
 * Generates an Instagram caption for the carousel.
 * The caption complements the slides and drives saves/comments.
 */
export async function generateCarouselCaption(
  content: string,
  slides: { number: number; label?: string; text: string }[]
): Promise<string> {
  const client = getClient()
  const { models } = await getPlatformConfig()

  const slidesSummary = slides.map((s) => `Slide ${s.number} (${s.label}): ${s.text}`).join('\n')

  const message = await client.messages.create({
    model: models.carousel_caption,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are writing an Instagram caption for a carousel post.

${BRAND_VOICE}

INSTAGRAM CAPTION RULES:
- Length: 80–150 words max
- NO hashtags
- Hook in the first line (5–8 words) — must stop the scroll
- Body: 2–3 short lines teasing what's inside the carousel
- End with a save-driving CTA like: "Save this before you forget." or "Send this to someone who needs it."
- Write like you're talking to one person
- The caption should make people want to swipe through the carousel

THE CAROUSEL SLIDES:
${slidesSummary}

SOURCE CONTENT:
${content.slice(0, 600)}

Write the Instagram caption now. No hashtags. Output only the caption text, nothing else.`,
    }],
  })

  return (message.content[0] as { text: string }).text.trim()
}

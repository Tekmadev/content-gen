import Anthropic from '@anthropic-ai/sdk'
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

export async function generateLinkedInPost(extractedContent: string): Promise<string> {
  const client = getClient()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are writing a LinkedIn post for a business brand.

${BRAND_VOICE}

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

export async function generateInstagramPost(extractedContent: string): Promise<string> {
  const client = getClient()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are writing an Instagram caption for a business brand.

${BRAND_VOICE}

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

export async function generateXPost(extractedContent: string): Promise<string> {
  const client = getClient()
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are writing an X (Twitter) post for a business brand.

${BRAND_VOICE}

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

export async function generateAllPosts(extractedContent: string) {
  const [linkedin, instagram, x] = await Promise.all([
    generateLinkedInPost(extractedContent),
    generateInstagramPost(extractedContent),
    generateXPost(extractedContent),
  ])
  return { linkedin, instagram, x }
}

// ── Viral Carousel Studio ──────────────────────────────────────────────────

const VIRAL_CAROUSEL_STRUCTURE = `
CAROUSEL STRUCTURE (exactly 10 slides):
Slide 1 – HOOK (Pattern Interrupt): Bold, controversial, or curiosity-driven statement.
  - Make the reader feel: "Wait… what?"
  - Use tension, surprise, or a strong claim
  - 5–10 words max

Slide 2 – REHOOK (Open Loop): Add more intrigue without giving the answer.
  - Tease the outcome
  - Build curiosity gap
  - Make them NEED the next slide

Slide 3 – RELATABLE PAIN / STORY START: Start a short story or relatable situation.
  - "Most people think…" OR "I used to…" OR "Everyone does this wrong…"

Slides 4–7 – VALUE (Story + Insights): Deliver main content through narrative flow.
  - Break expectations
  - Reveal insights step-by-step
  - Each slide = 1 key idea
  - Mix storytelling + actionable value

Slide 8 – TURNING POINT (AHA MOMENT): Reveal the key insight or shift in perspective.
  - Make it feel like a realization
  - This is the "save-worthy" moment

Slide 9 – ACTIONABLE TAKEAWAY: Give clear, practical steps or advice.
  - Make it easy to apply immediately

Slide 10 – CTA (Engagement Trigger): Use a strong call-to-action.
  - "Comment 'X' and I'll send it" / "Follow for more" / "Save this before it disappears"
`

/**
 * Generates 10 viral carousel slides using the user's proven carousel structure.
 * Optionally uses AIM image style description and additional context.
 */
export async function generateViralCarouselSlides(
  content: string,
  additionalInfo?: string,
  aimStyleDescription?: string,
  brandSettings?: BrandSettings
): Promise<ViralSlide[]> {
  const client = getClient()

  const brandContext = brandSettings?.brand_name
    ? `\nBRAND: ${brandSettings.brand_name} — write in a voice that fits this brand.`
    : ''

  const aimContext = aimStyleDescription
    ? `\nVISUAL STYLE REFERENCE: The user wants the slides to feel like: ${aimStyleDescription}`
    : ''

  const extraContext = additionalInfo?.trim()
    ? `\nADDITIONAL CONTEXT FROM USER: ${additionalInfo.trim()}`
    : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `You are a world-class viral content strategist who creates highly addictive Instagram carousel posts using psychology, storytelling, and curiosity loops.

${BRAND_VOICE}

${VIRAL_CAROUSEL_STRUCTURE}

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

PSYCHOLOGICAL TRIGGERS TO USE: Curiosity gap, pattern interrupt, FOMO, contrarian ideas, fast rewards.
${brandContext}${aimContext}${extraContext}

SOURCE CONTENT TO BASE THE CAROUSEL ON:
${content}

OUTPUT FORMAT — return ONLY a valid JSON array, no markdown, no explanation:
[
  {"number": 1, "type": "hook", "label": "HOOK", "text": "Bold headline here.", "body": "Supporting sentence that builds intrigue."},
  {"number": 2, "type": "rehook", "label": "REHOOK", "text": "Second hook headline.", "body": "Supporting sentence."},
  {"number": 3, "type": "pain", "label": "RELATABLE PAIN", "text": "Pain point headline.", "body": "Supporting sentence."},
  {"number": 4, "type": "value", "label": "VALUE 1", "text": "Value headline.", "body": "Supporting sentence."},
  {"number": 5, "type": "value", "label": "VALUE 2", "text": "Value headline.", "body": "Supporting sentence."},
  {"number": 6, "type": "value", "label": "VALUE 3", "text": "Value headline.", "body": "Supporting sentence."},
  {"number": 7, "type": "value", "label": "VALUE 4", "text": "Value headline.", "body": "Supporting sentence."},
  {"number": 8, "type": "turning_point", "label": "AHA MOMENT", "text": "AHA headline.", "body": "Supporting sentence."},
  {"number": 9, "type": "takeaway", "label": "TAKEAWAY", "text": "Takeaway headline.", "body": "Supporting sentence."},
  {"number": 10, "type": "cta", "label": "CTA", "text": "CTA headline.", "body": "Specific action for the reader to take."}
]

Generate all 10 slides now. Make each slide scroll-stopping.`,
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

  const slidesSummary = slides.map((s) => `Slide ${s.number} (${s.label}): ${s.text}`).join('\n')

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
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

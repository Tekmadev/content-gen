import Anthropic from '@anthropic-ai/sdk'

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

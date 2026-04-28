import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlatformConfig } from '@/lib/platform-config'
import type { ChatMessage, BrandBrief } from '@/lib/types'

export const maxDuration = 120

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getHeaders() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
  }
}

async function callGemini(model: string, prompt: string, maxTokens = 8192): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
    }),
  })
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Robustly parse JSON from Gemini output — handles markdown fences and extra text */
function extractJson(raw: string): Partial<BrandBrief> {
  let text = raw.trim()

  // Strategy 1: strip ```json ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  // Strategy 2: find the first { ... } block if there's surrounding text
  if (!text.startsWith('{')) {
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) text = objMatch[0]
  }

  // Strategy 3: try to fix truncated JSON by closing open structures
  try {
    return JSON.parse(text)
  } catch {
    // Count unclosed brackets to attempt repair
    let openBraces = 0, openBrackets = 0
    for (const ch of text) {
      if (ch === '{') openBraces++
      else if (ch === '}') openBraces--
      else if (ch === '[') openBrackets++
      else if (ch === ']') openBrackets--
    }
    let repaired = text
    // close any open arrays first, then objects
    for (let i = 0; i < openBrackets; i++) repaired += ']'
    for (let i = 0; i < openBraces; i++) repaired += '}'
    return JSON.parse(repaired)
  }
}

// ── POST — extract structured data from chat history + generate brand brief ──

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { chat_history, reference_images = [] }: {
    chat_history: ChatMessage[]
    reference_images?: string[]
  } = await request.json()

  if (!chat_history?.length) {
    return NextResponse.json({ error: 'chat_history is required' }, { status: 400 })
  }

  // Read model from platform_config (admin-configurable, falls back to gemini-2.5-flash)
  const { models } = await getPlatformConfig()
  const model = models.brand_chat ?? 'gemini-2.5-flash'
  console.log('[brand-brief/generate] model=%s', model)

  const conversationText = chat_history
    .map((m) => `${m.role === 'user' ? 'CLIENT' : 'BRAND STRATEGIST'}: ${m.content}`)
    .join('\n\n')

  // Step 1 — extract structured JSON from the conversation
  const extractPrompt = `You are a data extraction agent. Read this brand discovery conversation and extract all brand information into a precise JSON object.

CONVERSATION:
${conversationText}

Return ONLY a valid JSON object with these exact keys (use empty string/array if not mentioned):
{
  "business_name": "",
  "tagline": "",
  "founded": "",
  "location": "",
  "website": "",
  "business_description": "",
  "mission": "",
  "audiences": [
    { "name": "", "description": "", "pain_points": [], "goals": [] }
  ],
  "personality_words": [],
  "tone_of_voice": "",
  "brand_character": "",
  "services": [
    { "name": "", "description": "", "key_message": "", "outcome": "" }
  ],
  "unique_value": "",
  "content_pillars": [],
  "content_goals": "",
  "always_say": [],
  "never_say": [],
  "example_phrases": []
}

Return ONLY the JSON. No markdown fences, no commentary.`

  let structured: Partial<BrandBrief> = {}
  try {
    const rawJson = await callGemini(model, extractPrompt, 8192)
    console.log('[brand-brief/generate] raw extraction length=%d', rawJson.length)
    structured = extractJson(rawJson)
  } catch (err) {
    console.error('[brand-brief/generate] JSON extraction failed:', err)
    // Save chat history to DB so the user doesn't lose their conversation
    await supabase.from('brand_briefs').upsert({
      user_id:         user.id,
      chat_history,
      reference_images,
      chat_completed:  false,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })
    return NextResponse.json(
      { error: 'Failed to extract brand data from conversation. Your chat history has been saved — click "Try again" to retry.' },
      { status: 500 }
    )
  }

  // Step 2 — generate the polished markdown brand brief
  const briefPrompt = `You are a senior brand strategist. Using this brand data, write a comprehensive, detailed brand brief in markdown format. Match the structure and depth of a professional brand identity document.

BRAND DATA:
${JSON.stringify(structured, null, 2)}

Write the brief with these exact sections in this order:

# [Business Name] — Brand Identity Brief

## 1. Company Identity & Story
Cover: what they do, when founded, location, mission, tagline, and why they exist.

## 2. What We Do
Describe the core offering and value proposition in 2-3 paragraphs.

## 3. Services
For each service: name, what it is, key message, and the outcome for the client.

## 4. Target Audience
For each audience segment: who they are, their pain points, their goals.

## 5. Brand Personality
List the personality words and explain what each means in practice for this brand.

## 6. Voice & Tone Guide
- Tone: [describe the tone]
- Writing style rules (5-8 bullet points)
- Always say: [list]
- Never say: [list]
- Example phrases: [list]

## 7. Content Strategy
- Content pillars (with 1-sentence explanation each)
- Goals of social media content
- What each post should make the audience feel/do

## 8. What Makes Us Different
Clear, punchy differentiation statement.

## 9. Quick-Reference Cheatsheet
A compact table: Brand in 3 words | Tone | Audience | Core message | Never say | Always say

Be specific, vivid, and detailed. Use the actual brand information — do not use placeholders. Write as if this will be handed to a content creator who has never heard of this brand.`

  const generatedBrief = await callGemini(model, briefPrompt, 8192)

  // Step 3 — save everything to the database
  const now = new Date().toISOString()
  const payload = {
    user_id:             user.id,
    ...structured,
    reference_images,
    generated_brief:     generatedBrief,
    brief_generated_at:  now,
    chat_history,
    chat_completed:      true,
    updated_at:          now,
  }

  const { error } = await supabase
    .from('brand_briefs')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    console.error('[brand-brief/generate] DB upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, brief: generatedBrief, structured })
}

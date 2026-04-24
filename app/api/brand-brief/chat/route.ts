import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ChatMessage } from '@/lib/types'

export const maxDuration = 60

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.0-flash'

const SYSTEM_PROMPT = `You are "Brand", a friendly and knowledgeable brand strategist helping a business owner build their brand identity profile. This profile will be used to generate consistent, on-brand social media content for them automatically.

Your job is to have a warm, natural conversation to learn everything about their brand. Ask ONE question at a time. Keep your messages short — 2 to 4 sentences max. Be encouraging, specific, and curious.

Cover these 12 areas in order (you can combine 1+2 naturally):
1. Business name and what they do (in their own words)
2. Location and how long they have been in business
3. Who their ideal customer is (who they serve, what situation they're in)
4. 3 to 5 words that describe their brand personality
5. Their tone of voice (formal or casual, serious or playful, bold or subtle)
6. The main services or products they offer
7. The specific problem they solve for their clients
8. What makes them different from their competitors
9. What topics they want to post about on social media (their content pillars)
10. The goal of their social media content (awareness, leads, sales, community, trust)
11. Words or phrases they always use, or things they want to avoid saying
12. Whether they have any visual references — brand photos, competitor styles, mood boards, or colors they love (let them know they can upload images)

If their answer is vague, ask one short follow-up to get specifics before moving on.
If they mention uploading images, acknowledge it warmly and continue to the next question.

When you have gathered information for ALL 12 areas, say:
"Perfect! I now have everything I need to build your brand profile. Give me just a moment to put it all together..."

Then on the very next line, output this exact JSON block and nothing else after it:
\`\`\`json
{"action":"BRIEF_COMPLETE"}
\`\`\`

Do NOT output the JSON block before covering all 12 areas. Do not number your questions. Sound like a real conversation, not a form.`

function getHeaders() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': key,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history }: { message: string; history: ChatMessage[] } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Build conversation contents for Gemini
  const contents = [
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: message }],
    },
  ]

  const res = await fetch(
    `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 })
  }

  // Stream the response back to the client as plain text chunks
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Gemini SSE: each line is "data: {...}" — extract text from each candidate
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6).trim()
            if (!json || json === '[DONE]') continue
            try {
              const parsed = JSON.parse(json)
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch {
              // skip malformed chunks
            }
          }
        }
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

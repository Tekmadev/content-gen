// Server-side only — uses admin client to load brand briefs in API routes
import { createAdminClient } from '@/lib/supabase/admin'
import type { BrandBrief } from '@/lib/types'

export async function getUserBrandBrief(userId: string): Promise<BrandBrief | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('brand_briefs')
    .select('*')
    .eq('user_id', userId)
    .eq('chat_completed', true)
    .maybeSingle()
  return data ?? null
}

/**
 * Converts a user's brand brief into a prompt-ready context block.
 * Returns null if the brief has no meaningful content.
 */
export function buildBrandVoiceContext(brief: BrandBrief | null): string | null {
  if (!brief || !brief.business_name) return null

  const lines: string[] = []

  lines.push(`BRAND IDENTITY`)
  lines.push(`Business: ${brief.business_name}`)
  if (brief.tagline) lines.push(`Tagline: "${brief.tagline}"`)
  if (brief.business_description) lines.push(`What we do: ${brief.business_description}`)
  if (brief.mission) lines.push(`Mission: ${brief.mission}`)
  if (brief.location) lines.push(`Based in: ${brief.location}`)

  if (brief.personality_words?.length) {
    lines.push(`\nBRAND PERSONALITY`)
    lines.push(`Words that describe us: ${brief.personality_words.join(', ')}`)
  }

  if (brief.tone_of_voice) {
    lines.push(`Tone of voice: ${brief.tone_of_voice}`)
  }

  if (brief.brand_character) {
    lines.push(`Brand character: ${brief.brand_character}`)
  }

  if (brief.unique_value) {
    lines.push(`What makes us different: ${brief.unique_value}`)
  }

  if (brief.audiences?.length) {
    lines.push(`\nTARGET AUDIENCE`)
    for (const a of brief.audiences) {
      lines.push(`- ${a.name}: ${a.description}`)
      if (a.pain_points?.length) lines.push(`  Pain points: ${a.pain_points.join('; ')}`)
      if (a.goals?.length) lines.push(`  Goals: ${a.goals.join('; ')}`)
    }
  }

  if (brief.services?.length) {
    lines.push(`\nSERVICES`)
    for (const s of brief.services) {
      lines.push(`- ${s.name}: ${s.description}`)
      if (s.key_message) lines.push(`  Key message: "${s.key_message}"`)
      if (s.outcome) lines.push(`  Client outcome: ${s.outcome}`)
    }
  }

  if (brief.content_pillars?.length) {
    lines.push(`\nCONTENT PILLARS`)
    lines.push(brief.content_pillars.map((p) => `- ${p}`).join('\n'))
  }

  if (brief.content_goals) {
    lines.push(`Content goal: ${brief.content_goals}`)
  }

  const voiceRules: string[] = []
  if (brief.always_say?.length) {
    voiceRules.push(`Always say / use: ${brief.always_say.join(', ')}`)
  }
  if (brief.never_say?.length) {
    voiceRules.push(`Never say / avoid: ${brief.never_say.join(', ')}`)
  }
  if (brief.example_phrases?.length) {
    voiceRules.push(`Example phrases: ${brief.example_phrases.join(' | ')}`)
  }
  if (voiceRules.length) {
    lines.push(`\nVOICE RULES`)
    lines.push(...voiceRules)
  }

  return lines.join('\n')
}

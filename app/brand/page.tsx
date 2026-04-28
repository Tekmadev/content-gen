'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import BrandChat from '@/components/BrandChat'
import BrandBriefDisplay from '@/components/BrandBriefDisplay'
import BrandStyleSection from '@/components/BrandStyleSection'
import type { BrandBrief, ChatMessage } from '@/lib/types'

type PageState = 'loading' | 'chat' | 'generating' | 'ready' | 'error'

const EMPTY_BRIEF: BrandBrief = {
  business_name: '',
  tagline: '',
  founded: '',
  location: '',
  website: '',
  business_description: '',
  mission: '',
  audiences: [],
  personality_words: [],
  tone_of_voice: '',
  brand_character: '',
  services: [],
  unique_value: '',
  content_pillars: [],
  content_goals: '',
  always_say: [],
  never_say: [],
  example_phrases: [],
  reference_images: [],
  generated_brief: '',
  brief_generated_at: null,
  chat_history: [],
  chat_completed: false,
}

export default function BrandPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{ email?: string; user_metadata?: { avatar_url?: string; full_name?: string } } | null>(null)
  const [brief, setBrief] = useState<BrandBrief>(EMPTY_BRIEF)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [generateError, setGenerateError] = useState('')

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUser(data.user)
    })
  }, [supabase, router])

  // Load existing brand brief
  useEffect(() => {
    if (!user) return
    fetch('/api/brand-brief')
      .then((r) => r.ok ? r.json() : null)
      .then((data: BrandBrief | null) => {
        if (data?.chat_completed) {
          setBrief(data)
          setPageState('ready')
        } else if (data) {
          setBrief(data)
          setPageState('chat')
        } else {
          setPageState('chat')
        }
      })
      .catch(() => setPageState('chat'))
  }, [user])

  // Run the generate pipeline — extracted so we can reuse it for "Retry generation"
  const runGeneration = useCallback(async (history: ChatMessage[], images: string[]) => {
    setPageState('generating')
    setGenerateError('')
    try {
      const res = await fetch('/api/brand-brief/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_history: history, reference_images: images }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Generation failed')
      }
      const { structured, brief: generatedBrief } = await res.json()
      setBrief({
        ...EMPTY_BRIEF,
        ...structured,
        reference_images: images,
        generated_brief: generatedBrief,
        brief_generated_at: new Date().toISOString(),
        chat_history: history,
        chat_completed: true,
      })
      setPageState('ready')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }, [])

  // Called when chat signals completion — saves history first, then generates
  const handleChatComplete = useCallback(async (history: ChatMessage[], images: string[]) => {
    // ⚡ Persist chat history IMMEDIATELY to state + DB before generation starts.
    // This ensures "Try again" / refresh always restores the full conversation.
    const withHistory: BrandBrief = { ...EMPTY_BRIEF, chat_history: history, reference_images: images }
    setBrief(withHistory)
    // Await the save so the row exists before we try to upsert generated data on top
    try {
      await fetch('/api/brand-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withHistory),
      })
    } catch {
      // non-fatal — generation will still attempt to upsert
    }
    await runGeneration(history, images)
  }, [runGeneration])

  // Called when user edits individual fields in the brief display
  const handleUpdate = useCallback(async (patch: Partial<BrandBrief>) => {
    const updated = { ...brief, ...patch }
    setBrief(updated)
    await fetch('/api/brand-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
  }, [brief])

  // Reset — lets user redo the wizard
  const handleReset = useCallback(async () => {
    const reset = { ...EMPTY_BRIEF }
    setBrief(reset)
    await fetch('/api/brand-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reset),
    })
    setPageState('chat')
  }, [])

  if (!user || pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AppShell user={user}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🎨</span>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Brand Identity</h1>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm ml-10">
            Your brand profile powers every piece of content generated in SMS — posts, carousels, captions, and more.
          </p>
        </div>

        {/* Chat state */}
        {pageState === 'chat' && (
          <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--background)]" style={{ height: '75vh' }}>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">
                B
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Brand — Your Brand Strategist</p>
                <p className="text-xs text-[var(--muted-foreground)]">Powered by Gemini · Takes ~5 minutes</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-[var(--muted-foreground)]">Online</span>
              </div>
            </div>
            <div className="h-[calc(100%-61px)]">
              <BrandChat
                initialHistory={brief.chat_history ?? []}
                referenceImages={brief.reference_images ?? []}
                onComplete={handleChatComplete}
              />
            </div>
          </div>
        )}

        {/* Generating state */}
        {pageState === 'generating' && (
          <div className="border border-[var(--border)] rounded-2xl p-16 flex flex-col items-center justify-center gap-6 bg-[var(--surface)]">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">✨</span>
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-[var(--foreground)]">Building your brand profile…</p>
              <p className="text-sm text-[var(--muted-foreground)]">Extracting brand data and generating your full brief. This takes 15–30 seconds.</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {pageState === 'error' && (
          <div className="border border-red-500/30 bg-red-500/10 rounded-2xl p-8 text-center space-y-4">
            <p className="text-red-400 font-medium">Generation failed</p>
            <p className="text-sm text-[var(--muted-foreground)]">{generateError}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Your chat ({(brief.chat_history ?? []).length} messages) is safely saved — choose how to retry:
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => runGeneration(brief.chat_history ?? [], brief.reference_images ?? [])}
                className="text-sm font-medium bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
              >
                ✨ Retry generation
              </button>
              <button
                onClick={() => setPageState('chat')}
                className="text-sm border border-[var(--border)] px-4 py-2 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--foreground)]"
              >
                Continue chat
              </button>
            </div>
          </div>
        )}

        {/* Ready state — show brand brief */}
        {pageState === 'ready' && (
          <BrandBriefDisplay
            brief={brief}
            onUpdate={handleUpdate}
            onReset={handleReset}
          />
        )}

        {/* Brand Style — visual identity for AI-generated images.
            Always visible (any state) so users can configure their style
            before, during, or after the brand chat. Persists to brand_settings. */}
        <div className="mt-8">
          <BrandStyleSection />
        </div>
      </div>
    </AppShell>
  )
}

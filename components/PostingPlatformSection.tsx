'use client'

/**
 * PostingPlatformSection — shows the user's plan-allowed publishing platforms.
 *
 * For Starter tier: lets the user pick their one platform of choice.
 *   The choice is saved to user_profiles.starter_platform via PATCH /api/profile
 *   and enforced server-side in /api/generate + /api/publish.
 *
 * For Creator/Pro/Agency tiers: shows "All platforms" as a confirmation card.
 *
 * Drop into any page with <PostingPlatformSection />.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Platform = 'linkedin' | 'instagram' | 'x'

const PLATFORM_OPTIONS: { id: Platform; label: string; color: string; icon: string }[] = [
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0077b5', icon: 'in' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', icon: '◉' },
  { id: 'x',         label: 'X',         color: '#000000', icon: '𝕏' },
]

interface ProfileShape {
  subscription_plan: 'starter' | 'creator' | 'pro' | 'agency' | null
  starter_platform: Platform | null
}

export default function PostingPlatformSection() {
  const [profile, setProfile] = useState<ProfileShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedPlatform, setSavedPlatform] = useState<Platform | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const { profile: p } = await res.json()
          setProfile(p)
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const choose = async (platform: Platform) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starter_platform: platform }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg ?? 'Save failed')
      }
      setProfile((prev) => prev ? { ...prev, starter_platform: platform } : prev)
      setSavedPlatform(platform)
      setTimeout(() => setSavedPlatform(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="border border-[var(--border)] rounded-2xl p-8 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  const plan = profile.subscription_plan
  const isStarter = plan === 'starter'
  // Same default as the server (lib/platform-restriction.ts STARTER_DEFAULT)
  const currentPlatform: Platform = profile.starter_platform ?? 'linkedin'

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
        <span>📡</span>
        <h3 className="font-semibold text-[var(--foreground)] text-sm">Publishing Platform</h3>
        {plan && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 rounded-full">
            {plan} plan
          </span>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">

        {/* Non-Starter tiers: simple confirmation card */}
        {!isStarter && plan !== null && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 text-lg flex-shrink-0">
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">All platforms unlocked</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Your {plan} plan publishes to LinkedIn, Instagram, and X. No restrictions.
              </p>
            </div>
          </div>
        )}

        {/* No plan yet */}
        {plan === null && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-lg flex-shrink-0">
              !
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">No active subscription</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Choose a plan to start publishing.{' '}
                <Link href="/billing" className="underline text-[var(--accent)]">View plans →</Link>
              </p>
            </div>
          </div>
        )}

        {/* Starter: platform picker */}
        {isStarter && (
          <>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Pick your platform</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Starter posts to one platform. You can change this anytime.{' '}
                <Link href="/billing" className="underline text-[var(--accent)]">
                  Upgrade to Creator
                </Link>{' '}
                to unlock all 3.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map(({ id, label, color, icon }) => {
                const active = currentPlatform === id
                const justSaved = savedPlatform === id
                return (
                  <button
                    key={id}
                    onClick={() => !active && choose(id)}
                    disabled={saving}
                    className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition-all relative ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)]'
                    } disabled:opacity-50 disabled:cursor-wait`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {icon}
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
                    {active && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                        ✓ {justSaved ? 'Saved' : 'Active'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-start gap-2 text-xs text-[var(--muted-foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5">
              <span className="text-base leading-none">💡</span>
              <span>
                Generations and publishes are restricted to <strong className="text-[var(--foreground)]">{PLATFORM_OPTIONS.find((p) => p.id === currentPlatform)?.label}</strong>.
                We don&apos;t spend tokens generating posts you can&apos;t publish.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppShell from '@/components/AppShell'
import UserAvatar from '@/components/UserAvatar'

interface Account {
  id: string
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok'
  username: string
  fullname?: string
  displayName?: string
  subAccounts: { id: string; name: string }[]
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0077b5',
  instagram: '#e1306c',
  facebook: '#1877f2',
  tiktok: '#010101',
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [user, setUser] = useState<{
    id?: string
    email?: string
    user_metadata?: { avatar_url?: string; full_name?: string; email?: string }
  } | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false))
  }, [])

  async function copyUserId() {
    if (!user) return
    await navigator.clipboard.writeText(user.id ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    if (!acc[a.platform]) acc[a.platform] = []
    acc[a.platform].push(a)
    return acc
  }, {})

  return (
    <AppShell user={user}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <h1 className="text-xl font-semibold">Settings</h1>

        {/* Profile */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Profile</h2>

          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-[var(--foreground)]">
                {user?.user_metadata?.full_name || 'No name'}
              </p>
              <p className="text-sm text-[var(--muted)]">{user?.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Account ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--muted)] truncate font-mono">
                {user?.id ?? '—'}
              </code>
              <button
                onClick={copyUserId}
                className="text-xs text-[var(--primary)] hover:underline flex-shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)] mb-3">
              Authenticated via Google through Supabase. To change your name or profile picture, update your Google account.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Connected Accounts</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Managed via Blotato. Connect or disconnect accounts from your Blotato dashboard.
              </p>
            </div>
            <a
              href="https://app.blotato.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap flex-shrink-0"
            >
              Open Blotato →
            </a>
          </div>

          {loadingAccounts ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--muted)]">Loading accounts…</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <p className="text-sm text-[var(--muted)]">No accounts connected yet.</p>
              <a
                href="https://app.blotato.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--primary)] hover:underline font-medium"
              >
                Connect accounts in Blotato →
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(grouped).map(([platform, accs]) => (
                <div key={platform} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PLATFORM_COLORS[platform] ?? '#999' }}
                    />
                    <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pl-4">
                    {accs.map((acc) => (
                      <div key={acc.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 bg-[var(--surface)] rounded-lg px-3 py-2.5">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {acc.fullname || acc.displayName || acc.username}
                            </p>
                            {acc.username && (acc.fullname || acc.displayName) && (
                              <p className="text-xs text-[var(--muted)] truncate">@{acc.username}</p>
                            )}
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Connected" />
                        </div>
                        {acc.subAccounts?.length > 0 && (
                          <div className="pl-3 flex flex-col gap-1">
                            {acc.subAccounts.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2 text-xs text-[var(--muted)] bg-[var(--surface)] rounded-lg px-3 py-2">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {sub.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* API Keys info */}
        <section className="bg-white rounded-2xl border border-[var(--border)] p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-[var(--muted)]">Integrations</h2>
          <div className="flex flex-col gap-3">
            {[
              { name: 'Blotato', desc: 'Content extraction, visual generation, and publishing', env: 'BLOTATO_API_KEY' },
              { name: 'Anthropic Claude', desc: 'AI post copy generation', env: 'ANTHROPIC_API_KEY' },
              { name: 'Supabase', desc: 'Database, auth, and file storage', env: 'NEXT_PUBLIC_SUPABASE_URL' },
            ].map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3 bg-[var(--surface)] rounded-lg px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                </div>
                <span className="text-xs font-mono bg-white border border-[var(--border)] rounded px-2 py-1 text-[var(--muted)] flex-shrink-0">
                  {item.env}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            API keys are set as environment variables and never exposed to the browser.
          </p>
        </section>
      </div>
    </AppShell>
  )
}

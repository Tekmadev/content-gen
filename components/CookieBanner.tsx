'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Cookie consent banner — required for GDPR / PIPEDA transparency.
// We only set essential session cookies (Supabase auth) and a single
// localStorage flag to remember the user's dismissal. No third-party
// analytics cookies are written, so the choice is essentially "got it"
// vs "show me the policy" — no granular toggles needed yet.
//
// When analytics are added later, expand this to a real "accept / reject"
// toggle and gate analytics on the saved preference.

const STORAGE_KEY = 'cm.cookies.acknowledged.v1'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== '1') {
        // Defer one tick so the banner doesn't flash during hydration.
        const t = setTimeout(() => setVisible(true), 600)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage may be disabled (private mode); show the banner anyway.
      setVisible(true)
    }
  }, [])

  function dismiss() {
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 inset-x-0 z-40 px-4 pb-4 sm:pb-6 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl pointer-events-auto bg-white border border-[var(--border)] rounded-2xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 text-xs text-[var(--foreground)] leading-relaxed">
          We use essential cookies to keep you signed in. We don&apos;t set advertising or
          tracking cookies. Read our{' '}
          <Link href="/privacy" className="text-[var(--primary)] underline">Privacy Policy</Link>
          {' '}for details.
        </div>
        <div className="flex gap-2 shrink-0 self-stretch sm:self-auto">
          <Link
            href="/privacy"
            className="flex-1 sm:flex-none text-center px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--surface)] transition-colors"
          >
            Learn more
          </Link>
          <button
            onClick={dismiss}
            className="flex-1 sm:flex-none px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

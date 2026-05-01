'use client'

// Runtime error boundary — catches errors thrown in any nested route segment.
// Next.js renders this in place of the broken UI so the rest of the app shell
// keeps working and we don't leak stack traces to users.

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to the server console in development; replace with Sentry/Datadog
    // in production once an observability provider is wired up.
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--surface)]">
      <div className="w-full max-w-md flex flex-col gap-4 items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Something went wrong</h1>
        <p className="text-sm text-[var(--muted)]">
          We hit an unexpected error rendering this page. Try again — if it keeps happening,
          please send us feedback from Settings.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--muted)] font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={reset}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-white transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

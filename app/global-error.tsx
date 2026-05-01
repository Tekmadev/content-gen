'use client'

// Last-resort error boundary — Next.js renders this if the root layout itself
// throws. It must include its own <html> and <body> because the layout never
// rendered. Keep this minimal and dependency-free.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#f8fafc',
        }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, marginBottom: 12, color: '#0f172a' }}>
              Content Manager is having trouble
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              We hit a fatal error loading the app. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 16 }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '10px 16px',
                background: '#6366f1',
                color: 'white',
                border: 0,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

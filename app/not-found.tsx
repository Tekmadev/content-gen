import Link from 'next/link'

// 404 page — rendered for any unmatched route in the app/ tree.
// Server component (no 'use client') so it pre-renders fast.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--surface)]">
      <div className="w-full max-w-md flex flex-col gap-4 items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-[var(--primary)]">404</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Page not found</h1>
        <p className="text-sm text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-2 mt-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-white transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'signup' && !agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.')
      return
    }
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { agreed_to_terms_at: new Date().toISOString() },
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setSuccess('Check your email for a confirmation link, then come back to sign in.')
        setLoading(false)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
      // On success middleware redirects — no need to setLoading(false)
    }
  }

  async function handleGoogle() {
    if (mode === 'signup' && !agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.')
      return
    }
    setGoogleLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: mode === 'signup'
          ? { agreed_to_terms_at: new Date().toISOString() }
          : undefined,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)] px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10 w-full max-w-sm flex flex-col gap-6">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Content Manager</h1>
          <p className="text-xs text-[var(--muted)] text-center">by Tekmadev Innovation Inc.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-xl">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-white text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Error / success */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {success}
          </p>
        )}

        {/* Email/password form */}
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
              required
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          {/* T&C checkbox — shown for signup */}
          {mode === 'signup' && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[var(--primary)] flex-shrink-0"
              />
              <span className="text-xs text-[var(--muted)] leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-[var(--primary)] underline hover:opacity-80">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="text-[var(--primary)] underline hover:opacity-80">
                  Privacy Policy
                </Link>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--foreground)] bg-white hover:bg-[var(--surface)] transition-colors disabled:opacity-60"
        >
          {googleLoading ? (
            <span className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* T&C note for Google signup */}
        {mode === 'signup' && (
          <p className="text-xs text-[var(--muted)] text-center leading-relaxed -mt-2">
            By continuing with Google you agree to our{' '}
            <Link href="/terms" target="_blank" className="text-[var(--primary)] underline">Terms</Link> and{' '}
            <Link href="/privacy" target="_blank" className="text-[var(--primary)] underline">Privacy Policy</Link>.
          </p>
        )}
      </div>
    </div>
  )
}

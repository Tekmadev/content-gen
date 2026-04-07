import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — Content Manager by Tekmadev',
  description: 'Simple, transparent pricing for AI-powered social media publishing. Starter, Pro, and Agency plans billed monthly in CAD.',
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    period: 'CAD/month',
    description: 'Perfect for solo creators and small businesses getting started with social media.',
    features: [
      '60 credits per month',
      'Post generation — 1 credit',
      'Visual generation — 3 credits',
      'Carousel generation — 8 credits',
      'LinkedIn, Instagram & X publishing',
      'Content extraction from YouTube, articles, PDFs',
      'Brand style kit',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$50',
    period: 'CAD/month',
    description: 'For growing brands and marketers who publish consistently across platforms.',
    features: [
      '250 credits per month',
      'Post generation — 1 credit',
      'Visual generation — 3 credits',
      'Carousel generation — 8 credits',
      'LinkedIn, Instagram & X publishing',
      'Content extraction from YouTube, articles, PDFs',
      'Brand style kit',
      'Priority support',
    ],
    cta: 'Get Pro',
    highlight: true,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '$120',
    period: 'CAD/month',
    description: 'For agencies and power users managing high-volume content production.',
    features: [
      '1,000 credits per month',
      'Post generation — 1 credit',
      'Visual generation — 3 credits',
      'Carousel generation — 8 credits',
      'LinkedIn, Instagram & X publishing',
      'Content extraction from YouTube, articles, PDFs',
      'Brand style kit',
      'Priority support',
    ],
    cta: 'Get Agency',
    highlight: false,
  },
]

const FAQ = [
  {
    q: 'What counts as a "post generation"?',
    a: 'Each time you submit a URL or text and generate posts for all three platforms (LinkedIn, Instagram, X), that counts as one post generation.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription at any time from your billing portal. You\'ll keep access until the end of your billing period.',
  },
  {
    q: 'Are usage limits reset monthly?',
    a: 'Yes. All usage counters reset on the 1st of each calendar month.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a prorated refund within 7 days of your first subscription payment if you\'re unsatisfied. Contact info@tekmadev.com.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) through Stripe. All prices are in Canadian dollars (CAD).',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is stored securely in Canada/US via Supabase. We do not sell your data. See our Privacy Policy for details.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* Nav */}
      <nav className="border-b border-[var(--border)] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-[var(--foreground)]">
            Content Manager
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm bg-[var(--primary)] text-white px-4 py-1.5 rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col gap-20">

        {/* Hero */}
        <div className="text-center flex flex-col gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[var(--muted)] max-w-xl mx-auto">
            Turn any content into ready-to-publish social posts. No hidden fees.
            Cancel anytime.
          </p>
          <p className="text-sm text-[var(--muted)]">All prices in Canadian dollars (CAD) · Billed monthly</p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border p-6 gap-6 ${
                plan.highlight
                  ? 'border-[var(--primary)] shadow-lg bg-white'
                  : 'border-[var(--border)] bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[var(--primary)] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p className="font-bold text-lg">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-[var(--muted)]">{plan.period}</span>
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">{plan.description}</p>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                    : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--border)] border border-[var(--border)]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-center">What&apos;s included</h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-5 py-3 font-semibold text-[var(--muted)]">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.key} className={`px-5 py-3 text-center font-semibold ${p.highlight ? 'text-[var(--primary)]' : ''}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  { label: 'Credits per month',         values: ['60', '250', '1,000'] },
                  { label: 'Post generation cost',      values: ['1 cr', '1 cr', '1 cr'] },
                  { label: 'Visual generation cost',    values: ['3 cr', '3 cr', '3 cr'] },
                  { label: 'Carousel generation cost',  values: ['8 cr', '8 cr', '8 cr'] },
                  { label: 'LinkedIn publishing',       values: [true, true, true] },
                  { label: 'Instagram publishing',      values: [true, true, true] },
                  { label: 'X / Twitter publishing',    values: [true, true, true] },
                  { label: 'YouTube content extraction',values: [true, true, true] },
                  { label: 'Article / PDF extraction',  values: [true, true, true] },
                  { label: 'Brand style kit',           values: [true, true, true] },
                  { label: 'Priority support',          values: [false, true, true] },
                ].map((row) => (
                  <tr key={row.label} className="bg-white even:bg-[var(--surface)]">
                    <td className="px-5 py-3 text-[var(--foreground)]">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-3 text-center">
                        {typeof v === 'boolean' ? (
                          v
                            ? <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            : <span className="text-[var(--muted)]">—</span>
                        ) : (
                          <span className="font-semibold">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center">Frequently asked questions</h2>
          <div className="flex flex-col gap-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl border border-[var(--border)] px-5 py-4 flex flex-col gap-1.5">
                <p className="font-semibold text-[var(--foreground)]">{q}</p>
                <p className="text-sm text-[var(--muted)]">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center flex flex-col gap-4 bg-white rounded-2xl border border-[var(--border)] px-6 py-12">
          <h2 className="text-2xl font-bold">Ready to publish smarter?</h2>
          <p className="text-[var(--muted)] text-sm max-w-sm mx-auto">
            Join teams using Content Manager to turn any content into polished social posts in seconds.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-semibold text-sm hover:bg-[var(--primary-hover)] transition-colors"
            >
              Start free →
            </Link>
            <Link
              href="mailto:info@tekmadev.com"
              className="px-6 py-3 bg-[var(--surface)] text-[var(--foreground)] rounded-lg font-semibold text-sm hover:bg-[var(--border)] border border-[var(--border)] transition-colors"
            >
              Contact us
            </Link>
          </div>
          <p className="text-xs text-[var(--muted)]">No credit card required to sign up · Cancel anytime</p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <p>© {new Date().getFullYear()} Tekmadev Innovation Inc. · Ontario, Canada</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link>
            <a href="mailto:info@tekmadev.com" className="hover:text-[var(--foreground)] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

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
    description: 'Get one polished post out the door every day, on your favorite platform.',
    features: [
      '120 credits per month',
      '~30 posts/month (one per day)',
      'Choose 1 platform — LinkedIn, Instagram, or X',
      'AI brand voice from your chat-built brand brief',
      'Visuals generation included',
      'Carousel Studio (occasional use)',
      'Content extraction from YouTube, articles, PDFs',
      'Brand style kit (logo, colors, font)',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    key: 'creator',
    name: 'Creator',
    price: '$49',
    period: 'CAD/month',
    description: 'Stay consistent across all 3 platforms with daily posts and regular carousels.',
    features: [
      '350 credits per month',
      'All 3 platforms — LinkedIn, Instagram, X',
      'Carousel Studio with image-rich styles',
      'Reference image library + AIM uploads',
      'Custom carousel prompts',
      'Brand voice profile (full)',
      'Content extraction from YouTube, articles, PDFs',
      'Email support (24h response)',
    ],
    cta: 'Get Creator',
    highlight: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99',
    period: 'CAD/month',
    description: 'For business owners and power users publishing daily across every platform.',
    features: [
      '800 credits per month',
      'Everything in Creator',
      'Up to 2 brand profiles (personal + business)',
      'Priority generation queue',
      'Unlimited reference images',
      'Custom carousel templates',
      'Priority support (8h response)',
    ],
    cta: 'Get Pro',
    highlight: false,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '$279',
    period: 'CAD/month',
    description: 'For agencies managing multiple clients with team collaboration.',
    features: [
      '2,200 credits per month',
      'Everything in Pro',
      '5 brand profiles (manage multiple clients)',
      '3 team seats',
      'Dedicated success manager',
      'Phone & Slack support (4h response)',
    ],
    cta: 'Get Agency',
    highlight: false,
  },
]

const ADDONS = [
  { name: 'Boost',  credits: 50,  price: '$19',  desc: 'Power through a busy week' },
  { name: 'Pulse',  credits: 200, price: '$59',  desc: 'Cover a big launch month' },
  { name: 'Surge',  credits: 500, price: '$129', desc: 'A heavy quarter, no upgrade' },
]

const FAQ = [
  {
    q: 'What is a credit?',
    a: 'A credit is the unit we use to track usage. A post generation costs 1 credit, a single visual costs 3 credits, and a full carousel (4–10 slides) costs 8 credits. Your monthly credits refresh on the 1st of each month.',
  },
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes — upgrade or downgrade from your billing page. Upgrades take effect immediately and are prorated. Downgrades apply at the start of your next billing cycle.',
  },
  {
    q: 'What happens if I run out of credits?',
    a: 'You can buy a top-up pack — 50, 200, or 500 extra credits — without changing your plan. Top-up credits roll over for 90 days. Or upgrade to the next tier for more monthly credits at a better per-credit rate.',
  },
  {
    q: 'Why does Starter only support 1 platform?',
    a: 'We tuned Starter for solo creators who want to stay consistent on their main channel. If you publish on multiple platforms, Creator is built for you.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your billing portal. You\'ll keep access until the end of your current billing period.',
  },
  {
    q: 'Are usage limits reset monthly?',
    a: 'Yes. Subscription credits reset on the 1st of each calendar month. Top-up credits expire 90 days after purchase.',
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                  { label: 'Credits per month',          values: ['120', '350', '800', '2,200'] },
                  { label: 'Platforms',                  values: ['1 of choice', 'All 3', 'All 3', 'All 3'] },
                  { label: 'Brand profiles',             values: ['1', '1', '2', '5'] },
                  { label: 'Team seats',                 values: ['1', '1', '1', '3'] },
                  { label: 'Post generation cost',       values: ['1 cr', '1 cr', '1 cr', '1 cr'] },
                  { label: 'Visual generation cost',     values: ['3 cr', '3 cr', '3 cr', '3 cr'] },
                  { label: 'Carousel generation cost',   values: ['8 cr', '8 cr', '8 cr', '8 cr'] },
                  { label: 'Carousel Studio',            values: [true, true, true, true] },
                  { label: 'Image-rich carousel styles', values: [true, true, true, true] },
                  { label: 'Reference image library',    values: ['3', '10', 'Unlimited', 'Unlimited'] },
                  { label: 'YouTube + article + PDF extraction', values: [true, true, true, true] },
                  { label: 'Brand style kit',            values: [true, true, true, true] },
                  { label: 'Brand voice profile',        values: [true, true, true, true] },
                  { label: 'Priority generation queue',  values: [false, false, true, true] },
                  { label: 'Email support',              values: ['48h', '24h', '8h priority', '4h priority'] },
                  { label: 'Dedicated success manager',  values: [false, false, false, true] },
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

        {/* Add-on credit packs */}
        <div className="flex flex-col gap-6">
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-2xl font-bold">Need more credits this month?</h2>
            <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">
              Buy a top-up pack on top of any plan — no contract change, no commitment.
              Top-up credits roll over for 90 days.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ADDONS.map((pack) => (
              <div
                key={pack.name}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-bold text-lg">{pack.name}</p>
                  <span className="text-xl font-bold text-[var(--primary)]">{pack.price}</span>
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  +{pack.credits} credits
                </p>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{pack.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)] text-center">
            Top-up packs are billed once. Heavy use? Upgrading your plan is usually the better deal.
          </p>
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

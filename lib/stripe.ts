import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2025-03-31.basil' })
}

export const PLANS: Record<string, {
  name: string
  priceId: string
  price: number   // CAD cents
  credits: number // monthly credits
}> = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER ?? '',
    price: 1900,    // $19 CAD
    credits: 120,
  },
  creator: {
    name: 'Creator',
    priceId: process.env.STRIPE_PRICE_CREATOR ?? '',
    price: 4900,    // $49 CAD
    credits: 350,
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    price: 9900,    // $99 CAD
    credits: 800,
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_PRICE_AGENCY ?? '',
    price: 27900,   // $279 CAD
    credits: 2200,
  },
}

// Map a Stripe price ID back to our internal plan key
export function planFromPriceId(priceId: string): string | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key
  }
  return null
}

// ── Top-up credit packs (one-time purchases) ─────────────────────────
// Pack pricing is intentionally HIGHER per credit than the equivalent tier —
// add-ons are for "I just need this month", not "I want to stay here forever".
// Three Boost packs ($57) costs more than upgrading to Creator ($49 / 350 credits)
// — that's the incentive for heavy users to upgrade their subscription instead.
//
// Required env vars (set in Vercel + .env.local):
//   STRIPE_PRICE_BOOST — $19 CAD (one-time) → 50 credits
//   STRIPE_PRICE_PULSE — $59 CAD (one-time) → 200 credits
//   STRIPE_PRICE_SURGE — $129 CAD (one-time) → 500 credits

export type CreditPackKey = 'boost' | 'pulse' | 'surge'

export const CREDIT_PACKS: Record<CreditPackKey, {
  name: string
  priceId: string
  price: number       // CAD cents
  credits: number     // credits granted on purchase
  expiryDays: number  // unused credits forfeit after this many days
  description: string
}> = {
  boost: {
    name: 'Boost',
    priceId: process.env.STRIPE_PRICE_BOOST ?? '',
    price: 1900,
    credits: 50,
    expiryDays: 90,
    description: 'Quick top-up. 50 credits for $19.',
  },
  pulse: {
    name: 'Pulse',
    priceId: process.env.STRIPE_PRICE_PULSE ?? '',
    price: 5900,
    credits: 200,
    expiryDays: 90,
    description: 'Big push. 200 credits for $59.',
  },
  surge: {
    name: 'Surge',
    priceId: process.env.STRIPE_PRICE_SURGE ?? '',
    price: 12900,
    credits: 500,
    expiryDays: 90,
    description: 'Heavy month. 500 credits for $129.',
  },
}

// Map a Stripe price ID back to our internal pack key
export function packFromPriceId(priceId: string): CreditPackKey | null {
  for (const [key, pack] of Object.entries(CREDIT_PACKS)) {
    if (pack.priceId === priceId) return key as CreditPackKey
  }
  return null
}

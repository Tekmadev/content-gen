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

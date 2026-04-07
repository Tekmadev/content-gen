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
    price: 1900,
    credits: 60,
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    price: 5000,
    credits: 250,
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_PRICE_AGENCY ?? '',
    price: 12000,
    credits: 1000,
  },
}

// Map a Stripe price ID back to our internal plan key
export function planFromPriceId(priceId: string): string | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key
  }
  return null
}

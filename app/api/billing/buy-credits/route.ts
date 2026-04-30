/**
 * POST /api/billing/buy-credits
 *
 * Creates a Stripe Checkout Session (mode=payment) for a one-time credit pack
 * purchase. Returns the hosted Checkout URL.
 *
 * The actual credit grant happens in the webhook handler when Stripe fires
 * `checkout.session.completed` with mode=payment. That writes to
 * credit_addon_purchases.
 *
 * Requires: active subscription (no pay-as-you-go without a plan).
 *
 * Body: { packKey: 'boost' | 'pulse' | 'surge' }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, CREDIT_PACKS } from '@/lib/stripe'
import { getUserProfile, hasActiveSubscription } from '@/lib/user-profile'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packKey } = await request.json()
  if (!packKey || !(packKey in CREDIT_PACKS)) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })
  }

  const pack = CREDIT_PACKS[packKey as keyof typeof CREDIT_PACKS]
  if (!pack.priceId) {
    return NextResponse.json(
      { error: 'Pack price not configured. Contact support.' },
      { status: 500 }
    )
  }

  // Gate: must have an active subscription to buy add-ons
  const profile = await getUserProfile(user.id)
  if (!hasActiveSubscription(profile) && !profile?.is_admin) {
    return NextResponse.json(
      { error: 'You need an active subscription to purchase credit packs.' },
      { status: 403 }
    )
  }

  const stripe = getStripe()
  const admin = createAdminClient()

  // Get or create Stripe customer (same pattern as the subscription checkout)
  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('user_profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user.id)
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',                                    // ← one-time charge
    line_items: [{ price: pack.priceId, quantity: 1 }],
    payment_intent_data: {
      // metadata flows to the PaymentIntent for refund handling
      metadata: {
        supabase_user_id: user.id,
        pack_key: packKey,
        pack_size: String(pack.credits),
      },
    },
    success_url: `${origin}/billing?credits_purchased=1`,
    cancel_url:  `${origin}/billing?credits_canceled=1`,
    metadata: {
      supabase_user_id: user.id,
      pack_key: packKey,
      pack_size: String(pack.credits),
      pack_expiry_days: String(pack.expiryDays),
    },
  })

  console.log('[buy-credits] user=%s pack=%s session=%s', user.id, packKey, session.id)

  return NextResponse.json({ url: session.url })
}

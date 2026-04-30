import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, planFromPriceId, PLANS, CREDIT_PACKS } from '@/lib/stripe'
import type Stripe from 'stripe'

export const maxDuration = 30

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('[billing/webhook] Signature error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id
        const newPlan = planFromPriceId(priceId ?? '') ?? sub.metadata?.plan ?? null
        const userId = sub.metadata?.supabase_user_id

        if (!userId) {
          console.error('[billing/webhook] No supabase_user_id in subscription metadata', sub.id)
          break
        }

        // Get the old plan to detect upgrade/downgrade
        const { data: existing } = await admin
          .from('user_profiles')
          .select('subscription_plan, subscription_status, subscription_started_at')
          .eq('user_id', userId)
          .maybeSingle()

        const oldPlan = existing?.subscription_plan ?? null
        const isNewSub = !existing?.subscription_started_at

        // Determine event type for subscription_events log
        let subEventType: string
        if (isNewSub || oldPlan === null) {
          subEventType = sub.status === 'trialing' ? 'trial_started' : 'subscribed'
        } else if (oldPlan && newPlan && oldPlan !== newPlan) {
          const planOrder = ['starter', 'creator', 'pro', 'agency']
          subEventType = planOrder.indexOf(newPlan) > planOrder.indexOf(oldPlan)
            ? 'upgraded'
            : 'downgraded'
        } else {
          subEventType = 'subscribed' // renewal or status change
        }

        const now = new Date().toISOString()

        await Promise.all([
          // Update user profile
          admin.from('user_profiles').update({
            subscription_plan: newPlan,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
            subscription_period_end: sub.items.data[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
              : null,
            ...(isNewSub ? { subscription_started_at: now } : {}),
            updated_at: now,
          }).eq('user_id', userId),

          // Log to subscription_events (deduplication via stripe_event_id)
          admin.from('subscription_events').upsert({
            user_id: userId,
            event_type: subEventType,
            from_plan: oldPlan,
            to_plan: newPlan,
            stripe_event_id: event.id,
            amount_cad_cents: newPlan ? (PLANS[newPlan]?.price ?? null) : null,
          }, { onConflict: 'stripe_event_id', ignoreDuplicates: true }),
        ])

        console.log(`[billing/webhook] ${event.type} → user ${userId}, ${oldPlan} → ${newPlan}, status ${sub.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        if (!userId) break

        const { data: existing } = await admin
          .from('user_profiles')
          .select('subscription_plan')
          .eq('user_id', userId)
          .maybeSingle()

        await Promise.all([
          admin.from('user_profiles').update({
            subscription_plan: null,
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            subscription_period_end: null,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId),

          admin.from('subscription_events').upsert({
            user_id: userId,
            event_type: 'canceled',
            from_plan: existing?.subscription_plan ?? null,
            to_plan: null,
            stripe_event_id: event.id,
          }, { onConflict: 'stripe_event_id', ignoreDuplicates: true }),
        ])

        console.log(`[billing/webhook] Subscription canceled → user ${userId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: profile } = await admin
          .from('user_profiles')
          .select('user_id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile) {
          await Promise.all([
            admin.from('user_profiles').update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            }).eq('user_id', profile.user_id),

            admin.from('subscription_events').upsert({
              user_id: profile.user_id,
              event_type: 'payment_failed',
              from_plan: profile.subscription_plan,
              to_plan: profile.subscription_plan,
              stripe_event_id: event.id,
            }, { onConflict: 'stripe_event_id', ignoreDuplicates: true }),
          ])
          console.log(`[billing/webhook] Payment failed → user ${profile.user_id}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Only handle renewals (not the first payment — that's covered by subscription.created)
        if (invoice.billing_reason === 'subscription_cycle') {
          const customerId = invoice.customer as string
          const { data: profile } = await admin
            .from('user_profiles')
            .select('user_id, subscription_plan, subscription_status')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()

          if (profile && profile.subscription_status === 'past_due') {
            await Promise.all([
              admin.from('user_profiles').update({
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              }).eq('user_id', profile.user_id),

              admin.from('subscription_events').upsert({
                user_id: profile.user_id,
                event_type: 'payment_recovered',
                from_plan: profile.subscription_plan,
                to_plan: profile.subscription_plan,
                stripe_event_id: event.id,
                amount_cad_cents: invoice.amount_paid,
              }, { onConflict: 'stripe_event_id', ignoreDuplicates: true }),
            ])
            console.log(`[billing/webhook] Payment recovered → user ${profile.user_id}`)
          }
        }
        break
      }

      // ── One-time credit pack purchases (Phase 2A) ──────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Only handle one-time payments — subscription checkouts are covered
        // by customer.subscription.created/updated above.
        if (session.mode !== 'payment') break

        const userId = session.metadata?.supabase_user_id
        const packKey = session.metadata?.pack_key as 'boost' | 'pulse' | 'surge' | undefined

        if (!userId || !packKey || !(packKey in CREDIT_PACKS)) {
          console.error('[webhook] Bad credit pack session metadata:', session.id, session.metadata)
          break
        }

        const pack = CREDIT_PACKS[packKey]
        const expiresAt = new Date(Date.now() + pack.expiryDays * 24 * 60 * 60 * 1000).toISOString()

        // Idempotent insert: stripe_session_id is UNIQUE, so a webhook retry
        // does NOT credit the user twice. Use INSERT … ON CONFLICT DO NOTHING.
        const { error: insertErr } = await admin
          .from('credit_addon_purchases')
          .insert({
            user_id:           userId,
            pack_key:          packKey,
            pack_size:         pack.credits,
            credits_remaining: pack.credits,
            amount_cad_cents:  session.amount_total ?? pack.price,
            stripe_session_id: session.id,
            stripe_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            expires_at:        expiresAt,
          })

        // unique_violation on stripe_session_id means this webhook already fired —
        // silently ignore (idempotent retry).
        if (insertErr && insertErr.code !== '23505') {
          console.error('[webhook] addon insert failed:', insertErr.message)
          return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 })
        }

        // The credit_addon_purchases row IS the audit trail (timestamps, amount,
        // pack details all there). No separate credit_transactions entry needed.
        console.log('[webhook] credit pack granted: user=%s pack=%s credits=%d expires=%s',
          userId, packKey, pack.credits, expiresAt)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[billing/webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

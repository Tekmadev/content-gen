import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'

// GDPR / PIPEDA — right to erasure. Hard-deletes the user's auth row and any
// dependent rows. Most data is removed by ON DELETE CASCADE on user_id FKs;
// we explicitly clean storage and Stripe customer here.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Require an explicit confirmation phrase in the request body so a stray
  // CSRF/click can't trigger deletion.
  let confirmation = ''
  try {
    const body = await request.json()
    confirmation = typeof body?.confirmation === 'string' ? body.confirmation : ''
  } catch {
    // empty body — fall through to the guard below
  }
  if (confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json(
      { error: 'Type "DELETE MY ACCOUNT" to confirm.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // ── Cancel Stripe subscription if any (best-effort) ─────────────────
  try {
    const { data: profile } = await admin
      .from('user_profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.stripe_subscription_id) {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(profile.stripe_subscription_id).catch(() => {})
    }
    // We deliberately don't delete the Stripe customer — Stripe's docs
    // recommend keeping the customer for tax/audit history.
  } catch (err) {
    console.error('[account/delete] Stripe cleanup failed:', err)
  }

  // ── Purge user-owned storage objects ────────────────────────────────
  try {
    const buckets = ['Content']
    for (const bucket of buckets) {
      const { data: list } = await admin.storage.from(bucket).list(user.id, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (list && list.length > 0) {
        const paths = list.map((f) => `${user.id}/${f.name}`)
        await admin.storage.from(bucket).remove(paths).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[account/delete] Storage cleanup failed:', err)
  }

  // ── Delete the auth user — cascades to user_profiles, posts_log,
  // brand_settings, brand_briefs, carousel_jobs, feedback if FKs are set
  // up correctly. Any orphans are caught by the explicit deletes below.
  try {
    await admin.from('feedback').delete().eq('user_id', user.id)
    await admin.from('carousel_jobs').delete().eq('user_id', user.id)
    await admin.from('brand_briefs').delete().eq('user_id', user.id)
    await admin.from('brand_settings').delete().eq('user_id', user.id)
    await admin.from('posts_log').delete().eq('user_id', user.id)
    await admin.from('credit_transactions').delete().eq('user_id', user.id)
    await admin.from('credit_addon_purchases').delete().eq('user_id', user.id)
    await admin.from('user_profiles').delete().eq('user_id', user.id)
  } catch (err) {
    console.error('[account/delete] Row cleanup failed:', err)
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) {
    console.error('[account/delete] auth.deleteUser failed:', authErr.message)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

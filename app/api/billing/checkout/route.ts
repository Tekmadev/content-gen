import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, PLANS } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planKey } = await request.json();
  if (!planKey || !PLANS[planKey]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = PLANS[planKey];
  if (!plan.priceId) {
    return NextResponse.json(
      { error: "Plan price not configured" },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const admin = createAdminClient();

  // Get or create Stripe customer
  const { data: profile } = await admin
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await admin
      .from("user_profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
  }

  const origin =
    request.headers.get("origin") ?? "https://content.tekmadev.com";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing?canceled=1`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan: planKey },
    },
    metadata: { supabase_user_id: user.id, plan: planKey },
  });

  return NextResponse.json({ url: session.url });
}

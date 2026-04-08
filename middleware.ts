import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require auth
const PUBLIC_ROUTES = ['/login', '/pricing', '/terms', '/privacy', '/auth']

// Routes that authenticated users can access even without a subscription
const AUTH_ONLY_ROUTES = ['/onboarding', '/billing', '/auth']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicRoute   = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  const isApiRoute      = pathname.startsWith('/api/')

  // 1. Not logged in → redirect to /login (except public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Logged in + on /login → redirect to /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 3. For logged-in users on protected routes, check onboarding + subscription
  //    Skip check for API routes (they do their own auth), auth-only routes, and public routes
  if (user && !isPublicRoute && !isAuthOnlyRoute && !isApiRoute) {
    try {
      // Lightweight DB check using the anon client (RLS will limit to own rows)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, subscription_status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        // Onboarding not done → redirect to /onboarding
        if (!profile.onboarding_completed) {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          return NextResponse.redirect(url)
        }

        // No active subscription → redirect to /billing
        const hasActive =
          profile.subscription_status === 'active' ||
          profile.subscription_status === 'trialing'

        if (!hasActive) {
          const url = request.nextUrl.clone()
          url.pathname = '/billing'
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // If DB check fails, let the request through — API routes handle their own auth
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

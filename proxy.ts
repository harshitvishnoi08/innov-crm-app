import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users to /login
  if (!user && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users away from /login and /forgot-password
  if (user && (pathname === '/login' || pathname === '/forgot-password')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Includes /api/:path* so client-side fetches also get a refreshed session
  // cookie — without this, the token can expire between page loads (this proxy
  // never runs on client-side SPA navigation) and API calls fail with a stale
  // 401 that the UI was misreporting as "Lead not found".
  matcher: ['/admin', '/admin/:path*', '/login', '/forgot-password', '/api/:path*'],
};

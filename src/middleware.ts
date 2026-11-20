import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !key) {
    if (path === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => {
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  }) as unknown as SupabaseClient<Database>;

  const { data: { user } } = await supabase.auth.getUser();
  if (path === '/login') {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url));
    return response;
  }
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const { data: profile } = await supabase.from('profiles').select('id, role, active').eq('id', user.id).maybeSingle();
  if (!profile?.active || profile.role !== 'superadmin') {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  }
  return response;
}

export const config = { matcher: ['/((?!api|_next|.*\..*).*)'] };

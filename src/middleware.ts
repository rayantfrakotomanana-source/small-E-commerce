import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/(fr|mg)(?=\/|$)/, '') || '/';
  const guarded = path.startsWith('/admin') || path.startsWith('/livreur') || path.startsWith('/superadmin');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return guarded
      ? NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
      : intlMiddleware(request);
  }

  const refreshResponse = NextResponse.next({ request });
  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          refreshResponse.cookies.set(name, value, options);
        }
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const response = intlMiddleware(request);
  for (const cookie of refreshResponse.cookies.getAll()) response.cookies.set(cookie);
  const redirectWithRefreshedCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of refreshResponse.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  };
  if (!guarded) return response;

  const locale = request.nextUrl.pathname.match(/^\/(fr|mg)(?:\/|$)/)?.[1] ?? 'fr';
  if (!user) return redirectWithRefreshedCookies(new URL(`/${locale}/connexion`, request.url));
  const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', user.id).maybeSingle();
  if (!profile?.active) return redirectWithRefreshedCookies(new URL(`/${locale}/attente`, request.url));

  const allowed = path.startsWith('/superadmin')
    ? profile.role === 'superadmin'
    : path.startsWith('/admin')
      ? profile.role === 'admin' || profile.role === 'superadmin'
      : profile.role === 'livreur';
  return allowed ? response : redirectWithRefreshedCookies(new URL(`/${locale}/non-autorise`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
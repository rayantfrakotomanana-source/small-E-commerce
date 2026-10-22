import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const staff = await getActiveStaff();
  if (!staff || !['admin', 'superadmin'].includes(staff.profile.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({
    status: z.enum(['livree', 'annulee']).default('livree'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().max(80).default(''),
  }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid filters' }, { status: 400 });
  const supabase = await createClient();
  let query = supabase.from('orders').select('*', { count: 'exact' }).eq('status', parsed.data.status).eq('is_spam', false).order('created_at', { ascending: false });
  const search = parsed.data.search.replace(/[^\p{L}\p{N} '\-]/gu, '').trim();
  if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data, count, error } = await query.range((parsed.data.page - 1) * 20, parsed.data.page * 20 - 1);
  if (error) return NextResponse.json({ error: 'Could not load journal' }, { status: 500 });
  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page: parsed.data.page }, { headers: { 'Cache-Control': 'no-store' } });
}
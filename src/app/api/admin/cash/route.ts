import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

async function isAdmin() {
  const staff = await getActiveStaff();
  return staff && (staff.profile.role === 'admin' || staff.profile.role === 'superadmin');
}

export async function GET(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ day: z.iso.date() }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
  const dayStart = new Date(`${parsed.data.day}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const supabase = await createClient();
  const [{ data: couriers }, { data: orders, error }, { data: closings }, { data: unpaidCash, error: unpaidError }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'livreur').eq('active', true).order('full_name'),
    supabase.from('orders').select('id, order_number, livreur_id, customer_name, total, cash_collected_ar').eq('status', 'livree').eq('payment_mode', 'cash').eq('cash_handed_over', false).gte('delivered_at', dayStart.toISOString()).lt('delivered_at', dayEnd.toISOString()),
    supabase.from('cash_closings').select('*').eq('day', parsed.data.day),
    supabase.from('orders').select('id, order_number, customer_name, phone, total, status, created_at').eq('payment_mode', 'cash').eq('payment_status', 'non_paye').eq('is_province', false).in('status', ['a_confirmer', 'en_cours']).eq('is_spam', false).order('created_at', { ascending: false }).limit(100),
  ]);
  if (error || unpaidError) return NextResponse.json({ error: 'Could not load expected cash' }, { status: 500 });
  const rows = (couriers ?? []).map((courier) => {
    const courierOrders = (orders ?? []).filter((order) => order.livreur_id === courier.id);
    const expected = courierOrders.reduce((sum, order) => sum + (order.cash_collected_ar ?? order.total), 0);
    const closing = closings?.find((entry) => entry.livreur_id === courier.id);
    return { ...courier, orders: courierOrders, expected, closing: closing ?? null };
  });
  return NextResponse.json({ rows, unpaidCash: unpaidCash ?? [], unpaidCashTotal: (unpaidCash ?? []).reduce((sum, order) => sum + order.total, 0), totalExpected: rows.reduce((sum, row) => sum + row.expected, 0) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({
    day: z.iso.date(), livreur_id: z.uuid(), received: z.number().int().nonnegative(), note: z.string().trim().max(500).optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid cash closing' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('close_livreur_cash', {
    closing_day: parsed.data.day, target_livreur_id: parsed.data.livreur_id,
    received: parsed.data.received, closing_note: parsed.data.note ?? null,
  });
  if (error) return NextResponse.json({ error: 'Cash closing was rejected' }, { status: 409 });
  return NextResponse.json({ id: data });
}
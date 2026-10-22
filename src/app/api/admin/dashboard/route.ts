import { NextResponse } from 'next/server';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const staff = await getActiveStaff();
  if (!staff || !['admin', 'superadmin'].includes(staff.profile.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date());
  const start = new Date(`${today}T00:00:00+03:00`);
  const weekStart = new Date(start);
  weekStart.setUTCDate(start.getUTCDate() - 6);
  const [{ data: todayOrders, error }, { count: currentOrdersCount }, { data: unpaidOrders }, { data: cashOrders }, { data: weekOrders }] = await Promise.all([
    supabase.from('orders').select('id, total, status').eq('status', 'livree').gte('delivered_at', start.toISOString()),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'en_cours'),
    supabase.from('orders').select('total').eq('payment_status', 'non_paye').not('status', 'in', '(annulee,livree)'),
    supabase.from('orders').select('cash_collected_ar, total').eq('status', 'livree').eq('payment_mode', 'cash').eq('cash_handed_over', false),
    supabase.from('orders').select('id, total, delivered_at').eq('status', 'livree').gte('delivered_at', weekStart.toISOString()),
  ]);
  if (error) return NextResponse.json({ error: 'Could not load dashboard' }, { status: 500 });
  const deliveredIds = (weekOrders ?? []).map((order) => order.id);
  const { data: weekItems } = deliveredIds.length
    ? await supabase.from('order_items').select('product_id, name_snapshot, qty').in('order_id', deliveredIds)
    : { data: [] };
  const products = new Map<string, { name: string; quantity: number }>();
  for (const item of weekItems ?? []) {
    const aggregate = products.get(item.product_id) ?? { name: item.name_snapshot, quantity: 0 };
    aggregate.quantity += item.qty;
    products.set(item.product_id, aggregate);
  }
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + index);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(date);
    const total = (weekOrders ?? []).filter((order) => order.delivered_at && new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date(order.delivered_at)) === key).reduce((sum, order) => sum + order.total, 0);
    return { day: key, total };
  });
  return NextResponse.json({
    todaySales: (todayOrders ?? []).reduce((sum, order) => sum + order.total, 0),
    currentOrders: currentOrdersCount ?? 0,
    unpaidTotal: (unpaidOrders ?? []).reduce((sum, order) => sum + order.total, 0),
    cashExpected: (cashOrders ?? []).reduce((sum, order) => sum + (order.cash_collected_ar ?? order.total), 0),
    topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    salesByDay,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
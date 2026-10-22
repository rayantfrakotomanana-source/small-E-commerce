import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getActiveStaff();
  if (!staff || !['admin', 'superadmin'].includes(staff.profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  const supabase = await createClient();
  const [{ data: order, error }, { data: items }, { data: events }, { data: couriers }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'livreur').eq('active', true).order('full_name'),
  ]);
  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order, items: items ?? [], events: events ?? [], couriers: couriers ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
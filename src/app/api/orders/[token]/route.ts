import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const tokenSchema = z.uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const admin = createAdminClient();
  const { data: order, error } = await admin.from('orders')
    .select('id, order_number, status, payment_status, created_at, delivered_at')
    .eq('public_token', token).eq('is_spam', false).maybeSingle();
  if (error || !order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: items, error: itemsError } = await admin.from('order_items')
    .select('name_snapshot, unit_price, qty, image_snapshot').eq('order_id', order.id);
  if (itemsError) return NextResponse.json({ error: 'Could not load tracking information' }, { status: 500 });
  const { id: _id, ...publicOrder } = order;
  return NextResponse.json({ ...publicOrder, items }, { headers: { 'Cache-Control': 'no-store' } });
}
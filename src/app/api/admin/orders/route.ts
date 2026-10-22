import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { madagascarPhoneSchema } from '@/lib/validation/phone';

const manualOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  phone: madagascarPhoneSchema,
  phone2: madagascarPhoneSchema.optional(),
  address: z.string().trim().min(2).max(300),
  landmark: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  source: z.enum(['facebook', 'whatsapp', 'appel']),
  is_province: z.boolean(),
  city: z.string().trim().max(120).optional(),
  payment_mode: z.enum(['cash', 'mvola', 'orange']),
  payment_status: z.enum(['non_paye', 'paye']),
  payer_name: z.string().trim().max(120).optional(),
  payer_phone: madagascarPhoneSchema.optional(),
  payment_ref: z.string().trim().max(120).optional(),
  livreur_id: z.uuid().nullable().optional(),
  items: z.array(z.object({ product_id: z.uuid(), qty: z.number().int().min(1).max(100) })).min(1).max(50),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mark_paid'), id: z.uuid(), ref: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal('confirm'), id: z.uuid() }),
  z.object({ action: z.literal('cancel'), id: z.uuid(), reason: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal('spam'), id: z.uuid() }),
  z.object({ action: z.literal('assign'), id: z.uuid(), livreur_id: z.uuid() }),
  z.object({ action: z.literal('transport'), id: z.uuid(), info: z.string().trim().min(2).max(1000), url: z.union([z.literal(''), z.string().url().startsWith('https://')]).optional() }),
  z.object({ action: z.literal('delivered'), id: z.uuid(), note: z.string().trim().max(500).optional() }),
]);

async function authorized() {
  const staff = await getActiveStaff();
  return staff && (staff.profile.role === 'admin' || staff.profile.role === 'superadmin') ? staff : null;
}

export async function GET(request: NextRequest) {
  const staff = await authorized();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = z.object({
    status: z.enum(['a_confirmer', 'en_cours', 'livree', 'annulee']).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().max(80).default(''),
  }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return NextResponse.json({ error: 'Invalid filters' }, { status: 400 });
  const supabase = await createClient();
  let ordersQuery = supabase.from('orders').select('*', { count: 'exact' }).eq('is_spam', false)
    .order('created_at', { ascending: false });
  if (query.data.status) ordersQuery = ordersQuery.eq('status', query.data.status);
  const search = query.data.search.replace(/[^\p{L}\p{N} '\-]/gu, '').trim();
  if (search) ordersQuery = ordersQuery.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
  const { data, count, error } = await ordersQuery.range((query.data.page - 1) * 20, query.data.page * 20 - 1);
  if (error) return NextResponse.json({ error: 'Could not load orders' }, { status: 500 });
  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page: query.data.page }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order details' }, { status: 400 });
  if (parsed.data.is_province && parsed.data.payment_mode === 'cash') {
    return NextResponse.json({ error: 'Province orders cannot use cash' }, { status: 400 });
  }
  if (parsed.data.payment_mode !== 'cash' && !parsed.data.payer_name?.trim()) {
    return NextResponse.json({ error: 'Payer name is required for mobile money' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_manual_order', {
    payload: parsed.data as unknown as import('@/lib/database.types').Json,
  });
  if (error) return NextResponse.json({ error: 'Order could not be created' }, { status: 400 });
  return NextResponse.json({ id: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order action' }, { status: 400 });
  const supabase = await createClient();
  const { action, id } = parsed.data;
  let error: { message: string } | null = null;
  if (action === 'mark_paid') ({ error } = await supabase.rpc('mark_paid', { target_order_id: id, ref: parsed.data.ref ?? null }));
  if (action === 'confirm') ({ error } = await supabase.rpc('confirm_order', { target_order_id: id }));
  if (action === 'cancel') ({ error } = await supabase.rpc('cancel_order', { target_order_id: id, reason: parsed.data.reason }));
  if (action === 'spam') ({ error } = await supabase.rpc('reject_spam', { target_order_id: id }));
  if (action === 'assign') ({ error } = await supabase.rpc('assign_livreur', { target_order_id: id, target_livreur_id: parsed.data.livreur_id }));
  if (action === 'transport') ({ error } = await supabase.rpc('set_order_transport', { target_order_id: id, info: parsed.data.info, location_url: parsed.data.url || null }));
  if (action === 'delivered') ({ error } = await supabase.rpc('admin_mark_delivered', { target_order_id: id, note: parsed.data.note ?? null }));
  if (error) return NextResponse.json({ error: 'Order action was rejected' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
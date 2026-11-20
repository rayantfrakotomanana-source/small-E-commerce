import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

async function owner() {
  const staff = await getActiveStaff();
  return staff?.profile.role === 'superadmin' ? staff : null;
}

export async function GET() {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: sales, error }, { data: products }, { data: customers }] = await Promise.all([
    admin.from('bms_sales').select('*').order('sold_at', { ascending: false }).limit(100),
    admin.from('bms_products').select('id, name, purchase_price, selling_price, stock_quantity').is('archived_at', null).order('name'),
    admin.from('bms_customers').select('id, name, phone').order('name'),
  ]);
  if (error) return NextResponse.json({ error: 'Could not load sales' }, { status: 500 });
  return NextResponse.json({ sales: sales ?? [], products: products ?? [], customers: customers ?? [] });
}

export async function POST(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({
    customer_id: z.uuid().nullable().optional(),
    discount: z.number().int().nonnegative().default(0),
    note: z.string().trim().max(1000).optional(),
    sold_at: z.iso.datetime().optional(),
    items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().positive() })).min(1).max(100),
    payments: z.array(z.object({ amount: z.number().int().nonnegative(), method: z.enum(['cash','mobile_money','bank_transfer','other']), reference: z.string().trim().max(160).optional(), paid_at: z.iso.datetime().optional() })).max(20),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sale' }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('bms_create_sale', {
    p_customer_id: parsed.data.customer_id ?? null,
    p_discount: parsed.data.discount,
    p_items: parsed.data.items,
    p_payments: parsed.data.payments,
    p_note: parsed.data.note,
    p_sold_at: parsed.data.sold_at ?? new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ id: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('cancel'), id: z.uuid(), reason: z.string().trim().min(2).max(500) }),
    z.object({ action: z.literal('return'), id: z.uuid(), reason: z.string().trim().min(2).max(500) }),
    z.object({ action: z.literal('payment'), id: z.uuid(), amount: z.number().int().positive(), method: z.enum(['cash','mobile_money','bank_transfer','other']), reference: z.string().trim().max(160).optional() }),
  ]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sale action' }, { status: 400 });
  const admin = createAdminClient();
  let error: { message: string } | null = null;
  if (parsed.data.action === 'cancel') ({ error } = await admin.rpc('bms_cancel_sale', { p_sale_id: parsed.data.id, p_reason: parsed.data.reason }));
  if (parsed.data.action === 'return') ({ error } = await admin.rpc('bms_return_sale', { p_sale_id: parsed.data.id, p_reason: parsed.data.reason }));
  if (parsed.data.action === 'payment') ({ error } = await admin.rpc('bms_record_payment', { p_sale_id: parsed.data.id, p_amount: parsed.data.amount, p_method: parsed.data.method, p_reference: parsed.data.reference }));
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}

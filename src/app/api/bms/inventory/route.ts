import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(5000).default(''),
  purchase_price: z.number().int().nonnegative(),
  selling_price: z.number().int().nonnegative(),
  stock_quantity: z.number().int().nonnegative(),
  minimum_stock: z.number().int().nonnegative(),
  category_id: z.uuid().nullable().optional(),
});

async function owner() {
  const staff = await getActiveStaff();
  return staff?.profile.role === 'superadmin' ? staff : null;
}

export async function GET() {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: products, error }, { data: categories }] = await Promise.all([
    admin.from('bms_products').select('*').is('archived_at', null).order('name'),
    admin.from('bms_categories').select('*').is('archived_at', null).order('sort_order'),
  ]);
  if (error) return NextResponse.json({ error: 'Could not load inventory' }, { status: 500 });
  return NextResponse.json({ products: products ?? [], categories: categories ?? [] });
}

export async function POST(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
  const admin = createAdminClient();
  const { id, ...values } = parsed.data;
  const payload = { ...values, sku: values.sku || null };
  const { data, error } = id
    ? await admin.from('bms_products').update(payload).eq('id', id).select('id').single()
    : await admin.from('bms_products').insert(payload).select('id').single();
  if (error) return NextResponse.json({ error: 'Could not save product' }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: id ? 200 : 201 });
}

export async function PATCH(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({
    action: z.enum(['adjust','purchase','archive','restore','category']),
    id: z.uuid().nullable().optional(),
    quantity_change: z.number().int().optional(),
    quantity: z.number().int().positive().optional(),
    unit_cost: z.number().int().nonnegative().optional(),
    note: z.string().trim().max(500).optional(),
    name: z.string().trim().max(120).optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const admin = createAdminClient();
  if (parsed.data.action === 'adjust') {
    if (!parsed.data.id || parsed.data.quantity_change === undefined || !parsed.data.note) {
      return NextResponse.json({ error: 'Product, adjustment quantity and note are required' }, { status: 400 });
    }
    const { error } = await admin.rpc('bms_adjust_stock', {
      p_product_id: parsed.data.id,
      p_quantity_change: parsed.data.quantity_change,
      p_note: parsed.data.note,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === 'archive') {
    if (!parsed.data.id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    const { error } = await admin.from('bms_products').update({ archived_at: new Date().toISOString() }).eq('id', parsed.data.id);
    if (error) return NextResponse.json({ error: 'Could not archive product' }, { status: 500 });
  } else if (parsed.data.action === 'restore') {
    if (!parsed.data.id) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    const { error } = await admin.from('bms_products').update({ archived_at: null }).eq('id', parsed.data.id);
    if (error) return NextResponse.json({ error: 'Could not restore product' }, { status: 500 });
  } else if (parsed.data.action === 'purchase') {
    if (!parsed.data.id || !parsed.data.quantity || parsed.data.unit_cost === undefined) {
      return NextResponse.json({ error: 'Product, quantity and unit cost are required' }, { status: 400 });
    }
    const { error } = await admin.rpc('bms_record_purchase', {
      p_product_id: parsed.data.id,
      p_quantity: parsed.data.quantity,
      p_unit_cost: parsed.data.unit_cost,
      p_note: parsed.data.note ?? 'Purchase recorded',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  } else if (parsed.data.action === 'category') {
    if (!parsed.data.name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    const { error } = await admin.rpc('bms_upsert_category', { p_id: parsed.data.id ?? null, p_name: parsed.data.name });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { getActiveStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const staff = await getActiveStaff();
  if (!staff || !['admin', 'superadmin'].includes(staff.profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = await createClient();
  const [{ data: products, error: productError }, { data: couriers }, { data: fee }] = await Promise.all([
    supabase.from('products').select('id, name_fr, price_ar, stock, reserved, is_sold_out').eq('is_active', true).is('deleted_at', null).order('name_fr').limit(200),
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'livreur').eq('active', true).order('full_name'),
    supabase.from('settings').select('value').eq('key', 'delivery_fee_ar').maybeSingle(),
  ]);
  if (productError) return NextResponse.json({ error: 'Could not load order options' }, { status: 500 });
  return NextResponse.json({
    products: (products ?? []).map((product) => ({ ...product, available: Math.max(0, product.stock - product.reserved) })),
    couriers: couriers ?? [],
    deliveryFee: Number(fee?.value ?? 5000),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
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
  const [{ data: customers, error }, { data: sales }] = await Promise.all([
    admin.from('bms_customers').select('*').order('name'),
    admin.from('bms_sales').select('customer_id, total, payment_status, status'),
  ]);
  if (error) return NextResponse.json({ error: 'Could not load customers' }, { status: 500 });
  const rows = (customers ?? []).map((customer) => {
    const customerSales = (sales ?? []).filter((sale) => sale.customer_id === customer.id && sale.status === 'completed');
    return { ...customer, purchases: customerSales.reduce((sum, sale) => sum + sale.total, 0), outstanding: customerSales.filter((sale) => sale.payment_status !== 'paid').reduce((sum, sale) => sum + sale.total, 0) };
  });
  return NextResponse.json({ customers: rows });
}

export async function POST(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ id: z.uuid().optional(), name: z.string().trim().min(2).max(160), phone: z.string().trim().max(40).optional(), address: z.string().trim().max(500).optional(), notes: z.string().trim().max(1000).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid customer' }, { status: 400 });
  const admin = createAdminClient();
  const { id, ...values } = parsed.data;
  const { data, error } = id
    ? await admin.from('bms_customers').update(values).eq('id', id).select('id').single()
    : await admin.from('bms_customers').insert(values).select('id').single();
  if (error) return NextResponse.json({ error: 'Could not save customer' }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: id ? 200 : 201 });
}

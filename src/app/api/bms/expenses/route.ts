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
  const [{ data: expenses, error }, { data: categories }] = await Promise.all([
    admin.from('bms_expenses').select('*').order('expense_date', { ascending: false }).limit(200),
    admin.from('bms_expense_categories').select('*').is('archived_at', null).order('name'),
  ]);
  if (error) return NextResponse.json({ error: 'Could not load expenses' }, { status: 500 });
  return NextResponse.json({ expenses: expenses ?? [], categories: categories ?? [] });
}

export async function POST(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({
    category_id: z.uuid().nullable(),
    description: z.string().trim().min(2).max(500),
    amount: z.number().int().nonnegative(),
    method: z.enum(['cash','mobile_money','bank_transfer','other']),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid expense' }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('bms_record_expense', {
    p_category_id: parsed.data.category_id,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_expense_date: parsed.data.expense_date,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ id: data }, { status: 201 });
}

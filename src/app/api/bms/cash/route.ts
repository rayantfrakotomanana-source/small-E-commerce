import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

async function owner() {
  const staff = await getActiveStaff();
  return staff?.profile.role === 'superadmin' ? staff : null;
}

export async function GET(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const day = z.iso.date().safeParse(request.nextUrl.searchParams.get('day'));
  if (!day.success) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: movements }, { data: snapshot }, { data: opening }] = await Promise.all([
    admin.from('bms_cash_transactions').select('*').eq('transaction_date', day.data).order('created_at'),
    admin.from('bms_cash_snapshots').select('*').eq('snapshot_date', day.data).maybeSingle(),
    admin.from('bms_settings').select('value').eq('key', 'cash_opening_balance').maybeSingle(),
  ]);
  const openingBalance = Number(opening?.value ?? 0);
  const net = (movements ?? []).reduce((sum, movement) => sum + movement.amount, 0);
  const expected = openingBalance + net;
  return NextResponse.json({ movements: movements ?? [], openingBalance, expected, snapshot: snapshot ?? null });
}

export async function POST(request: NextRequest) {
  if (!await owner()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ snapshot_date: z.iso.date(), opening_balance: z.number().int().nonnegative(), physically_counted: z.number().int().nonnegative(), note: z.string().trim().max(500).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid cash closing' }, { status: 400 });
  const admin = createAdminClient();
  const { data: movements } = await admin.from('bms_cash_transactions').select('amount').eq('transaction_date', parsed.data.snapshot_date);
  const net = (movements ?? []).reduce((sum, movement) => sum + movement.amount, 0);
  const expected = parsed.data.opening_balance + net;
  const discrepancy = parsed.data.physically_counted - expected;
  const { data, error } = await admin.from('bms_cash_snapshots').upsert({
    snapshot_date: parsed.data.snapshot_date,
    opening_balance: parsed.data.opening_balance,
    expected_closing: expected,
    physically_counted: parsed.data.physically_counted,
    discrepancy,
    note: parsed.data.note,
  }, { onConflict: 'snapshot_date' }).select('id').single();
  if (error) return NextResponse.json({ error: 'Could not save cash closing' }, { status: 500 });
  return NextResponse.json({ id: data.id, expected, discrepancy });
}

import { NextResponse } from 'next/server';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const staff = await getActiveStaff();
  if (staff?.profile.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: sales }, { data: payments }, { data: expenseRows }, { data: items }, { data: opening }] = await Promise.all([
    admin.from('bms_sales').select('id, total, status, payment_status, sold_at'),
    admin.from('bms_payments').select('amount, method'),
    admin.from('bms_expenses').select('amount, expense_date'),
    admin.from('bms_sale_items').select('purchase_price, unit_price, quantity'),
    admin.from('bms_settings').select('value').eq('key', 'cash_opening_balance').maybeSingle(),
  ]);
  const completed = (sales ?? []).filter((sale) => sale.status === 'completed');
  const revenue = completed.reduce((sum, sale) => sum + sale.total, 0);
  const expenses = (expenseRows ?? []).reduce((sum, expense) => sum + expense.amount, 0);
  const grossCost = (items ?? []).reduce((sum, item) => sum + item.purchase_price * item.quantity, 0);
  const cashOpening = Number(opening?.value ?? 0);
  const cashReceived = (payments ?? []).filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + payment.amount, 0);
  const mobileMoneyReceived = (payments ?? []).filter((payment) => payment.method === 'mobile_money').reduce((sum, payment) => sum + payment.amount, 0);
  const bankReceived = (payments ?? []).filter((payment) => payment.method === 'bank_transfer').reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = completed.filter((sale) => sale.payment_status !== 'paid').reduce((sum, sale) => sum + sale.total, 0);
  const grossProfit = revenue - grossCost;
  const netProfit = grossProfit - expenses;
  const cashBalance = cashOpening + cashReceived - expenses;
  return NextResponse.json({ revenue, expenses, grossProfit, netProfit, cashReceived, mobileMoneyReceived, bankReceived, outstanding, cashBalance, grossCost });
}

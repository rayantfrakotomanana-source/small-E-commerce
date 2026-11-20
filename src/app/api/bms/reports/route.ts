import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const staff = await getActiveStaff();
  if (staff?.profile.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const filters = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), format: z.enum(['json','csv']).default('json') }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!filters.success) return NextResponse.json({ error: 'Invalid report filters' }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: sales }, { data: expenses }, { data: stock }] = await Promise.all([
    admin.from('bms_sales').select('sale_number, sold_at, subtotal, discount, total, payment_status, status').gte('sold_at', `${filters.data.from}T00:00:00+03:00`).lte('sold_at', `${filters.data.to}T23:59:59+03:00`).order('sold_at'),
    admin.from('bms_expenses').select('description, amount, method, expense_date').gte('expense_date', filters.data.from).lte('expense_date', filters.data.to).order('expense_date'),
    admin.from('bms_products').select('name, sku, purchase_price, selling_price, stock_quantity, minimum_stock').is('archived_at', null).order('name'),
  ]);
  const report = { sales: sales ?? [], expenses: expenses ?? [], inventory: stock ?? [] };
  if (filters.data.format === 'csv') {
    const rows = [
      ['Type','Name/Number','Date','Quantity/Status','Amount MGA'],
      ...(report.sales ?? []).map((sale) => ['Sale', sale.sale_number, sale.sold_at, sale.status, String(sale.total)]),
      ...(report.expenses ?? []).map((expense) => ['Expense', expense.description, expense.expense_date, expense.method, String(expense.amount)]),
      ...(report.inventory ?? []).map((product) => ['Inventory', product.name, product.sku ?? '', String(product.stock_quantity), String(product.stock_quantity * product.purchase_price)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="jr-concept-report.csv"' } });
  }
  return NextResponse.json(report);
}

import { createHmac } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { madagascarPhoneSchema } from '@/lib/validation/phone';

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  phone: madagascarPhoneSchema,
  phone2: madagascarPhoneSchema.optional(),
  address: z.string().trim().min(2).max(300),
  landmark: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  is_province: z.boolean().default(false),
  city: z.string().trim().max(120).optional(),
  payment_mode: z.enum(['cash', 'mvola', 'orange']),
  payer_name: z.string().trim().max(120).optional(),
  payer_phone: madagascarPhoneSchema.optional(),
  items: z.array(z.object({ product_id: z.uuid(), qty: z.number().int().positive().max(100) })).min(1).max(50),
});

function getTrustedClientIp(request: NextRequest) {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER ?? 'x-nf-client-connection-ip';
  return request.headers.get(header)?.trim() ?? null;
}

export async function POST(request: NextRequest) {
  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  if (parsed.data.is_province && parsed.data.payment_mode === 'cash') {
    return NextResponse.json({ error: 'Cash payment is only available in Antananarivo' }, { status: 400 });
  }
  const ip = getTrustedClientIp(request);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ip || !secret) return NextResponse.json({ error: 'Order service unavailable' }, { status: 503 });
  const ipHash = createHmac('sha256', secret).update(ip).digest('hex');
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('create_order', {
    payload: { ...parsed.data, source: 'app', ip_hash: ipHash },
  });
  if (error) {
    const status = /limit reached/i.test(error.message) ? 429
      : /stock/i.test(error.message) ? 409
        : /blocked|cash payment|invalid|payer/i.test(error.message) ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? 'Could not create order' : 'Order could not be accepted' }, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
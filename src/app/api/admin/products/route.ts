import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getActiveStaff } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';

const productSchema = z.object({
  id: z.uuid().optional(),
  category_id: z.uuid(),
  name_fr: z.string().trim().min(1).max(160),
  name_mg: z.string().trim().min(1).max(160),
  desc_fr: z.string().max(5000),
  desc_mg: z.string().max(5000),
  price_ar: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  warranty_months: z.number().int().nonnegative().max(120),
  images: z.array(z.string().url()).max(10),
});

const actionSchema = z.object({
  action: z.enum(['soldOut', 'inventory', 'delete', 'restore', 'hardDelete']),
  id: z.uuid(),
  price_ar: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
});

async function getStaff() {
  const staff = await getActiveStaff();
  if (!staff || !['admin', 'superadmin'].includes(staff.profile.role)) return null;
  return staff;
}

export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const filters = z.object({
    trash: z.enum(['0', '1']).default('0'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().max(80).default(''),
    category: z.uuid().optional(),
  }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!filters.success) return NextResponse.json({ error: 'Invalid product filters' }, { status: 400 });
  const { trash: rawTrash, page, category: categoryId } = filters.data;
  const trash = rawTrash === '1';
  const search = filters.data.search.replace(/[^\p{L}\p{N} '\-]/gu, '').trim();
  let query = admin.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (categoryId && z.uuid().safeParse(categoryId).success) query = query.eq('category_id', categoryId);
  if (search) query = query.or(`name_fr.ilike.%${search}%,name_mg.ilike.%${search}%`);
  const [{ data: products, count, error }, { data: categories, error: categoryError }] = await Promise.all([
    query.range((page - 1) * 20, page * 20 - 1),
    admin.from('categories').select('*').order('sort'),
  ]);
  if (error || categoryError) return NextResponse.json({ error: 'Could not load products' }, { status: 500 });
  return NextResponse.json({ products, categories, total: count ?? 0, page }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const form = await request.formData();
  let submitted: unknown;
  try {
    submitted = JSON.parse(String(form.get('product') ?? 'null'));
  } catch {
    return NextResponse.json({ error: 'Invalid product details' }, { status: 400 });
  }
  const parsed = productSchema.safeParse(submitted);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product details' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.json({ error: 'Product storage is unavailable' }, { status: 503 });
  const storageOrigin = new URL(supabaseUrl).origin;
  if (parsed.data.images.some((image) => {
    try {
      const url = new URL(image);
      return url.origin !== storageOrigin || !url.pathname.startsWith('/storage/v1/object/public/products/');
    } catch {
      return true;
    }
  })) return NextResponse.json({ error: 'Invalid product image URL' }, { status: 400 });

  const admin = createAdminClient();
  if (parsed.data.id) {
    const { data: current } = await admin.from('products').select('reserved').eq('id', parsed.data.id).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (parsed.data.stock < current.reserved) {
      return NextResponse.json({ error: 'Stock cannot be lower than reserved units' }, { status: 409 });
    }
  }
  const images = [...parsed.data.images];
  const uploadedPaths: string[] = [];
  const uploads = form.getAll('images').filter((file): file is File => file instanceof File);
  if (images.length + uploads.length > 10) return NextResponse.json({ error: 'Maximum 10 product images' }, { status: 400 });
  for (const file of uploads) {
    if (file.type !== 'image/webp' || file.size < 1 || file.size > 153600) {
      return NextResponse.json({ error: 'Product images must be WebP under 150 KB' }, { status: 400 });
    }
    const path = `${parsed.data.id ?? randomUUID()}/${randomUUID()}.webp`;
    const { error: uploadError } = await admin.storage.from('products').upload(path, file, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) {
      if (uploadedPaths.length) await admin.storage.from('products').remove(uploadedPaths);
      return NextResponse.json({ error: 'Could not upload product image' }, { status: 500 });
    }
    uploadedPaths.push(path);
    const { data } = admin.storage.from('products').getPublicUrl(path);
    images.push(data.publicUrl);
  }
  const { id, ...values } = parsed.data;
  const save = id
    ? await admin.from('products').update({ ...values, images }).eq('id', id).select('id').single()
    : await admin.from('products').insert({ ...values, images }).select('id').single();
  if (save.error) {
    if (uploadedPaths.length) await admin.storage.from('products').remove(uploadedPaths);
    return NextResponse.json({ error: 'Could not save product' }, { status: 500 });
  }
  return NextResponse.json({ id: save.data.id }, { status: id ? 200 : 201 });
}

export async function PATCH(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product action' }, { status: 400 });
  const admin = createAdminClient();
  const { action, id } = parsed.data;

  if (action === 'soldOut') {
    const { data: product } = await admin.from('products').select('is_sold_out').eq('id', id).maybeSingle();
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const { error } = await admin.from('products').update({ is_sold_out: !product.is_sold_out }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not update product' }, { status: 500 });
    return NextResponse.json({ is_sold_out: !product.is_sold_out });
  }
  if (action === 'inventory') {
    if (parsed.data.price_ar === undefined && parsed.data.stock === undefined) {
      return NextResponse.json({ error: 'No inventory values supplied' }, { status: 400 });
    }
    const { data: current } = await admin.from('products').select('reserved').eq('id', id).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (parsed.data.stock !== undefined && parsed.data.stock < current.reserved) {
      return NextResponse.json({ error: 'Stock cannot be lower than reserved units' }, { status: 409 });
    }
    const { error } = await admin.from('products').update({
      ...(parsed.data.price_ar === undefined ? {} : { price_ar: parsed.data.price_ar }),
      ...(parsed.data.stock === undefined ? {} : { stock: parsed.data.stock }),
    }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not update inventory' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { error } = await admin.from('products').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not move product to trash' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'restore') {
    const { error } = await admin.from('products').update({ deleted_at: null, is_active: true }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not restore product' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (staff.profile.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { count, error: countError } = await admin.from('order_items')
    .select('id', { count: 'exact', head: true }).eq('product_id', id);
  if (countError || (count ?? 0) > 0) return NextResponse.json({ error: 'Ordered products cannot be deleted permanently' }, { status: 409 });
  const { error } = await admin.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not permanently delete product' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
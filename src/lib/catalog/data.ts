import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export type CatalogCategory = Database['public']['Tables']['categories']['Row'];
export type CatalogProduct = Database['public']['Tables']['products']['Row'];

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public environment is not configured');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const getCatalog = unstable_cache(async (page = 1, rawSearch = '') => {
  const supabase = publicSupabase();
  const from = (page - 1) * 20;
  const search = rawSearch.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 80);
  let productsQuery = supabase.from('products').select('*', { count: 'exact' })
    .eq('is_active', true).is('deleted_at', null).order('created_at', { ascending: false });
  if (search) productsQuery = productsQuery.or([
    `name_fr.ilike.%${search}%`,
    `name_mg.ilike.%${search}%`,
    `desc_fr.ilike.%${search}%`,
    `desc_mg.ilike.%${search}%`,
  ].join(','));
  const [{ data: categories, error: categoryError }, { data: products, count, error: productError }, { data: setting }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    productsQuery.range(from, from + 19),
    supabase.from('settings').select('value').eq('key', 'whatsapp_number').maybeSingle(),
  ]);
  if (categoryError || productError) throw new Error('Catalog data could not be loaded');
  const whatsappNumber = typeof setting?.value === 'string' ? setting.value : '';
  return { categories: categories ?? [], products: products ?? [], whatsappNumber, total: count ?? 0 };
}, ['public-catalog-v1'], { revalidate: 60 });

export const getCatalogProduct = unstable_cache(async (id: string) => {
  const supabase = publicSupabase();
  const [{ data: product }, { data: setting }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).eq('is_active', true).is('deleted_at', null).maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'whatsapp_number').maybeSingle(),
  ]);
  return {
    product,
    category: product ? (await supabase.from('categories').select('*').eq('id', product.category_id).maybeSingle()).data : null,
    whatsappNumber: typeof setting?.value === 'string' ? setting.value : '',
  };
}, ['public-catalog-product-v1'], { revalidate: 60 });
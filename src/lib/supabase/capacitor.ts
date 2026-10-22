import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import type { Database } from '@/lib/database.types';

const sessionStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => { await Preferences.set({ key, value }); },
  removeItem: async (key: string) => { await Preferences.remove({ key }); },
};

export function createCapacitorSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public environment is not configured');
  return createClient<Database>(url, key, {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
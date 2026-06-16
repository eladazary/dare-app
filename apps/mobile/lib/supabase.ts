import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * SecureStore-backed storage adapter for Supabase auth tokens.
 * SecureStore keys must be <= 255 chars and contain only alphanumeric,
 * dot, dash, and underscore chars — we sanitise the key just in case.
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(sanitiseKey(key));
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(sanitiseKey(key), value);
    } catch {
      // Silently fail — the app will re-authenticate next launch.
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(sanitiseKey(key));
    } catch {
      // Silently fail.
    }
  },
};

function sanitiseKey(key: string): string {
  // Replace characters that SecureStore disallows with underscores.
  return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

import axios from 'axios';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Challenge {
  id: string;
  city_id: string;
  date: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  expires_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const workerUrl = (process.env.EXPO_PUBLIC_CLOUDFLARE_WORKER_URL ?? '').replace(
  /\/$/,
  ''
);

export const workerApi = axios.create({
  baseURL: workerUrl,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Supabase session JWT to every worker request when available.
workerApi.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch today's challenge for a given city.
 *
 * Strategy:
 *  1. Try the Cloudflare Worker (cached, fast).
 *  2. Fall back to Supabase REST directly if the worker is unavailable.
 */
export async function getChallenge(
  cityId: string,
  date: string
): Promise<Challenge> {
  // 1. Try worker first.
  if (workerUrl) {
    try {
      const response = await workerApi.get<Challenge>(
        `/challenge/${encodeURIComponent(cityId)}/${encodeURIComponent(date)}`
      );
      return response.data;
    } catch (workerError) {
      console.warn('[api] Worker request failed, falling back to Supabase:', workerError);
    }
  }

  // 2. Fall back to Supabase REST.
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('city_id', cityId)
    .eq('date', date)
    .single();

  if (error) {
    throw new Error(`Failed to fetch challenge: ${error.message}`);
  }

  return data as Challenge;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (publishable anon key). It can only sign people in
 * and read/write the signed-in user's own vault row — row-level security
 * blocks everything else.
 */

let client: SupabaseClient | null | undefined;

export function accountsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (typeof window === "undefined" || !accountsEnabled()) return (client = null);
  client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return client;
}

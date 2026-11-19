/**
 * Pneuma's Supabase address. It is public (it ships in every page), so it lives here: a bad value in the Vercel
 * setting (Nov 2026: not a valid https address, and Vercel won't let Paulo edit it without its authenticator)
 * can no longer break the app. A valid https *.supabase.co value in NEXT_PUBLIC_SUPABASE_URL still wins.
 */
export const PNEUMA_SUPABASE_URL = "https://ookjqagkelkoggpqwbti.supabase.co";

export function supabaseUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(v) ? v : PNEUMA_SUPABASE_URL;
}

/**
 * Pneuma's publishable key: built to be public (Supabase: "can be safely shared publicly"); row level security
 * guards the data. In code so sign-in works without a Vercel setting. A NEXT_PUBLIC_SUPABASE_ANON_KEY value wins.
 */
export const PNEUMA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bxwxlcOcIzDILRK6KHcfcQ_0BpVeha-";

export function supabasePublicKey(raw: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY): string {
  const v = (raw ?? "").trim();
  return v || PNEUMA_SUPABASE_PUBLISHABLE_KEY;
}

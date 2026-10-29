/**
 * Where `/api/*` lives. Empty on the website (same origin). The bundled iOS build sets
 * NEXT_PUBLIC_API_BASE to the live site, because the app itself is served from capacitor://localhost.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

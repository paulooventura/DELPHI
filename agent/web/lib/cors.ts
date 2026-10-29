/**
 * The bundled iOS app is served from capacitor://localhost and calls the live /api routes.
 * Only the app's own origins are let in; the website stays same-origin and needs nothing.
 */
const APP_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost", "https://localhost"]);

export function appCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin || !APP_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

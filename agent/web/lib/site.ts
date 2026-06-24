/** Canonical URLs — DELPHI lives under the pauloventura.org domain. */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://delphi.pauloventura.org";

export const WIX_HOME = "https://www.pauloventura.org";

/** Paulo Ventura Wix site sections (www.pauloventura.org). */
export const PAULO_VENTURA_LINKS = [
  { id: "home", label: "Home", href: WIX_HOME, glyph: "🏠" },
  { id: "bio", label: "Bio", href: `${WIX_HOME}/bio`, glyph: "✦" },
  { id: "epk", label: "EPK", href: `${WIX_HOME}/epk`, glyph: "📋" },
  { id: "alienativ", label: "AlieNatiV", href: `${WIX_HOME}/alienativ`, glyph: "👽" },
  { id: "kanuak", label: "KanuaK", href: `${WIX_HOME}/kanuak`, glyph: "🌺" },
  { id: "nfts", label: "NFTs", href: `${WIX_HOME}/nfts`, glyph: "◆" },
] as const;

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appCorsHeaders } from "./lib/cors";

/** Never cache HTML/shell routes — phones and PWAs otherwise freeze on old builds. */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const cors = path.startsWith("/api/") ? appCorsHeaders(request.headers.get("origin")) : null;
  if (cors && request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }
  const response = NextResponse.next();
  if (cors) for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  if (
    path.startsWith("/_next/static") ||
    path.startsWith("/_next/image") ||
    path.startsWith("/api/orbits/") ||
    path.startsWith("/api/aircraft") ||
    path.startsWith("/api/seafloor/")
  ) {
    return response;
  }
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:woff2?|png|jpg|svg)$).*)"],
};

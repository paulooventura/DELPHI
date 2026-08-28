import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Never cache HTML/shell routes — phones and PWAs otherwise freeze on old builds. */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path.startsWith("/_next/static") || path.startsWith("/_next/image")) {
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

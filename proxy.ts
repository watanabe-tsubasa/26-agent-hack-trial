import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE_COOKIE_NAME } from "@/lib/demo-sites";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SITE_COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|mock/|generated-frames/).*)"],
};

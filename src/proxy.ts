import { NextResponse, type NextRequest } from "next/server";
import { getDevelopmentAuthBypassConfig } from "@/lib/auth/dev-bypass";
import { BOOTSTRAP_ADMIN_EMAIL, GRAPH_PIXEL_SESSION_COOKIE } from "@/lib/constants";

const protectedPrefixes = ["/dashboard", "/projects", "/settings"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const developmentAuthBypass = getDevelopmentAuthBypassConfig(BOOTSTRAP_ADMIN_EMAIL);

  if (isProtected && !developmentAuthBypass.enabled && !request.cookies.get(GRAPH_PIXEL_SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/settings/:path*"],
};

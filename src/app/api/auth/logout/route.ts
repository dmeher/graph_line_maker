import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const acceptsJson = request.headers.get("accept")?.includes("application/json");
  // Scripted clients need a result so they can clear user-scoped offline data.
  // Native form posts retain the 303 fallback so /login is requested with GET.
  const response = acceptsJson
    ? NextResponse.json(
        { ok: true, redirectTo: "/login" },
        { headers: { "cache-control": "no-store" } },
      )
    : NextResponse.redirect(new URL("/login", request.url), 303);
  return clearSessionCookie(response);
}

import { NextRequest, NextResponse } from "next/server";
import { listDesignLibrary } from "@/lib/design/server";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const kind = params.get("kind");
    const result = await listDesignLibrary({ query: params.get("query") ?? undefined, kind: kind === "design" || kind === "clipart" ? kind : undefined, cursorUpdatedAt: params.get("cursorUpdatedAt") ?? undefined, cursorId: params.get("cursorId") ?? undefined, limit: Number(params.get("limit") || 48) });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load the Design library." }, { status: 500 });
  }
}

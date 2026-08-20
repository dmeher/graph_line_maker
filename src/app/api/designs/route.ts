import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBlankDesignDocument, createBuiltInDesignDocument } from "@/lib/design/defaults";
import { createDesignRecord, listDesignSummaries } from "@/lib/design/server";
import { designDocumentSchema } from "@/lib/design/schema";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "@/lib/canvas/performance-limits";

const createSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Untitled design"),
  kind: z.enum(["document", "template"]).default("document"),
  templateId: z.string().max(120).optional(),
  document: designDocumentSchema.optional(),
  canvas: z.object({ width: z.number().int().positive().max(MAX_CANVAS_DIMENSION), height: z.number().int().positive().max(MAX_CANVAS_DIMENSION), background: z.string().max(64).nullable().optional() }).refine((canvas) => canvas.width * canvas.height <= MAX_CANVAS_PIXELS, "Canvas exceeds the safe pixel limit.").optional(),
});

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind");
    const items = await listDesignSummaries({ kind: kind === "template" ? "template" : kind === "document" ? "document" : undefined, includeAll: request.nextUrl.searchParams.get("scope") === "all" });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load Designs." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid Design." }, { status: 400 });
    const canvas = parsed.data.canvas ?? { width: 1200, height: 1200, background: "#ffffff" };
    const document = parsed.data.document ?? (parsed.data.templateId ? createBuiltInDesignDocument(parsed.data.templateId) : createBlankDesignDocument(canvas.width, canvas.height, canvas.background ?? null));
    const designId = await createDesignRecord({ title: parsed.data.title, kind: parsed.data.kind, document });
    return NextResponse.json({ designId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to create Design." }, { status: 500 });
  }
}

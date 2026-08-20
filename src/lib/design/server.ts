import "server-only";

import { DESIGN_ASSETS_BUCKET } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";
import { parseDesignDocument } from "@/lib/design/schema";
import type { Design, DesignDocumentV1, DesignFile, DesignKind, DesignLibraryItem, DesignLibraryKind, DesignSummary } from "@/lib/design/types";
import { mediaUrlsForBucket } from "@/lib/storage/media";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type DbDesign = {
  id: string; user_id: string; kind: DesignKind; title: string; document_version: number;
  document: unknown; canvas_width: number; canvas_height: number; revision: number;
  preview_path: string | null; preview_thumb_path: string | null; created_at: string; updated_at: string;
};
type DbDesignFile = {
  id: string; design_id: string; user_id: string; name: string; path: string; thumb_path: string | null;
  mime_type: string; width: number; height: number; size_bytes: number; created_at: string;
};
type DbLibraryItem = {
  id: string; user_id: string; kind: DesignLibraryKind; title: string; tags: string[] | null; path: string;
  thumb_path: string | null; mime_type: string; width: number; height: number; size_bytes: number;
  source_design_id: string | null; created_at: string; updated_at: string; owner_email?: string; owner_display_name?: string | null;
};
type Owner = { email: string; display_name: string | null };

async function ownerFor(userId: string): Promise<Owner> {
  const { data, error } = await getSupabaseAdmin().from("app_users").select("email, display_name").eq("id", userId).single();
  if (error) throw new Error(error.message);
  return data as Owner;
}

function mapFile(row: DbDesignFile, urls: Map<string, string | null>): DesignFile {
  return { id: row.id, designId: row.design_id, name: row.name, path: row.path, thumbPath: row.thumb_path, mimeType: row.mime_type, width: row.width, height: row.height, sizeBytes: row.size_bytes, createdAt: row.created_at, url: urls.get(row.path) ?? null, thumbUrl: row.thumb_path ? urls.get(row.thumb_path) ?? null : null };
}

function mapLibraryItem(row: DbLibraryItem, urls: Map<string, string | null>): DesignLibraryItem {
  return { id: row.id, userId: row.user_id, kind: row.kind, title: row.title, tags: row.tags ?? [], path: row.path, thumbPath: row.thumb_path, mimeType: row.mime_type, width: row.width, height: row.height, sizeBytes: row.size_bytes, sourceDesignId: row.source_design_id, ownerEmail: row.owner_email ?? "", ownerDisplayName: row.owner_display_name ?? null, url: urls.get(row.path) ?? null, thumbUrl: row.thumb_path ? urls.get(row.thumb_path) ?? null : null, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function assertDesignFileReferences(designId: string, document: DesignDocumentV1) {
  const referencedIds = Array.from(new Set(document.nodes.filter((node) => node.type === "image").map((node) => node.fileId)));
  if (!referencedIds.length) return;
  const { data, error } = await getSupabaseAdmin().from("design_files").select("id").eq("design_id", designId).in("id", referencedIds);
  if (error) throw new Error(error.message);
  const available = new Set((data ?? []).map((row: { id: string }) => row.id));
  if (referencedIds.some((id) => !available.has(id))) throw new Error("The Design references a file that does not belong to this document.");
}

export async function assertDesignAccess(designId: string) {
  const session = await requireSession();
  const query = getSupabaseAdmin().from("designs").select("id, user_id, kind, title, document_version, document, canvas_width, canvas_height, revision, preview_path, preview_thumb_path, created_at, updated_at").eq("id", designId);
  if (session.role !== "admin") query.eq("user_id", session.userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Design not found.");
  return { session, row: data as DbDesign };
}

export async function getDesignForCurrentUser(designId: string): Promise<Design | null> {
  const session = await requireSession();
  const query = getSupabaseAdmin().from("designs").select("id, user_id, kind, title, document_version, document, canvas_width, canvas_height, revision, preview_path, preview_thumb_path, created_at, updated_at").eq("id", designId);
  if (session.role !== "admin") query.eq("user_id", session.userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as DbDesign;
  const [filesResult, owner] = await Promise.all([
    getSupabaseAdmin().from("design_files").select("id, design_id, user_id, name, path, thumb_path, mime_type, width, height, size_bytes, created_at").eq("design_id", row.id).order("created_at", { ascending: true }),
    ownerFor(row.user_id),
  ]);
  if (filesResult.error) throw new Error(filesResult.error.message);
  const files = (filesResult.data ?? []) as DbDesignFile[];
  const urls = mediaUrlsForBucket(DESIGN_ASSETS_BUCKET, [row.preview_path, row.preview_thumb_path, ...files.flatMap((file) => [file.path, file.thumb_path])]);
  return { id: row.id, userId: row.user_id, kind: row.kind, title: row.title, document: parseDesignDocument(row.document), revision: Number(row.revision), previewPath: row.preview_path, previewThumbPath: row.preview_thumb_path, previewUrl: row.preview_path ? urls.get(row.preview_path) ?? null : null, previewThumbUrl: row.preview_thumb_path ? urls.get(row.preview_thumb_path) ?? null : null, ownerEmail: owner.email, ownerDisplayName: owner.display_name, createdAt: row.created_at, updatedAt: row.updated_at, files: files.map((file) => mapFile(file, urls)) };
}

export async function createDesignRecord(input: { title: string; kind?: DesignKind; document: DesignDocumentV1; userId?: string }) {
  const session = await requireSession();
  const userId = input.userId && session.role === "admin" ? input.userId : session.userId;
  const document = parseDesignDocument(input.document);
  if (document.nodes.some((node) => node.type === "image")) throw new Error("Create the Design before attaching immutable image files.");
  const { data, error } = await getSupabaseAdmin().from("designs").insert({ user_id: userId, kind: input.kind ?? "document", title: input.title.trim().slice(0, 160) || "Untitled design", document_version: document.version, document, canvas_width: document.canvas.width, canvas_height: document.canvas.height, revision: 1 }).select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateDesignRecord(input: { designId: string; baseRevision: number; title?: string; document: DesignDocumentV1; previewPath?: string | null; previewThumbPath?: string | null }) {
  const { row } = await assertDesignAccess(input.designId);
  const document = parseDesignDocument(input.document);
  await assertDesignFileReferences(input.designId, document);
  const values: Record<string, unknown> = { document_version: document.version, document, canvas_width: document.canvas.width, canvas_height: document.canvas.height, revision: input.baseRevision + 1 };
  if (input.title !== undefined) values.title = input.title.trim().slice(0, 160) || row.title;
  if (input.previewPath !== undefined) values.preview_path = input.previewPath;
  if (input.previewThumbPath !== undefined) values.preview_thumb_path = input.previewThumbPath;
  const { data, error } = await getSupabaseAdmin().from("designs").update(values).eq("id", input.designId).eq("revision", input.baseRevision).select("revision, updated_at").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { revision: Number((data as { revision: number }).revision), updatedAt: (data as { updated_at: string }).updated_at } : null;
}

export async function listDesignSummaries(input: { kind?: DesignKind; includeAll?: boolean; limit?: number } = {}): Promise<DesignSummary[]> {
  const session = await requireSession();
  const limit = Math.max(1, Math.min(100, input.limit ?? 48));
  const query = getSupabaseAdmin().from("designs").select("id, user_id, kind, title, document_version, document, canvas_width, canvas_height, revision, preview_path, preview_thumb_path, created_at, updated_at").order("updated_at", { ascending: false }).limit(limit);
  if (input.kind) query.eq("kind", input.kind);
  if (session.role !== "admin" || !input.includeAll) query.eq("user_id", session.userId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DbDesign[];
  const ownerIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const ownerMap = new Map<string, Owner>();
  if (ownerIds.length) {
    const owners = await getSupabaseAdmin().from("app_users").select("id, email, display_name").in("id", ownerIds);
    if (owners.error) throw new Error(owners.error.message);
    for (const owner of (owners.data ?? []) as Array<Owner & { id: string }>) ownerMap.set(owner.id, owner);
  }
  const urls = mediaUrlsForBucket(DESIGN_ASSETS_BUCKET, rows.flatMap((row) => [row.preview_path, row.preview_thumb_path]));
  return rows.map((row) => ({ id: row.id, userId: row.user_id, kind: row.kind, title: row.title, revision: Number(row.revision), previewPath: row.preview_path, previewThumbPath: row.preview_thumb_path, previewUrl: row.preview_path ? urls.get(row.preview_path) ?? null : null, previewThumbUrl: row.preview_thumb_path ? urls.get(row.preview_thumb_path) ?? null : null, ownerEmail: ownerMap.get(row.user_id)?.email ?? "", ownerDisplayName: ownerMap.get(row.user_id)?.display_name ?? null, createdAt: row.created_at, updatedAt: row.updated_at, nodeCount: Array.isArray((row.document as { nodes?: unknown[] })?.nodes) ? (row.document as { nodes: unknown[] }).nodes.length : 0 }));
}

export async function listDesignLibrary(input: { query?: string; kind?: DesignLibraryKind; cursorUpdatedAt?: string; cursorId?: string; limit?: number } = {}) {
  await requireSession();
  const limit = Math.max(1, Math.min(100, input.limit ?? 48));
  const { data, error } = await getSupabaseAdmin().rpc("get_design_library_summaries", { p_query: input.query?.trim() || null, p_kind: input.kind ?? null, p_cursor_updated_at: input.cursorUpdatedAt ?? null, p_cursor_id: input.cursorId ?? null, p_limit: limit + 1 });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DbLibraryItem[];
  const page = rows.slice(0, limit);
  const urls = mediaUrlsForBucket(DESIGN_ASSETS_BUCKET, page.flatMap((row) => [row.path, row.thumb_path]));
  return { items: page.map((row) => mapLibraryItem(row, urls)), nextCursor: rows.length > limit && page.length ? { updatedAt: page.at(-1)!.updated_at, id: page.at(-1)!.id } : null };
}

export async function assertLibraryMutationAccess(itemId: string) {
  const session = await requireSession();
  const query = getSupabaseAdmin().from("design_library_items").select("id, user_id, kind, title, tags, path, thumb_path, mime_type, width, height, size_bytes, source_design_id, created_at, updated_at").eq("id", itemId);
  if (session.role !== "admin") query.eq("user_id", session.userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Library item not found.");
  return { session, row: data as DbLibraryItem };
}

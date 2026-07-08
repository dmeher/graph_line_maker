import type { GraphSettings, PaletteColor } from "@/lib/types";

export const EDITOR_SESSION_DRAFT_VERSION = 1;

export type EditorSessionDraft = {
  version: typeof EDITOR_SESSION_DRAFT_VERSION;
  projectId: string;
  savedAt: string;
  title: string;
  description: string;
  settings: GraphSettings;
  palette: PaletteColor[];
  width: number;
  height: number;
  colorCount: number;
};

export type EditorDraftInput = {
  projectId: string;
  title: string;
  description: string;
  settings: GraphSettings;
  palette: PaletteColor[];
  width: number;
  height: number;
  colorCount: number;
  savedAt?: string;
};

export function editorSessionDraftKey(projectId: string) {
  return `graph-pixel-maker:editor-draft:v${EDITOR_SESSION_DRAFT_VERSION}:${projectId}`;
}

function sanitizeSettingsForDraft(settings: GraphSettings): GraphSettings {
  return {
    ...settings,
    sourceImages: (settings.sourceImages ?? []).map(({ url: _url, ...source }) => ({
      ...source,
      url: null,
    })),
    clipartAssets: (settings.clipartAssets ?? []).map(({ url: _url, dataUrl: _dataUrl, ...asset }) => ({
      ...asset,
      url: null,
      dataUrl: null,
    })),
  };
}

function reviveDraftSettings(settings: GraphSettings, baseSettings: GraphSettings): GraphSettings {
  const baseSourcesById = new Map((baseSettings.sourceImages ?? []).map((source) => [source.id, source] as const));
  const baseClipartsById = new Map((baseSettings.clipartAssets ?? []).map((asset) => [asset.id, asset] as const));
  return {
    ...settings,
    sourceImages: (settings.sourceImages ?? []).map((source) => {
      const baseSource = baseSourcesById.get(source.id);
      return {
        ...source,
        path: source.path ?? baseSource?.path ?? null,
        url: baseSource?.url ?? null,
      };
    }),
    clipartAssets: (settings.clipartAssets ?? []).map((asset) => {
      const baseAsset = baseClipartsById.get(asset.id);
      return {
        ...asset,
        path: asset.path ?? baseAsset?.path ?? null,
        url: baseAsset?.url ?? null,
        dataUrl: null,
      };
    }),
  };
}

export function createEditorSessionDraft(input: EditorDraftInput): EditorSessionDraft {
  const savedAt = input.savedAt ?? new Date().toISOString();
  return {
    version: EDITOR_SESSION_DRAFT_VERSION,
    projectId: input.projectId,
    savedAt,
    title: input.title,
    description: input.description,
    settings: sanitizeSettingsForDraft(input.settings),
    palette: input.palette.map((color, index) => ({ ...color, sortOrder: index })),
    width: Math.max(0, Math.round(input.width)),
    height: Math.max(0, Math.round(input.height)),
    colorCount: Math.max(0, Math.round(input.colorCount)),
  };
}

export function parseEditorSessionDraft(value: string, projectId: string, baseSettings: GraphSettings) {
  const parsed = JSON.parse(value) as Partial<EditorSessionDraft>;
  if (parsed.version !== EDITOR_SESSION_DRAFT_VERSION) return null;
  if (parsed.projectId !== projectId) return null;
  if (typeof parsed.savedAt !== "string" || Number.isNaN(Date.parse(parsed.savedAt))) return null;
  if (typeof parsed.title !== "string") return null;
  if (typeof parsed.description !== "string") return null;
  if (!parsed.settings || typeof parsed.settings !== "object") return null;
  if (!Array.isArray(parsed.palette)) return null;

  return {
    ...parsed,
    settings: reviveDraftSettings(parsed.settings as GraphSettings, baseSettings),
    palette: parsed.palette as PaletteColor[],
    width: Number(parsed.width ?? 0),
    height: Number(parsed.height ?? 0),
    colorCount: Number(parsed.colorCount ?? parsed.palette.length),
  } as EditorSessionDraft;
}

export function isEditorSessionDraftNewer(draft: EditorSessionDraft, projectUpdatedAt: string) {
  const draftTime = Date.parse(draft.savedAt);
  const projectTime = Date.parse(projectUpdatedAt);
  if (Number.isNaN(draftTime)) return false;
  if (Number.isNaN(projectTime)) return true;
  return draftTime > projectTime;
}

function browserSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function readEditorSessionDraft(
  projectId: string,
  projectUpdatedAt: string,
  baseSettings: GraphSettings,
  storage: Storage | null = browserSessionStorage(),
) {
  if (!storage) return null;

  try {
    const raw = storage.getItem(editorSessionDraftKey(projectId));
    if (!raw) return null;
    const draft = parseEditorSessionDraft(raw, projectId, baseSettings);
    return draft && isEditorSessionDraftNewer(draft, projectUpdatedAt) ? draft : null;
  } catch {
    return null;
  }
}

export function hasEditorSessionDraft(projectId: string, storage: Storage | null = browserSessionStorage()) {
  if (!storage) return false;
  try {
    return storage.getItem(editorSessionDraftKey(projectId)) !== null;
  } catch {
    return false;
  }
}

export function writeEditorSessionDraft(draft: EditorSessionDraft, storage: Storage | null = browserSessionStorage()) {
  if (!storage) throw new Error("Browser session storage is not available.");
  storage.setItem(editorSessionDraftKey(draft.projectId), JSON.stringify(draft));
}

export function removeEditorSessionDraft(projectId: string, storage: Storage | null = browserSessionStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(editorSessionDraftKey(projectId));
  } catch {
    // Session drafts are best effort only.
  }
}

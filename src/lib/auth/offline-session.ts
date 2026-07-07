import type { CurrentSession } from "@/lib/types";

export const OFFLINE_SESSION_STORAGE_KEY = "graph-pixel-maker:offline-session:v1";
export const OFFLINE_SESSION_READY_MESSAGE = "GRAPH_PIXEL_OFFLINE_SESSION_READY";
export const OFFLINE_SESSION_CLEAR_MESSAGE = "GRAPH_PIXEL_OFFLINE_SESSION_CLEAR";

export type OfflineSessionSnapshot = {
  version: 1;
  token: string;
  expiresAt: string;
  session: CurrentSession;
  cachedAt: string;
};

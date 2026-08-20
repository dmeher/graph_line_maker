"use client";

import type { DesignDocumentV1 } from "@/lib/design/types";

const DATABASE_NAME = "graph-pixel-design-recovery";
const STORE_NAME = "drafts";
export const DESIGN_RECOVERY_VERSION = 1;

export type DesignRecoveryDraft = { version: number; userId: string; designId: string; revision: number; title?: string; document: DesignDocumentV1; savedAt: string; synced: boolean };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DESIGN_RECOVERY_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

function key(userId: string, designId: string) { return `${userId}:${designId}`; }

export async function saveDesignRecoveryDraft(draft: DesignRecoveryDraft) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => { const transaction = database.transaction(STORE_NAME, "readwrite"); transaction.objectStore(STORE_NAME).put({ key: key(draft.userId, draft.designId), ...draft }); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  database.close();
}

export async function readDesignRecoveryDraft(userId: string, designId: string): Promise<DesignRecoveryDraft | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  const value = await new Promise<DesignRecoveryDraft | null>((resolve, reject) => { const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key(userId, designId)); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); });
  database.close(); return value;
}

export async function clearDesignRecoveryDrafts(userId?: string) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite"); const store = transaction.objectStore(STORE_NAME);
    if (!userId) store.clear(); else { const request = store.openCursor(); request.onsuccess = () => { const cursor = request.result; if (!cursor) return; if (String(cursor.key).startsWith(`${userId}:`)) cursor.delete(); cursor.continue(); }; }
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

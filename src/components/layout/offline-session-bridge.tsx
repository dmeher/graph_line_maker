"use client";

import { useEffect, useRef } from "react";
import {
  OFFLINE_SESSION_READY_MESSAGE,
  OFFLINE_SESSION_STORAGE_KEY,
  type OfflineSessionSnapshot,
} from "@/lib/auth/offline-session";
import type { CurrentSession } from "@/lib/types";

export function OfflineSessionBridge({
  session,
  offlineSessionTicket,
}: {
  session: CurrentSession;
  offlineSessionTicket: { token: string; expiresAt: string };
}) {
  const { token, expiresAt } = offlineSessionTicket;
  const signature = `${session.userId}:${session.email}:${session.role}:${session.displayName ?? ""}:${expiresAt}:${token}`;
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;

    const cachedAt = new Date().toISOString();
    const snapshot: OfflineSessionSnapshot = {
      version: 1,
      token,
      expiresAt,
      session,
      cachedAt,
    };

    try {
      window.sessionStorage.setItem(OFFLINE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Session storage can be unavailable in private or restricted browser modes.
    }

    if (!("serviceWorker" in navigator)) return;

    const message = {
      type: OFFLINE_SESSION_READY_MESSAGE,
      cachedAt,
      expiresAt,
      userId: session.userId,
    };

    navigator.serviceWorker.controller?.postMessage(message);
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.active?.postMessage(message);
      })
      .catch(() => {});
  });

  return null;
}

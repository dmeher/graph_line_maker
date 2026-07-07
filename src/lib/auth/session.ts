import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BOOTSTRAP_ADMIN_EMAIL, GRAPH_PIXEL_SESSION_COOKIE } from "@/lib/constants";
import { normalizeEmail, signPayload, verifySignedPayload } from "@/lib/auth/security";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";
import type { AppRole, AppUser, CurrentSession } from "@/lib/types";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OFFLINE_SESSION_KIND = "offline-session";

type SessionPayload = {
  userId: string;
  email: string;
  role: AppRole;
  exp: number;
  kind?: string;
};

type DbUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  status: "active" | "inactive";
  invited_by_email: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapUser(user: DbUser): AppUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    invitedByEmail: user.invited_by_email,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function createSessionToken(input: Pick<SessionPayload, "userId" | "email" | "role">) {
  return signPayload({
    ...input,
    email: normalizeEmail(input.email),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
}

export function createOfflineSessionTicket(input: CurrentSession) {
  try {
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const token = signPayload({
      kind: OFFLINE_SESSION_KIND,
      userId: input.userId,
      email: normalizeEmail(input.email),
      role: input.role,
      exp,
    });

    return {
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function parseSessionToken(token?: string | null) {
  const payload = verifySignedPayload<SessionPayload>(token);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (payload.kind === OFFLINE_SESSION_KIND) return null;
  return payload;
}

export async function getActiveUserByEmail(email: string) {
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, status, invited_by_email, last_login_at, created_at, updated_at")
    .eq("email", normalizeEmail(email))
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data as DbUser) : null;
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const payload = parseSessionToken(cookieStore.get(GRAPH_PIXEL_SESSION_COOKIE)?.value);
  if (!payload) return null;

  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, status")
    .eq("id", payload.userId)
    .eq("email", normalizeEmail(payload.email))
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const user = data as Pick<DbUser, "id" | "email" | "display_name" | "role" | "status">;

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  };
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Sign in is required.");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Admin access is required.");
  return session;
}

export async function getAppUsers() {
  await requireAdmin();
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, status, invited_by_email, last_login_at, created_at, updated_at")
    .order("role", { ascending: true })
    .order("email", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbUser[]).map(mapUser);
}

export function setSessionCookie(response: NextResponse, user: Pick<AppUser, "id" | "email" | "role">) {
  response.cookies.set(GRAPH_PIXEL_SESSION_COOKIE, createSessionToken({ userId: user.id, email: user.email, role: user.role }), getSessionCookieOptions());
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(GRAPH_PIXEL_SESSION_COOKIE, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function isBootstrapAdmin(email: string) {
  return normalizeEmail(email) === BOOTSTRAP_ADMIN_EMAIL;
}

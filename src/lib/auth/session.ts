import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { BOOTSTRAP_ADMIN_EMAIL, GRAPH_PIXEL_SESSION_COOKIE } from "@/lib/constants";
import { getDevelopmentAuthBypassConfig } from "@/lib/auth/dev-bypass";
import { normalizeEmail, signPayload, verifySignedPayload } from "@/lib/auth/security";
import { tryGetSupabaseAdmin } from "@/lib/supabase/server";
import type { AppRole, AppUser, CurrentSession } from "@/lib/types";
import { displayNameFromEmail } from "@/lib/utils/format";

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

async function getDevelopmentBypassSession(): Promise<CurrentSession | null> {
  const config = getDevelopmentAuthBypassConfig(BOOTSTRAP_ADMIN_EMAIL);
  if (!config.enabled) return null;

  const supabase = tryGetSupabaseAdmin();
  if (supabase) {
    const user = await getActiveUserByEmail(config.email);
    if (!user) {
      throw new Error(
        `Development auth bypass user ${config.email} is not an active app user. Set GRAPH_PIXEL_DEV_USER_EMAIL to an active app_users email.`,
      );
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    };
  }

  return {
    userId: "00000000-0000-4000-8000-000000000001",
    email: config.email,
    role: isBootstrapAdmin(config.email) ? "admin" : "member",
    displayName: displayNameFromEmail(config.email),
  };
}

const resolveCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const developmentSession = await getDevelopmentBypassSession();
  if (developmentSession) return developmentSession;

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
});

export async function getCurrentSession(): Promise<CurrentSession | null> {
  return resolveCurrentSession();
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

export async function getAppUsers(cursor?: string, pageSize = 25) {
  await requireAdmin();
  const supabase = tryGetSupabaseAdmin();
  if (!supabase) return { users: [], nextCursor: null };

  const limit = Math.max(1, Math.min(100, pageSize));
  let request = supabase
    .from("app_users")
    .select("id, email, display_name, role, status, invited_by_email, last_login_at, created_at, updated_at")
    .order("email", { ascending: true })
    .limit(limit + 1);
  if (cursor) request = request.gt("email", normalizeEmail(cursor));
  const { data, error } = await request;

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DbUser[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  return {
    users: pageRows.map(mapUser),
    nextCursor: hasMore ? pageRows.at(-1)?.email ?? null : null,
  };
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

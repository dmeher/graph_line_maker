import "server-only";

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

function safeEqual(left: string, right: string) {
  const expected = Buffer.from(left);
  const received = Buffer.from(right);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function getOtpPepper() {
  const pepper =
    process.env.EMAIL_OTP_SECRET?.trim() ||
    process.env.GRAPH_PIXEL_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_OTP_SECRET is required in production.");
  }
  return "dev-only-graph-pixel-otp-pepper";
}

function getSessionSecret() {
  const secret =
    process.env.GRAPH_PIXEL_SESSION_SECRET?.trim() ||
    process.env.EMAIL_OTP_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("GRAPH_PIXEL_SESSION_SECRET is required in production.");
  }
  return "dev-only-graph-pixel-session-secret";
}

export function hashOtp(email: string, otp: string) {
  return createHash("sha256")
    .update(`${normalizeEmail(email)}:app_login:${otp}:${getOtpPepper()}`)
    .digest("hex");
}

export function verifyOtpHash(email: string, otp: string, storedHash: string) {
  return safeEqual(hashOtp(email, otp), storedHash);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signPayload(payload: Record<string, unknown>) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySignedPayload<T>(token?: string | null): T | null {
  if (!token?.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  if (!body || !signature || !safeEqual(expected, signature)) return null;

  try {
    return JSON.parse(base64UrlDecode(body)) as T;
  } catch {
    return null;
  }
}


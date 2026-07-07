import type { CurrentSession } from "@/lib/types";

export function isAuthDisabledForTesting() {
  if (process.env.NODE_ENV === "production") return process.env.DISABLE_AUTH_FOR_TESTING === "true";
  return process.env.DISABLE_AUTH_FOR_TESTING !== "false";
}

export function getTestingSession(): CurrentSession {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "testing@graphpixel.local",
    role: "admin",
    displayName: "Testing Admin",
  };
}

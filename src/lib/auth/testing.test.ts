import assert from "node:assert/strict";
import test from "node:test";
import { getTestingSession, isAuthDisabledForTesting } from "./testing.ts";

const originalEnv = { ...process.env };

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

test.afterEach(() => {
  setNodeEnv(originalEnv.NODE_ENV);
  if (originalEnv.DISABLE_AUTH_FOR_TESTING === undefined) {
    delete process.env.DISABLE_AUTH_FOR_TESTING;
  } else {
    process.env.DISABLE_AUTH_FOR_TESTING = originalEnv.DISABLE_AUTH_FOR_TESTING;
  }
});

test("auth bypass is enabled by default outside production", () => {
  setNodeEnv("development");
  delete process.env.DISABLE_AUTH_FOR_TESTING;

  assert.equal(isAuthDisabledForTesting(), true);
});

test("auth bypass can be disabled outside production", () => {
  setNodeEnv("development");
  process.env.DISABLE_AUTH_FOR_TESTING = "false";

  assert.equal(isAuthDisabledForTesting(), false);
});

test("auth bypass requires explicit opt-in in production", () => {
  setNodeEnv("production");
  delete process.env.DISABLE_AUTH_FOR_TESTING;
  assert.equal(isAuthDisabledForTesting(), false);

  process.env.DISABLE_AUTH_FOR_TESTING = "true";
  assert.equal(isAuthDisabledForTesting(), true);
});

test("testing session has a stable admin identity", () => {
  const session = getTestingSession();

  assert.equal(session.role, "admin");
  assert.equal(session.email, "testing@graphpixel.local");
  assert.match(session.userId, /^[0-9a-f-]{36}$/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { getDevelopmentAuthBypassConfig } from "./dev-bypass.ts";

const defaultEmail = "admin@example.test";

test("development auth bypass is opt-in", () => {
  assert.deepEqual(
    getDevelopmentAuthBypassConfig(defaultEmail, { NODE_ENV: "development" }),
    { enabled: false, email: defaultEmail },
  );
});

test("development auth bypass accepts true and normalizes the selected email", () => {
  assert.deepEqual(
    getDevelopmentAuthBypassConfig(
      defaultEmail,
      {
        NODE_ENV: "development",
        GRAPH_PIXEL_DEV_AUTH_BYPASS: " TRUE ",
        GRAPH_PIXEL_DEV_USER_EMAIL: " Developer@Example.Test ",
      },
    ),
    { enabled: true, email: "developer@example.test" },
  );
});

test("development auth bypass cannot be enabled in production", () => {
  assert.deepEqual(
    getDevelopmentAuthBypassConfig(
      defaultEmail,
      {
        NODE_ENV: "production",
        GRAPH_PIXEL_DEV_AUTH_BYPASS: "true",
        GRAPH_PIXEL_DEV_USER_EMAIL: "developer@example.test",
      },
    ),
    { enabled: false, email: "developer@example.test" },
  );
});

test("development auth bypass cannot be enabled in the test environment", () => {
  assert.deepEqual(
    getDevelopmentAuthBypassConfig(
      defaultEmail,
      { NODE_ENV: "test", GRAPH_PIXEL_DEV_AUTH_BYPASS: "true" },
    ),
    { enabled: false, email: defaultEmail },
  );
});

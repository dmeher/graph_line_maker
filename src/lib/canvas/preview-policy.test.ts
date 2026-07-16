import assert from "node:assert/strict";
import test from "node:test";
import { PREVIEW_POLICIES, draftDimensions, performanceTierForCapabilities } from "./preview-policy.ts";

test("capability tiers favor safe defaults and low-spec constraints", () => {
  assert.equal(performanceTierForCapabilities({}), "standard");
  assert.equal(performanceTierForCapabilities({ deviceMemoryGb: 4, hardwareConcurrency: 8 }), "low");
  assert.equal(performanceTierForCapabilities({ deviceMemoryGb: 16, hardwareConcurrency: 12 }), "high");
});

test("draft dimensions preserve aspect ratio while respecting the tier cap", () => {
  const result = draftDimensions(4000, 3000, PREVIEW_POLICIES.low);
  assert.ok(result.width * result.height <= PREVIEW_POLICIES.low.draftPixelCap);
  assert.ok(Math.abs(result.width / result.height - 4 / 3) < 0.01);
  assert.equal(draftDimensions(800, 600, PREVIEW_POLICIES.low).scale, 1);
});

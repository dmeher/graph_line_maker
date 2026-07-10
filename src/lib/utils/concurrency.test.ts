import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "./concurrency.ts";

test("mapWithConcurrency preserves order and enforces its limit", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(result, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});

test("mapWithConcurrency stops scheduling new work after a failure", async () => {
  const started: number[] = [];
  await assert.rejects(
    mapWithConcurrency([1, 2, 3, 4], 1, async (value) => {
      started.push(value);
      if (value === 2) throw new Error("failed");
      return value;
    }),
    /failed/,
  );
  assert.deepEqual(started, [1, 2]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { ByteLruCache } from "./byte-lru.ts";

test("byte LRU refreshes reads and evicts the least recently used entry", () => {
  const disposed: string[] = [];
  const cache = new ByteLruCache<string, string>(8);
  const dispose = (value: string) => disposed.push(value);
  cache.set("a", "alpha", { bytes: 4, dispose });
  cache.set("b", "beta", { bytes: 4, dispose });
  assert.equal(cache.get("a"), "alpha");
  cache.set("c", "gamma", { bytes: 4, dispose });
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.deepEqual(disposed, ["beta"]);
});

test("byte LRU disposes rejected oversize values and clears retained entries", () => {
  const disposed: string[] = [];
  const cache = new ByteLruCache<string, string>(4);
  assert.equal(cache.set("large", "large", { bytes: 5, dispose: (value) => disposed.push(value) }), false);
  cache.set("small", "small", { bytes: 4, dispose: (value) => disposed.push(value) });
  cache.clear();
  assert.deepEqual(disposed, ["large", "small"]);
  assert.equal(cache.bytes, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { isSafeObjectKey, objectKey } from "../object-storage/canonical.ts";
import { thumbnailPathFor } from "./paths.ts";

test("thumbnail paths sit beside their asset under a thumbs/ segment", () => {
  assert.equal(
    thumbnailPathFor("user-1/project-1/sources/abc.png"),
    "user-1/project-1/sources/thumbs/abc.webp",
  );
  assert.equal(
    thumbnailPathFor("user-1/project-1/cliparts/def.svg"),
    "user-1/project-1/cliparts/thumbs/def.webp",
  );
  assert.equal(
    thumbnailPathFor("user-1/project-1/processed.png"),
    "user-1/project-1/thumbs/processed.webp",
  );
});

test("thumbnail derivation is stable, so cleanup deletes the key upload wrote", () => {
  // Nothing stores the mapping between an asset and its derivative; both sides
  // recompute it, so drift here would silently orphan every thumbnail.
  const path = "user-1/project-1/sources/abc.png";
  assert.equal(thumbnailPathFor(path), thumbnailPathFor(path));
});

test("assets whose names differ only slightly do not share one thumbnail", () => {
  assert.notEqual(
    thumbnailPathFor("user-1/p/sources/abc.png"),
    thumbnailPathFor("user-1/p/sources/abcd.png"),
  );
});

test("a file name without an extension still yields a usable thumbnail key", () => {
  assert.equal(
    thumbnailPathFor("user-1/project-1/sources/abc"),
    "user-1/project-1/sources/thumbs/abc.webp",
  );
});

test("R2 keys keep the legacy Supabase bucket name as the first segment", () => {
  // This is what lets every existing original_image_path and settings[].path
  // value resolve after the migration with no data rewrite.
  assert.equal(
    objectKey("graph-pixel-original-images", "user-1/project-1/sources/abc.png"),
    "graph-pixel-original-images/user-1/project-1/sources/abc.png",
  );
  assert.equal(
    objectKey("graph-pixel-processed-images", "user-1/project-1/processed.png"),
    "graph-pixel-processed-images/user-1/project-1/processed.png",
  );
});

test("derived thumbnail keys are always valid object keys", () => {
  for (const path of [
    "user-1/project-1/sources/abc.png",
    "user-1/project-1/cliparts/a b c.svg",
    "user-1/project-1/processed.png",
  ]) {
    assert.equal(
      isSafeObjectKey(objectKey("graph-pixel-original-images", thumbnailPathFor(path))),
      true,
      `expected a safe key for ${path}`,
    );
  }
});

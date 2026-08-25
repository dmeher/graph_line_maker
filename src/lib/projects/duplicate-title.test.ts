import assert from "node:assert/strict";
import test from "node:test";
import { duplicateProjectTitle, MAX_PROJECT_TITLE_LENGTH, normalizeDuplicateProjectTitle } from "./duplicate-title.ts";

test("duplicate titles retain the Copy suffix within the save limit", () => {
  const title = "A".repeat(MAX_PROJECT_TITLE_LENGTH);
  const duplicate = duplicateProjectTitle(title);

  assert.equal(duplicate.length, MAX_PROJECT_TITLE_LENGTH);
  assert.equal(duplicate.endsWith(" Copy"), true);
  assert.equal(duplicate.slice(0, -" Copy".length), "A".repeat(MAX_PROJECT_TITLE_LENGTH - " Copy".length));
});

test("duplicate titles use a valid fallback for blank legacy titles", () => {
  assert.equal(duplicateProjectTitle("  "), "Untitled project Copy");
});

test("saving an existing overlong copy repairs its title without dropping the suffix", () => {
  const legacyCopy = `${"A".repeat(MAX_PROJECT_TITLE_LENGTH)} Copy`;

  assert.equal(normalizeDuplicateProjectTitle(legacyCopy), `${"A".repeat(MAX_PROJECT_TITLE_LENGTH - " Copy".length)} Copy`);
});

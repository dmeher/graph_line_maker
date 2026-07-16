import assert from "node:assert/strict";
import test from "node:test";
import {
  applySettingsHistoryCommand,
  boundSettingsHistory,
  createSettingsHistoryCommand,
} from "./history.ts";

type FixtureSettings = {
  width: number;
  title: string;
  layers: Array<{ id: string; x: number }>;
};

test("history commands retain only changed settings and round-trip undo/redo", () => {
  const before: FixtureSettings = { width: 10, title: "Chart", layers: [{ id: "a", x: 0 }] };
  const after: FixtureSettings = { ...before, width: 12, layers: [{ id: "a", x: 2 }] };
  const command = createSettingsHistoryCommand(before, after, "Move layer");

  assert.ok(command);
  assert.equal(command.label, "Move layer");
  assert.deepEqual(command.patches.map((patch) => patch.key), ["width", "layers"]);
  assert.deepEqual(applySettingsHistoryCommand(after, command, "undo"), before);
  assert.deepEqual(applySettingsHistoryCommand(before, command, "redo"), after);
});

test("history byte pruning keeps the newest command", () => {
  const first = createSettingsHistoryCommand(
    { value: "a" },
    { value: "a".repeat(200) },
    "First",
  );
  const second = createSettingsHistoryCommand(
    { value: "b" },
    { value: "b".repeat(200) },
    "Second",
  );
  assert.ok(first);
  assert.ok(second);

  const bounded = boundSettingsHistory([first, second], 80, second.estimatedBytes + 1);
  assert.deepEqual(bounded.map((command) => command.label), ["Second"]);
});

test("history ignores structurally equal arrays recreated by normalization", () => {
  const before: FixtureSettings = { width: 10, title: "Chart", layers: [{ id: "a", x: 0 }] };
  const after: FixtureSettings = { ...before, layers: [{ id: "a", x: 0 }] };
  assert.equal(createSettingsHistoryCommand(before, after), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_COMMAND_CANVAS_POD_IDS,
  COMMAND_CANVAS_ACTIVE_DOCKS,
  COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
  COMMAND_CANVAS_DOCK_GAP,
  COMMAND_CANVAS_DOCK_SNAP_DISTANCE,
  COMMAND_CANVAS_LAYOUT_STORAGE_KEY,
  clampCommandCanvasPodSize,
  commandCanvasRectsConflict,
  commandCanvasCommandScore,
  createCommandCanvasDesktopGeometry,
  createDefaultCommandCanvasLayout,
  deserializeCommandCanvasLayout,
  detectCommandCanvasDockSnap,
  findCommandCanvasPodCollision,
  filterCommandCanvasCommands,
  placeCommandCanvasPod,
  quantizeCommandCanvasCoordinate,
  repairCommandCanvasDesktopLayout,
  resolveCommandCanvasPodAnchor,
  resolveCommandCanvasPodPlacement,
  serializeCommandCanvasLayout,
  type CommandCanvasCommand,
} from "./command-canvas.ts";

test("command canvas renders four modules while retaining the five-slot v1 layout", () => {
  const layout = createDefaultCommandCanvasLayout();

  assert.equal(COMMAND_CANVAS_LAYOUT_STORAGE_KEY, "gpm.editor.command-canvas.layout.v1");
  assert.deepEqual(ACTIVE_COMMAND_CANVAS_POD_IDS, ["tools", "scene", "navigator", "focus"]);
  assert.deepEqual(layout, {
    version: 1,
    modules: {
      tools: { dock: "tool-spine" },
      scene: { dock: "left-main" },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-top" },
      focus: { dock: "right-main" },
    },
    collapsed: [],
  });
});

test("layout deserialization repairs malformed modules and normalizes floating coordinates", () => {
  const layout = deserializeCommandCanvasLayout(JSON.stringify({
    version: 1,
    modules: {
      scene: { dock: "floating", x: 163, y: 155 },
      selection: { dock: "nowhere", x: 20, y: 30 },
      navigator: { dock: "right-top", x: Number.NaN, y: 110, width: 320, height: 204 },
      focus: null,
    },
    collapsed: ["scene", "scene", "selection", "focus", "unknown"],
  }));

  assert.deepEqual(layout.modules.tools, { dock: "tool-spine" });
  assert.deepEqual(layout.modules.scene, { dock: "floating", x: 160, y: 152 });
  assert.deepEqual(layout.modules.selection, { dock: "left-lower" });
  assert.deepEqual(layout.modules.navigator, {
    dock: "right-top",
    y: 112,
    width: 320,
    height: 204,
  });
  assert.deepEqual(layout.modules.focus, { dock: "right-main" });
  assert.deepEqual(layout.collapsed, ["scene", "selection", "focus"]);
  assert.deepEqual(deserializeCommandCanvasLayout(serializeCommandCanvasLayout(layout)), layout);
});

test("legacy selection placement remains round-trippable but is not an active module", () => {
  const legacyLayout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "tool-spine" },
      scene: { dock: "left-main" },
      selection: {
        dock: "floating",
        x: 176,
        y: 592,
        width: 320,
        height: 192,
      },
      navigator: { dock: "right-top" },
      focus: { dock: "right-main", width: 380, height: 580 },
    },
    collapsed: ["selection"],
  });

  assert.equal((ACTIVE_COMMAND_CANVAS_POD_IDS as readonly string[]).includes("selection"), false);
  assert.deepEqual(legacyLayout.modules.selection, {
    dock: "floating",
    x: 176,
    y: 592,
    width: 320,
    height: 192,
  });
  assert.deepEqual(legacyLayout.modules.focus, {
    dock: "right-main",
    width: 380,
    height: 580,
  });
  assert.deepEqual(legacyLayout.collapsed, ["selection"]);
  assert.deepEqual(
    deserializeCommandCanvasLayout(serializeCommandCanvasLayout(legacyLayout)),
    legacyLayout,
  );
});

test("desktop horizontal collapse persists as an opt-in edge-tab direction", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "tool-spine" },
      scene: { dock: "left-main" },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-top" },
      focus: { dock: "right-main" },
    },
    collapsed: ["scene"],
    collapseDirections: {
      scene: "horizontal",
      focus: "horizontal",
    },
  });

  assert.deepEqual(layout.collapsed, ["scene"]);
  assert.deepEqual(layout.collapseDirections, { scene: "horizontal" });
  assert.deepEqual(deserializeCommandCanvasLayout(serializeCommandCanvasLayout(layout)), layout);
});

test("invalid or incompatible layout values fall back without sharing mutable defaults", () => {
  const first = deserializeCommandCanvasLayout("{broken");
  const second = deserializeCommandCanvasLayout({ version: 2, modules: {}, collapsed: [] });

  first.modules.scene.dock = "floating";
  first.collapsed.push("scene");

  assert.deepEqual(second.modules.scene, { dock: "left-main" });
  assert.deepEqual(second.collapsed, []);
});

test("responsive placement restores semantic docks below desktop without deleting customization", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "right-top", width: 180, height: 420 },
      scene: { dock: "floating", x: 240, y: 192 },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-top" },
      focus: { dock: "right-main" },
    },
    collapsed: [],
  });

  assert.deepEqual(resolveCommandCanvasPodPlacement(layout, "scene", 1180), { dock: "left-main" });
  assert.deepEqual(resolveCommandCanvasPodPlacement(layout, "tools", 1180), { dock: "tool-spine" });
  assert.deepEqual(resolveCommandCanvasPodPlacement(layout, "scene", 1536), {
    dock: "floating",
    x: 240,
    y: 192,
  });
  assert.deepEqual(layout.modules.scene, { dock: "floating", x: 240, y: 192 });
});

test("layout deserialization preserves valid pod dimensions and rejects invalid sizes", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "floating", x: 40, y: 136, width: 88, height: 572 },
      scene: { dock: "left-main", width: 360, height: 520 },
      selection: { dock: "left-lower", width: 0, height: -12 },
      navigator: { dock: "right-top", width: Number.NaN, height: Number.POSITIVE_INFINITY },
      focus: { dock: "right-main", width: 448, height: 640 },
    },
    collapsed: ["tools"],
  });

  assert.deepEqual(layout.modules.tools, {
    dock: "floating",
    x: 40,
    y: 136,
    width: 88,
    height: 572,
  });
  assert.deepEqual(layout.modules.scene, { dock: "left-main", width: 360, height: 520 });
  assert.deepEqual(layout.modules.selection, { dock: "left-lower" });
  assert.deepEqual(layout.modules.navigator, { dock: "right-top" });
  assert.deepEqual(layout.modules.focus, { dock: "right-main", width: 448, height: 640 });
  assert.deepEqual(layout.collapsed, ["tools"]);
});

test("active desktop docks are exclusive while the legacy Selection slot remains readable", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "right-top" },
      scene: { dock: "right-top" },
      selection: { dock: "left-lower", x: 152, y: 488 },
      navigator: { dock: "right-top" },
      focus: { dock: "right-top" },
    },
    collapsed: [],
  });

  assert.deepEqual(COMMAND_CANVAS_ACTIVE_DOCKS, ["tool-spine", "left-main", "right-top", "right-main"]);
  assert.equal(layout.modules.navigator.dock, "right-top");
  assert.equal(layout.modules.tools.dock, "tool-spine");
  assert.equal(layout.modules.scene.dock, "left-main");
  assert.equal(layout.modules.focus.dock, "right-main");
  assert.deepEqual(layout.modules.selection, { dock: "left-lower", x: 152, y: 488 });
});

test("desktop geometry packs left and right lanes with the shared twelve-pixel gutter", () => {
  const geometry = createCommandCanvasDesktopGeometry(createDefaultCommandCanvasLayout(), {
    viewportSize: { width: 1920, height: 1080 },
    podSizes: {
      tools: { width: 68, height: 500 },
      scene: { width: 400, height: 976 },
      navigator: { width: 356, height: 116 },
      focus: { width: 430, height: 844 },
    },
  });

  assert.equal(COMMAND_CANVAS_DOCK_GAP, 12);
  assert.deepEqual(geometry.scene.rect, { x: 12, y: 92, width: 400, height: 976 });
  assert.deepEqual(geometry.tools.rect, { x: 424, y: 92, width: 68, height: 500 });
  assert.deepEqual(geometry.navigator.rect, { x: 1552, y: 96, width: 356, height: 116 });
  assert.deepEqual(geometry.focus.rect, { x: 1478, y: 224, width: 430, height: 844 });
  assert.equal(geometry.scene.rect.y + geometry.scene.rect.height, 1_068);
  assert.equal(geometry.focus.rect.y + geometry.focus.rect.height, 1_068);
  assert.equal(geometry.scene.anchor, "left");
  assert.equal(geometry.focus.anchor, "right");
});

test("a swapped right-top pod leaves room for the right-main counterpart", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "tool-spine" },
      scene: { dock: "left-main" },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-main" },
      focus: { dock: "right-top", height: 900 },
    },
    collapsed: [],
  });
  const geometry = createCommandCanvasDesktopGeometry(layout, {
    viewportSize: { width: 1920, height: 1080 },
    podSizes: {
      tools: { width: 68, height: 500 },
      scene: { width: 400, height: 860 },
      navigator: { width: 356, height: 116 },
      focus: { width: 430, height: 900 },
    },
  });

  assert.equal(geometry.focus.rect.height, 844);
  assert.equal(geometry.navigator.rect.y, 952);
  assert.equal(geometry.navigator.rect.y + geometry.navigator.rect.height, 1068);
});

test("restored left-side widths yield to a wider right dock instead of overlapping it", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "tool-spine", width: 320 },
      scene: { dock: "left-main", width: 560 },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-top" },
      focus: { dock: "right-main", width: 720 },
    },
    collapsed: [],
  });
  const geometry = createCommandCanvasDesktopGeometry(layout, {
    viewportSize: { width: 1280, height: 900 },
    podSizes: {
      tools: { width: 320, height: 500 },
      scene: { width: 560, height: 760 },
      navigator: { width: 356, height: 116 },
      focus: { width: 720, height: 640 },
    },
    podMinimumSizes: {
      tools: { width: 56, height: 300 },
      scene: { width: 260, height: 220 },
      navigator: { width: 260, height: 88 },
      focus: { width: 340, height: 340 },
    },
  });

  assert.deepEqual(geometry.scene.rect, { x: 12, y: 92, width: 456, height: 760 });
  assert.deepEqual(geometry.tools.rect, { x: 480, y: 92, width: 56, height: 500 });
  assert.equal(geometry.focus.rect.x, 548);
  assert.equal(geometry.tools.rect.x + geometry.tools.rect.width + COMMAND_CANVAS_DOCK_GAP, geometry.focus.rect.x);
});

test("valid legacy floating positions retain their physical point while new anchors preserve resize direction", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "tool-spine" },
      scene: { dock: "floating", x: 196, y: 184, width: 400, height: 500 },
      selection: { dock: "left-lower" },
      navigator: { dock: "right-top" },
      focus: { dock: "floating", anchor: "right", right: 24, y: 240, width: 430, height: 400 },
    },
    collapsed: [],
  });
  const geometry = createCommandCanvasDesktopGeometry(layout, {
    viewportSize: { width: 1440, height: 900 },
    podSizes: {
      tools: { width: 68, height: 500 },
      scene: { width: 400, height: 500 },
      navigator: { width: 356, height: 116 },
      focus: { width: 430, height: 400 },
    },
  });

  assert.equal(resolveCommandCanvasPodAnchor(layout.modules.scene, "scene"), "left");
  assert.equal(resolveCommandCanvasPodAnchor(layout.modules.focus, "focus"), "right");
  assert.deepEqual(geometry.scene.rect, { x: 200, y: 184, width: 400, height: 500 });
  assert.deepEqual(geometry.focus.rect, { x: 974, y: 240, width: 430, height: 400 });
});

test("restored floating collisions return the affected docks to safe semantic slots", () => {
  const layout = deserializeCommandCanvasLayout({
    version: 1,
    modules: {
      tools: { dock: "floating", x: 344, y: 88, width: 56, height: 400 },
      scene: { dock: "floating", x: 16, y: 88, width: 312, height: 635 },
      selection: { dock: "left-lower" },
      navigator: { dock: "floating", anchor: "right", right: 188, y: 272 },
      focus: { dock: "floating", anchor: "right", right: 372, y: 120, width: 344, height: 504 },
    },
    collapsed: [],
  });
  const options = {
    viewportSize: { width: 1360, height: 768 },
    podSizes: {
      tools: { width: 56, height: 400 },
      scene: { width: 312, height: 635 },
      navigator: { width: 356, height: 116 },
      focus: { width: 344, height: 504 },
    },
  };

  const repaired = repairCommandCanvasDesktopLayout(layout, options);
  const geometry = createCommandCanvasDesktopGeometry(repaired, options);

  assert.deepEqual(repaired.modules.tools, layout.modules.tools);
  assert.deepEqual(repaired.modules.scene, layout.modules.scene);
  assert.deepEqual(repaired.modules.navigator, { dock: "right-top" });
  assert.deepEqual(repaired.modules.focus, { dock: "right-main", width: 344, height: 504 });
  for (const podId of ACTIVE_COMMAND_CANVAS_POD_IDS) {
    for (const peerId of ACTIVE_COMMAND_CANVAS_POD_IDS) {
      if (podId >= peerId) continue;
      assert.equal(commandCanvasRectsConflict(geometry[podId].rect, geometry[peerId].rect), false);
    }
  }
});

test("collision helpers enforce the gutter and select the strongest free-floating swap target", () => {
  const moving = { x: 100, y: 100, width: 120, height: 120 };
  assert.equal(
    commandCanvasRectsConflict(moving, { x: 232, y: 100, width: 80, height: 80 }),
    false,
  );
  assert.equal(
    commandCanvasRectsConflict(moving, { x: 231, y: 100, width: 80, height: 80 }),
    true,
  );
  assert.deepEqual(
    findCommandCanvasPodCollision(moving, [
      { podId: "tools", rect: { x: 190, y: 190, width: 80, height: 80 } },
      { podId: "focus", rect: { x: 150, y: 150, width: 120, height: 120 } },
    ]),
    {
      podId: "focus",
      rect: { x: 150, y: 150, width: 120, height: 120 },
      overlapArea: 4900,
    },
  );
});

test("pod placement quantizes movement and clamps every edge to safe viewport insets", () => {
  assert.equal(quantizeCommandCanvasCoordinate(163), 160);
  assert.equal(quantizeCommandCanvasCoordinate(165), 168);
  assert.equal(quantizeCommandCanvasCoordinate(-13), -16);

  assert.deepEqual(
    placeCommandCanvasPod(
      { x: 1_500, y: -11 },
      { width: 296, height: 416 },
      { width: 1_536, height: 1_024 },
      { top: 16, right: 24, bottom: 32, left: 24 },
    ),
    { x: 1_216, y: 16 },
  );

  assert.deepEqual(
    placeCommandCanvasPod(
      { x: 200, y: 200 },
      { width: 600, height: 500 },
      { width: 390, height: 440 },
      8,
    ),
    { x: 8, y: 8 },
  );

  assert.deepEqual(
    placeCommandCanvasPod(
      { x: 400, y: 1_000 },
      { width: 300, height: 420 },
      { width: 1_440, height: 900 },
      COMMAND_CANVAS_DESKTOP_SAFE_INSETS,
    ),
    { x: 400, y: 468 },
  );
});

test("pod size clamping applies independent horizontal and vertical constraints", () => {
  assert.deepEqual(
    clampCommandCanvasPodSize(
      { width: 180, height: 900 },
      { width: 240, height: 160 },
      { width: 560, height: 720 },
    ),
    { width: 240, height: 720 },
  );

  assert.deepEqual(
    clampCommandCanvasPodSize(
      { width: Number.NaN, height: 360 },
      { width: 68, height: 120 },
      { width: 240, height: 640 },
    ),
    { width: 68, height: 360 },
  );
});

test("magnetic docking chooses the nearest target inside twenty-four pixels", () => {
  const targets = [
    { dock: "tool-spine" as const, x: 40, y: 136 },
    { dock: "left-main" as const, x: 160, y: 158 },
    { dock: "left-lower" as const, x: 160, y: 586 },
  ];

  assert.deepEqual(detectCommandCanvasDockSnap({ x: 48, y: 152 }, targets), {
    dock: "tool-spine",
    x: 40,
    y: 136,
    distance: Math.hypot(8, 16),
  });
  assert.equal(
    detectCommandCanvasDockSnap(
      { x: 160 + COMMAND_CANVAS_DOCK_SNAP_DISTANCE + 1, y: 158 },
      targets,
    ),
    null,
  );
});

function commands(): CommandCanvasCommand[] {
  return [
    {
      id: "export-png",
      label: "Export PNG",
      group: "Export",
      keywords: ["download raster image", "save png"],
      run() {},
    },
    {
      id: "save-project",
      label: "Save project",
      group: "Document",
      shortcut: "Ctrl S",
      run() {},
    },
    {
      id: "toggle-grid",
      label: "Toggle grid numbers",
      group: "View",
      keywords: ["canvas numbering"],
      run() {},
    },
    {
      id: "crop-selection",
      label: "Crop selection",
      group: "Selection",
      keywords: ["frame source"],
      run() {},
    },
  ];
}

test("command filtering prioritizes exact labels, then prefixes, and keeps stable ties", () => {
  const source = commands();

  assert.equal(commandCanvasCommandScore(source[0], "export png") > commandCanvasCommandScore(source[0], "png"), true);
  assert.deepEqual(filterCommandCanvasCommands(source, "save").map((command) => command.id), [
    "save-project",
    "export-png",
  ]);
  assert.deepEqual(filterCommandCanvasCommands(source, "", 2).map((command) => command.id), [
    "export-png",
    "save-project",
  ]);
});

test("command filtering matches multi-token keywords and rejects partial unrelated results", () => {
  const source = commands();

  assert.deepEqual(filterCommandCanvasCommands(source, "canvas number").map((command) => command.id), [
    "toggle-grid",
  ]);
  assert.deepEqual(filterCommandCanvasCommands(source, "frame crop").map((command) => command.id), [
    "crop-selection",
  ]);
  assert.deepEqual(filterCommandCanvasCommands(source, "database schema"), []);
  assert.deepEqual(filterCommandCanvasCommands(source, "export", 0), []);
});

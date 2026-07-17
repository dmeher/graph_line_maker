import assert from "node:assert/strict";
import test from "node:test";
import {
  clearEditorSessionDrafts,
  createEditorSessionDraft,
  editorSessionDraftKey,
  readEditorSessionDraft,
  writeEditorSessionDraft,
} from "./session-draft.ts";
import type { GraphSettings } from "../types.ts";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function settingsFixture(url = "https://example.test/source.svg"): GraphSettings {
  return {
    graphWidth: 10,
    graphHeight: 12,
    cellWidth: 40,
    cellHeight: 40,
    cellSizeCm: 1,
    measurementUnit: "cm",
    printPaperSize: "a4",
    printOrientation: "auto",
    printHorizontalAlignment: "center",
    printVerticalAlignment: "center",
    pixelSize: 40,
    gridCellSize: 40,
    outputWidth: 400,
    outputHeight: 480,
    backgroundColor: "#ffffff",
    lineColor: "#111827",
    outlineColor: "#111827",
    fillColor: "transparent",
    fillRegions: {},
    imageLineThickness: 3,
    sourceFillThreshold: 0.58,
    sourceFillMinStrokePixels: 7,
    strokeGapClosePixels: 0,
    imageAutoEnhance: false,
    imageDenoiseLevel: "off",
    imageEdgeDetection: "standard",
    imageColorQuantization: "off",
    imageTraceEngine: "default",
    vectorizerStrokeWidth: 3,
    vectorizerStrokeColor: "#111827",
    vectorizerLineAdjust: 0,
    vectorizerInkThreshold: 210,
    vectorizerFidelity: "exact",
    gridLineColor: "#94a3b8",
    gridLineLayer: "front",
    gridLineStyle: "solid",
    gridPattern: "square",
    gridLineThickness: 1,
    showBorder: true,
    transparentBackground: false,
    showNumbers: true,
    gridNumberPlacement: "inside",
    showPageBreaks: true,
    majorGridEvery: 5,
    imageWidth: 8,
    imageHeight: 10,
    sourceImages: [
      {
        id: "original",
        name: "Source",
        path: "user/project/source.svg",
        url,
        width: 8,
        height: 10,
        measurementUnit: "cm",
        imageLineThickness: 3,
        sourceFillThreshold: 0.58,
        sourceFillMinStrokePixels: 7,
        strokeGapClosePixels: 0,
        imageAutoEnhance: false,
        imageDenoiseLevel: "off",
        imageEdgeDetection: "standard",
        imageColorQuantization: "off",
        vectorizerLineAdjust: 0,
        vectorizerInkThreshold: 210,
        vectorizerFidelity: "exact",
        x: 1,
        y: 0,
        topPadding: 0,
        bottomPadding: 0,
        locked: false,
        visible: true,
        rotationDegrees: 0,
        flipX: false,
        flipY: false,
      },
    ],
    cellPaints: [],
    graphShapes: [],
    clipartAssets: [],
    clipartImages: [],
    imagePadding: 0,
    imageOffsetX: 0,
    imageOffsetY: 0,
    spotPadding: 0,
    spotShape: "round",
    pageMargin: 24,
    blackAndWhite: false,
    limitedColorMode: true,
    maxColors: 8,
  };
}

test("session draft stores JSON without source URLs and restores current signed URLs", () => {
  const storage = new MemoryStorage();
  const settings = settingsFixture("blob:https://example.test/local");
  const baseSettings = settingsFixture("https://signed.example.test/current");
  const draft = createEditorSessionDraft({
    projectId: "project-1",
    title: "Draft title",
    description: "Draft description",
    settings,
    palette: [{ name: "Outline", hex: "#111827", locked: true, cellCount: 12, sortOrder: 4 }],
    width: 400,
    height: 480,
    colorCount: 1,
    savedAt: "2026-07-07T12:00:00.000Z",
  });

  writeEditorSessionDraft(draft, storage);

  const raw = storage.getItem(editorSessionDraftKey("project-1"));
  assert.ok(raw);
  assert.equal(JSON.parse(raw).settings.sourceImages[0].url, null);

  const restored = readEditorSessionDraft("project-1", "2026-07-07T11:59:00.000Z", baseSettings, storage);
  assert.ok(restored);
  assert.equal(restored.title, "Draft title");
  assert.equal(restored.settings.sourceImages[0].url, "https://signed.example.test/current");
  assert.equal(restored.palette[0].sortOrder, 0);
});

test("session draft restore ignores drafts older than the database project", () => {
  const storage = new MemoryStorage();
  const settings = settingsFixture();
  const draft = createEditorSessionDraft({
    projectId: "project-1",
    title: "Old draft",
    description: "",
    settings,
    palette: [],
    width: 400,
    height: 480,
    colorCount: 0,
    savedAt: "2026-07-07T10:00:00.000Z",
  });

  writeEditorSessionDraft(draft, storage);

  const restored = readEditorSessionDraft("project-1", "2026-07-07T11:00:00.000Z", settings, storage);
  assert.equal(restored, null);
});

test("logout cleanup removes every editor draft without deleting unrelated preferences", () => {
  const storage = new MemoryStorage();
  storage.setItem(editorSessionDraftKey("project-1"), "one");
  storage.setItem(editorSessionDraftKey("project-2"), "two");
  storage.setItem("graph-pixel-maker:workspace-tab", "layers");

  clearEditorSessionDrafts(storage);

  assert.equal(storage.getItem(editorSessionDraftKey("project-1")), null);
  assert.equal(storage.getItem(editorSessionDraftKey("project-2")), null);
  assert.equal(storage.getItem("graph-pixel-maker:workspace-tab"), "layers");
});

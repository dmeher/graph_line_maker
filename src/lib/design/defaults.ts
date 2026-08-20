import { DEFAULT_DESIGN_ADJUSTMENTS, DESIGN_DOCUMENT_VERSION, type DesignDocumentV1, type DesignImageNode, type DesignNodeBase, type DesignShapeNode } from "./types.ts";

export const BUILT_IN_DESIGN_TEMPLATES = [
  { id: "blank", title: "Blank", width: 1200, height: 1200, description: "Flexible square canvas" },
  { id: "square", title: "Square", width: 1080, height: 1080, description: "Social square" },
  { id: "portrait", title: "Portrait", width: 1080, height: 1350, description: "Portrait composition" },
  { id: "landscape", title: "Landscape", width: 1920, height: 1080, description: "Wide composition" },
  { id: "a4", title: "A4", width: 2480, height: 3508, description: "A4 at 300 DPI" },
  { id: "two-panel", title: "Two panel", width: 1600, height: 900, description: "Side-by-side layout" },
  { id: "four-panel", title: "Four panel", width: 1600, height: 1600, description: "Four-part layout" },
] as const;

export function createBlankDesignDocument(width = 1200, height = 1200, background: string | null = "#ffffff"): DesignDocumentV1 {
  return { version: DESIGN_DOCUMENT_VERSION, canvas: { width, height, background }, nodes: [] };
}

export function createBuiltInDesignDocument(templateId: string) {
  const template = BUILT_IN_DESIGN_TEMPLATES.find((item) => item.id === templateId) ?? BUILT_IN_DESIGN_TEMPLATES[0];
  const document = createBlankDesignDocument(template.width, template.height, "#ffffff");
  if (template.id !== "two-panel" && template.id !== "four-panel") return document;
  const gap = 32; const columns = 2; const rows = template.id === "four-panel" ? 2 : 1;
  const panelWidth = (template.width - gap * (columns + 1)) / columns; const panelHeight = (template.height - gap * (rows + 1)) / rows;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const base = createBaseDesignNode(`Panel ${row * columns + column + 1}`, panelWidth, panelHeight, gap + column * (panelWidth + gap), gap + row * (panelHeight + gap));
    const panel: DesignShapeNode = { ...base, type: "shape", shape: "rectangle", points: [], fill: "transparent", stroke: "#98a2b3", strokeWidth: 3, dash: [12, 8], cornerRadius: 0, shadowColor: "transparent", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0 };
    document.nodes.push(panel);
  }
  return document;
}

export function createBaseDesignNode(name: string, width: number, height: number, x = 0, y = 0): DesignNodeBase {
  return { id: crypto.randomUUID(), name, x, y, width, height, rotation: 0, flipX: false, flipY: false, opacity: 1, blendMode: "normal", visible: true, locked: false, parentId: null };
}

export function createDesignImageNode(input: { fileId: string; name: string; width: number; height: number; x?: number; y?: number }): DesignImageNode {
  return { ...createBaseDesignNode(input.name, input.width, input.height, input.x, input.y), type: "image", fileId: input.fileId, crop: { x: 0, y: 0, width: 1, height: 1 }, masks: [], adjustments: { ...DEFAULT_DESIGN_ADJUSTMENTS } };
}

export const COMMAND_CANVAS_LAYOUT_STORAGE_KEY = "gpm.editor.command-canvas.layout.v1";
export const COMMAND_CANVAS_LAYOUT_VERSION = 1 as const;
export const COMMAND_CANVAS_MOVEMENT_GRID = 8;
export const COMMAND_CANVAS_DOCK_SNAP_DISTANCE = 24;
export const COMMAND_CANVAS_DESKTOP_FLOATING_MIN_WIDTH = 1280;
export const COMMAND_CANVAS_DESKTOP_SAFE_INSETS = Object.freeze({
  top: 88,
  right: 12,
  bottom: 12,
  left: 12,
});

export const COMMAND_CANVAS_POD_IDS = ["tools", "scene", "selection", "navigator", "focus"] as const;
/**
 * Modules rendered by the current Command Canvas chrome. `selection` remains
 * in COMMAND_CANVAS_POD_IDS so version-1 presentation payloads round-trip
 * without data loss, but its controls now live inside Focus.
 */
export const ACTIVE_COMMAND_CANVAS_POD_IDS = ["tools", "scene", "navigator", "focus"] as const;
export const COMMAND_CANVAS_DOCKS = [
  "tool-spine",
  "left-main",
  "left-lower",
  "right-top",
  "right-main",
  "floating",
] as const;

export type PodId = (typeof COMMAND_CANVAS_POD_IDS)[number];
export type ActivePodId = (typeof ACTIVE_COMMAND_CANVAS_POD_IDS)[number];
export type PodDock = (typeof COMMAND_CANVAS_DOCKS)[number];
export type DockedPodPlacement = Exclude<PodDock, "floating">;

export type PodPlacement = {
  dock: PodDock;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type CommandCanvasLayout = {
  version: typeof COMMAND_CANVAS_LAYOUT_VERSION;
  modules: Record<PodId, PodPlacement>;
  collapsed: PodId[];
};

export type CommandCanvasPoint = {
  x: number;
  y: number;
};

export type CommandCanvasSize = {
  width: number;
  height: number;
};

export type CommandCanvasInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type CommandCanvasDockTarget = CommandCanvasPoint & {
  dock: DockedPodPlacement;
};

export type CommandCanvasDockSnap = CommandCanvasDockTarget & {
  distance: number;
};

export type CommandCanvasCommand = {
  id: string;
  label: string;
  group: string;
  keywords?: string | readonly string[];
  shortcut?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

const DEFAULT_MODULES: Record<PodId, PodPlacement> = {
  tools: { dock: "tool-spine" },
  scene: { dock: "left-main" },
  selection: { dock: "left-lower" },
  navigator: { dock: "right-top" },
  focus: { dock: "right-main" },
};

export function createDefaultCommandCanvasLayout(): CommandCanvasLayout {
  return {
    version: COMMAND_CANVAS_LAYOUT_VERSION,
    modules: {
      tools: { ...DEFAULT_MODULES.tools },
      scene: { ...DEFAULT_MODULES.scene },
      selection: { ...DEFAULT_MODULES.selection },
      navigator: { ...DEFAULT_MODULES.navigator },
      focus: { ...DEFAULT_MODULES.focus },
    },
    collapsed: [],
  };
}

export const DEFAULT_COMMAND_CANVAS_LAYOUT = createDefaultCommandCanvasLayout();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPodId(value: unknown): value is PodId {
  return typeof value === "string" && (COMMAND_CANVAS_POD_IDS as readonly string[]).includes(value);
}

function isPodDock(value: unknown): value is PodDock {
  return typeof value === "string" && (COMMAND_CANVAS_DOCKS as readonly string[]).includes(value);
}

function finiteCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? quantizeCommandCanvasCoordinate(value)
    : undefined;
}

function finiteDimension(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function normalizePodPlacement(value: unknown, fallback: PodPlacement): PodPlacement {
  if (!isRecord(value) || !isPodDock(value.dock)) return { ...fallback };

  const x = finiteCoordinate(value.x);
  const y = finiteCoordinate(value.y);
  const width = finiteDimension(value.width);
  const height = finiteDimension(value.height);
  return {
    dock: value.dock,
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  };
}

/**
 * Deserializes user-owned presentation state without allowing malformed local
 * storage values to make any editor module unreachable.
 */
export function deserializeCommandCanvasLayout(value: unknown): CommandCanvasLayout {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return createDefaultCommandCanvasLayout();
    }
  }

  if (!isRecord(parsed) || parsed.version !== COMMAND_CANVAS_LAYOUT_VERSION || !isRecord(parsed.modules)) {
    return createDefaultCommandCanvasLayout();
  }

  const collapsed = Array.isArray(parsed.collapsed)
    ? [...new Set(parsed.collapsed.filter(isPodId))]
    : [];

  return {
    version: COMMAND_CANVAS_LAYOUT_VERSION,
    modules: {
      tools: normalizePodPlacement(parsed.modules.tools, DEFAULT_MODULES.tools),
      scene: normalizePodPlacement(parsed.modules.scene, DEFAULT_MODULES.scene),
      selection: normalizePodPlacement(parsed.modules.selection, DEFAULT_MODULES.selection),
      navigator: normalizePodPlacement(parsed.modules.navigator, DEFAULT_MODULES.navigator),
      focus: normalizePodPlacement(parsed.modules.focus, DEFAULT_MODULES.focus),
    },
    collapsed,
  };
}

export function serializeCommandCanvasLayout(layout: CommandCanvasLayout) {
  return JSON.stringify(deserializeCommandCanvasLayout(layout));
}

/**
 * Desktop placements and dimensions stay persisted at smaller breakpoints,
 * while callers use each module's semantic responsive dock until the floating
 * desktop composition is restored.
 */
export function resolveCommandCanvasPodPlacement(
  layout: CommandCanvasLayout,
  podId: PodId,
  viewportWidth: number,
): PodPlacement {
  const placement = layout.modules[podId] ?? DEFAULT_MODULES[podId];
  if (viewportWidth < COMMAND_CANVAS_DESKTOP_FLOATING_MIN_WIDTH) {
    return { ...DEFAULT_MODULES[podId] };
  }
  return { ...placement };
}

export function quantizeCommandCanvasCoordinate(value: number, grid = COMMAND_CANVAS_MOVEMENT_GRID) {
  if (!Number.isFinite(value)) return 0;
  const safeGrid = Number.isFinite(grid) && grid > 0 ? grid : COMMAND_CANVAS_MOVEMENT_GRID;
  return Math.round(value / safeGrid) * safeGrid;
}

export function quantizeCommandCanvasPosition(
  point: CommandCanvasPoint,
  grid = COMMAND_CANVAS_MOVEMENT_GRID,
): CommandCanvasPoint {
  return {
    x: quantizeCommandCanvasCoordinate(point.x, grid),
    y: quantizeCommandCanvasCoordinate(point.y, grid),
  };
}

function safeExtent(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeInsets(insets: number | CommandCanvasInsets | undefined): Required<CommandCanvasInsets> {
  if (typeof insets === "number") {
    const inset = safeExtent(insets);
    return { top: inset, right: inset, bottom: inset, left: inset };
  }
  return {
    top: safeExtent(insets?.top ?? 0),
    right: safeExtent(insets?.right ?? 0),
    bottom: safeExtent(insets?.bottom ?? 0),
    left: safeExtent(insets?.left ?? 0),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Constrains both pod dimensions independently. Callers provide per-module
 * limits so compact modules such as Tools and larger content pods can share
 * the same persisted placement model without weakening their own safeguards.
 */
export function clampCommandCanvasPodSize(
  size: CommandCanvasSize,
  minimumSize: CommandCanvasSize,
  maximumSize: CommandCanvasSize,
): CommandCanvasSize {
  const minimumWidth = safeExtent(minimumSize.width);
  const minimumHeight = safeExtent(minimumSize.height);
  const maximumWidth = Math.max(minimumWidth, safeExtent(maximumSize.width));
  const maximumHeight = Math.max(minimumHeight, safeExtent(maximumSize.height));

  return {
    width: clamp(size.width, minimumWidth, maximumWidth),
    height: clamp(size.height, minimumHeight, maximumHeight),
  };
}

export function clampCommandCanvasPodPosition(
  point: CommandCanvasPoint,
  podSize: CommandCanvasSize,
  viewportSize: CommandCanvasSize,
  insets?: number | CommandCanvasInsets,
): CommandCanvasPoint {
  const safeInsets = normalizeInsets(insets);
  const viewportWidth = safeExtent(viewportSize.width);
  const viewportHeight = safeExtent(viewportSize.height);
  const podWidth = safeExtent(podSize.width);
  const podHeight = safeExtent(podSize.height);
  const maximumX = viewportWidth - safeInsets.right - podWidth;
  const maximumY = viewportHeight - safeInsets.bottom - podHeight;

  return {
    x: clamp(point.x, safeInsets.left, maximumX),
    y: clamp(point.y, safeInsets.top, maximumY),
  };
}

export function placeCommandCanvasPod(
  point: CommandCanvasPoint,
  podSize: CommandCanvasSize,
  viewportSize: CommandCanvasSize,
  insets?: number | CommandCanvasInsets,
  grid = COMMAND_CANVAS_MOVEMENT_GRID,
): CommandCanvasPoint {
  return clampCommandCanvasPodPosition(
    quantizeCommandCanvasPosition(point, grid),
    podSize,
    viewportSize,
    insets,
  );
}

/**
 * Returns the nearest magnetic dock target within the configured radius.
 * Target coordinates are the exact top-left landing points for a module.
 */
export function detectCommandCanvasDockSnap(
  point: CommandCanvasPoint,
  targets: readonly CommandCanvasDockTarget[],
  snapDistance = COMMAND_CANVAS_DOCK_SNAP_DISTANCE,
): CommandCanvasDockSnap | null {
  const safeDistance = Number.isFinite(snapDistance)
    ? Math.max(0, snapDistance)
    : COMMAND_CANVAS_DOCK_SNAP_DISTANCE;
  let nearest: CommandCanvasDockSnap | null = null;

  for (const target of targets) {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance > safeDistance || (nearest && distance >= nearest.distance)) continue;
    nearest = {
      dock: target.dock,
      x: target.x,
      y: target.y,
      distance,
    };
  }

  return nearest;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isSubsequence(needle: string, haystack: string) {
  let needleIndex = 0;
  for (let haystackIndex = 0; haystackIndex < haystack.length && needleIndex < needle.length; haystackIndex += 1) {
    if (needle[needleIndex] === haystack[haystackIndex]) needleIndex += 1;
  }
  return needleIndex === needle.length;
}

function tokenFieldScore(token: string, field: string, weight: number) {
  if (!field) return -1;
  if (field === token) return 180 + weight;
  if (field.startsWith(token)) return 145 + weight;
  if (field.split(" ").some((word) => word.startsWith(token))) return 120 + weight;
  if (field.includes(token)) return 85 + weight;
  if (token.length >= 2 && isSubsequence(token, field)) return 35 + weight;
  return -1;
}

/**
 * Scores a command for a fuzzy command-palette query. Every query token must
 * match at least one field, preventing unrelated partial results.
 */
export function commandCanvasCommandScore(command: CommandCanvasCommand, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return 0;

  const label = normalizeSearchValue(command.label);
  const id = normalizeSearchValue(command.id);
  const group = normalizeSearchValue(command.group);
  const shortcut = normalizeSearchValue(command.shortcut ?? "");
  const keywords = (Array.isArray(command.keywords) ? command.keywords : [command.keywords ?? ""])
    .map(normalizeSearchValue)
    .filter(Boolean);
  const fields = [
    { value: label, weight: 60 },
    { value: id, weight: 44 },
    ...keywords.map((value) => ({ value, weight: 36 })),
    { value: group, weight: 18 },
    { value: shortcut, weight: 8 },
  ];

  let score = 0;
  for (const token of normalizedQuery.split(" ")) {
    const tokenScore = fields.reduce(
      (best, field) => Math.max(best, tokenFieldScore(token, field.value, field.weight)),
      -1,
    );
    if (tokenScore < 0) return -1;
    score += tokenScore;
  }

  if (label === normalizedQuery) score += 1_200;
  else if (label.startsWith(normalizedQuery)) score += 800;
  else if (label.includes(normalizedQuery)) score += 400;
  else if (keywords.some((keyword) => keyword === normalizedQuery)) score += 300;

  return score;
}

export function filterCommandCanvasCommands(
  commands: readonly CommandCanvasCommand[],
  query: string,
  limit = 12,
): CommandCanvasCommand[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 12;
  if (safeLimit === 0) return [];

  return commands
    .map((command, index) => ({
      command,
      index,
      score: commandCanvasCommandScore(command, query),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, safeLimit)
    .map((candidate) => candidate.command);
}

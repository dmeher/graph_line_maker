export const COMMAND_CANVAS_LAYOUT_STORAGE_KEY = "gpm.editor.command-canvas.layout.v1";
export const COMMAND_CANVAS_LAYOUT_VERSION = 1 as const;
export const COMMAND_CANVAS_MOVEMENT_GRID = 8;
export const COMMAND_CANVAS_DOCK_SNAP_DISTANCE = 24;
export const COMMAND_CANVAS_DOCK_GAP = 12;
export const COMMAND_CANVAS_DESKTOP_FLOATING_MIN_WIDTH = 1280;
export const COMMAND_CANVAS_DESKTOP_LEFT_DOCK_TOP = 92;
export const COMMAND_CANVAS_DESKTOP_RIGHT_DOCK_TOP = 96;
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
/**
 * The legacy `left-lower` slot is retained in persisted v1 layouts for the
 * retired Selection pod, but no rendered pod may claim it on desktop.
 */
export const COMMAND_CANVAS_ACTIVE_DOCKS = [
  "tool-spine",
  "left-main",
  "right-top",
  "right-main",
] as const;

export type PodId = (typeof COMMAND_CANVAS_POD_IDS)[number];
export type ActivePodId = (typeof ACTIVE_COMMAND_CANVAS_POD_IDS)[number];
export type PodDock = (typeof COMMAND_CANVAS_DOCKS)[number];
export type DockedPodPlacement = Exclude<PodDock, "floating">;
export type ActivePodDock = (typeof COMMAND_CANVAS_ACTIVE_DOCKS)[number];
export type PodHorizontalAnchor = "left" | "right";
export type PodCollapseDirection = "vertical" | "horizontal";

export type PodPlacement = {
  dock: PodDock;
  /** The fixed edge for a floating pod. Omitted v1 records derive it safely. */
  anchor?: PodHorizontalAnchor;
  x?: number;
  y?: number;
  /** Right-side floating offset. `x` remains the compatible left-side offset. */
  right?: number;
  width?: number;
  height?: number;
};

export type CommandCanvasLayout = {
  version: typeof COMMAND_CANVAS_LAYOUT_VERSION;
  modules: Record<PodId, PodPlacement>;
  collapsed: PodId[];
  /** Only stored for the optional desktop edge-tab collapse. */
  collapseDirections?: Partial<Record<PodId, PodCollapseDirection>>;
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

export type CommandCanvasPodRect = CommandCanvasPoint & CommandCanvasSize;

export type CommandCanvasPodGeometry = {
  podId: ActivePodId;
  dock: PodDock;
  anchor: PodHorizontalAnchor;
  rect: CommandCanvasPodRect;
};

export type CommandCanvasDesktopGeometryOptions = {
  viewportSize: CommandCanvasSize;
  podSizes: Record<ActivePodId, CommandCanvasSize>;
  podMinimumSizes?: Partial<Record<ActivePodId, CommandCanvasSize>>;
  insets?: number | CommandCanvasInsets;
  gap?: number;
  leftTop?: number;
  rightTop?: number;
};

export type CommandCanvasPodCollision = {
  podId: ActivePodId;
  rect: CommandCanvasPodRect;
  overlapArea: number;
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

function isPodHorizontalAnchor(value: unknown): value is PodHorizontalAnchor {
  return value === "left" || value === "right";
}

function isPodCollapseDirection(value: unknown): value is PodCollapseDirection {
  return value === "vertical" || value === "horizontal";
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

  const anchor = isPodHorizontalAnchor(value.anchor) ? value.anchor : undefined;
  const x = finiteCoordinate(value.x);
  const y = finiteCoordinate(value.y);
  const right = finiteCoordinate(value.right);
  const width = finiteDimension(value.width);
  const height = finiteDimension(value.height);
  return {
    dock: value.dock,
    ...(anchor === undefined ? {} : { anchor }),
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    ...(right === undefined ? {} : { right }),
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
  const serializedCollapseDirections = isRecord(parsed.collapseDirections)
    ? parsed.collapseDirections
    : null;
  const collapseDirections = serializedCollapseDirections
    ? Object.fromEntries(
        COMMAND_CANVAS_POD_IDS.flatMap((podId) => {
          const direction = serializedCollapseDirections[podId];
          return collapsed.includes(podId) && isPodCollapseDirection(direction)
            ? [[podId, direction]]
            : [];
        }),
      ) as Partial<Record<PodId, PodCollapseDirection>>
    : {};

  return normalizeCommandCanvasActiveDocks({
    version: COMMAND_CANVAS_LAYOUT_VERSION,
    modules: {
      tools: normalizePodPlacement(parsed.modules.tools, DEFAULT_MODULES.tools),
      scene: normalizePodPlacement(parsed.modules.scene, DEFAULT_MODULES.scene),
      selection: normalizePodPlacement(parsed.modules.selection, DEFAULT_MODULES.selection),
      navigator: normalizePodPlacement(parsed.modules.navigator, DEFAULT_MODULES.navigator),
      focus: normalizePodPlacement(parsed.modules.focus, DEFAULT_MODULES.focus),
    },
    collapsed,
    ...(Object.keys(collapseDirections).length > 0 ? { collapseDirections } : {}),
  });
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

export function isActiveCommandCanvasDock(dock: PodDock): dock is ActivePodDock {
  return (COMMAND_CANVAS_ACTIVE_DOCKS as readonly PodDock[]).includes(dock);
}

/**
 * Restores old floating v1 layouts without changing their coordinates. New
 * right-anchored floating layouts persist `right`; old records only carry
 * `x`, which remains a top-left coordinate until the user moves them again.
 */
export function resolveCommandCanvasPodAnchor(
  placement: Pick<PodPlacement, "dock" | "anchor">,
  podId: PodId,
): PodHorizontalAnchor {
  if (placement.dock === "tool-spine" || placement.dock === "left-main" || placement.dock === "left-lower") {
    return "left";
  }
  if (placement.dock === "right-top" || placement.dock === "right-main") {
    return "right";
  }
  if (placement.anchor) return placement.anchor;
  return podId === "navigator" || podId === "focus" ? "right" : "left";
}

/**
 * Active desktop slots are exclusive. This repairs legacy layouts that could
 * persist multiple rendered modules in the same slot while leaving the inert
 * Selection payload untouched for round-tripping.
 */
export function normalizeCommandCanvasActiveDocks(layout: CommandCanvasLayout): CommandCanvasLayout {
  const modules = { ...layout.modules };
  const claimed = new Set<ActivePodDock>();
  const resolutionOrder: ActivePodId[] = ["navigator", "tools", "scene", "focus"];

  for (const podId of resolutionOrder) {
    const placement = modules[podId] ?? DEFAULT_MODULES[podId];
    if (placement.dock === "floating") continue;

    const preferred = isActiveCommandCanvasDock(placement.dock) ? placement.dock : null;
    const fallback = DEFAULT_MODULES[podId].dock as ActivePodDock;
    const nextDock = preferred && !claimed.has(preferred)
      ? preferred
      : !claimed.has(fallback)
        ? fallback
        : COMMAND_CANVAS_ACTIVE_DOCKS.find((dock) => !claimed.has(dock)) ?? fallback;
    claimed.add(nextDock);
    modules[podId] = nextDock === placement.dock ? placement : {
      ...placement,
      dock: nextDock,
    };
  }

  return {
    ...layout,
    modules,
  };
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

function rectangleRight(rect: CommandCanvasPodRect) {
  return rect.x + rect.width;
}

function rectangleBottom(rect: CommandCanvasPodRect) {
  return rect.y + rect.height;
}

/** Returns true when the rectangles touch or cross the requested safety gap. */
export function commandCanvasRectsConflict(
  first: CommandCanvasPodRect,
  second: CommandCanvasPodRect,
  gap = COMMAND_CANVAS_DOCK_GAP,
) {
  const safeGap = safeExtent(gap);
  return first.x < rectangleRight(second) + safeGap
    && rectangleRight(first) + safeGap > second.x
    && first.y < rectangleBottom(second) + safeGap
    && rectangleBottom(first) + safeGap > second.y;
}

export function commandCanvasRectOverlapArea(first: CommandCanvasPodRect, second: CommandCanvasPodRect) {
  const width = Math.max(0, Math.min(rectangleRight(first), rectangleRight(second)) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(rectangleBottom(first), rectangleBottom(second)) - Math.max(first.y, second.y));
  return width * height;
}

/** Picks the strongest collision so free-floating drops can exchange positions. */
export function findCommandCanvasPodCollision(
  moving: CommandCanvasPodRect,
  peers: readonly Pick<CommandCanvasPodGeometry, "podId" | "rect">[],
  gap = COMMAND_CANVAS_DOCK_GAP,
): CommandCanvasPodCollision | null {
  let match: CommandCanvasPodCollision | null = null;
  for (const peer of peers) {
    if (!commandCanvasRectsConflict(moving, peer.rect, gap)) continue;
    const overlapArea = commandCanvasRectOverlapArea(moving, peer.rect);
    if (!match || overlapArea > match.overlapArea) {
      match = { podId: peer.podId, rect: peer.rect, overlapArea };
    }
  }
  return match;
}

/**
 * Computes a normalized desktop geometry before collision repair. Kept
 * separate so stale persisted floating positions can be inspected and
 * deterministically repaired without recursive layout calculation.
 */
function createCommandCanvasDesktopGeometryUnrepaired(
  sourceLayout: CommandCanvasLayout,
  options: CommandCanvasDesktopGeometryOptions,
): Record<ActivePodId, CommandCanvasPodGeometry> {
  const layout = normalizeCommandCanvasActiveDocks(sourceLayout);
  const insets = normalizeInsets(options.insets ?? COMMAND_CANVAS_DESKTOP_SAFE_INSETS);
  const gap = safeExtent(options.gap ?? COMMAND_CANVAS_DOCK_GAP);
  const viewport = {
    width: safeExtent(options.viewportSize.width),
    height: safeExtent(options.viewportSize.height),
  };
  const leftTop = safeExtent(options.leftTop ?? COMMAND_CANVAS_DESKTOP_LEFT_DOCK_TOP);
  const rightTop = safeExtent(options.rightTop ?? COMMAND_CANVAS_DESKTOP_RIGHT_DOCK_TOP);
  const placements = layout.modules;
  const sizes = options.podSizes;
  const slotOwner = new Map<ActivePodDock, ActivePodId>();

  for (const podId of ACTIVE_COMMAND_CANVAS_POD_IDS) {
    const dock = placements[podId].dock;
    if (isActiveCommandCanvasDock(dock)) slotOwner.set(dock, podId);
  }

  const leftMainOwner = slotOwner.get("left-main");
  const toolSpineOwner = slotOwner.get("tool-spine");
  const requestedLeftMainWidth = leftMainOwner ? safeExtent(sizes[leftMainOwner].width) : 0;
  const requestedToolSpineWidth = toolSpineOwner ? safeExtent(sizes[toolSpineOwner].width) : 0;
  const leftMainMinimumWidth = leftMainOwner
    ? safeExtent(options.podMinimumSizes?.[leftMainOwner]?.width ?? 0)
    : 0;
  const toolSpineMinimumWidth = toolSpineOwner
    ? safeExtent(options.podMinimumSizes?.[toolSpineOwner]?.width ?? 0)
    : 0;
  const rightTopOwner = slotOwner.get("right-top");
  const rightMainOwner = slotOwner.get("right-main");
  const requestedRightTopHeight = rightTopOwner ? safeExtent(sizes[rightTopOwner].height) : 0;
  const requestedRightMainHeight = rightMainOwner ? safeExtent(sizes[rightMainOwner].height) : 0;
  const rightTopMinimumHeight = rightTopOwner
    ? safeExtent(options.podMinimumSizes?.[rightTopOwner]?.height ?? 0)
    : 0;
  const rightMainMinimumHeight = rightMainOwner
    ? safeExtent(options.podMinimumSizes?.[rightMainOwner]?.height ?? 0)
    : 0;
  const availableRightHeight = Math.max(0, viewport.height - insets.bottom - rightTop - gap);
  let rightTopHeight = requestedRightTopHeight;
  let rightMainHeight = requestedRightMainHeight;
  if (rightTopOwner && rightMainOwner) {
    if (rightMainOwner === "navigator") {
      rightMainHeight = Math.min(
        requestedRightMainHeight,
        Math.max(rightMainMinimumHeight, availableRightHeight - rightTopMinimumHeight),
      );
      rightTopHeight = Math.min(
        requestedRightTopHeight,
        Math.max(rightTopMinimumHeight, availableRightHeight - rightMainHeight),
      );
    } else {
      rightTopHeight = Math.min(
        requestedRightTopHeight,
        Math.max(rightTopMinimumHeight, availableRightHeight - rightMainMinimumHeight),
      );
      rightMainHeight = Math.min(
        requestedRightMainHeight,
        Math.max(rightMainMinimumHeight, availableRightHeight - rightTopHeight),
      );
    }
  }
  const rightDockLeft = Math.min(
    rightTopOwner ? viewport.width - insets.right - safeExtent(sizes[rightTopOwner].width) : viewport.width - insets.right,
    rightMainOwner ? viewport.width - insets.right - safeExtent(sizes[rightMainOwner].width) : viewport.width - insets.right,
  );
  const availableLeftPairWidth = Math.max(0, rightDockLeft - insets.left - gap * 2);
  let leftMainWidth = requestedLeftMainWidth;
  let toolSpineWidth = requestedToolSpineWidth;
  if (leftMainOwner && toolSpineOwner) {
    leftMainWidth = Math.min(
      requestedLeftMainWidth,
      Math.max(leftMainMinimumWidth, availableLeftPairWidth - toolSpineMinimumWidth),
    );
    toolSpineWidth = Math.min(
      requestedToolSpineWidth,
      Math.max(toolSpineMinimumWidth, availableLeftPairWidth - leftMainWidth),
    );
  }
  const geometry = {} as Record<ActivePodId, CommandCanvasPodGeometry>;

  for (const podId of ACTIVE_COMMAND_CANVAS_POD_IDS) {
    const placement = placements[podId];
    const size = {
      width: safeExtent(sizes[podId].width),
      height: safeExtent(sizes[podId].height),
    };
    if (placement.dock === "left-main" && toolSpineOwner) size.width = leftMainWidth;
    if (placement.dock === "tool-spine" && leftMainOwner) size.width = toolSpineWidth;
    if (placement.dock === "right-top" && rightMainOwner) size.height = rightTopHeight;
    if (placement.dock === "right-main" && rightTopOwner) size.height = rightMainHeight;
    const anchor = resolveCommandCanvasPodAnchor(placement, podId);
    let point: CommandCanvasPoint;

    if (placement.dock === "left-main") {
      point = { x: insets.left, y: leftTop };
    } else if (placement.dock === "tool-spine") {
      point = { x: insets.left + (leftMainWidth ? leftMainWidth + gap : 0), y: leftTop };
    } else if (placement.dock === "right-top") {
      point = { x: viewport.width - insets.right - size.width, y: rightTop };
    } else if (placement.dock === "right-main") {
      point = {
        x: viewport.width - insets.right - size.width,
        y: rightTop + (rightTopHeight ? rightTopHeight + gap : 0),
      };
    } else {
      const right = placement.right ?? (placement.x === undefined
        ? insets.right
        : viewport.width - insets.right - placement.x - size.width);
      point = anchor === "right"
        ? { x: viewport.width - insets.right - right - size.width, y: placement.y ?? leftTop }
        : { x: placement.x ?? insets.left, y: placement.y ?? leftTop };
    }

    const clamped = clampCommandCanvasPodPosition(point, size, viewport, insets);
    geometry[podId] = {
      podId,
      dock: placement.dock,
      anchor,
      rect: { x: clamped.x, y: clamped.y, ...size },
    };
  }

  return geometry;
}

/**
 * Repairs a persisted desktop layout that would reopen with overlapping pods.
 * The conflicting modules return to their semantic slots, retaining their
 * saved dimensions while clearing only stale floating coordinates. This keeps
 * a valid free-floating arrangement intact, but never lets an old layout
 * restore on top of another dock.
 */
export function repairCommandCanvasDesktopLayout(
  sourceLayout: CommandCanvasLayout,
  options: CommandCanvasDesktopGeometryOptions,
): CommandCanvasLayout {
  const layout = normalizeCommandCanvasActiveDocks(sourceLayout);
  const geometry = createCommandCanvasDesktopGeometryUnrepaired(layout, options);
  const collidingPods = new Set<ActivePodId>();
  const activePods = [...ACTIVE_COMMAND_CANVAS_POD_IDS];

  for (let index = 0; index < activePods.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < activePods.length; peerIndex += 1) {
      const podId = activePods[index];
      const peerId = activePods[peerIndex];
      if (commandCanvasRectsConflict(geometry[podId].rect, geometry[peerId].rect, options.gap)) {
        collidingPods.add(podId);
        collidingPods.add(peerId);
      }
    }
  }

  if (collidingPods.size === 0) return layout;

  const modules = { ...layout.modules };
  for (const podId of collidingPods) {
    const { anchor: _anchor, x: _x, y: _y, right: _right, ...dimensions } = modules[podId];
    modules[podId] = {
      ...dimensions,
      dock: DEFAULT_MODULES[podId].dock,
    };
  }

  return normalizeCommandCanvasActiveDocks({ ...layout, modules });
}

/**
 * Computes all desktop positions from one source of truth. Side docks are
 * packed around the configured gap, while valid floating layouts retain their
 * independent coordinates and directional resize anchor.
 */
export function createCommandCanvasDesktopGeometry(
  sourceLayout: CommandCanvasLayout,
  options: CommandCanvasDesktopGeometryOptions,
): Record<ActivePodId, CommandCanvasPodGeometry> {
  return createCommandCanvasDesktopGeometryUnrepaired(
    repairCommandCanvasDesktopLayout(sourceLayout, options),
    options,
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

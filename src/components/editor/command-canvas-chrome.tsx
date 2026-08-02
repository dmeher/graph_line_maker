"use client";

import {
  Check,
  ChevronDown,
  Command,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  Maximize2,
  MoreHorizontal,
  Move,
  PanelTopClose,
  Pin,
  RotateCcw,
  Ruler,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEventHandler,
  type ReactNode,
} from "react";
import {
  filterCommandCanvasCommands,
  type CommandCanvasCommand,
  type PodDock,
  type PodId,
} from "@/lib/editor/command-canvas";
import {
  MAX_CANVAS_ZOOM_PERCENT,
  MIN_CANVAS_ZOOM_PERCENT,
  canvasZoomPercent,
  parseCanvasZoomPercent,
} from "@/lib/editor/canvas-zoom";

export type { CommandCanvasCommand } from "@/lib/editor/command-canvas";

export type CommandCanvasPaletteCommand = CommandCanvasCommand & {
  icon?: LucideIcon;
  description?: string;
};

export type CommandCanvasCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: readonly CommandCanvasPaletteCommand[];
  placeholder?: string;
  emptyMessage?: string;
  maxResults?: number;
};

function nextEnabledCommandIndex(
  commands: readonly CommandCanvasPaletteCommand[],
  currentIndex: number,
  direction: 1 | -1,
) {
  if (commands.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= commands.length; offset += 1) {
    const index = (currentIndex + offset * direction + commands.length) % commands.length;
    if (!commands[index]?.disabled) {
      return index;
    }
  }

  return -1;
}

export const CommandCanvasCommandPalette = memo(function CommandCanvasCommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = "Search tools, panels, actions, and exports",
  emptyMessage = "No matching commands",
  maxResults = 40,
}: CommandCanvasCommandPaletteProps) {
  const dialogTitleId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const results = useMemo(
    () => filterCommandCanvasCommands(commands, query, maxResults),
    [commands, maxResults, query],
  ) as CommandCanvasPaletteCommand[];

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (open && event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [onOpenChange, open]);

  useLayoutEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setQuery("");
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(frame);
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      restoreFocusRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    const firstEnabledIndex = results.findIndex((command) => !command.disabled);
    setActiveIndex(firstEnabledIndex);
  }, [results]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const execute = useCallback((command: CommandCanvasPaletteCommand | undefined) => {
    if (!command || command.disabled) {
      return;
    }

    close();
    void command.run();
  }, [close]);

  const onInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => nextEnabledCommandIndex(results, current, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => nextEnabledCommandIndex(results, current, -1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(results.findIndex((command) => !command.disabled));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      for (let index = results.length - 1; index >= 0; index -= 1) {
        if (!results[index]?.disabled) {
          setActiveIndex(index);
          break;
        }
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      execute(results[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }, [activeIndex, close, execute, results]);

  const onDialogKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'input:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) {
    return null;
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="command-canvas-palette-layer" data-editor-portal="command-palette">
      <button
        type="button"
        className="command-canvas-palette__backdrop"
        onClick={close}
        aria-label="Close command palette"
        tabIndex={-1}
      />
      <section
        className="command-canvas-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        data-editor-region="command-palette"
        onKeyDown={onDialogKeyDown}
      >
        <h2 id={dialogTitleId} className="sr-only">Command palette</h2>
        <div className="command-canvas-palette__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>

        <div className="command-canvas-palette__results" id={listboxId} role="listbox" aria-label="Commands">
          {results.length === 0 ? (
            <div className="command-canvas-palette__empty">
              <Command size={20} aria-hidden="true" />
              <span>{emptyMessage}</span>
            </div>
          ) : results.map((command, index) => {
            const Icon = command.icon;
            const active = index === activeIndex;

            return (
              <button
                key={command.id}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                disabled={command.disabled}
                className={`command-canvas-palette__option ${active ? "is-active" : ""}`}
                onPointerMove={() => {
                  if (!command.disabled) {
                    setActiveIndex(index);
                  }
                }}
                onClick={() => execute(command)}
              >
                <span className="command-canvas-palette__option-icon">
                  {Icon ? <Icon size={17} aria-hidden="true" /> : <Command size={17} aria-hidden="true" />}
                </span>
                <span className="command-canvas-palette__option-copy">
                  <strong>{command.label}</strong>
                  {command.description ? <small>{command.description}</small> : null}
                </span>
                <span className="command-canvas-palette__option-meta">
                  <small>{command.group}</small>
                  {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                </span>
              </button>
            );
          })}
        </div>

        <footer className="command-canvas-palette__footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Run</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </section>
    </div>
  );
});

export const CommandCanvasCommandTrigger = memo(function CommandCanvasCommandTrigger({
  onClick,
  label = "Search commands",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="command-canvas-command-trigger"
      onClick={onClick}
      aria-label="Open command palette"
      aria-haspopup="dialog"
    >
      <Search size={16} aria-hidden="true" />
      <span>{label}</span>
      <kbd aria-hidden="true">Ctrl K</kbd>
    </button>
  );
});

export type CommandCanvasPodId = PodId;
export type CommandCanvasResizeEdge = "bottom-left" | "bottom-right";

export type CommandCanvasPodProps = {
  id: CommandCanvasPodId;
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  dock?: PodDock;
  collapsed?: boolean;
  dragging?: boolean;
  dockPreview?: boolean;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>;
  onHeaderPointerMove?: PointerEventHandler<HTMLDivElement>;
  onHeaderPointerUp?: PointerEventHandler<HTMLDivElement>;
  onHeaderPointerCancel?: PointerEventHandler<HTMLDivElement>;
  onNudge?: (deltaX: number, deltaY: number) => void;
  onRequestDock?: () => void;
  onRequestFloat?: () => void;
  onRequestCollapse?: () => void;
  onRequestReset?: () => void;
  resizeEdge?: CommandCanvasResizeEdge;
  resizeActive?: boolean;
  onResizePointerDown?: PointerEventHandler<HTMLButtonElement>;
  onResizePointerMove?: PointerEventHandler<HTMLButtonElement>;
  onResizePointerUp?: PointerEventHandler<HTMLButtonElement>;
  onResizePointerCancel?: PointerEventHandler<HTMLButtonElement>;
  onResizeNudge?: (deltaWidth: number, deltaHeight: number) => void;
};

const COMMAND_CANVAS_POD_DRAG_THRESHOLD_PX = 5;

type CommandCanvasPodHeaderGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  target: EventTarget;
  dragging: boolean;
};

export const CommandCanvasPod = memo(function CommandCanvasPod({
  id,
  title,
  eyebrow,
  icon: Icon,
  meta,
  children,
  className = "",
  style,
  dock,
  collapsed = false,
  dragging = false,
  dockPreview = false,
  headerContent,
  headerActions,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onHeaderPointerCancel,
  onNudge,
  onRequestDock,
  onRequestFloat,
  onRequestCollapse,
  onRequestReset,
  resizeEdge,
  resizeActive = false,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
  onResizeNudge,
}: CommandCanvasPodProps) {
  const titleId = useId();
  const bodyId = useId();
  const menuId = useId();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const headerGestureRef = useRef<CommandCanvasPodHeaderGesture | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const onMoveKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "Enter" || event.key === " ") && onRequestCollapse) {
      event.preventDefault();
      onRequestCollapse();
      return;
    }

    if (!onNudge) {
      return;
    }

    const step = event.shiftKey ? 24 : 8;
    const deltas: Partial<Record<string, readonly [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];

    if (delta) {
      event.preventDefault();
      onNudge(delta[0], delta[1]);
    }
  };

  const beginHeaderGesture: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      event.button !== 0
      || (event.target as Element).closest("button, input, select, textarea, a, [role='menuitem']")
    ) {
      return;
    }

    headerGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: event.target,
      dragging: false,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveHeaderGesture: PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = headerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (!gesture.dragging) {
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (Math.hypot(deltaX, deltaY) < COMMAND_CANVAS_POD_DRAG_THRESHOLD_PX) {
        return;
      }

      gesture.dragging = true;
      if (onHeaderPointerDown) {
        const delayedPointerDownEvent = Object.create(event) as typeof event;
        Object.defineProperties(delayedPointerDownEvent, {
          button: { value: 0 },
          clientX: { value: gesture.startX },
          clientY: { value: gesture.startY },
          currentTarget: { value: event.currentTarget },
          target: { value: gesture.target },
          preventDefault: { value: () => event.preventDefault() },
        });
        onHeaderPointerDown(delayedPointerDownEvent);
      }
    }

    onHeaderPointerMove?.(event);
  };

  const endHeaderGesture: PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = headerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    headerGestureRef.current = null;
    if (gesture.dragging) {
      onHeaderPointerUp?.(event);
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onRequestCollapse?.();
  };

  const cancelHeaderGesture: PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = headerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    headerGestureRef.current = null;
    if (gesture.dragging) {
      onHeaderPointerCancel?.(event);
    } else if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const runMenuAction = (action: (() => void) | undefined) => {
    setMenuOpen(false);
    action?.();
  };
  const hasMenuActions = Boolean(onRequestDock || onRequestFloat || onRequestCollapse || onRequestReset);
  const headerInteractive = Boolean(onHeaderPointerDown || onNudge || onRequestCollapse);

  return (
    <section
      className={`command-canvas-pod command-canvas-pod--${id} ${collapsed ? "is-collapsed" : ""} ${dragging ? "is-dragging" : ""} ${dockPreview ? "has-dock-preview" : ""} ${className}`}
      style={style}
      aria-labelledby={titleId}
      data-editor-pod={id}
      data-command-canvas-pod={id}
      data-dock={dock}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <header className="command-canvas-pod__header">
        <div
          role={headerInteractive ? "button" : undefined}
          tabIndex={headerInteractive ? 0 : undefined}
          className={`command-canvas-pod__drag-handle ${headerContent ? "has-custom-content" : ""} ${headerInteractive ? "" : "is-static"}`}
          onPointerDown={headerInteractive ? beginHeaderGesture : undefined}
          onPointerMove={headerInteractive ? moveHeaderGesture : undefined}
          onPointerUp={headerInteractive ? endHeaderGesture : undefined}
          onPointerCancel={headerInteractive ? cancelHeaderGesture : undefined}
          onKeyDown={headerInteractive ? onMoveKeyDown : undefined}
          aria-label={headerInteractive
            ? onRequestCollapse
              ? `${collapsed ? "Expand" : "Collapse"} ${title} module. Drag to move or use arrow keys to nudge.`
              : `Move ${title} module. Drag to move or use arrow keys to nudge.`
            : undefined}
          aria-controls={onRequestCollapse ? bodyId : undefined}
          aria-expanded={onRequestCollapse ? !collapsed : undefined}
        >
          {headerContent ? (
            <>
              <span id={titleId} className="sr-only">{title}</span>
              {headerContent}
            </>
          ) : (
            <>
              <span className="command-canvas-pod__heading-icon">
                {Icon ? <Icon size={16} aria-hidden="true" /> : <Move size={16} aria-hidden="true" />}
              </span>
              <span className="command-canvas-pod__heading-copy">
                {eyebrow ? <small>{eyebrow}</small> : null}
                <strong id={titleId}>{title}</strong>
              </span>
              {meta ? <span className="command-canvas-pod__meta">{meta}</span> : null}
            </>
          )}
        </div>

        <div className="command-canvas-pod__header-actions">
          {headerActions}
          {onRequestCollapse ? (
            <button
              type="button"
              className="command-canvas-pod__menu-trigger"
              onClick={onRequestCollapse}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${title} module`}
              aria-controls={bodyId}
              aria-expanded={!collapsed}
            >
              {collapsed
                ? <ChevronDown size={17} aria-hidden="true" />
                : <PanelTopClose size={17} aria-hidden="true" />}
            </button>
          ) : null}
          {hasMenuActions ? (
            <div ref={menuRootRef} className="command-canvas-pod__menu-root">
              <button
                type="button"
                className="command-canvas-pod__menu-trigger"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label={`${title} module options`}
                aria-haspopup="menu"
                aria-controls={menuId}
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={17} aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div id={menuId} className="command-canvas-pod__menu" role="menu">
                  <button type="button" role="menuitem" disabled={!onRequestDock} onClick={() => runMenuAction(onRequestDock)}>
                    <Pin size={15} aria-hidden="true" />
                    <span>Dock</span>
                  </button>
                  <button type="button" role="menuitem" disabled={!onRequestFloat} onClick={() => runMenuAction(onRequestFloat)}>
                    <Maximize2 size={15} aria-hidden="true" />
                    <span>Float</span>
                  </button>
                  {onRequestCollapse ? (
                    <button type="button" role="menuitem" onClick={() => runMenuAction(onRequestCollapse)}>
                      {collapsed ? <ChevronDown size={15} aria-hidden="true" /> : <PanelTopClose size={15} aria-hidden="true" />}
                      <span>{collapsed ? "Expand" : "Collapse"}</span>
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" disabled={!onRequestReset} onClick={() => runMenuAction(onRequestReset)}>
                    <RotateCcw size={15} aria-hidden="true" />
                    <span>Reset position</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div id={bodyId} className="command-canvas-pod__body" hidden={collapsed} data-pod-content-mounted="true">
        {children}
      </div>

      {resizeEdge && onResizePointerDown ? (
        <button
          type="button"
          className="command-canvas-pod__resize-target"
          data-resize-edge={resizeEdge}
          data-resizing={resizeActive ? "true" : "false"}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerCancel}
          onKeyDown={(event) => {
            if (!onResizeNudge) return;
            const step = event.shiftKey ? 24 : 8;
            const deltas: Partial<Record<string, readonly [number, number]>> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            const delta = deltas[event.key];
            if (!delta) return;
            event.preventDefault();
            onResizeNudge(delta[0], delta[1]);
          }}
          aria-label={`Resize ${title} module`}
          title={`Drag to resize ${title} horizontally and vertically. Use arrow keys for precise sizing.`}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
});

export type CommandCanvasNavigatorProps = {
  showOriginal: boolean;
  showNumbers: boolean;
  zoom: number;
  onToggleOriginal: () => void;
  onToggleNumbers: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomChange: (zoom: number) => void;
  onResetZoom: () => void;
  onActualSize: () => void;
  onFitView: () => void;
};

export const CommandCanvasNavigator = memo(function CommandCanvasNavigator({
  showOriginal,
  showNumbers,
  zoom,
  onToggleOriginal,
  onToggleNumbers,
  onZoomOut,
  onZoomIn,
  onZoomChange,
  onResetZoom,
  onActualSize,
  onFitView,
}: CommandCanvasNavigatorProps) {
  // Held only while the field is being edited, so buttons and pinch zoom still
  // drive the displayed value and a half-typed "5" never becomes a zoom change.
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  const zoomPercent = canvasZoomPercent(zoom);

  const commitZoomDraft = useCallback(() => {
    setZoomDraft((draft) => {
      if (draft !== null) {
        const nextZoom = parseCanvasZoomPercent(draft);
        if (nextZoom !== null) onZoomChange(nextZoom);
      }
      return null;
    });
  }, [onZoomChange]);

  return (
    <div className="command-canvas-navigator is-compact" data-editor-region="navigator">
      <div className="command-canvas-navigator__controls" role="group" aria-label="Navigator view controls">
        <button
          type="button"
          onClick={onToggleOriginal}
          className={showOriginal ? "is-active" : ""}
          aria-label={showOriginal ? "Show processed graph lines" : "Show source graph lines"}
          aria-pressed={showOriginal}
          title="Graph line view"
          data-navigator-control="graph-line"
        >
          {showOriginal ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onToggleNumbers}
          className={showNumbers ? "is-active" : ""}
          aria-label="Toggle graph grid numbers"
          aria-pressed={showNumbers}
          title="Grid numbers"
          data-navigator-control="grid"
        >
          <Grid3X3 size={15} aria-hidden="true" />
        </button>
        <span aria-hidden="true" />
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" data-navigator-control="zoom-out"><ZoomOut size={15} aria-hidden="true" /></button>
        <span className="command-canvas-navigator__zoom">
          <input
            type="text"
            inputMode="numeric"
            className="command-canvas-navigator__zoom-input"
            value={zoomDraft ?? String(zoomPercent)}
            aria-label="Canvas zoom percentage"
            title={`Canvas zoom (${MIN_CANVAS_ZOOM_PERCENT}-${MAX_CANVAS_ZOOM_PERCENT}%)`}
            data-navigator-control="zoom-value"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setZoomDraft(event.target.value)}
            onBlur={commitZoomDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitZoomDraft();
                event.currentTarget.blur();
                return;
              }
              if (event.key !== "Escape") return;
              event.preventDefault();
              setZoomDraft(null);
              event.currentTarget.blur();
            }}
          />
          <span className="command-canvas-navigator__zoom-unit" aria-hidden="true">%</span>
        </span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" data-navigator-control="zoom-in"><ZoomIn size={15} aria-hidden="true" /></button>
        <button
          type="button"
          onClick={onActualSize}
          aria-label="Actual size: one centimetre cells"
          title="Actual size — 1 cm cells on screen. Assumes a 96 dpi display; fine-tune with the zoom field if your ruler disagrees."
          data-navigator-control="zoom-actual"
        >
          <Ruler size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={onResetZoom} aria-label="Reset zoom to 100%" title="Reset zoom to 100%" data-navigator-control="zoom-reset"><RotateCcw size={15} aria-hidden="true" /></button>
        <button type="button" onClick={onFitView} aria-label="Fit canvas to view" title="Fit canvas to view" data-navigator-control="zoom-fit"><Maximize2 size={15} aria-hidden="true" /></button>
      </div>
    </div>
  );
});

export type CommandCanvasTransformAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  run: () => void;
};

export type CommandCanvasSelectionStripProps = {
  visible: boolean;
  selectionLabel: string;
  style?: CSSProperties;
  disabled?: boolean;
  cropAvailable?: boolean;
  onRotateLeft?: () => void;
  onRotateRight?: () => void;
  onFlipHorizontal?: () => void;
  onFlipVertical?: () => void;
  onCrop?: () => void;
  onDuplicate?: () => void;
  extraActions?: readonly CommandCanvasTransformAction[];
};

export const CommandCanvasSelectionStrip = memo(function CommandCanvasSelectionStrip({
  visible,
  selectionLabel,
  style,
  disabled = false,
  cropAvailable = false,
  onRotateLeft,
  onRotateRight,
  onFlipHorizontal,
  onFlipVertical,
  onCrop,
  onDuplicate,
  extraActions = [],
}: CommandCanvasSelectionStripProps) {
  const menuId = useId();
  const menuRootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMenuOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      className={`command-canvas-selection-strip ${visible ? "is-visible" : ""}`}
      style={style}
      hidden={!visible}
      role="toolbar"
      aria-label={`Transform ${selectionLabel}`}
      data-editor-region="selection-transform-strip"
      data-selection-controls-mounted="true"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <span className="command-canvas-selection-strip__identity" title={selectionLabel}>{selectionLabel}</span>
      <span className="command-canvas-selection-strip__divider" aria-hidden="true" />
      <button type="button" onClick={onRotateLeft} disabled={disabled || !onRotateLeft} aria-label="Rotate selection left" title="Rotate left"><RotateCcw size={16} aria-hidden="true" /></button>
      <button type="button" onClick={onRotateRight} disabled={disabled || !onRotateRight} aria-label="Rotate selection right" title="Rotate right"><RotateCw size={16} aria-hidden="true" /></button>
      <button type="button" onClick={onFlipHorizontal} disabled={disabled || !onFlipHorizontal} aria-label="Flip selection horizontally" title="Flip horizontally"><FlipHorizontal2 size={16} aria-hidden="true" /></button>
      <button type="button" onClick={onFlipVertical} disabled={disabled || !onFlipVertical} aria-label="Flip selection vertically" title="Flip vertically"><FlipVertical2 size={16} aria-hidden="true" /></button>
      {cropAvailable ? (
        <button type="button" onClick={onCrop} disabled={disabled || !onCrop} aria-label="Crop selection" title="Crop"><Crop size={16} aria-hidden="true" /></button>
      ) : null}
      <button type="button" onClick={onDuplicate} disabled={disabled || !onDuplicate} aria-label="Duplicate selection" title="Duplicate"><Copy size={16} aria-hidden="true" /></button>
      {extraActions.length > 0 ? (
        <div ref={menuRootRef} className="command-canvas-selection-strip__menu-root">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            disabled={extraActions.every((action) => action.disabled)}
            aria-label="More selection actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            title="More actions"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div id={menuId} className="command-canvas-selection-strip__menu" role="menu">
              {extraActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      action.run();
                      setMenuOpen(false);
                    }}
                  >
                    {Icon ? <Icon size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export const CommandCanvasCompactViewTrigger = memo(function CommandCanvasCompactViewTrigger({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="command-canvas-view-trigger"
      onClick={onClick}
      aria-label={open ? "Close navigator" : "Open navigator"}
      aria-expanded={open}
    >
      <Eye size={16} aria-hidden="true" />
      <span>View</span>
      {open ? <X size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </button>
  );
});

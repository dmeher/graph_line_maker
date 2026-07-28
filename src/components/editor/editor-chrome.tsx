"use client";

import Link from "next/link";
import { memo, type Ref } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Grid3X3,
  Hand,
  LassoSelect,
  Loader2,
  MousePointer2,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Redo2,
  RotateCcw,
  Search,
  Scissors,
  Shapes,
  SlidersHorizontal,
  Undo2,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { LogoMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export type EditorToolId = "select" | "pan" | "draw" | "shape" | "fill" | "lasso" | "background-remover" | "image-eraser";

type EditorCommandBarProps = {
  title: string;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  savePending: boolean;
  saveDisabled: boolean;
  sourcePanelCollapsed: boolean;
  onToggleSourcePanel: () => void;
  inspectorCollapsed: boolean;
  onToggleInspector: () => void;
  onToggleWorkspace: () => void;
  workspaceOpen: boolean;
  workspaceButtonRef: Ref<HTMLButtonElement>;
  onToggleExport: () => void;
  exportOpen: boolean;
  exportButtonRef: Ref<HTMLButtonElement>;
  onOpenCommandPalette?: () => void;
  commandPaletteLabel?: string;
};

export const EditorCommandBar = memo(function EditorCommandBar({
  title,
  onTitleChange,
  onUndo,
  onRedo,
  onSave,
  savePending,
  saveDisabled,
  sourcePanelCollapsed,
  onToggleSourcePanel,
  inspectorCollapsed,
  onToggleInspector,
  onToggleWorkspace,
  workspaceOpen,
  workspaceButtonRef,
  onToggleExport,
  exportOpen,
  exportButtonRef,
  onOpenCommandPalette,
  commandPaletteLabel = "Search commands",
}: EditorCommandBarProps) {
  return (
    <header className="editor-command-bar atelier-command-bar editor-dark-toolbar" data-editor-region="command-bar">
      <div className="editor-command-bar__identity">
        <Link href="/dashboard" className="editor-command-bar__home editor-toolbar-logo" aria-label="Back to projects">
          <LogoMark className="h-8 w-8" />
        </Link>
        <div className="editor-command-bar__product" aria-hidden="true">
          <strong>Graph Pixel Maker</strong>
          <span>Command canvas</span>
        </div>
        <span className="editor-command-bar__divider" aria-hidden="true" />
        <label className="editor-command-bar__document editor-title-editor">
          <span>Project</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} aria-label="Project name" placeholder="Untitled graph" />
        </label>
      </div>

      {onOpenCommandPalette ? (
        <button
          type="button"
          className="command-canvas-command-trigger editor-command-bar__command-trigger"
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          aria-haspopup="dialog"
        >
          <Search size={15} aria-hidden="true" />
          <span>{commandPaletteLabel}</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
      ) : null}

      <div className="editor-command-bar__history editor-toolbar-group editor-toolbar-history" role="group" aria-label="History">
        <span className="editor-command-bar__group-label" aria-hidden="true">History</span>
        <button type="button" onClick={onUndo} className="editor-command-bar__icon-button editor-dark-btn editor-icon-only" title="Undo" aria-label="Undo">
          <Undo2 size={18} aria-hidden="true" />
          <kbd aria-hidden="true">Ctrl Z</kbd>
        </button>
        <button type="button" onClick={onRedo} className="editor-command-bar__icon-button editor-dark-btn editor-icon-only" title="Redo" aria-label="Redo">
          <Redo2 size={18} aria-hidden="true" />
          <kbd aria-hidden="true">Ctrl Shift Z</kbd>
        </button>
      </div>

      <div className="editor-command-bar__actions ml-auto" role="group" aria-label="Project actions">
        <div className="editor-command-bar__panel-actions" role="group" aria-label="Panels">
          <button type="button" onClick={onToggleSourcePanel} className="editor-command-bar__icon-button editor-dark-btn editor-panel-toggle editor-icon-only" title={sourcePanelCollapsed ? "Show layers" : "Hide layers"} aria-label={sourcePanelCollapsed ? "Show layers" : "Hide layers"} aria-pressed={!sourcePanelCollapsed}>
            {sourcePanelCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
          <button type="button" onClick={onToggleInspector} className="editor-command-bar__icon-button editor-dark-btn editor-panel-toggle editor-icon-only" title={inspectorCollapsed ? "Show properties" : "Hide properties"} aria-label={inspectorCollapsed ? "Show properties" : "Hide properties"} aria-pressed={!inspectorCollapsed}>
            {inspectorCollapsed ? <PanelRightOpen size={17} aria-hidden="true" /> : <PanelRightClose size={17} aria-hidden="true" />}
          </button>
        </div>
        <div className="editor-command-bar__workspace-actions">
          <ThemeToggle variant="editor" />
          <button ref={workspaceButtonRef} type="button" onClick={onToggleWorkspace} className="editor-command-bar__menu-button editor-dark-btn" title="Workspace settings" aria-label="Workspace settings" aria-expanded={workspaceOpen}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Workspace</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="editor-command-bar__output-actions">
          <button type="button" onClick={onSave} disabled={saveDisabled} className="editor-command-bar__save editor-dark-btn editor-save-btn" aria-label="Save project" aria-busy={savePending}>
            {savePending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span>{savePending ? "Saving" : "Save"}</span>
          </button>
          <button ref={exportButtonRef} type="button" onClick={onToggleExport} className="editor-command-bar__export editor-dark-btn" title="Export" aria-label="Export project" aria-expanded={exportOpen}>
            <Download size={16} aria-hidden="true" />
            <span>Export</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
});

const TOOL_GROUPS: { id: string; label: string; items: { id: EditorToolId; label: string; icon: typeof MousePointer2 }[] }[] = [
  {
    id: "navigate",
    label: "",
    items: [
      { id: "select", label: "Select", icon: MousePointer2 },
      { id: "pan", label: "Pan", icon: Hand },
    ],
  },
  {
    id: "create",
    label: "",
    items: [
      { id: "draw", label: "Draw Line", icon: Pencil },
      { id: "shape", label: "Draw Shape", icon: Shapes },
      { id: "fill", label: "Fill", icon: PaintBucket },
    ],
  },
  {
    id: "refine",
    label: "",
    items: [
      { id: "lasso", label: "Lasso", icon: LassoSelect },
      { id: "background-remover", label: "Remove background", icon: Scissors },
      { id: "image-eraser", label: "Erase image", icon: Eraser },
    ],
  },
];

export const EditorToolRail = memo(function EditorToolRail({ activeTool, onSelectTool }: { activeTool: EditorToolId; onSelectTool: (tool: EditorToolId) => void }) {
  return (
    <nav className="editor-tool-rail atelier-tool-rail" aria-label="Canvas tools" data-editor-region="tool-rail">
      {TOOL_GROUPS.map((group) => (
        <section key={group.id} className={`editor-tool-rail__group editor-tool-rail__group--${group.id}`} aria-label={group.label}>
          <span className="editor-tool-rail__group-label" aria-hidden="true">{group.label}</span>
          <div className="editor-tool-rail__group-items">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTool(item.id)}
                  className={`editor-tool-rail__item ${active ? "is-active" : ""}`}
                  title={item.label}
                  aria-label={item.label}
                  aria-pressed={active}
                  data-tool={item.id}
                >
                  <span className="editor-tool-rail__icon">
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    <i aria-hidden="true" />
                  </span>
                  <span className="editor-tool-rail__label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
});

type EditorViewControlsProps = {
  showOriginal: boolean;
  showNumbers: boolean;
  zoom: number;
  onToggleOriginal: () => void;
  onToggleNumbers: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetView: () => void;
};

export const EditorViewControls = memo(function EditorViewControls({ showOriginal, showNumbers, zoom, onToggleOriginal, onToggleNumbers, onZoomOut, onZoomIn, onResetView }: EditorViewControlsProps) {
  return (
    <div className="editor-view-controls atelier-view-controls" role="group" aria-label="Canvas view controls" data-editor-region="view-controls">
      <div className="editor-view-controls__modes">
        <button type="button" onClick={onToggleOriginal} className={`editor-view-controls__mode ${showOriginal ? "is-active" : ""}`} title={showOriginal ? "Show processed artwork" : "Show original artwork"} aria-label={showOriginal ? "Show processed artwork" : "Show original artwork"}>
          {showOriginal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          <span>Source</span>
        </button>
        <button type="button" onClick={onToggleNumbers} className={`editor-view-controls__mode ${showNumbers ? "is-active" : ""}`} title="Toggle graph numbers" aria-label="Toggle graph numbers">
          <Grid3X3 size={17} aria-hidden="true" />
          <span>Numbers</span>
        </button>
      </div>
      <span className="editor-view-controls__divider" aria-hidden="true" />
      <div className="editor-view-controls__zoom-cluster">
        <button type="button" onClick={onZoomOut} className="editor-view-controls__zoom" title="Zoom out" aria-label="Zoom out"><ZoomOut size={17} aria-hidden="true" /></button>
        <output className="editor-view-controls__zoom-value" aria-label="Canvas zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={onZoomIn} className="editor-view-controls__zoom" title="Zoom in" aria-label="Zoom in"><ZoomIn size={17} aria-hidden="true" /></button>
        <button type="button" onClick={onResetView} className="editor-view-controls__reset" title="Reset view" aria-label="Reset view"><RotateCcw size={16} aria-hidden="true" /></button>
      </div>
    </div>
  );
});

type EditorStatusBarProps = {
  status: string;
  processing: boolean;
  dimensions: string;
  selection: string;
  zoom: number;
  online: boolean;
};

type EditorNavigatorStatusProps = Pick<EditorStatusBarProps, "status" | "processing" | "online"> & {
  tone?: "positive" | "attention";
};

type EditorCanvasLoaderProps = {
  visible: boolean;
  phase: "assets" | "render" | "error";
  label: string;
};

/**
 * Visual-only bootstrap/error surface. The hidden EditorStatusBar remains the
 * only live announcement so project readiness is never read twice.
 */
export const EditorCanvasLoader = memo(function EditorCanvasLoader({
  visible,
  phase,
  label,
}: EditorCanvasLoaderProps) {
  return (
    <div
      className="editor-canvas-loader"
      data-visible={visible ? "true" : "false"}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className="editor-canvas-loader__card">
        <span className="editor-canvas-loader__visual">
          <svg viewBox="0 0 96 96" focusable="false">
            <rect className="editor-canvas-loader__paper" x="9" y="9" width="78" height="78" rx="18" />
            <g className="editor-canvas-loader__grid">
              <path d="M25 17v62M40 17v62M56 17v62M71 17v62" />
              <path d="M17 25h62M17 40h62M17 56h62M17 71h62" />
            </g>
            <path
              className="editor-canvas-loader__thread-shadow"
              pathLength="1"
              d="M20 65h15V53h13V40h14V28h14"
            />
            <path
              className="editor-canvas-loader__thread"
              pathLength="1"
              d="M20 65h15V53h13V40h14V28h14"
            />
            <g className="editor-canvas-loader__nodes">
              <circle cx="20" cy="65" r="3" />
              <circle cx="35" cy="53" r="3" />
              <circle cx="48" cy="40" r="3" />
              <circle cx="62" cy="28" r="3" />
              <circle cx="76" cy="28" r="3" />
            </g>
            <path className="editor-canvas-loader__orbit" d="M48 5a43 43 0 1 1-30.4 12.6" />
          </svg>
        </span>
        <span className="editor-canvas-loader__copy">
          <strong>{label}</strong>
          <span>
            {phase === "assets"
              ? "Preparing source artwork"
              : phase === "error"
                ? "Review the project assets, then refresh to try again"
                : "Weaving pixels onto the graph"}
          </span>
        </span>
        <span className="editor-canvas-loader__meter" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
});

export const EditorStatusBar = memo(function EditorStatusBar({ status, processing, dimensions, selection, zoom, online }: EditorStatusBarProps) {
  return (
    <footer
      className="editor-status-announcer sr-only"
      aria-live="polite"
      aria-atomic="true"
      data-editor-region="status-bar"
      data-processing={processing ? "true" : "false"}
    >
      Workspace status: {status}. Current selection: {selection}. Canvas: {dimensions} at {Math.round(zoom * 100)}% zoom. Snap enabled. Connection: {online ? "Online" : "Offline"}.
    </footer>
  );
});

export const EditorNavigatorStatus = memo(function EditorNavigatorStatus({
  status,
  processing,
  online,
  tone = "positive",
}: EditorNavigatorStatusProps) {
  const activityTone = processing ? "is-processing" : tone === "attention" ? "is-attention" : "is-positive";
  return (
    <div className="editor-navigator-status" data-navigator-status="visual" aria-hidden="true">
      <div className="editor-navigator-status__visual">
        <span
          className={`editor-navigator-status__item editor-navigator-status__item--activity ${activityTone}`}
          title={status}
          data-status-item="activity"
        >
          {processing
            ? <span className="editor-navigator-status__pulse" aria-hidden="true" />
            : tone === "attention"
              ? <AlertTriangle size={11} aria-hidden="true" />
              : <Check size={11} aria-hidden="true" />}
          <span className="editor-navigator-status__label">{status}</span>
        </span>
        <span
          className={`editor-navigator-status__item ${online ? "is-positive" : "is-attention"}`}
          title={online ? "Online" : "Offline"}
          data-status-item="connection"
        >
          {online
            ? <Wifi size={11} aria-hidden="true" />
            : <WifiOff size={11} aria-hidden="true" />}
        </span>
      </div>
    </div>
  );
});

export {
  CommandCanvasCommandPalette,
  CommandCanvasCommandTrigger,
  CommandCanvasCompactViewTrigger,
  CommandCanvasNavigator,
  CommandCanvasPod,
  CommandCanvasSelectionStrip,
} from "./command-canvas-chrome";
export type {
  CommandCanvasCommand,
  CommandCanvasCommandPaletteProps,
  CommandCanvasNavigatorProps,
  CommandCanvasPaletteCommand,
  CommandCanvasPodProps,
  CommandCanvasPodId,
  CommandCanvasResizeEdge,
  CommandCanvasSelectionStripProps,
  CommandCanvasTransformAction,
} from "./command-canvas-chrome";

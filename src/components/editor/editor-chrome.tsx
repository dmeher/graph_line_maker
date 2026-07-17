"use client";

import Link from "next/link";
import { memo, type Ref } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Grid3X3,
  Hand,
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
  Scissors,
  Shapes,
  SlidersHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { LogoMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export type EditorToolId = "select" | "pan" | "draw" | "shape" | "fill" | "background-remover" | "image-eraser";

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
}: EditorCommandBarProps) {
  return (
    <header className="editor-dark-toolbar">
      <div className="editor-toolbar-group editor-toolbar-brand">
        <Link href="/dashboard" className="editor-toolbar-logo" aria-label="Back to projects">
          <LogoMark className="h-8 w-8" />
        </Link>
        <div className="editor-title-editor">
          <span>Project</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} aria-label="Project name" placeholder="Untitled graph" />
        </div>
      </div>

      <div className="editor-toolbar-group editor-toolbar-history" aria-label="History">
        <button type="button" onClick={onUndo} className="editor-dark-btn editor-icon-only" title="Undo" aria-label="Undo">
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onRedo} className="editor-dark-btn editor-icon-only" title="Redo" aria-label="Redo">
          <Redo2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="editor-toolbar-group ml-auto" aria-label="Project actions">
        <button type="button" onClick={onToggleSourcePanel} className="editor-dark-btn editor-panel-toggle editor-icon-only" title={sourcePanelCollapsed ? "Show layers" : "Hide layers"} aria-label={sourcePanelCollapsed ? "Show layers" : "Hide layers"}>
          {sourcePanelCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
        <button type="button" onClick={onToggleInspector} className="editor-dark-btn editor-panel-toggle editor-icon-only" title={inspectorCollapsed ? "Show properties" : "Hide properties"} aria-label={inspectorCollapsed ? "Show properties" : "Hide properties"}>
          {inspectorCollapsed ? <PanelRightOpen size={17} aria-hidden="true" /> : <PanelRightClose size={17} aria-hidden="true" />}
        </button>
        <ThemeToggle variant="editor" />
        <button ref={workspaceButtonRef} type="button" onClick={onToggleWorkspace} className="editor-dark-btn" title="Workspace settings" aria-label="Workspace settings" aria-expanded={workspaceOpen}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>Workspace</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={onSave} disabled={saveDisabled} className="editor-dark-btn editor-save-btn" aria-label="Save project">
          {savePending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
          <span>Save</span>
        </button>
        <button ref={exportButtonRef} type="button" onClick={onToggleExport} className="editor-dark-btn" title="Export" aria-label="Export project" aria-expanded={exportOpen}>
          <Download size={16} aria-hidden="true" />
          <span>Export</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
});

const TOOL_ITEMS: { id: EditorToolId; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "draw", label: "Draw cells", icon: Pencil },
  { id: "shape", label: "Shape", icon: Shapes },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "background-remover", label: "Remove background", icon: Scissors },
  { id: "image-eraser", label: "Erase image", icon: Eraser },
];

export const EditorToolRail = memo(function EditorToolRail({ activeTool, onSelectTool }: { activeTool: EditorToolId; onSelectTool: (tool: EditorToolId) => void }) {
  return (
    <nav className="editor-tool-rail" aria-label="Canvas tools">
      {TOOL_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" onClick={() => onSelectTool(item.id)} className={activeTool === item.id ? "is-active" : ""} title={item.label} aria-label={item.label} aria-pressed={activeTool === item.id}>
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
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
    <div className="editor-view-controls" aria-label="Canvas view controls">
      <button type="button" onClick={onToggleOriginal} className={showOriginal ? "is-active" : ""} title={showOriginal ? "Show processed artwork" : "Show original artwork"} aria-label={showOriginal ? "Show processed artwork" : "Show original artwork"}>
        {showOriginal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
      <button type="button" onClick={onToggleNumbers} className={showNumbers ? "is-active" : ""} title="Toggle graph numbers" aria-label="Toggle graph numbers">
        <Grid3X3 size={17} aria-hidden="true" />
      </button>
      <span className="editor-view-controls__divider" aria-hidden="true" />
      <button type="button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out"><ZoomOut size={17} aria-hidden="true" /></button>
      <output aria-label="Canvas zoom">{Math.round(zoom * 100)}%</output>
      <button type="button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in"><ZoomIn size={17} aria-hidden="true" /></button>
      <button type="button" onClick={onResetView} title="Reset view" aria-label="Reset view"><RotateCcw size={16} aria-hidden="true" /></button>
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

export const EditorStatusBar = memo(function EditorStatusBar({ status, processing, dimensions, selection, zoom, online }: EditorStatusBarProps) {
  return (
    <footer className="editor-status-bar" aria-live="polite">
      <span className={`editor-status-bar__state ${processing ? "is-processing" : ""}`}><i aria-hidden="true" />{status}</span>
      <span className="editor-status-bar__dimensions">{dimensions}</span>
      <span className="editor-status-bar__selection">{selection}</span>
      <span className="editor-status-bar__zoom">{Math.round(zoom * 100)}%</span>
      <span className="editor-status-bar__connection"><i className={online ? "is-online" : ""} aria-hidden="true" />{online ? "Online" : "Offline"}</span>
      <span className="editor-status-bar__snap">Snap on</span>
    </footer>
  );
});

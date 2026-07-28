"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GraphCellLineSide, GraphShapeKind } from "@/lib/types";
import {
  CELL_LINE_SIDE_KEYS,
  GRAPH_SHAPE_KIND_LABELS,
} from "./inspector-constants";
import {
  DEFAULT_OUTLINE_COLOR,
  PRESET_GRAPH_COLORS,
  TRANSPARENT_FILL_COLOR,
  isTransparentFillColor,
  normalizeCanvasColor,
  normalizeCanvasFillColor,
} from "@/lib/graph-paper";

export const NumberField = memo(function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  allowDecimalInput = false,
  wholeStep = false,
  disabled = false,
  readOnly = false,
  hideLabel = false,
  unit,
  emphasis = "normal",
  wrapperClassName,
  inputClassName,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  allowDecimalInput?: boolean;
  wholeStep?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hideLabel?: boolean;
  unit?: string;
  emphasis?: "primary" | "normal";
  wrapperClassName?: string;
  inputClassName?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  function parseDraft(nextValue: string) {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function commitDraft(nextValue = draftValue) {
    if (readOnly) return;
    const parsed = parseDraft(nextValue);
    if (parsed === null) {
      setDraftValue(String(value));
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setDraftValue(String(clamped));
  }

  function normalizeSteppedValue(parsed: number) {
    if (!wholeStep || step < 1) return parsed;
    const delta = parsed - value;
    if (Math.abs(Math.abs(delta) - step) > 0.000001) return parsed;
    const stepped =
      delta > 0
        ? Number.isInteger(value)
          ? value + step
          : Math.ceil(value)
        : Number.isInteger(value)
          ? value - step
          : Math.floor(value);
    return Math.max(min, Math.min(max, stepped));
  }

  return (
    <label
      className={`editor-number-field ${wrapperClassName ?? "grid min-w-0 gap-1.5"}`}
      data-emphasis={emphasis}
      data-read-only={readOnly ? "true" : undefined}
    >
      <span className={hideLabel ? "sr-only" : "editor-number-field__label text-xs font-semibold text-[var(--editor-text-dim)]"}>
        {label}
      </span>
      <span className="editor-number-field__control">
        <input
          type="number"
          inputMode={allowDecimalInput || step < 1 ? "decimal" : "numeric"}
          min={min}
          max={max}
          step={step}
          value={draftValue}
          disabled={disabled}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          onBlur={() => {
            if (!readOnly) commitDraft();
          }}
          onChange={(event) => {
            if (readOnly) return;
            const nextValue = event.target.value;
            const parsed = parseDraft(nextValue);
            setDraftValue(nextValue);
            if (parsed === null) return;
            const clamped = Math.max(min, Math.min(max, parsed));
            const normalized = normalizeSteppedValue(clamped);
            if (normalized !== parsed) setDraftValue(String(normalized));
            onChange(normalized);
          }}
          className={`editor-number-field__input ${
            inputClassName ??
            `h-10 w-full min-w-0 rounded-md border border-[var(--editor-control-border)] bg-[var(--editor-panel)] px-3 text-sm text-[var(--editor-text)] outline-none disabled:bg-[var(--editor-panel-2)] disabled:text-[var(--editor-muted)]${readOnly ? " cursor-default" : ""}`
          }`}
        />
        {unit ? <span className="editor-number-field__unit">{unit}</span> : null}
      </span>
    </label>
  );
});

export const ColorPresetField = memo(function ColorPresetField({
  label,
  value,
  onChange,
  colors = PRESET_GRAPH_COLORS,
  allowTransparent = false,
  normalizeColor = normalizeCanvasColor,
  expanded,
  onExpandedChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors?: readonly { name: string; hex: string }[];
  allowTransparent?: boolean;
  normalizeColor?: (value: unknown) => string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = expanded ?? internalOpen;
  const normalizedValue = allowTransparent ? normalizeCanvasFillColor(value) : normalizeColor(value);
  const transparentSelected = isTransparentFillColor(normalizedValue);

  function setOpen(nextOpen: boolean) {
    if (onExpandedChange) {
      onExpandedChange(nextOpen);
      return;
    }
    setInternalOpen(nextOpen);
  }

  return (
    <div className="editor-color-field min-w-0 rounded-md border border-[var(--editor-line)] bg-[var(--editor-panel)]" data-expanded={open ? "true" : "false"}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="editor-color-field__trigger flex h-10 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-xs font-semibold text-[var(--editor-text-dim)]">{label}</span>
        <span className="ml-auto inline-flex min-w-0 items-center gap-2">
          <ColorSummary value={normalizedValue} />
          <span className="max-w-24 truncate font-mono text-[11px] font-semibold text-[var(--editor-muted)]">
            {transparentSelected ? "Transparent" : normalizedValue.toUpperCase()}
          </span>
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-[var(--editor-muted)]" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[var(--editor-muted)]" aria-hidden="true" />
          )}
        </span>
      </button>
      {open ? (
        <div className="editor-color-field__palette grid min-w-0 gap-2 border-t border-[var(--editor-line-soft)] p-2">
          <div className="editor-color-field__swatches grid grid-cols-[repeat(auto-fit,minmax(1.75rem,1fr))] gap-1.5">
            {colors.map((color) => {
              const selected = color.hex === normalizedValue;
              return (
                <button
                  key={`${label}-${color.hex}`}
                  type="button"
                  onClick={() => onChange(color.hex)}
                  className={`editor-color-field__swatch h-7 rounded-sm border ${selected ? "border-[var(--editor-text)] ring-2 ring-[var(--editor-accent-soft)]" : "border-[var(--editor-line)]"}`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                  aria-label={`${label}: ${color.name}`}
                />
              );
            })}
            {allowTransparent ? (
              <button
                type="button"
                onClick={() => onChange(TRANSPARENT_FILL_COLOR)}
                className={`editor-color-field__swatch editor-transparent-checker h-7 rounded-sm border ${transparentSelected ? "border-[var(--editor-text)] ring-2 ring-[var(--editor-accent-soft)]" : "border-[var(--editor-line)]"}`}
                title="Transparent"
                aria-label={`${label}: Transparent`}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-[var(--editor-line)] pt-3 first:border-t-0 first:pt-0 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[var(--editor-text)]"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {!open ? summary : null}
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}

export function InspectorDisclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="editor-inspector-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{title}</span>
        {summary ? <span className="editor-inspector-disclosure__summary">{summary}</span> : null}
        <ChevronRight className="editor-inspector-disclosure__chevron" size={15} aria-hidden="true" />
      </summary>
      <div className="editor-inspector-disclosure__body">{children}</div>
    </details>
  );
}

export function ColorSummary({ value }: { value: string }) {
  const transparent = isTransparentFillColor(value);
  return (
    <span
      className={`h-5 w-5 rounded-sm border border-[var(--editor-line)] ${transparent ? "editor-transparent-checker" : ""}`}
      style={transparent ? undefined : { backgroundColor: value }}
      aria-hidden="true"
    />
  );
}

export const ShapePreviewSvg = memo(function ShapePreviewSvg({
  kind,
  sides,
  fillColor,
  strokeColor,
  strokeWidth,
  widthCells,
  heightCells,
  className = "h-full w-full",
}: {
  kind: GraphShapeKind;
  sides: GraphCellLineSide[];
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  widthCells?: number;
  heightCells?: number;
  className?: string;
}) {
  const rectLike = kind === "square" || kind === "rectangle";
  const circleLike = kind === "circle" || kind === "oval";
  const halfCircleLike = kind === "half-circle";
  const normalizedSides = isTransparentFillColor(fillColor) ? (sides.length ? sides : CELL_LINE_SIDE_KEYS) : CELL_LINE_SIDE_KEYS;
  const stroke = normalizeCanvasColor(strokeColor, DEFAULT_OUTLINE_COLOR);
  const fill = isTransparentFillColor(fillColor) ? "none" : normalizeCanvasColor(fillColor);
  const previewStrokeWidth = Math.max(2, Math.min(10, strokeWidth * 1.5));
  const rawWidth = Math.max(0.01, Number(widthCells) || (kind === "square" || kind === "circle" ? 1 : 1.65));
  const rawHeight = kind === "square" || kind === "circle" ? rawWidth : Math.max(0.01, Number(heightCells) || 1);
  const maxPreviewWidth = 92;
  const maxPreviewHeight = 62;
  const scale = Math.min(maxPreviewWidth / rawWidth, maxPreviewHeight / rawHeight);
  const width = Math.max(8, rawWidth * scale);
  const height = Math.max(8, rawHeight * scale);
  const left = 60 - width / 2;
  const top = 45 - height / 2;
  const right = left + width;
  const bottom = top + height;

  return (
    <svg viewBox="0 0 120 90" className={className} role="img" aria-label={GRAPH_SHAPE_KIND_LABELS[kind] ?? "Shape preview"}>
      <rect x="1" y="1" width="118" height="88" rx="5" fill="var(--artboard-bg)" stroke="var(--editor-line)" />
      {circleLike ? (
        <ellipse
          cx={left + width / 2}
          cy={top + height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={previewStrokeWidth}
        />
      ) : halfCircleLike ? (
        <path
          d={`M ${left} ${bottom} A ${width / 2} ${height} 0 0 1 ${right} ${bottom} L ${left} ${bottom} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={previewStrokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : rectLike ? (
        <>
          <rect x={left} y={top} width={width} height={height} fill={fill} stroke="none" />
          {normalizedSides.includes("top") ? <line x1={left} y1={top} x2={right} y2={top} stroke={stroke} strokeWidth={previewStrokeWidth} strokeLinecap="round" /> : null}
          {normalizedSides.includes("right") ? <line x1={right} y1={top} x2={right} y2={bottom} stroke={stroke} strokeWidth={previewStrokeWidth} strokeLinecap="round" /> : null}
          {normalizedSides.includes("bottom") ? <line x1={right} y1={bottom} x2={left} y2={bottom} stroke={stroke} strokeWidth={previewStrokeWidth} strokeLinecap="round" /> : null}
          {normalizedSides.includes("left") ? <line x1={left} y1={bottom} x2={left} y2={top} stroke={stroke} strokeWidth={previewStrokeWidth} strokeLinecap="round" /> : null}
        </>
      ) : (
        <line x1="18" y1="68" x2="102" y2="22" stroke={stroke} strokeWidth={previewStrokeWidth} strokeLinecap="round" />
      )}
    </svg>
  );
});

export function InspectorSegmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="grid rounded-md border border-[var(--editor-line)] bg-[var(--editor-panel-2)] p-0.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={`inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded text-[12px] font-semibold ${
            option.value === value ? "bg-[var(--editor-accent)] text-[var(--editor-on-accent)] shadow-sm" : "text-[var(--editor-muted)] hover:bg-[var(--editor-control-hover-bg)]"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

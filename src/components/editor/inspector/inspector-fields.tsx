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
  hideLabel = false,
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
  hideLabel?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));
  const [isFocused, setIsFocused] = useState(false);

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
    <label className={wrapperClassName ?? "grid min-w-0 gap-1.5"}>
      <span className={hideLabel ? "sr-only" : "text-xs font-semibold text-[#8592a6]"}>
        {label}
      </span>
      <input
        type="number"
        inputMode={allowDecimalInput || step < 1 ? "decimal" : "numeric"}
        step={step}
        value={draftValue}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commitDraft();
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          const parsed = parseDraft(nextValue);
          setDraftValue(nextValue);
          if (parsed === null) return;
          const clamped = Math.max(min, Math.min(max, parsed));
          const normalized = normalizeSteppedValue(clamped);
          if (normalized !== parsed) setDraftValue(String(normalized));
          onChange(normalized);
        }}
        className={
          inputClassName ??
          "h-10 w-full min-w-0 rounded-md border border-[var(--line)] bg-[#141b28] px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-[#6b7688]"
        }
      />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colors?: readonly { name: string; hex: string }[];
  allowTransparent?: boolean;
  normalizeColor?: (value: unknown) => string;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = allowTransparent ? normalizeCanvasFillColor(value) : normalizeColor(value);
  const transparentSelected = isTransparentFillColor(normalizedValue);

  return (
    <div className="min-w-0 rounded-md border border-[#2a3344] bg-[#141b28]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 px-2.5 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-xs font-semibold text-[#8592a6]">{label}</span>
        <span className="ml-auto inline-flex min-w-0 items-center gap-2">
          <ColorSummary value={normalizedValue} />
          <span className="max-w-24 truncate font-mono text-[11px] font-semibold text-[#9aa7ba]">
            {transparentSelected ? "Transparent" : normalizedValue.toUpperCase()}
          </span>
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-[#9aa7ba]" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#9aa7ba]" aria-hidden="true" />
          )}
        </span>
      </button>
      {open ? (
        <div className="grid min-w-0 gap-2 border-t border-[#232c3c] p-2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(1.75rem,1fr))] gap-1.5">
            {colors.map((color) => {
              const selected = color.hex === normalizedValue;
              return (
                <button
                  key={`${label}-${color.hex}`}
                  type="button"
                  onClick={() => onChange(color.hex)}
                  className={`h-7 rounded-sm border ${selected ? "border-[#0b0f16] ring-2 ring-slate-300" : "border-[#2a3344]"}`}
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
                className={`h-7 rounded-sm border bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0] ${transparentSelected ? "border-[#0b0f16] ring-2 ring-slate-300" : "border-[#2a3344]"}`}
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
    <section className={`border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[#e7edf5]"
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

export function ColorSummary({ value }: { value: string }) {
  const transparent = isTransparentFillColor(value);
  return (
    <span
      className={`h-5 w-5 rounded-sm border border-[#2a3344] ${
        transparent
          ? "bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%),linear-gradient(-45deg,#cbd5e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#cbd5e1_75%),linear-gradient(-45deg,transparent_75%,#cbd5e1_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]"
          : ""
      }`}
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
      <rect x="1" y="1" width="118" height="88" rx="5" fill="#ffffff" stroke="#232c3c" />
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
      className="grid rounded-md border border-[#2a3344] bg-[#161f2e] p-0.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded text-[12px] font-semibold ${
            option.value === value ? "bg-[#008c8f] text-white shadow-sm" : "text-[#9aa7ba] hover:bg-[#1b2433]"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

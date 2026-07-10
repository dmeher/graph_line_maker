"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { isHexColor } from "@/lib/graph-paper";
import { DEFAULT_GRID_LINE_COLOR } from "@/lib/graph-paper";

export const inspectorControlClass =
  "h-9 w-full min-w-0 rounded-md border border-[#d7dde5] bg-white px-2.5 text-[13px] font-medium text-[#101828] outline-none focus:border-[#008c8f] focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400";

export function InspectorGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d7dde5] bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#101828]">
        {icon ? <span className="text-[#008c8f]">{icon}</span> : null}
        <span>{title}</span>
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function InspectorRow({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-w-0 grid-cols-[86px_minmax(0,1fr)] items-center gap-2 ${className}`}>
      <span className="text-[12px] font-medium text-[#344054]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function InspectorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className={inspectorControlClass}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function InspectorCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[#344054]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        readOnly={disabled || !onChange}
        onChange={(event) => onChange?.(event.target.checked)}
        className="h-4 w-4 shrink-0 rounded accent-[#008c8f]"
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

export function InspectorColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={`${inspectorControlClass} flex cursor-pointer items-center gap-2 px-2`} title={`${label}: ${value}`}>
      <input type="color" value={isHexColor(value) ? value : DEFAULT_GRID_LINE_COLOR} onChange={(event) => onChange(event.target.value)} className="sr-only" aria-label={label} />
      <span className="h-5 w-5 shrink-0 rounded border border-[#cfd7df]" style={{ backgroundColor: value }} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{value.toUpperCase()}</span>
      <ChevronDown size={14} className="shrink-0 text-[#667085]" aria-hidden="true" />
    </label>
  );
}

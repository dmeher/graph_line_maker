import type { ReactNode } from "react";
import { normalizeGraphLineColor, PRESET_GRAPH_LINE_COLORS } from "@/lib/graph-paper";

export const inspectorControlClass =
  "h-9 w-full min-w-0 rounded-md border border-[#2a3344] bg-[#141b28] px-2.5 text-[13px] font-medium text-[#e7edf5] outline-none focus:border-[#008c8f] focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-[#6b7688]";

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
    <section className="rounded-xl border border-[#2a3344] bg-[#141b28] p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#e7edf5]">
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
      <span className="text-[12px] font-medium text-[#c3cdda]">{label}</span>
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
    <label className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[#c3cdda]">
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
  const selectedColor = normalizeGraphLineColor(value);

  return (
    <div className="flex h-9 items-center gap-2" aria-label={label}>
      {PRESET_GRAPH_LINE_COLORS.map((color) => {
        const selected = color.hex === selectedColor;
        return (
          <button
            key={color.hex}
            type="button"
            onClick={() => onChange(color.hex)}
            className={`grid h-7 w-7 place-items-center rounded border transition-colors ${
              selected ? "border-[#22d3c5] ring-1 ring-[#22d3c5]" : "border-[#2a3344] hover:border-[#7b8aa3]"
            }`}
            title={color.name}
            aria-label={`${label}: ${color.name}`}
            aria-pressed={selected}
          >
            <span className="h-4 w-4 rounded-sm border border-black/20" style={{ backgroundColor: color.hex }} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

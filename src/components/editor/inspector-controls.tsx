import type { ReactNode } from "react";
import { normalizeGraphLineColor, PRESET_GRAPH_LINE_COLORS } from "@/lib/graph-paper";

export const inspectorControlClass =
  "editor-inspector-control h-9 w-full min-w-0 rounded-md border border-[var(--editor-control-border)] bg-[var(--editor-panel)] px-2.5 text-[13px] font-medium text-[var(--editor-text)] outline-none disabled:bg-[var(--editor-panel-2)] disabled:text-[var(--editor-muted)]";

export type InspectorModeOption<T extends string> = {
  id: T;
  label: string;
  accessibleLabel: string;
  icon: ReactNode;
};

export function InspectorModeRail<T extends string>({
  value,
  options,
  onChange,
  orientation = "vertical",
}: {
  value: T;
  options: readonly InspectorModeOption<T>[];
  onChange: (value: T) => void;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <nav
      className="editor-inspector__mode-rail"
      data-orientation={orientation}
      role="tablist"
      aria-label="Inspector modes"
      aria-orientation={orientation}
    >
      {options.map((option, index) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`editor-inspector-tab-${option.id}`}
            aria-controls={`editor-inspector-panel-${option.id}`}
            aria-label={option.accessibleLabel}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={option.accessibleLabel}
            className="editor-inspector__mode-button"
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => {
              const lastIndex = options.length - 1;
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? lastIndex
                    : event.key === "ArrowRight" || (orientation === "vertical" && event.key === "ArrowDown")
                      ? (index + 1) % options.length
                      : event.key === "ArrowLeft" || (orientation === "vertical" && event.key === "ArrowUp")
                        ? (index - 1 + options.length) % options.length
                        : null;
              if (nextIndex === null) return;
              event.preventDefault();
              const nextOption = options[nextIndex];
              onChange(nextOption.id);
              requestAnimationFrame(() =>
                document.getElementById(`editor-inspector-tab-${nextOption.id}`)?.focus(),
              );
            }}
          >
            <span className="editor-inspector__mode-icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="editor-inspector__mode-label">{option.label}</span>
            <span className="editor-inspector__mode-indicator" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

export function InspectorGroup({
  title,
  icon,
  description,
  action,
  priority = "secondary",
  children,
}: {
  title: string;
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
  priority?: "primary" | "secondary" | "quiet";
  children: ReactNode;
}) {
  return (
    <section
      className="editor-inspector-group rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4 shadow-sm"
      data-priority={priority}
    >
      <header className="editor-inspector-group__header">
        <div className="editor-inspector-group__heading-copy">
          <h3 className="editor-inspector-group__heading flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[var(--editor-text)]">
            {icon ? <span className="text-[var(--editor-accent)]">{icon}</span> : null}
            <span>{title}</span>
          </h3>
          {description ? <p className="editor-inspector-group__description">{description}</p> : null}
        </div>
        {action ? <div className="editor-inspector-group__action">{action}</div> : null}
      </header>
      <div className="editor-inspector-group__body">{children}</div>
    </section>
  );
}

export function InspectorRow({
  label,
  children,
  className = "",
  layout = "stacked",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  layout?: "inline" | "stacked";
}) {
  return (
    <div
      className={`editor-inspector-row grid min-w-0 ${className}`}
      data-layout={layout}
    >
      <span className="editor-inspector-row__label text-[12px] font-medium text-[var(--editor-text-dim)]">{label}</span>
      <div className="editor-inspector-row__control min-w-0">{children}</div>
    </div>
  );
}

export function InspectorFieldGrid({
  children,
  columns = 2,
  className = "",
}: {
  children: ReactNode;
  columns?: 1 | 2 | 4;
  className?: string;
}) {
  return (
    <div
      className={`editor-inspector-field-grid ${className}`}
      data-columns={columns}
    >
      {children}
    </div>
  );
}

export function InspectorMetricGrid({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={`editor-inspector-metric-grid ${className}`} aria-label={label}>
      {children}
    </dl>
  );
}

export function InspectorActionStrip({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`editor-inspector-action-strip ${className}`}
      role="group"
      aria-label={label}
    >
      {children}
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
    <label className="editor-inspector-checkbox inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--editor-text-dim)]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        readOnly={disabled || !onChange}
        onChange={(event) => onChange?.(event.target.checked)}
        className="h-4 w-4 shrink-0 rounded accent-[var(--editor-accent)]"
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

export function InspectorColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const selectedColor = normalizeGraphLineColor(value);

  return (
    <div className="editor-inspector-colors flex h-9 items-center gap-2" aria-label={label}>
      {PRESET_GRAPH_LINE_COLORS.map((color) => {
        const selected = color.hex === selectedColor;
        return (
          <button
            key={color.hex}
            type="button"
            onClick={() => onChange(color.hex)}
            className={`grid h-7 w-7 place-items-center rounded border transition-colors ${
              selected ? "border-[var(--editor-accent)] ring-1 ring-[var(--editor-accent)]" : "border-[var(--editor-line)] hover:border-[var(--editor-muted)]"
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

"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

function focusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

function useOverlayFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => focusableElements(panelRef.current)[0]?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusableElements(panelRef.current);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { panelRef, onKeyDown };
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const { panelRef, onKeyDown } = useOverlayFocus(open, onClose);
  if (!open) return null;

  return (
    <div className="ui-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="ui-dialog"
        onKeyDown={onKeyDown}
      >
        <header className="ui-overlay__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </header>
        {children ? <div className="ui-dialog__body">{children}</div> : null}
        {footer ? <footer className="ui-overlay__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  side = "bottom",
  size = "half",
  title,
  onClose,
  children,
}: {
  open: boolean;
  side?: "bottom" | "left" | "right";
  size?: "compact" | "half" | "full";
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const { panelRef, onKeyDown } = useOverlayFocus(open, onClose);
  if (!open) return null;
  return (
    <div className="ui-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`ui-sheet ui-sheet--${side} ui-sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <header className="ui-overlay__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Close panel"><X size={18} /></button>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </div>
  );
}

export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="ui-disclosure" open={defaultOpen || undefined}>
      <summary>{label}</summary>
      <div className="ui-disclosure__body">{children}</div>
    </details>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ui-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}

export function VirtualList<T>({
  items,
  rowHeight,
  height,
  renderItem,
  overscan = 8,
  getKey,
}: {
  items: T[];
  rowHeight: number;
  height: number;
  overscan?: number;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(items.length, start + visible);

  return (
    <div className="ui-virtual-list" style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(start, end).map((item, offset) => {
          const index = start + offset;
          return (
            <div key={getKey(item)} style={{ position: "absolute", insetInline: 0, top: index * rowHeight, height: rowHeight }}>
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Menu({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", close, { capture: true });
    return () => window.removeEventListener("pointerdown", close, { capture: true });
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className="ui-menu" role="menu" aria-label={label}>{children}</div>;
}

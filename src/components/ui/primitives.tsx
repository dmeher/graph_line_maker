import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type ButtonTone = "default" | "primary" | "quiet" | "danger";

export function Button({
  tone = "default",
  pending = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  pending?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={classes("ui-button", `ui-button--${tone}`, className)}
    >
      <span className="ui-button__content">
        {pending ? <Loader2 size={16} className="ui-button__spinner animate-spin" aria-hidden="true" /> : null}
        {children}
      </span>
    </button>
  );
}

export function IconButton({
  label,
  pressed,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  pressed?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      title={props.title ?? label}
      aria-label={label}
      aria-pressed={pressed}
      className={classes("ui-icon-button", pressed && "is-active", className)}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const description = error ?? hint;
  const { leading, trailing, ...inputProps } = props;
  return (
    <label className={classes("ui-field", className)}>
      <span className="ui-field__label">{label}</span>
      <span className="ui-field__frame">
        {leading ? <span className="ui-field__leading" aria-hidden="true">{leading}</span> : null}
        <input
          {...inputProps}
          className={classes("ui-field__control", leading ? "has-leading" : null, trailing ? "has-trailing" : null)}
          aria-invalid={Boolean(error)}
        />
        {trailing ? <span className="ui-field__trailing">{trailing}</span> : null}
      </span>
      {description ? <span className={classes("ui-field__hint", error && "ui-field__hint--error")}>{description}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const description = error ?? hint;
  return (
    <label className={classes("ui-field", className)}>
      <span className="ui-field__label">{label}</span>
      <span className="ui-field__frame ui-field__frame--select">
        <select {...props} className="ui-field__control" aria-invalid={Boolean(error)}>
          {children}
        </select>
        <ChevronDown className="ui-field__select-icon" size={15} aria-hidden="true" />
      </span>
      {description ? <span className={classes("ui-field__hint", error && "ui-field__hint--error")}>{description}</span> : null}
    </label>
  );
}

export function StatusPill({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "ready" | "processing" | "offline" | "error";
}) {
  return (
    <span {...props} className={classes("ui-status-pill", `ui-status-pill--${tone}`, className)}>
      <i className="ui-status-pill__dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" className={classes("ui-skeleton", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={classes("ui-empty-state", className)}>
      {icon ? <span className="ui-empty-state__icon" aria-hidden="true">{icon}</span> : null}
      <div className="ui-empty-state__copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </section>
  );
}

export function ToastRegion({ children }: { children?: ReactNode }) {
  return (
    <div className="ui-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

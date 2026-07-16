import { useId } from "react";

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const gradientId = useId();
  const glowId = useId();

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Graph Pixel Maker" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#122C3A" />
        </linearGradient>
        <linearGradient id={glowId} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#008C8F" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={"url(#" + gradientId + ")"} />
      <path d="M14 16H50M14 27H50M14 38H50M14 49H50M16 14V50M27 14V50M38 14V50M49 14V50" stroke="#FFFFFF" strokeOpacity=".08" strokeWidth="1" />
      <g fill={"url(#" + glowId + ")"}>
        <rect x="15" y="15" width="8" height="8" rx="2.25" />
        <rect x="26" y="15" width="8" height="8" rx="2.25" />
        <rect x="37" y="15" width="8" height="8" rx="2.25" />
        <rect x="15" y="26" width="8" height="8" rx="2.25" />
        <rect x="15" y="37" width="8" height="8" rx="2.25" />
        <rect x="26" y="37" width="8" height="8" rx="2.25" />
        <rect x="37" y="37" width="8" height="8" rx="2.25" />
      </g>
      <rect x="37" y="26" width="8" height="8" rx="2.25" fill="#F8FAFC" />
      <circle cx="49" cy="15" r="3" fill="#F59E0B" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoMark className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-5 tracking-[-0.015em] text-[var(--brand-text,var(--ink))]">Graph Pixel Maker</p>
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--brand-muted,#64748b)]">Precision graph studio</p>
      </div>
    </div>
  );
}

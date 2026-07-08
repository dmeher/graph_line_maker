export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Graph Pixel Maker" className={className}>
      <rect x="6" y="6" width="14" height="14" rx="2" fill="#008c8f" />
      <rect x="25" y="6" width="14" height="14" rx="2" fill="#008c8f" />
      <rect x="44" y="6" width="14" height="14" rx="2" fill="#0f172a" />
      <rect x="6" y="25" width="14" height="14" rx="2" fill="#0f172a" />
      <rect x="25" y="25" width="14" height="14" rx="2" fill="#008c8f" />
      <rect x="44" y="25" width="14" height="14" rx="2" fill="#008c8f" />
      <rect x="6" y="44" width="14" height="14" rx="2" fill="#008c8f" />
      <rect x="25" y="44" width="14" height="14" rx="2" fill="#0f172a" />
      <rect x="44" y="44" width="14" height="14" rx="2" fill="#008c8f" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoMark className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-5 text-[var(--brand-text,var(--ink))]">Graph Pixel Maker</p>
      </div>
    </div>
  );
}

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={`brand-mark__logo ${className}`}
    >
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#1C2230" />
      <path
        d="M12 8V40M20 8V40M28 8V40M36 8V40M8 12H40M8 20H40M8 28H40M8 36H40"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity=".09"
        strokeWidth=".8"
      />
      <path
        d="M10 34.5C13.5 34.5 14.5 27 18 27C21.5 27 22.5 31 26 31C30.5 31 30.5 16 36 16H39"
        fill="none"
        stroke="#8DA8FF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7.5" y="32" width="5" height="5" rx="1.4" fill="#F7F7F9" />
      <rect x="23.5" y="28.5" width="5" height="5" rx="1.4" fill="#ED6548" />
      <rect x="33.5" y="13.5" width="5" height="5" rx="1.4" fill="#8DA8FF" />
      <circle cx="40" cy="16" r="2.4" fill="#ED6548" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <div className="brand-mark flex min-w-0 items-center gap-3">
      <LogoMark className="h-9 w-9 shrink-0" />
      <div className="brand-mark__copy min-w-0">
        <p className="brand-mark__title truncate text-[15px] font-semibold leading-5 tracking-[-0.015em] text-[var(--brand-text,var(--ink))]">
          Graph Pixel Maker
        </p>
        <p className="brand-mark__tagline truncate text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--brand-muted,var(--muted))]">
          Visual chart atelier
        </p>
      </div>
    </div>
  );
}

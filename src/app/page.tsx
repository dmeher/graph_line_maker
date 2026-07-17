import Link from "next/link";
import { ArrowRight, Grid3X3, ImageUp, Palette, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";

const features = [
  { label: "Any artwork in", icon: ImageUp, text: "PNG, JPG, WEBP, SVG, and multi-page PDF uploads with precision cropping." },
  { label: "Cell-perfect grids", icon: Grid3X3, text: "1 cm cells up to 20 × 125 cm, numbering, major lines, and dot patterns." },
  { label: "Smart line tracing", icon: Sparkles, text: "Vector line extraction with thickness, threshold, and fidelity controls." },
  { label: "Palette intelligence", icon: Palette, text: "Locked colors, live cell counts, and per-region fill overrides." },
  { label: "Print-ready output", icon: Printer, text: "Tiled PDF export sized for real paper, plus PNG and JSON." },
  { label: "Private workspace", icon: ShieldCheck, text: "Email-OTP sign-in with an admin-managed allowlist. No passwords." },
];

/** Decorative pixel-chart preview rendered with pure CSS grid cells. */
function HeroChart() {
  const cells: (0 | 1 | 2)[] = [
    0, 0, 1, 1, 0, 0, 0, 0,
    0, 1, 2, 2, 1, 0, 0, 0,
    1, 2, 2, 2, 2, 1, 0, 0,
    1, 2, 2, 2, 2, 1, 1, 0,
    0, 1, 2, 2, 2, 2, 2, 1,
    0, 0, 1, 1, 2, 2, 1, 0,
    0, 0, 0, 0, 1, 1, 0, 0,
  ];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2.5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Saree border draft</p>
          <p className="text-[11px] text-[var(--muted)]">20 × 125 cm · grid every 5 cells</p>
        </div>
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-[#e7edf5]" />
          <span className="h-3 w-3 rounded-[3px] bg-[var(--teal)]" />
          <span className="h-3 w-3 rounded-[3px] bg-amber-400" />
        </div>
      </div>
      <div className="rounded-xl bg-[#eef2f7] p-4">
        <div
          className="grid aspect-[8/7] gap-[3px] rounded-md p-2"
          style={{
            gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
            backgroundImage: "linear-gradient(#d7dee8 1px, transparent 1px), linear-gradient(90deg, #d7dee8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        >
          {cells.map((cell, index) => (
            <span
              key={index}
              className={
                cell === 2
                  ? "rounded-[2px] bg-[#134e4a]"
                  : cell === 1
                    ? "rounded-[2px] bg-[#2dd4bf]"
                    : "rounded-[2px] bg-transparent"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_30%_-20%,rgb(45_212_191_/_0.16),transparent_60%)]" aria-hidden="true" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandMark />
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--teal)] hover:text-[var(--teal)]"
        >
          Sign in
        </Link>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-[rgb(45_212_191_/_0.35)] bg-[var(--teal-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--teal)]">
            <Sparkles size={13} aria-hidden="true" />
            Line art → graph charts
          </p>
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Pixel-perfect graph charts from your{" "}
            <span className="bg-gradient-to-r from-[#2dd4bf] to-[#67e8f9] bg-clip-text text-transparent">line art</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)]">
            Upload a drawing, trace it onto a precision centimeter grid, refine every cell and color, and print it as a
            tiled, paper-accurate chart — all in one dark, focused studio.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--teal)] px-6 text-sm font-bold text-[#052722] shadow-[0_10px_30px_rgb(45_212_191_/_0.3)] transition hover:bg-[var(--brand-hover)]"
            >
              Start with email OTP
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <span className="text-xs font-semibold text-[var(--muted)]">Passwordless · allowlist only</span>
          </div>
        </div>

        <HeroChart />
      </section>

      <section className="relative border-t border-[var(--line)] bg-[rgb(19_27_41_/_0.4)]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <p className="page-eyebrow">Everything in the studio</p>
          <h2 className="mt-2 max-w-md text-2xl font-bold tracking-tight">Built for craft charts, from upload to print</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ label, icon: Icon, text }) => (
              <article
                key={label}
                className="group rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:border-[rgb(45_212_191_/_0.4)] hover:shadow-[0_14px_40px_rgb(0_0_0_/_0.35)]"
              >
                <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-[rgb(45_212_191_/_0.3)] bg-[var(--teal-soft)] text-[var(--teal)]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-bold text-[var(--foreground)]">{label}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--muted)]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8">
          <BrandMark />
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:text-[var(--brand-hover)]">
            Open your workspace <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Grid3X3, ImageUp, Palette, ShieldCheck } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { BrandMark } from "@/components/layout/brand-mark";

const features = [
  { label: "Upload", icon: ImageUp, text: "PNG, JPG, JPEG, WEBP, SVG" },
  { label: "Pixel grid", icon: Grid3X3, text: "Cell size, numbering, heavy lines" },
  { label: "Color counts", icon: Palette, text: "Palette locks and cell totals" },
  { label: "Private access", icon: ShieldCheck, text: "Brevo OTP allowlist" },
];

export default async function Home() {
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <BrandMark />
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white shadow-sm"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl">
            Graph Pixel Maker
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Convert lining and line-art images into accurate graph-paper pixel charts with grid controls, palette counts,
            and export-ready output.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--teal)] px-5 text-sm font-semibold text-white shadow-sm"
            >
              Start with email OTP
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm">
          <div className="rounded-md border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Saree border draft</p>
                <p className="text-xs text-slate-500">Grid every 5 cells</p>
              </div>
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-sm bg-slate-950" />
                <span className="h-3 w-3 rounded-sm bg-teal-500" />
                <span className="h-3 w-3 rounded-sm bg-amber-500" />
              </div>
            </div>
            <div className="grid aspect-[4/3] place-items-center p-5">
              <div className="h-full w-full rounded-sm border border-slate-300 bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[length:24px_24px] p-4">
                <div className="h-full w-full bg-[linear-gradient(135deg,transparent_0_35%,#111827_35%_41%,transparent_41%_100%),linear-gradient(45deg,transparent_0_55%,#0f766e_55%_62%,transparent_62%_100%)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 sm:px-6 md:grid-cols-4">
          {features.map(({ label, icon: Icon, text }) => (
            <article key={label} className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm">
              <Icon size={18} className="text-[var(--teal)]" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-slate-950">{label}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

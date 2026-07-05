import { Grid3X3 } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--teal)] text-white shadow-sm">
        <Grid3X3 size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">Graph Pixel Maker</p>
        <p className="truncate text-xs text-slate-500">Line art to graph chart</p>
      </div>
    </div>
  );
}


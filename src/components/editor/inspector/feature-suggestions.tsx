"use client";

import {
  Brush,
  Check,
  Grid3X3,
  Image,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

type FeatureToolCategory = {
  title: string;
  icon: LucideIcon;
  status: "enabled" | "deferred";
  items: string[];
};

const featureTools: FeatureToolCategory[] = [
  {
    title: "Drawing productivity",
    icon: Brush,
    status: "enabled",
    items: [
      "Use Draw > Drawing Tools for cell paint, shape drawing, and image-line erasing.",
      "Shift/Ctrl/Cmd-click layers for multi-select, then use batch duplicate/delete/lock/show/nudge.",
      "Layer edges and centers snap while moving; hold Alt to temporarily disable snapping.",
    ],
  },
  {
    title: "Image processing",
    icon: Image,
    status: "enabled",
    items: [
      "Source and clipart layers now support auto enhance, denoise, enhanced edges, and color reduction.",
      "These settings save inside the project settings JSON, so no database migration is needed.",
    ],
  },
  {
    title: "Grid and layout",
    icon: Grid3X3,
    status: "enabled",
    items: [
      "Graph > Grid Lines controls major-grid spacing, solid/dashed/dotted lines, and square/dot patterns.",
      "Graph > Productivity includes Cross-stitch, Pixel art, Dot grid, and A4 tiled print templates.",
    ],
  },
  {
    title: "Collaboration phase",
    icon: Users,
    status: "deferred",
    items: [
      "Share links, comments, and version history are intentionally deferred because they need schema and permission work.",
    ],
  },
];

export function FeatureSuggestions() {
  return (
    <section className="rounded-xl border border-[#d7dde5] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[#008c8f]">
          <Zap size={16} aria-hidden="true" />
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#101828]">
          Feature tools
        </h3>
      </div>
      <p className="mb-3 text-[12px] leading-5 text-[#667085]">
        Practical v1 tools are enabled in the editor. Database-heavy collaboration features remain a later phase.
      </p>
      <div className="space-y-3">
        {featureTools.map((category) => {
          const Icon = category.icon;
          const enabled = category.status === "enabled";
          return (
            <div key={category.title} className="rounded-lg border border-[#e8edf2] bg-[#f8fafc] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="text-[#008c8f]">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <h4 className="truncate text-[12px] font-bold text-[#101828]">{category.title}</h4>
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {enabled ? <Check size={11} aria-hidden="true" /> : null}
                  {enabled ? "On" : "Deferred"}
                </span>
              </div>
              <ul className="space-y-1.5">
                {category.items.map((item, index) => (
                  <li key={`${category.title}-${index}`} className="flex items-start gap-2 text-[11px] leading-4 text-[#475467]">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#008c8f]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import {
  Brush,
  Image,
  Grid3X3,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

type SuggestionCategory = {
  title: string;
  icon: LucideIcon;
  items: string[];
};

const suggestions: SuggestionCategory[] = [
  {
    title: "Enhanced Drawing Tools",
    icon: Brush,
    items: [
      "Eraser tool: Remove parts of drawings",
      "Shape snapping: Snap shapes to grid lines and other shapes",
      "Multi-select: Select multiple layers for batch operations",
    ],
  },
  {
    title: "Advanced Image Processing",
    icon: Image,
    items: [
      "Auto-enhance: Automatically adjust contrast/brightness of source images",
      "Edge detection: Enhanced edge detection algorithms",
      "Color quantization: Reduce colors in source image before processing",
      "Denoise: Remove noise from scanned images",
    ],
  },
  {
    title: "Grid & Layout Features",
    icon: Grid3X3,
    items: [
      "Custom grid subdivisions: Beyond current 5 subdivisions",
      "Isometric grid mode: For isometric graph paper",
      "Custom grid patterns: Dot grid, hex grid, logarithmic grid",
      "Grid line styles: Dashed, dotted, custom patterns",
      "Multiple graph areas: Support for non-contiguous graph regions",
    ],
  },
  {
    title: "Collaboration & Sharing",
    icon: Users,
    items: [
      "Comment system: Add annotations to specific regions",
      "Version history: Visual timeline of changes with thumbnails",
      "Share links: Read-only sharing with customizable permissions",
    ],
  },
  {
    title: "Productivity Features",
    icon: Zap,
    items: [
      "Templates: Pre-built graph templates (cross-stitch patterns, pixel art grids)",
      "Batch operations: Apply settings to multiple layers at once",
      "Keyboard shortcuts: Customizable shortcut system",
      "Auto-save intervals: Configurable auto-save frequency",
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
          Feature Suggestions
        </h3>
      </div>
      <p className="mb-3 text-[12px] leading-5 text-[#667085]">
        Ideas on the roadmap. These are read-only previews of capabilities we are
        considering for future releases.
      </p>
      <div className="space-y-3">
        {suggestions.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.title}
              className="rounded-lg border border-[#e8edf2] bg-[#f8fafc] p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[#008c8f]">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <h4 className="text-[12px] font-bold text-[#101828]">
                  {category.title}
                </h4>
              </div>
              <ul className="space-y-1.5">
                {category.items.map((item, index) => (
                  <li
                    key={`${category.title}-${index}`}
                    className="flex items-start gap-2 text-[11px] leading-4 text-[#475467]"
                  >
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

export const GRAPH_EXPORT_LOGO_OPTIONS = [
  {
    id: "current",
    label: "Current logo",
    description: "Jitendra Meher Haradakhol",
    path: "/brand/company-hallmark.jpeg",
  },
  {
    id: "prafulka-design",
    label: "Prafulka Design",
    description: "Graph artist Jitendra Meher",
    path: "/brand/prafulka-design.jpeg",
  },
] as const;

export type GraphExportLogoId = (typeof GRAPH_EXPORT_LOGO_OPTIONS)[number]["id"];

export function graphExportLogoPath(logoId: GraphExportLogoId) {
  return GRAPH_EXPORT_LOGO_OPTIONS.find((option) => option.id === logoId)?.path
    ?? GRAPH_EXPORT_LOGO_OPTIONS[0].path;
}

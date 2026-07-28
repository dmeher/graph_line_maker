import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Graph Pixel Maker",
    short_name: "Graph Pixel",
    description: "Convert line-art images into graph-paper pixel charts.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    categories: ["productivity", "utilities", "graphics"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

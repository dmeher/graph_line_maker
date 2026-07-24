import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray, empty package-lock.json in
  // the parent `Coaching/` directory otherwise makes Next.js infer the wrong
  // root and emit a multiple-lockfiles warning.
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@neplex/vectorizer"],
  // The editor E2E contract requires no framework overlay; the dev-tools badge
  // also overlaps the mobile bottom dock and intercepts taps.
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

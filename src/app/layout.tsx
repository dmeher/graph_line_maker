import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./atelier.css";
import "./atelier-workspace.css";
import "./atelier-editor.css";
import "./atelier-polish.css";
import "./atelier-editor-studio.css";

export const viewport: Viewport = {
  themeColor: "#f4f3ef",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Graph Pixel Maker",
    template: "%s - Graph Pixel Maker",
  },
  description:
    "Convert line-art images into accurate graph-paper pixel charts with palette controls and export tools.",
  applicationName: "Graph Pixel Maker",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Graph Pixel Maker",
    statusBarStyle: "black-translucent",
  },
};

const serviceWorkerRegistrationScript = `
(() => {
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {});
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
})();
`;

const themePreferenceScript = `
(() => {
  const storageKey = "graph-pixel-theme";
  const editorStorageKey = "graph-pixel-editor-theme";
  const projectViewStorageKey = "graph-pixel-project-view";
  const colors = { dark: "#111319", light: "#f4f3ef" };
  let theme = "light";
  let editorTheme = "dark";
  let projectView = "grid";
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "dark" || stored === "light") {
      theme = stored;
      editorTheme = stored;
    }
    const storedEditorTheme = window.localStorage.getItem(editorStorageKey);
    if (storedEditorTheme === "dark" || storedEditorTheme === "light") editorTheme = storedEditorTheme;
    const storedProjectView = window.localStorage.getItem(projectViewStorageKey);
    if (storedProjectView === "grid" || storedProjectView === "list") projectView = storedProjectView;
  } catch {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.editorTheme = editorTheme;
  document.documentElement.dataset.projectView = projectView;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[theme]);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-editor-theme="dark"
      data-project-view="grid"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: themePreferenceScript }} />
        {children}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistrationScript }} />
      </body>
    </html>
  );
}

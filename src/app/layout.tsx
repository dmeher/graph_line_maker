import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import "./globals.css";

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
  appleWebApp: {
    capable: true,
    title: "Graph Pixel Maker",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

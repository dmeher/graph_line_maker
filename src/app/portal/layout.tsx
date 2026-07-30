import type { Metadata, Viewport } from "next";
import "./portal.css";

export const metadata: Metadata = {
  title: {
    default: "Study Portal",
    template: "%s · Study Portal",
  },
  description: "A mobile-first coaching companion for lessons, practice, and live classes.",
};

export const viewport: Viewport = {
  themeColor: "#101935",
  colorScheme: "light",
};

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="portal-app">{children}</div>;
}

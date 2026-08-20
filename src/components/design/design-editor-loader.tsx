"use client";

import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/types";

const DesignEditorClient = dynamic(() => import("@/components/design/design-editor-client").then((module) => module.DesignEditorClient), { ssr: false, loading: () => <div className="design-editor-loading"><span className="animate-spin" /> Loading Design studio…</div> });

export function DesignEditorLoader({ design, sessionUserId }: { design: Design; sessionUserId: string }) {
  return <DesignEditorClient design={design} sessionUserId={sessionUserId} />;
}

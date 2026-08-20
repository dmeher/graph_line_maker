import type { Metadata } from "next";
import { listDesignSummaries } from "@/lib/design/server";
import { NewDesignForm } from "@/components/design/new-design-form";

export const metadata: Metadata = { title: "New Design | Graph Pixel Maker" };

export default async function NewDesignPage() {
  const templates = await listDesignSummaries({ kind: "template", limit: 48 });
  return <NewDesignForm personalTemplates={templates} />;
}

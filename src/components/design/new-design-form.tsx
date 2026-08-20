"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, FileImage, LayoutTemplate, LoaderCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { BUILT_IN_DESIGN_TEMPLATES, createBlankDesignDocument, createDesignImageNode } from "@/lib/design/defaults";
import { normalizeDesignFile, uploadDesignFiles } from "@/lib/design/image-client";
import type { DesignSummary } from "@/lib/design/types";
import { IMAGE_ACCEPT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS } from "@/lib/canvas/performance-limits";

export function NewDesignForm({ personalTemplates }: { personalTemplates: DesignSummary[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("Untitled design");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [background, setBackground] = useState<string | null>("#ffffff");

  async function createFromTemplate(templateId: string, personal = false) {
    setBusy(true); setMessage(null);
    try {
      const response = personal
        ? await fetch(`/api/designs/${templateId}/duplicate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, kind: "document" }) })
        : await fetch("/api/designs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, templateId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.designId) throw new Error(payload.message || "Unable to create Design.");
      router.push(`/design/${payload.designId}`);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Unable to create Design."); }
  }

  async function createBlank() {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width * height > MAX_CANVAS_PIXELS) {
      setMessage(`Canvas must stay within ${MAX_CANVAS_DIMENSION.toLocaleString()} px per axis and ${MAX_CANVAS_PIXELS.toLocaleString()} total pixels.`);
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const document = createBlankDesignDocument(width, height, background);
      const response = await fetch("/api/designs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, document }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.designId) throw new Error(payload.message || "Unable to create Design.");
      router.push(`/design/${payload.designId}`);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Unable to create Design."); }
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) { setMessage("Keep the uploaded file under 50 MB."); return; }
    setBusy(true); setMessage("Preparing image…");
    let pendingDesignId: string | null = null;
    try {
      const normalized = await normalizeDesignFile(file, file.name);
      const document = createBlankDesignDocument(normalized.width, normalized.height, null);
      const create = await fetch("/api/designs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title === "Untitled design" ? file.name.replace(/\.[^.]+$/, "") : title, document }) });
      const created = await create.json().catch(() => ({}));
      if (!create.ok || !created.designId) throw new Error(created.message || "Unable to create Design.");
      pendingDesignId = created.designId;
      const fileId = crypto.randomUUID();
      const [uploaded] = await uploadDesignFiles(created.designId, [{ metadata: { id: fileId, name: normalized.name, type: normalized.type, size: normalized.blob.size, width: normalized.width, height: normalized.height }, blob: normalized.blob }]);
      document.nodes.push(createDesignImageNode({ fileId: uploaded.id, name: normalized.name, width: normalized.width, height: normalized.height }));
      const save = await fetch(`/api/designs/${created.designId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseRevision: 1, document }) });
      const saved = await save.json().catch(() => ({}));
      if (!save.ok) throw new Error(saved.message || "Unable to initialize Design.");
      pendingDesignId = null;
      router.push(`/design/${created.designId}`);
    } catch (error) { if (pendingDesignId) await fetch(`/api/designs/${pendingDesignId}`, { method: "DELETE" }).catch(() => {}); setBusy(false); setMessage(error instanceof Error ? error.message : "Unable to upload image."); }
  }

  return <div className="new-design workspace-page">
    <header className="new-design__header"><Link href="/design"><ArrowLeft size={17} /> Design workspace</Link><div><p className="eyebrow">New canvas</p><h1>Create a Design</h1><p>Start with an image, a canvas preset, or one of your reusable templates.</p></div></header>
    <label className="new-design__title"><span>Name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label>
    {message ? <p className="design-notice" role="status">{message}</p> : null}
    <section className="new-design__upload"><div><Upload size={24} /><h2>Upload artwork</h2><p>PNG, JPEG, WEBP, SVG, or the first page of a PDF. Large images are safely normalized.</p></div><button type="button" className="ui-button ui-button--primary" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <FileImage size={17} />} Choose image</button><input ref={inputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /></section>
    <section className="new-design__section"><div className="new-design__section-title"><LayoutTemplate size={19} /><div><h2>Canvas presets</h2><p>Choose a standard layout or set exact pixel dimensions.</p></div></div><div className="new-design__presets">{BUILT_IN_DESIGN_TEMPLATES.map((template) => <button type="button" key={template.id} disabled={busy} onClick={() => createFromTemplate(template.id)}><span style={{ aspectRatio: `${template.width}/${template.height}` }} /><strong>{template.title}</strong><small>{template.width} × {template.height}</small></button>)}</div>
      <div className="new-design__custom"><label>Width<input type="number" min={1} max={24000} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Height<input type="number" min={1} max={24000} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label><label>Background<select value={background ?? "transparent"} onChange={(event) => setBackground(event.target.value === "transparent" ? null : event.target.value)}><option value="#ffffff">White</option><option value="#000000">Black</option><option value="transparent">Transparent</option></select></label><button type="button" className="ui-button" disabled={busy} onClick={createBlank}>Create custom canvas</button></div>
    </section>
    {personalTemplates.length ? <section className="new-design__section"><div className="new-design__section-title"><LayoutTemplate size={19} /><div><h2>My templates</h2><p>Editable templates keep their original layers and assets.</p></div></div><div className="new-design__template-list">{personalTemplates.map((template) => <button type="button" key={template.id} disabled={busy} onClick={() => createFromTemplate(template.id, true)}><strong>{template.title}</strong><small>{template.nodeCount} layers</small></button>)}</div></section> : null}
  </div>;
}

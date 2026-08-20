"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileImage, FolderOpen, LayoutTemplate, LoaderCircle, Plus, Search, Shapes, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CurrentSession } from "@/lib/types";
import type { DesignLibraryItem, DesignSummary } from "@/lib/design/types";

type WorkspaceTab = "library" | "drafts" | "templates";

type LibraryCursor = { updatedAt: string; id: string } | null;

export function DesignWorkspace({ session, initialLibrary, initialLibraryCursor, initialDrafts, initialTemplates }: { session: CurrentSession; initialLibrary: DesignLibraryItem[]; initialLibraryCursor: LibraryCursor; initialDrafts: DesignSummary[]; initialTemplates: DesignSummary[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>(() => initialLibrary.length || !initialDrafts.length ? "library" : "drafts");
  const [kind, setKind] = useState<"all" | "design" | "clipart">("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [library, setLibrary] = useState(initialLibrary);
  const [libraryCursor, setLibraryCursor] = useState<LibraryCursor>(initialLibraryCursor);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [templates, setTemplates] = useState(initialTemplates);
  const initialFilterRender = useRef(true);

  const filteredLibrary = library;
  const activeDesigns = tab === "drafts" ? drafts : templates;
  const filteredDesigns = useMemo(() => activeDesigns.filter((item) => !deferredQuery || `${item.title} ${item.ownerEmail}`.toLowerCase().includes(deferredQuery)), [activeDesigns, deferredQuery]);

  useEffect(() => {
    if (initialFilterRender.current) { initialFilterRender.current = false; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLibraryLoading(true); setNotice(null);
      const params = new URLSearchParams({ limit: "48" });
      if (query.trim()) params.set("query", query.trim());
      if (kind !== "all") params.set("kind", kind);
      try {
        const response = await fetch(`/api/design-library?${params}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to search the Design library.");
        setLibrary(payload.items ?? []); setLibraryCursor(payload.nextCursor ?? null);
      } catch (error) { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Unable to search the Design library."); }
      finally { if (!controller.signal.aborted) setLibraryLoading(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [kind, query]);

  async function loadMoreLibrary() {
    if (!libraryCursor || libraryLoading) return;
    setLibraryLoading(true); setNotice(null);
    const params = new URLSearchParams({ limit: "48", cursorUpdatedAt: libraryCursor.updatedAt, cursorId: libraryCursor.id });
    if (query.trim()) params.set("query", query.trim());
    if (kind !== "all") params.set("kind", kind);
    try {
      const response = await fetch(`/api/design-library?${params}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to load more library items.");
      setLibrary((current) => [...current, ...(payload.items ?? []).filter((item: DesignLibraryItem) => !current.some((entry) => entry.id === item.id))]);
      setLibraryCursor(payload.nextCursor ?? null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load more library items."); }
    finally { setLibraryLoading(false); }
  }

  async function deleteDesign(item: DesignSummary) {
    if (!window.confirm(`Delete “${item.title}”? This removes its private editable document.`)) return;
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch(`/api/designs/${item.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to delete Design.");
      if (item.kind === "template") setTemplates((current) => current.filter((entry) => entry.id !== item.id));
      else setDrafts((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete Design.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLibraryItem(item: DesignLibraryItem) {
    if (!window.confirm(`Remove “${item.title}” from the shared library? Existing project copies remain safe.`)) return;
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch(`/api/design-library/${item.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to delete library item.");
      setLibrary((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete library item.");
    } finally {
      setBusyId(null);
    }
  }

  async function remix(item: DesignLibraryItem) {
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch(`/api/design-library/${item.id}/remix`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.designId) throw new Error(payload.message || "Unable to create remix.");
      router.push(`/design/${payload.designId}`);
    } catch (error) {
      setBusyId(null);
      setNotice(error instanceof Error ? error.message : "Unable to create remix.");
    }
  }

  return (
    <div className="design-hub workspace-page">
      <header className="design-hub__hero">
        <div><p className="eyebrow">Creative workspace</p><h1>Design</h1><p>Extract line art, build layered compositions, and publish reusable image assets.</p></div>
        <Link href="/design/new" className="ui-button ui-button--primary"><Plus size={17} /> New Design</Link>
      </header>

      <section className="design-hub__controls" aria-label="Design workspace filters">
        <div className="design-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-active" : ""} onClick={() => setTab("library")}><FolderOpen size={16} /> Workspace</button>
          <button type="button" role="tab" aria-selected={tab === "drafts"} className={tab === "drafts" ? "is-active" : ""} onClick={() => setTab("drafts")}><FileImage size={16} /> Drafts</button>
          <button type="button" role="tab" aria-selected={tab === "templates"} className={tab === "templates" ? "is-active" : ""} onClick={() => setTab("templates")}><LayoutTemplate size={16} /> Templates</button>
        </div>
        <label className="design-search"><Search size={16} /><span className="sr-only">Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs, tags, or owners" /></label>
        {tab === "library" ? <div className="design-kind-filter"><button type="button" className={kind === "all" ? "is-active" : ""} onClick={() => setKind("all")}>All</button><button type="button" className={kind === "design" ? "is-active" : ""} onClick={() => setKind("design")}>Designs</button><button type="button" className={kind === "clipart" ? "is-active" : ""} onClick={() => setKind("clipart")}>Cliparts</button></div> : null}
      </section>

      {notice ? <p className="design-notice" role="alert">{notice}</p> : null}
      {tab === "library" ? (
        <section className="design-card-grid" aria-label="Shared Design library" aria-busy={libraryLoading}>
          {filteredLibrary.map((item) => {
            const canManage = item.userId === session.userId || session.role === "admin";
            return <article className="design-card" key={item.id}>
              <div className="design-card__preview">{item.thumbUrl || item.url ? <Image src={item.thumbUrl || item.url!} alt="" fill sizes="(max-width: 700px) 50vw, 240px" unoptimized /> : <Shapes size={36} />}</div>
              <div className="design-card__body"><span className="design-card__kind">{item.kind}</span><h2>{item.title}</h2><p>{item.ownerDisplayName || item.ownerEmail}</p>{item.tags.length ? <div className="design-card__tags">{item.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</div>
              <div className="design-card__actions">{canManage && item.sourceDesignId ? <Link href={`/design/${item.sourceDesignId}`}><FolderOpen size={15} /> Edit</Link> : <button type="button" onClick={() => remix(item)} disabled={busyId === item.id}>{busyId === item.id ? <LoaderCircle className="animate-spin" size={15} /> : <Copy size={15} />} Remix</button>}{canManage ? <button type="button" className="is-danger" onClick={() => deleteLibraryItem(item)} disabled={busyId === item.id} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button> : null}</div>
            </article>;
          })}
        </section>
      ) : (
        <section className="design-card-grid" aria-label={tab === "drafts" ? "Editable Design drafts" : "Personal templates"}>
          {filteredDesigns.map((item) => <article className="design-card" key={item.id}>
            <Link href={`/design/${item.id}`} className="design-card__preview">{item.previewThumbUrl || item.previewUrl ? <Image src={item.previewThumbUrl || item.previewUrl!} alt="" fill sizes="(max-width: 700px) 50vw, 240px" unoptimized /> : <LayoutTemplate size={36} />}</Link>
            <div className="design-card__body"><span className="design-card__kind">{item.kind}</span><h2><Link href={`/design/${item.id}`}>{item.title}</Link></h2><p>{item.nodeCount} layer{item.nodeCount === 1 ? "" : "s"} · Revision {item.revision}</p></div>
            <div className="design-card__actions"><Link href={`/design/${item.id}`}><FolderOpen size={15} /> Open</Link><button type="button" className="is-danger" onClick={() => deleteDesign(item)} disabled={busyId === item.id} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button></div>
          </article>)}
        </section>
      )}
      {tab === "library" && libraryCursor ? <div className="design-load-more"><button type="button" onClick={loadMoreLibrary} disabled={libraryLoading}>{libraryLoading ? <LoaderCircle className="animate-spin" size={16} /> : null} Load more</button></div> : null}
      {(tab === "library" ? filteredLibrary.length : filteredDesigns.length) === 0 && !libraryLoading ? <div className="design-empty"><Shapes size={30} /><h2>Nothing here yet</h2><p>Create a Design or adjust the current filters.</p><Link href="/design/new" className="ui-button ui-button--primary"><Plus size={16} /> Create Design</Link></div> : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Crop,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Maximize2,
  MoreVertical,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { CropPixels } from "@/lib/canvas/crop";
import { ALLOWED_IMAGE_LABEL, IMAGE_ACCEPT, MAX_UPLOAD_BYTES, isAllowedImageFile, isPdfFile } from "@/lib/constants";
import { cropQueueItemId, cropQueueStatus, shouldCropQueuedFile } from "@/lib/projects/crop-queue";
import { bytesToSize } from "@/lib/utils/format";

const ManualCropper = dynamic(() => import("@/components/projects/manual-cropper").then((module) => module.ManualCropper), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] place-items-center text-sm font-semibold text-[#667085]">Preparing crop</div>,
});

type CropQueueItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  crop: CropPixels | null;
  previewPending: boolean;
  issue: string | null;
};

const placeholderRows = [
  ["tulip_01.png", "1024 x 1280", "Cropped"],
  ["tulip_02.png", "1200 x 1500", "Needs crop"],
  ["leaves.svg", "800 x 800", "Cropped"],
  ["pot.png", "1024 x 768", "Cropped"],
  ["border.pdf", "1 page", "Needs crop"],
  ["details_01.png", "900 x 900", "Needs crop"],
] as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

function readSvgDimension(value: string) {
  if (!value) return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function readSvgSize(svgText: string) {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = document.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;
  const width = readSvgDimension(svg.getAttribute("width") || "");
  const height = readSvgDimension(svg.getAttribute("height") || "");
  if (width && height) return { width: Math.round(width), height: Math.round(height) };
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+|,/).map(Number).filter(Number.isFinite);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return { width: Math.round(viewBox[2]), height: Math.round(viewBox[3]) };
  return null;
}

function fileIssueFor(file: File | null) {
  if (!file) return null;
  if (!isAllowedImageFile(file)) return `Use ${ALLOWED_IMAGE_LABEL}.`;
  if (file.size > MAX_UPLOAD_BYTES) return `File must be ${bytesToSize(MAX_UPLOAD_BYTES)} or smaller.`;
  return null;
}

function canvasToPngUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error("Unable to render PDF preview."));
    }, "image/png");
  });
}

async function pdfPreviewUrl(file: File) {
  const { renderPdfFirstPageToCanvas } = await import("@/lib/canvas/pdf");
  const { canvas } = await renderPdfFirstPageToCanvas(file);
  return canvasToPngUrl(canvas);
}

async function previewUrlFor(file: File) {
  if (isPdfFile(file)) return pdfPreviewUrl(file);
  return URL.createObjectURL(file);
}

async function cropFile(file: File, imageUrl: string, cropPixels: CropPixels | null) {
  if (!cropPixels) return file;
  const outputType = file.type === "image/svg+xml" || isPdfFile(file) ? "image/png" : file.type || "image/png";
  const { cropImageUrlToFile } = await import("@/lib/canvas/crop");
  return cropImageUrlToFile(imageUrl, cropPixels, file.name, outputType);
}

async function readImageSize(file: File) {
  if (isPdfFile(file)) {
    const { readPdfFirstPageSize } = await import("@/lib/canvas/pdf");
    const pdfSize = await readPdfFirstPageSize(file);
    return { width: pdfSize.width, height: pdfSize.height };
  }
  if (file.type === "image/svg+xml") {
    const svgSize = readSvgSize(await file.text());
    if (svgSize) return svgSize;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function revokeCropItem(item: CropQueueItem) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

function PlaceholderLineArt() {
  return (
    <svg viewBox="0 0 640 760" className="h-full w-full bg-white" role="img" aria-label="Tulip crop placeholder">
      <path d="M312 430c-6-88-2-156 12-204" stroke="#3f3f46" strokeWidth="9" fill="none" />
      <path d="M320 218c-70-22-112-88-102-160 54 23 91 60 102 160Z" fill="none" stroke="#3f3f46" strokeWidth="7" />
      <path d="M326 220c56-52 102-84 162-58-8 70-72 109-162 58Z" fill="none" stroke="#3f3f46" strokeWidth="7" />
      <path d="M318 214c-22-82 6-146 72-184 31 80 3 146-72 184Z" fill="none" stroke="#3f3f46" strokeWidth="7" />
      <path d="M307 454c-86-118-165-126-250-110 54 95 135 132 250 110Z" fill="none" stroke="#3f3f46" strokeWidth="8" />
      <path d="M332 450c82-122 165-132 253-94-66 92-147 123-253 94Z" fill="none" stroke="#3f3f46" strokeWidth="8" />
      <path d="M158 540h320l-24 126H184z" fill="none" stroke="#3f3f46" strokeWidth="9" />
      <path d="M140 510h356v40H140z" fill="none" stroke="#3f3f46" strokeWidth="9" />
      <path d="M180 602h270M195 636h240" stroke="#8a8a8a" strokeWidth="3" fill="none" />
      <path d="M74 380h498M74 540h498M216 40v640M416 40v640" stroke="#c7cdd4" strokeDasharray="8 8" strokeWidth="2" />
    </svg>
  );
}

function formatDimensions(item: CropQueueItem) {
  return item.width && item.height ? `${item.width} x ${item.height}` : "Preparing size";
}

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Flower Pattern");
  const [description, setDescription] = useState("Tulip flower pattern for cross stitch");
  const [cropItems, setCropItems] = useState<CropQueueItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const previewTokenRef = useRef(0);
  const cropItemsRef = useRef<CropQueueItem[]>([]);

  useEffect(() => {
    cropItemsRef.current = cropItems;
  }, [cropItems]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      previewTokenRef.current += 1;
      cropItemsRef.current.forEach(revokeCropItem);
    };
  }, []);

  const fileIssue = useMemo(() => cropItems.find((item) => item.issue)?.issue ?? null, [cropItems]);
  const previewPending = useMemo(() => cropItems.some((item) => item.previewPending), [cropItems]);
  const croppedCount = useMemo(() => cropItems.filter((item) => item.crop).length, [cropItems]);
  const selectedIndex = cropItems.findIndex((item) => item.id === selectedItemId);
  const selectedItem = selectedIndex >= 0 ? cropItems[selectedIndex] : cropItems[0] ?? null;
  const progressTotal = cropItems.length || 8;
  const progressCropped = cropItems.length ? croppedCount : 3;
  const progressRemaining = Math.max(0, progressTotal - progressCropped);
  const progressPercent = Math.round((progressCropped / progressTotal) * 100);

  function updateItemCrop(itemId: string, crop: CropPixels | null) {
    setCropItems((current) => current.map((item) => (item.id === itemId ? { ...item, crop } : item)));
  }

  function selectRelativeItem(direction: -1 | 1) {
    if (!cropItems.length) return;
    const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (startIndex + direction + cropItems.length) % cropItems.length;
    setSelectedItemId(cropItems[nextIndex].id);
  }

  function selectFiles(nextFiles: FileList | File[] | null) {
    const previewToken = previewTokenRef.current + 1;
    previewTokenRef.current = previewToken;
    const selectedFiles = Array.from(nextFiles ?? []);
    const baseItems = selectedFiles.map((file, index) => {
      const issue = fileIssueFor(file);
      return { id: cropQueueItemId(file, index), file, previewUrl: null, width: null, height: null, crop: null, previewPending: !issue, issue };
    });

    setMessage(null);
    setCropItems((current) => {
      current.forEach(revokeCropItem);
      return baseItems;
    });
    setSelectedItemId(baseItems[0]?.id ?? null);
    if (selectedFiles[0]) setTitle(selectedFiles[0].name.replace(/\.[^.]+$/, ""));
    if (!baseItems.length) return;

    void Promise.all(
      baseItems.map(async (item) => {
        if (item.issue) return { ...item, previewPending: false };
        try {
          const [previewUrl, size] = await Promise.all([previewUrlFor(item.file), readImageSize(item.file)]);
          return { ...item, previewUrl, width: size.width, height: size.height, previewPending: false };
        } catch {
          return { ...item, previewPending: false, issue: isPdfFile(item.file) ? "Unable to render the PDF preview." : "Unable to prepare this file for crop review." };
        }
      }),
    ).then((hydratedItems) => {
      if (previewTokenRef.current !== previewToken) {
        hydratedItems.forEach(revokeCropItem);
        return;
      }
      setCropItems((current) => {
        current.forEach(revokeCropItem);
        return hydratedItems;
      });
      setSelectedItemId((current) => current ?? hydratedItems[0]?.id ?? null);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cropItems.length || fileIssue || previewPending) return;
    if (!isOnline) {
      setMessage("Creating a new project needs a connection because source files must be uploaded.");
      return;
    }
    setPending(true);
    setMessage(null);

    try {
      const uploadFiles = await Promise.all(
        cropItems.map((item) => (shouldCropQueuedFile(item.crop, item.previewUrl) ? cropFile(item.file, item.previewUrl as string, item.crop) : item.file)),
      );
      const size = await readImageSize(uploadFiles[0]);
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("width", String(size.width));
      formData.set("height", String(size.height));
      for (const uploadFile of uploadFiles) formData.append("files", uploadFile);

      const response = await fetch("/api/projects", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to create project.");
      router.push(payload.redirectTo || `/projects/${payload.projectId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create project.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="create-workbench fixed inset-x-0 bottom-0 top-16 z-20 grid grid-rows-[1fr_144px] bg-white md:left-[128px]">
      <div className="create-workbench-main grid min-h-0 grid-cols-[330px_160px_minmax(0,1fr)] border-t border-[#d7dde5]">
        <aside className="create-workbench-details min-h-0 overflow-y-auto border-r border-[#d7dde5] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#101828]">Project details</h2>
          <label className="mt-4 block text-sm font-medium text-[#344054]" htmlFor="title">Title *</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} className="mock-input mt-2 h-10" required />
          <label className="mt-4 block text-sm font-medium text-[#344054]" htmlFor="description">Description</label>
          <textarea id="description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} className="mock-input mt-2 min-h-20 resize-none" />
          <p className="mt-1 text-right text-xs text-[#667085]">{description.length} / 500</p>

          <h2 className="mt-5 text-lg font-semibold text-[#101828]">Upload files</h2>
          <p className="mt-1 text-sm text-[#667085]">Up to 12 images/PDF/SVG (line art recommended)</p>
          <label className="mt-4 grid h-[116px] cursor-pointer place-items-center rounded-lg border border-dashed border-[#cfd7df] bg-white text-center hover:border-[#008c8f]">
            <span>
              <CloudUpload size={26} className="mx-auto text-[#101828]" strokeWidth={1.8} />
              <span className="mt-2 block text-sm font-medium text-[#101828]">Drag & drop files here</span>
              <span className="text-sm font-medium text-[#008c8f]">or click to browse</span>
              <span className="mt-3 block text-xs text-[#667085]">PNG, JPG, SVG, PDF - Max 12 files - Max 50MB each</span>
            </span>
            <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={(event) => { const selectedFiles = Array.from(event.target.files ?? []); event.target.value = ""; selectFiles(selectedFiles); }} />
          </label>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#101828]">Files ({cropItems.length || 8} / 12)</p>
            <button type="button" className="text-sm font-semibold text-[#008c8f]" onClick={() => setCropItems([])}>Clear all</button>
          </div>
          <div className="mt-3 divide-y divide-[#e8edf2] overflow-hidden rounded-md border border-[#d7dde5]">
            {cropItems.length
              ? cropItems.map((item) => {
                  const selected = selectedItem?.id === item.id;
                  return (
                    <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 p-2 text-left ${selected ? "bg-[#f0fafa] ring-1 ring-inset ring-[#008c8f]" : "bg-white"}`}>
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-10 w-10 rounded border border-[#d7dde5] object-contain p-1" /> : <span className="grid h-10 w-10 place-items-center rounded border border-[#d7dde5]"><ImageIcon size={17} /></span>}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#101828]">{item.file.name}</span><span className="text-xs text-[#667085]">{formatDimensions(item)}</span></span>
                      <span className={`min-w-0 truncate rounded px-2 py-0.5 text-xs font-medium ${item.crop ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#ffedd5] text-[#c2410c]"}`}>{cropQueueStatus(item.crop)}</span>
                    </button>
                  );
                })
              : placeholderRows.map(([name, size, status], index) => (
                  <div key={name} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 p-2 ${index === 0 ? "bg-[#f0fafa] ring-1 ring-inset ring-[#008c8f]" : "bg-white"}`}>
                    <span className="grid h-10 w-10 place-items-center rounded border border-[#d7dde5] bg-white text-[#667085]">{name.endsWith(".pdf") ? <FileText size={18} /> : <PlaceholderLineArt />}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#101828]">{name}</span><span className="text-xs text-[#667085]">{size}</span></span>
                    <span className="flex min-w-0 items-center gap-2"><span className={`truncate rounded px-2 py-0.5 text-xs font-medium ${status === "Cropped" ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#ffedd5] text-[#c2410c]"}`}>{status}</span>{status === "Cropped" ? <Check size={16} className="shrink-0 text-[#15803d]" /> : <MoreVertical size={16} className="shrink-0" />}</span>
                  </div>
                ))}
          </div>
          {fileIssue ? <p className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} />{fileIssue}</p> : null}
          {message ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
        </aside>

        <aside className="create-workbench-tools min-h-0 overflow-y-auto border-r border-[#d7dde5] bg-white p-5">
          <div className="grid gap-2">
            <div className="rounded-lg border border-[#d7dde5] p-3 text-center">
              <p className="mb-2 text-sm font-medium text-[#101828]">Zoom</p>
              <button type="button" className="mock-btn h-9 w-full"><ZoomIn size={16} /> </button>
              <p className="py-2 text-sm text-[#344054]">100%</p>
              <button type="button" className="mock-btn h-9 w-full"><ZoomOut size={16} /> </button>
            </div>
            <button type="button" className="mock-btn h-[76px] flex-col"><Crop size={20} />Fit</button>
            <button type="button" className="mock-btn h-[76px] flex-col"><Maximize2 size={20} />Full image</button>
            <button type="button" onClick={() => selectedItem && updateItemCrop(selectedItem.id, null)} className="mock-btn h-[76px] flex-col"><RotateCcw size={20} />Reset crop</button>
            <p className="pt-2 text-sm font-medium text-[#344054]">Rotate</p>
            <div className="grid grid-cols-2 gap-2"><button type="button" className="mock-btn h-9 px-0"><RotateCcw size={16} /></button><button type="button" className="mock-btn h-9 px-0"><RotateCw size={16} /></button></div>
            <div className="rounded-lg border border-[#d7dde5] p-3 text-sm leading-6 text-[#344054]">
              <p>Original<br /><span className="font-medium text-[#101828]">{selectedItem ? formatDimensions(selectedItem) : "1024 x 1280"}</span></p>
              <p className="mt-2">Crop<br /><span className="font-medium text-[#101828]">{selectedItem?.crop ? `${selectedItem.crop.width} x ${selectedItem.crop.height}` : "860 x 1060"}</span></p>
              <p className="mt-2">Aspect<br /><span className="font-medium text-[#101828]">Auto</span></p>
              <p className="mt-2">Selection<br /><span className="font-medium text-[#15803d]">Active</span></p>
            </div>
          </div>
        </aside>

        <main className="create-workbench-stage grid min-h-0 grid-rows-[64px_minmax(0,1fr)_72px]">
          <div className="flex items-center justify-between border-b border-[#d7dde5] bg-white px-6">
            <div className="flex items-center gap-2"><h1 className="text-lg font-semibold text-[#101828]">Crop review</h1><span className="text-sm text-[#667085]">Crop each image for best results</span></div>
            <div className="flex items-center gap-4">
              <div className="min-w-0 text-sm"><p className="truncate font-semibold text-[#101828]">{selectedItem?.file.name || "tulip_01.png"}</p><p className="truncate text-[#667085]">{selectedItem ? `${formatDimensions(selectedItem)} - ${selectedItem.file.type || "File"} - ${bytesToSize(selectedItem.file.size)}` : "1024 x 1280 - PNG - 248 KB"}</p></div>
              <button type="button" className="mock-btn">View original <ExternalLink size={15} /></button>
            </div>
          </div>

          <div className="mock-checker relative min-h-0 overflow-hidden p-10">
            <div className="relative mx-auto h-full max-h-[760px] max-w-[560px] border-2 border-[#008c8f] bg-white">
              {selectedItem?.previewPending ? (
                <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-[#008c8f]" /></div>
              ) : selectedItem?.previewUrl ? (
                <ManualCropper key={selectedItem.id} imageUrl={selectedItem.previewUrl} crop={selectedItem.crop} onCropChange={(crop) => updateItemCrop(selectedItem.id, crop)} className="h-full" />
              ) : (
                <PlaceholderLineArt />
              )}
              {["-top-2 -left-2", "-top-2 left-1/2 -translate-x-1/2", "-top-2 -right-2", "top-1/2 -left-2 -translate-y-1/2", "top-1/2 -right-2 -translate-y-1/2", "-bottom-2 -left-2", "-bottom-2 left-1/2 -translate-x-1/2", "-bottom-2 -right-2"].map((position) => (
                <span key={position} className={`absolute h-4 w-4 border-2 border-[#008c8f] bg-[#e6ffff] ${position}`} />
              ))}
              <div className="absolute bottom-[-64px] left-1/2 flex -translate-x-1/2 overflow-hidden rounded-md bg-[#17202a] p-2 text-sm font-medium text-white shadow-lg">
                {["Free", "1:1", "4:3", "16:9", "3:4", "2:3", "Custom"].map((item, index) => (
                  <button key={item} type="button" className={`h-9 px-5 ${index === 0 ? "rounded bg-[#008c8f]" : ""}`}>{item}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#d7dde5] bg-white px-6">
            <button type="button" onClick={() => selectRelativeItem(-1)} className="mock-btn h-10"><ChevronLeft size={16} />Previous image</button>
            <p className="text-sm font-semibold text-[#101828]">{progressCropped} of {progressTotal} cropped</p>
            <button type="button" onClick={() => selectRelativeItem(1)} className="mock-btn h-10">Next image<ChevronRight size={16} /></button>
          </div>
        </main>
      </div>

      <div className="create-workbench-footer grid grid-cols-[360px_minmax(0,1fr)] gap-5 border-t border-[#d7dde5] bg-white p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex gap-2 font-semibold"><AlertTriangle size={18} />{isOnline ? "Crop review ready." : "Needs connection to upload source files."}</p>
          <p className="mt-1">{isOnline ? "Project creation uploads source files when you start conversion." : "Project creation is disabled while offline."}</p>
        </div>
        <div className="create-workbench-progress mock-card flex items-center justify-between p-4">
          <div className="flex items-center gap-5">
            <div className="grid h-14 w-14 place-items-center rounded-full border-4 border-[#e5e7eb]" style={{ borderRightColor: "#008c8f", borderTopColor: "#008c8f" }}><span className="text-sm font-semibold">{progressPercent}%</span></div>
            <div><p className="font-semibold text-[#101828]">{progressCropped} of {progressTotal} cropped</p><p className="text-sm text-[#667085]">Crop optional before conversion</p></div>
            <div className="text-center text-sm"><FileText size={18} className="mx-auto" /><p className="font-semibold">{progressTotal}</p><p className="text-[#667085]">Total files</p></div>
            <div className="text-center text-sm text-[#15803d]"><CheckCircle2 size={18} className="mx-auto" /><p className="font-semibold">{progressCropped}</p><p className="text-[#667085]">Cropped</p></div>
            <div className="text-center text-sm text-[#f97316]"><CloudUpload size={18} className="mx-auto" /><p className="font-semibold">{progressRemaining}</p><p className="text-[#667085]">Remaining</p></div>
          </div>
          <div className="create-workbench-actions flex gap-4">
            <button type="button" onClick={() => setCropItems((current) => current.map((item) => ({ ...item, crop: null })))} className="mock-btn h-12"><Trash2 size={16} />Clear all crops</button>
            <button disabled={pending || previewPending || !isOnline || !cropItems.length || Boolean(fileIssue) || !title.trim()} className="mock-btn mock-btn-primary h-14 min-w-0 sm:min-w-[250px] text-base">
              {pending ? <Loader2 size={18} className="animate-spin" /> : <Scissors size={18} />}
              Start conversion -&gt;
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, Crop, ImageUp, Loader2, Maximize2 } from "lucide-react";
import type { CropPixels } from "@/lib/canvas/crop";
import { ALLOWED_IMAGE_LABEL, IMAGE_ACCEPT, MAX_UPLOAD_BYTES, isAllowedImageFile, isPdfFile } from "@/lib/constants";
import { bytesToSize } from "@/lib/utils/format";

const ManualCropper = dynamic(() => import("@/components/projects/manual-cropper").then((module) => module.ManualCropper), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[340px] place-items-center text-sm font-semibold text-slate-500">
      Preparing crop
    </div>
  ),
});

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
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: Math.round(viewBox[2]), height: Math.round(viewBox[3]) };
  }

  return null;
}

function fileIssueFor(file: File | null) {
  if (!file) return null;
  if (!isAllowedImageFile(file)) {
    return `Use ${ALLOWED_IMAGE_LABEL}.`;
  }
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

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedArea, setCroppedArea] = useState<CropPixels | null>(null);
  const [useCrop, setUseCrop] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pending, setPending] = useState(false);
  const previewTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      previewTokenRef.current += 1;
    };
  }, []);

  const fileIssue = useMemo(() => {
    return fileIssueFor(file);
  }, [file]);

  function selectFile(nextFile: File | null) {
    const previewToken = previewTokenRef.current + 1;
    previewTokenRef.current = previewToken;
    setMessage(null);
    setFile(nextFile);
    setUseCrop(false);
    setCroppedArea(null);
    setImageUrl(null);
    setPreviewPending(false);
    if (nextFile && !title) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
    if (!nextFile || fileIssueFor(nextFile)) return;

    if (!isPdfFile(nextFile)) {
      setImageUrl(URL.createObjectURL(nextFile));
      return;
    }

    setPreviewPending(true);
    void pdfPreviewUrl(nextFile)
      .then((url) => {
        if (previewTokenRef.current !== previewToken) {
          URL.revokeObjectURL(url);
          return;
        }
        setImageUrl(url);
      })
      .catch(() => {
        if (previewTokenRef.current === previewToken) {
          setMessage("Unable to render the PDF preview.");
          setFile(null);
        }
      })
      .finally(() => {
        if (previewTokenRef.current === previewToken) setPreviewPending(false);
      });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || fileIssue) return;
    setPending(true);
    setMessage(null);

    try {
      const uploadFile = await cropFile(file, imageUrl || "", useCrop ? croppedArea : null);
      const size = await readImageSize(uploadFile);
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("width", String(size.width));
      formData.set("height", String(size.height));
      formData.set("file", uploadFile);

      const response = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to create project.");
      router.push(payload.redirectTo || `/projects/${payload.projectId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create project.");
      setPending(false);
    }
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-950">Create project</h1>
        <p className="text-sm text-slate-600">Upload line-art, crop if needed, then open the graph editor.</p>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="title">
              Project name
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-[var(--panel)] p-4 text-center hover:bg-slate-100">
            <ImageUp size={26} className="text-[var(--teal)]" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-slate-950">Upload file</span>
            <span className="mt-1 text-xs text-slate-500">{ALLOWED_IMAGE_LABEL} up to {bytesToSize(MAX_UPLOAD_BYTES)}</span>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {file ? (
            <div className="rounded-md border border-[var(--line)] bg-white p-3 text-sm">
              <p className="font-semibold text-slate-950">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {file.type || "Unknown type"} - {bytesToSize(file.size)}
              </p>
            </div>
          ) : null}
          {fileIssue ? (
            <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} aria-hidden="true" />
              {fileIssue}
            </p>
          ) : null}
          {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
          <button
            disabled={pending || previewPending || !file || Boolean(fileIssue) || !title.trim()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Creating..." : "Start conversion"}
          </button>
        </div>

        <div className="min-h-[420px] rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
          {previewPending ? (
            <div className="grid h-full min-h-[420px] place-items-center text-center">
              <div>
                <Loader2 size={30} className="mx-auto animate-spin text-[var(--teal)]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-950">Preparing preview</p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setUseCrop((value) => !value)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                    useCrop ? "border-teal-200 bg-teal-50 text-[var(--teal)]" : "border-[var(--line)] bg-white text-slate-700"
                  }`}
                >
                  <Crop size={16} aria-hidden="true" />
                  Crop
                </button>
                {useCrop ? (
                  <button
                    type="button"
                    onClick={() => setCroppedArea(null)}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-slate-700"
                  >
                    <Maximize2 size={16} aria-hidden="true" />
                    Full image
                  </button>
                ) : null}
              </div>
              <div className="relative h-[min(70vh,36rem)] min-h-[340px] flex-1 overflow-hidden rounded-md border border-slate-200 bg-white">
                {useCrop ? (
                  <ManualCropper imageUrl={imageUrl} crop={croppedArea} onCropChange={setCroppedArea} className="h-full p-3" />
                ) : (
                  <img src={imageUrl} alt="Upload preview" className="h-full w-full object-contain p-3" />
                )}
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center text-center">
              <div>
                <ImageUp size={30} className="mx-auto text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-950">Preview appears here</p>
                <p className="mt-1 text-sm text-slate-500">Crop is optional before conversion.</p>
              </div>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

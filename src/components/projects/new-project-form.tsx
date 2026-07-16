"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Crop,
  ExternalLink,
  FlipHorizontal,
  FlipVertical,
  Hand,
  ImageIcon,
  Loader2,
  Maximize2,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanLine,
  Scissors,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DEFAULT_CROP_TRANSFORM,
  fullCrop,
  mapCropBetweenDimensions,
  normalizeCrop,
  type CropPixels,
  type CropTransform,
} from "@/lib/canvas/crop";
import {
  ALLOWED_IMAGE_LABEL,
  IMAGE_ACCEPT,
  ORIGINAL_IMAGES_BUCKET,
  MAX_PROJECT_UPLOAD_FILES,
  MAX_PROJECT_UPLOAD_TOTAL_BYTES,
  MAX_UPLOAD_BYTES,
  isAllowedImageFile,
  isPdfFile,
} from "@/lib/constants";
import { cropQueueItemId, cropQueueStatus } from "@/lib/projects/crop-queue";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
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
  transform: CropTransform;
  undoStack: CropTransform[];
  redoStack: CropTransform[];
  previewPending: boolean;
  issue: string | null;
};

type AspectPresetKey = "free" | "original" | "square" | "4:3" | "3:2" | "16:9" | "3:4" | "2:3" | "custom";

const ASPECT_PRESETS: { key: AspectPresetKey; label: string; ratio: number | null }[] = [
  { key: "free", label: "Free", ratio: null },
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "1:1", ratio: 1 },
  { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "3:2", label: "3:2", ratio: 3 / 2 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "3:4", label: "3:4", ratio: 3 / 4 },
  { key: "2:3", label: "2:3", ratio: 2 / 3 },
  { key: "custom", label: "Custom", ratio: null },
];

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

async function prepareFilePreview(file: File) {
  if (isPdfFile(file)) {
    const { renderPdfFirstPageToCanvas } = await import("@/lib/canvas/pdf");
    const { canvas } = await renderPdfFirstPageToCanvas(file);
    return {
      previewUrl: await canvasToPngUrl(canvas),
      size: { width: canvas.width, height: canvas.height },
    };
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    if (file.type === "image/svg+xml") {
      const svgSize = readSvgSize(await file.text());
      if (svgSize) return { previewUrl, size: svgSize };
    }
    const image = await loadImage(previewUrl);
    return { previewUrl, size: { width: image.naturalWidth, height: image.naturalHeight } };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

async function cropFile(file: File, imageUrl: string, transform: CropTransform) {
  const { transformImageUrlToFile } = await import("@/lib/canvas/crop");
  return transformImageUrlToFile({
    imageUrl,
    crop: transform.crop,
    rotationDegrees: transform.rotationDegrees,
    straightenDegrees: transform.straightenDegrees,
    flipX: transform.flipX,
    flipY: transform.flipY,
    fileName: file.name,
    type: "image/png",
  });
}

function revokeCropItem(item: CropQueueItem) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

function formatDimensions(item: CropQueueItem) {
  return item.width && item.height ? `${item.width} x ${item.height}` : "Preparing size";
}

function activeAspectRatio(preset: AspectPresetKey, customRatio: number | null) {
  const presetRatio = ASPECT_PRESETS.find((item) => item.key === preset)?.ratio ?? null;
  return preset === "custom" ? customRatio : presetRatio;
}

function centeredAspectCrop(width: number | null, height: number | null, ratio: number | null) {
  if (!width || !height) return null;
  if (!ratio) return fullCrop(width, height);
  let cropWidth = width;
  let cropHeight = Math.round(width / ratio);
  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = Math.round(height * ratio);
  }
  return {
    x: Math.max(0, Math.round((width - cropWidth) / 2)),
    y: Math.max(0, Math.round((height - cropHeight) / 2)),
    width: Math.max(1, cropWidth),
    height: Math.max(1, cropHeight),
  };
}

function cropSizeLabel(item: CropQueueItem | null) {
  if (!item) return "No selection";
  if (item.transform.crop) return item.transform.crop.width + " x " + item.transform.crop.height;
  return "Full image";
}

function hasTransform(item: CropQueueItem) {
  const transform = item.transform;
  return Boolean(
    transform.crop ||
    transform.rotationDegrees ||
    transform.straightenDegrees ||
    transform.flipX ||
    transform.flipY,
  );
}

function copyTransform(transform: CropTransform): CropTransform {
  return {
    ...transform,
    crop: transform.crop ? { ...transform.crop } : null,
  };
}

function transformsEqual(left: CropTransform, right: CropTransform) {
  return (
    left.rotationDegrees === right.rotationDegrees &&
    left.straightenDegrees === right.straightenDegrees &&
    left.flipX === right.flipX &&
    left.flipY === right.flipY &&
    left.aspectRatio === right.aspectRatio &&
    ((!left.crop && !right.crop) ||
      Boolean(
        left.crop &&
        right.crop &&
        left.crop.x === right.crop.x &&
        left.crop.y === right.crop.y &&
        left.crop.width === right.crop.width &&
        left.crop.height === right.crop.height,
      ))
  );
}

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cropItems, setCropItems] = useState<CropQueueItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [aspectPreset, setAspectPreset] = useState<AspectPresetKey>("free");
  const [customAspectRatio, setCustomAspectRatio] = useState<number | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [autoTrimmingItemId, setAutoTrimmingItemId] = useState<string | null>(null);
  const [cropGuide, setCropGuide] = useState<"none" | "thirds" | "golden" | "center" | "grid">("thirds");
  const [cropInteractionMode, setCropInteractionMode] = useState<"crop" | "pan">("crop");
  const previewTokenRef = useRef(0);
  const cropItemsRef = useRef<CropQueueItem[]>([]);
  const straightenStartRef = useRef<CropTransform | null>(null);
  const detectionUsedRef = useRef(false);

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
      if (detectionUsedRef.current) {
        void import("@/lib/canvas/crop-detection-client").then((module) => module.disposeCropDetectionWorker());
      }
    };
  }, []);

  useEffect(() => {
    if (!cropItems.length) {
      if (selectedItemId) setSelectedItemId(null);
      return;
    }
    if (!cropItems.some((item) => item.id === selectedItemId)) setSelectedItemId(cropItems[0].id);
  }, [cropItems, selectedItemId]);

  const fileIssue = useMemo(() => cropItems.find((item) => item.issue)?.issue ?? null, [cropItems]);
  const previewPending = useMemo(() => cropItems.some((item) => item.previewPending), [cropItems]);
  const croppedCount = useMemo(() => cropItems.filter((item) => item.transform.crop).length, [cropItems]);
  const selectedIndex = cropItems.findIndex((item) => item.id === selectedItemId);
  const selectedItem = selectedIndex >= 0 ? cropItems[selectedIndex] : cropItems[0] ?? null;
  const selectedAspectRatio = aspectPreset === "original" && selectedItem?.width && selectedItem.height
    ? selectedItem.width / selectedItem.height
    : activeAspectRatio(aspectPreset, customAspectRatio);
  const progressTotal = cropItems.length;
  const progressCropped = croppedCount;

  function updateItemTransform(
    itemId: string,
    updater: (transform: CropTransform) => CropTransform,
    recordHistory = true,
  ) {
    setCropItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const nextTransform = updater(copyTransform(item.transform));
        if (transformsEqual(item.transform, nextTransform)) return item;
        return {
          ...item,
          transform: nextTransform,
          undoStack: recordHistory
            ? [...item.undoStack, copyTransform(item.transform)].slice(-30)
            : item.undoStack,
          redoStack: recordHistory ? [] : item.redoStack,
        };
      }),
    );
  }

  function updateItemCrop(itemId: string, crop: CropPixels | null) {
    updateItemTransform(itemId, (transform) => ({ ...transform, crop }));
  }

  function updateItemSize(itemId: string, size: { width: number; height: number }) {
    setCropItems((current) =>
      current.map((item) =>
        item.id === itemId && (item.width !== size.width || item.height !== size.height) ? { ...item, ...size } : item,
      ),
    );
  }

  function clearCropItems() {
    previewTokenRef.current += 1;
    setMessage(null);
    setCropItems((current) => {
      current.forEach(revokeCropItem);
      return [];
    });
    setSelectedItemId(null);
  }

  function removeCropItem(itemId: string) {
    previewTokenRef.current += 1;
    setMessage(null);
    setCropItems((current) => {
      const removed = current.find((item) => item.id === itemId);
      if (removed) revokeCropItem(removed);
      return current.filter((item) => item.id !== itemId);
    });
  }

  function applyCropToSelected(crop: CropPixels | null) {
    if (!selectedItem) return;
    updateItemCrop(selectedItem.id, crop);
  }

  function resetSelectedTransform() {
    if (!selectedItem) return;
    updateItemTransform(selectedItem.id, () => copyTransform(DEFAULT_CROP_TRANSFORM));
    setAspectPreset("free");
    setZoom(1);
  }

  function fitSelectedCrop() {
    if (!selectedItem) return;
    const nextCrop = centeredAspectCrop(selectedItem.width, selectedItem.height, selectedAspectRatio);
    if (nextCrop) updateItemCrop(selectedItem.id, nextCrop);
  }

  function applyAspectPreset(nextPreset: AspectPresetKey) {
    const currentCrop = selectedItem?.transform.crop;
    const currentRatio = currentCrop ? currentCrop.width / currentCrop.height : selectedItem?.width && selectedItem.height ? selectedItem.width / selectedItem.height : null;
    const nextCustomRatio = nextPreset === "custom" && currentRatio ? currentRatio : customAspectRatio;
    const ratio = nextPreset === "original" && selectedItem?.width && selectedItem.height
      ? selectedItem.width / selectedItem.height
      : activeAspectRatio(nextPreset, nextCustomRatio);
    setAspectPreset(nextPreset);
    if (nextPreset === "custom") setCustomAspectRatio(nextCustomRatio);
    if (selectedItem) {
      const nextCrop = ratio ? centeredAspectCrop(selectedItem.width, selectedItem.height, ratio) : selectedItem.transform.crop;
      updateItemTransform(selectedItem.id, (transform) => ({ ...transform, aspectRatio: ratio, crop: nextCrop }));
    }
  }

  function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    selectFiles(event.dataTransfer.files);
  }

  function viewSelectedOriginal() {
    if (!selectedItem?.previewUrl) return;
    window.open(selectedItem.previewUrl, "_blank", "noopener,noreferrer");
  }

  function rotateSelectedItem(delta: number) {
    if (!selectedItem) return;
    updateItemTransform(selectedItem.id, (transform) => ({
      ...transform,
      rotationDegrees: ((transform.rotationDegrees + delta) % 360 + 360) % 360,
      crop: null,
    }));
  }

  function flipSelectedItem(axis: "x" | "y") {
    if (!selectedItem) return;
    updateItemTransform(selectedItem.id, (transform) => ({
      ...transform,
      flipX: axis === "x" ? !transform.flipX : transform.flipX,
      flipY: axis === "y" ? !transform.flipY : transform.flipY,
    }));
  }

  function undoSelectedTransform() {
    if (!selectedItem?.undoStack.length) return;
    setCropItems((current) =>
      current.map((item) => {
        if (item.id !== selectedItem.id) return item;
        const previous = item.undoStack.at(-1);
        if (!previous) return item;
        return {
          ...item,
          transform: copyTransform(previous),
          undoStack: item.undoStack.slice(0, -1),
          redoStack: [copyTransform(item.transform), ...item.redoStack].slice(0, 30),
        };
      }),
    );
  }

  function redoSelectedTransform() {
    if (!selectedItem?.redoStack.length) return;
    setCropItems((current) =>
      current.map((item) => {
        if (item.id !== selectedItem.id) return item;
        const next = item.redoStack[0];
        if (!next) return item;
        return {
          ...item,
          transform: copyTransform(next),
          undoStack: [...item.undoStack, copyTransform(item.transform)].slice(-30),
          redoStack: item.redoStack.slice(1),
        };
      }),
    );
  }

  function beginStraightenTransaction() {
    if (!selectedItem || straightenStartRef.current) return;
    straightenStartRef.current = copyTransform(selectedItem.transform);
  }

  function commitStraightenTransaction() {
    const original = straightenStartRef.current;
    straightenStartRef.current = null;
    if (!selectedItem || !original) return;
    setCropItems((current) =>
      current.map((item) =>
        item.id === selectedItem.id && !transformsEqual(item.transform, original)
          ? { ...item, undoStack: [...item.undoStack, original].slice(-30), redoStack: [] }
          : item,
      ),
    );
  }

  async function autoTrimSelectedItem() {
    if (!selectedItem?.previewUrl || selectedItem.previewPending || selectedItem.issue) return;
    const item = selectedItem;
    const previewUrl = item.previewUrl;
    if (!previewUrl) return;
    detectionUsedRef.current = true;
    setAutoTrimmingItemId(item.id);
    setMessage(null);
    try {
      const { detectContentCropResult } = await import("@/lib/canvas/crop");
      const detection = await detectContentCropResult({
        imageUrl: previewUrl,
        rotationDegrees: item.transform.rotationDegrees,
        straightenDegrees: item.transform.straightenDegrees,
        flipX: item.transform.flipX,
        flipY: item.transform.flipY,
      });
      if (!detection.crop || detection.reason === "edge-to-edge") {
        setMessage(
          detection.reason === "edge-to-edge"
            ? "Artwork reaches every image edge, so the current crop was kept."
            : "Artwork detection was not confident enough to change the crop. Adjust it manually instead.",
        );
        return;
      }
      updateItemCrop(item.id, detection.crop);
      setMessage(`Artwork detected at ${Math.round(detection.confidence * 100)}% confidence. Review the crop, then apply it.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to detect the artwork edges.");
    } finally {
      setAutoTrimmingItemId(null);
    }
  }

  function updateSelectedCropNumber(key: keyof CropPixels, value: number) {
    if (!selectedItem?.width || !selectedItem.height) return;
    const base = selectedItem.transform.crop ?? fullCrop(selectedItem.width, selectedItem.height);
    updateItemCrop(
      selectedItem.id,
      normalizeCrop({ ...base, [key]: Math.round(value) }, selectedItem.width, selectedItem.height),
    );
  }

  function applySelectedCropToAll() {
    if (!selectedItem?.transform.crop || !selectedItem.width || !selectedItem.height) return;
    const sourceCrop = selectedItem.transform.crop;
    setCropItems((current) =>
      current.map((item) => {
        if (!item.width || !item.height || item.id === selectedItem.id) return item;
        const crop = mapCropBetweenDimensions(
          sourceCrop,
          { width: selectedItem.width!, height: selectedItem.height! },
          { width: item.width, height: item.height },
        );
        return {
          ...item,
          transform: { ...item.transform, crop, aspectRatio: selectedItem.transform.aspectRatio },
          undoStack: [...item.undoStack, copyTransform(item.transform)].slice(-30),
          redoStack: [],
        };
      }),
    );
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
    const incomingFiles = Array.from(nextFiles ?? []);
    const selectedFiles = incomingFiles.slice(0, MAX_PROJECT_UPLOAD_FILES);
    const baseItems = selectedFiles.map((file, index) => {
      const issue = fileIssueFor(file);
      return {
        id: cropQueueItemId(file, index),
        file,
        previewUrl: null,
        width: null,
        height: null,
        transform: copyTransform(DEFAULT_CROP_TRANSFORM),
        undoStack: [],
        redoStack: [],
        previewPending: !issue,
        issue,
      };
    });

    setMessage(incomingFiles.length > MAX_PROJECT_UPLOAD_FILES ? `Only the first ${MAX_PROJECT_UPLOAD_FILES} files were added.` : null);
    setCropItems((current) => {
      current.forEach(revokeCropItem);
      return baseItems;
    });
    setSelectedItemId(baseItems[0]?.id ?? null);
    if (selectedFiles[0]) setTitle(selectedFiles[0].name.replace(/\.[^.]+$/, ""));
    if (!baseItems.length) return;

    void mapWithConcurrency(
      baseItems,
      2,
      async (item) => {
        if (item.issue) return { ...item, previewPending: false };
        try {
          const { previewUrl, size } = await prepareFilePreview(item.file);
          return { ...item, previewUrl, width: size.width, height: size.height, previewPending: false };
        } catch {
          return { ...item, previewPending: false, issue: isPdfFile(item.file) ? "Unable to render the PDF preview." : "Unable to prepare this file for crop review." };
        }
      },
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
    let pendingProject: { projectId: string; paths: string[] } | null = null;

    try {
      const uploadFiles = await mapWithConcurrency(
        cropItems,
        2,
        (item) => Promise.resolve(hasTransform(item) && item.previewUrl ? cropFile(item.file, item.previewUrl, item.transform) : item.file),
      );
      const uploadBytes = uploadFiles.reduce((total, file) => total + file.size, 0);
      if (uploadBytes > MAX_PROJECT_UPLOAD_TOTAL_BYTES) {
        throw new Error(`Combined upload must be ${bytesToSize(MAX_PROJECT_UPLOAD_TOTAL_BYTES)} or smaller.`);
      }
      const prepareResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          files: uploadFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        }),
      });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok || !prepared.projectId || !Array.isArray(prepared.uploads)) {
        throw new Error(prepared.message || "Unable to prepare project upload.");
      }
      pendingProject = { projectId: prepared.projectId, paths: prepared.uploads.map((upload: { path: string }) => upload.path) };
      const { getSupabaseBrowser } = await import("@/lib/supabase/browser");
      const supabase = getSupabaseBrowser();
      await mapWithConcurrency(prepared.uploads, 2, async (upload: { path: string; token: string }, index) => {
        const file = uploadFiles[index];
        const { error } = await supabase.storage
          .from(ORIGINAL_IMAGES_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, file, {
            cacheControl: "3600",
            contentType: file.type || undefined,
          });
        if (error) throw new Error(error.message);
      });

      const finalizeResponse = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: prepared.projectId,
          uploads: prepared.uploads.map((upload: { id: string; name: string; path: string }) => ({
            id: upload.id,
            name: upload.name,
            path: upload.path,
          })),
        }),
      });
      const finalized = await finalizeResponse.json().catch(() => ({}));
      if (!finalizeResponse.ok) throw new Error(finalized.message || "Unable to finalize project.");
      pendingProject = null;
      router.push(finalized.redirectTo || `/projects/${prepared.projectId}`);
    } catch (error) {
      if (pendingProject) {
        await fetch("/api/projects", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: pendingProject.projectId, paths: pendingProject.paths }),
        }).catch(() => {});
      }
      setMessage(error instanceof Error ? error.message : "Unable to create project.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`create-workbench ${cropItems.length ? "has-files" : ""}`}>
      <div className="create-workbench-main grid min-h-0 border-t border-[#d7dde5]">
        <aside className="create-workbench-details min-h-0 overflow-y-auto border-r border-[#d7dde5] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#101828]">Project details</h2>
          <label className="mt-4 block text-sm font-medium text-[#344054]" htmlFor="title">Title *</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} className="mock-input mt-2 h-10" required />
          <label className="mt-4 block text-sm font-medium text-[#344054]" htmlFor="description">Description</label>
          <textarea id="description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} className="mock-input mt-2 min-h-20 resize-none" />
          <p className="mt-1 text-right text-xs text-[#667085]">{description.length} / 500</p>

          <h2 className="mt-5 text-lg font-semibold text-[#101828]">Upload files</h2>
          <p className="mt-1 text-sm leading-5 text-[#667085]">Images, PDF, or SVG line art. Up to {MAX_PROJECT_UPLOAD_FILES} files.</p>
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={handleUploadDrop}
            className={`mt-4 grid min-h-[112px] cursor-pointer place-items-center rounded-lg border border-dashed bg-white px-3 py-3 text-center hover:border-[#008c8f] ${
              isDraggingFiles ? "border-[#008c8f] bg-[#f0fafa]" : "border-[#cfd7df]"
            }`}
          >
            <span className="grid w-full min-w-0 place-items-center leading-tight">
              <CloudUpload size={26} className="mx-auto text-[#101828]" strokeWidth={1.8} />
              <span className="mt-2 block text-sm font-medium text-[#101828]">Drag & drop files here</span>
              <span className="text-sm font-medium text-[#008c8f]">or click to browse</span>
              <span className="mt-2 block text-xs leading-4 text-[#667085]">
                <span className="block">PNG, JPG, SVG, PDF</span>
                <span className="block">Max {MAX_PROJECT_UPLOAD_FILES} files, 50MB each</span>
              </span>
            </span>
            <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={(event) => { const selectedFiles = Array.from(event.target.files ?? []); event.target.value = ""; selectFiles(selectedFiles); }} />
          </label>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#101828]">Files ({cropItems.length})</p>
            <button type="button" className="text-sm font-semibold text-[#008c8f] disabled:text-[#98a2b3]" onClick={clearCropItems} disabled={!cropItems.length}>Clear all</button>
          </div>
          <div className="create-file-filmstrip mt-3 divide-y divide-[#e8edf2] overflow-hidden rounded-md border border-[#d7dde5]">
            {cropItems.length ? (
              cropItems.map((item) => {
                const selected = selectedItem?.id === item.id;
                return (
                  <div key={item.id} className={`create-file-row grid grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3 p-2 ${selected ? "bg-[#f0fafa] ring-1 ring-inset ring-[#008c8f]" : "bg-white"}`}>
                    <button type="button" onClick={() => setSelectedItemId(item.id)} className="contents text-left">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-10 w-10 rounded border border-[#d7dde5] object-contain p-1" /> : <span className="grid h-10 w-10 place-items-center rounded border border-[#d7dde5]"><ImageIcon size={17} /></span>}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#101828]">{item.file.name}</span><span className="text-xs text-[#667085]">{item.issue ?? formatDimensions(item)}</span></span>
                      <span className={`min-w-0 truncate rounded px-2 py-0.5 text-xs font-medium ${item.issue ? "bg-red-50 text-red-700" : item.transform.crop ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f2f4f7] text-[#344054]"}`}>{item.issue ? "Issue" : cropQueueStatus(item.transform.crop)}</span>
                    </button>
                    <button type="button" onClick={() => removeCropItem(item.id)} className="grid h-8 w-8 place-items-center rounded text-[#667085] hover:bg-[#f2f4f7] hover:text-[#101828]" title="Remove file">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="grid min-h-[112px] place-items-center bg-white p-4 text-center text-sm text-[#667085]">
                <span><ImageIcon size={22} className="mx-auto mb-2" />Select files to start crop review.</span>
              </div>
            )}
          </div>
          {fileIssue ? <p className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} />{fileIssue}</p> : null}
          {message ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
        </aside>

        <main className="create-workbench-stage grid min-h-0">
          <div className="flex items-center justify-between border-b border-[#d7dde5] bg-white px-6">
            <div className="flex items-center gap-2"><h1 className="text-lg font-semibold text-[#101828]">Crop review</h1><span className="text-sm text-[#667085]">Crop each image for best results</span></div>
            <div className="flex items-center gap-4">
              <div className="min-w-0 text-sm"><p className="truncate font-semibold text-[#101828]">{selectedItem?.file.name || "No file selected"}</p><p className="truncate text-[#667085]">{selectedItem ? `${formatDimensions(selectedItem)} - ${selectedItem.file.type || "File"} - ${bytesToSize(selectedItem.file.size)}` : "Upload a source image to begin"}</p></div>
              <button type="button" onClick={viewSelectedOriginal} disabled={!selectedItem?.previewUrl} className="mock-btn">View original <ExternalLink size={15} /></button>
            </div>
          </div>

          <div className="mock-checker create-crop-review relative grid min-h-0 gap-3 overflow-hidden">
            <div className="create-crop-tooldock" aria-label="Crop tools">
              <button
                type="button"
                onClick={() => setCropInteractionMode("crop")}
                className={`create-crop-icon-button ${cropInteractionMode === "crop" ? "is-active" : ""}`}
                disabled={!selectedItem}
                title="Crop"
                aria-label="Crop"
              >
                <Crop size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCropInteractionMode("pan")}
                className={`create-crop-icon-button ${cropInteractionMode === "pan" ? "is-active" : ""}`}
                disabled={!selectedItem}
                title="Pan image"
                aria-label="Pan image"
              >
                <Hand size={15} aria-hidden="true" />
              </button>
              <span className="create-crop-tool-separator" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(3, Math.round((value + 0.1) * 10) / 10))}
                className="create-crop-icon-button"
                disabled={!selectedItem}
                title={`Zoom in (${Math.round(zoom * 100)}%)`}
                aria-label={`Zoom in (${Math.round(zoom * 100)}%)`}
              >
                <ZoomIn size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10))}
                className="create-crop-icon-button"
                disabled={!selectedItem}
                title={`Zoom out (${Math.round(zoom * 100)}%)`}
                aria-label={`Zoom out (${Math.round(zoom * 100)}%)`}
              >
                <ZoomOut size={15} aria-hidden="true" />
              </button>
              <span className="create-crop-tool-separator" aria-hidden="true" />
              <button
                type="button"
                onClick={resetSelectedTransform}
                disabled={!selectedItem}
                className="create-crop-icon-button"
                title="Reset transforms"
                aria-label="Reset transforms"
              >
                <Maximize2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={undoSelectedTransform}
                disabled={!selectedItem?.undoStack.length}
                className="create-crop-icon-button"
                title="Undo"
                aria-label="Undo"
              >
                <Undo2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={redoSelectedTransform}
                disabled={!selectedItem?.redoStack.length}
                className="create-crop-icon-button"
                title="Redo"
                aria-label="Redo"
              >
                <Redo2 size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="create-crop-frame relative mx-auto h-full min-h-0 w-full max-h-[760px] max-w-[560px] border-2 border-[#008c8f] bg-white">
              {selectedItem?.previewPending ? (
                <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-[#008c8f]" /></div>
              ) : selectedItem?.previewUrl ? (
                <ManualCropper
                  key={selectedItem.id}
                  imageUrl={selectedItem.previewUrl}
                  crop={selectedItem.transform.crop}
                  aspectRatio={selectedAspectRatio}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  rotationDegrees={selectedItem.transform.rotationDegrees}
                  straightenDegrees={selectedItem.transform.straightenDegrees}
                  flipX={selectedItem.transform.flipX}
                  flipY={selectedItem.transform.flipY}
                  guide={cropGuide}
                  interactionMode={cropInteractionMode}
                  onImageSizeChange={(size) => updateItemSize(selectedItem.id, size)}
                  onCropChange={(crop) => updateItemCrop(selectedItem.id, crop)}
                  className="h-full"
                />
              ) : (
                <div className="grid h-full place-items-center p-8 text-center text-sm text-[#667085]">
                  <span><ImageIcon size={34} className="mx-auto mb-3" />Upload a file to activate crop review.</span>
                </div>
              )}
            </div>
            <aside className="create-transform-panel" aria-label="Crop transform controls">
              <div className="create-transform-heading">
                <div>
                  <p>Crop & transform</p>
                  <span>{cropSizeLabel(selectedItem)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void autoTrimSelectedItem()}
                  disabled={!selectedItem?.previewUrl || selectedItem.previewPending || autoTrimmingItemId === selectedItem.id}
                  className="mock-btn mock-btn-primary create-auto-trim-button"
                >
                  {autoTrimmingItemId === selectedItem?.id ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
                      Detect artwork
                </button>
              </div>

              <div className="create-transform-section">
                <span className="create-transform-label">Bounds in pixels</span>
                <div className="create-crop-number-grid">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label key={key}>
                      <span>{key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()}</span>
                      <input
                        type="number"
                        min={key === "width" || key === "height" ? 1 : 0}
                        value={selectedItem?.transform.crop?.[key] ?? (key === "width" ? selectedItem?.width ?? 0 : key === "height" ? selectedItem?.height ?? 0 : 0)}
                        onChange={(event) => updateSelectedCropNumber(key, Number(event.target.value))}
                        disabled={!selectedItem?.width || !selectedItem.height}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="create-transform-section">
                <div className="create-transform-row">
                  <label className="create-transform-field">
                    <span>Aspect</span>
                    <select value={aspectPreset} onChange={(event) => applyAspectPreset(event.target.value as AspectPresetKey)} disabled={!selectedItem}>
                      {ASPECT_PRESETS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="create-transform-field">
                    <span>Guides</span>
                    <select value={cropGuide} onChange={(event) => setCropGuide(event.target.value as typeof cropGuide)} disabled={!selectedItem}>
                      <option value="thirds">Thirds</option>
                      <option value="golden">Golden ratio</option>
                      <option value="center">Center</option>
                      <option value="grid">Grid</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                </div>
                <div className="create-transform-actions">
                  <button type="button" onClick={() => rotateSelectedItem(-90)} disabled={!selectedItem} title="Rotate left" aria-label="Rotate left"><RotateCcw size={16} /></button>
                  <button type="button" onClick={() => rotateSelectedItem(90)} disabled={!selectedItem} title="Rotate right" aria-label="Rotate right"><RotateCw size={16} /></button>
                  <button type="button" onClick={() => flipSelectedItem("x")} disabled={!selectedItem} className={selectedItem?.transform.flipX ? "is-active" : ""} title="Flip horizontally" aria-label="Flip horizontally"><FlipHorizontal size={16} /></button>
                  <button type="button" onClick={() => flipSelectedItem("y")} disabled={!selectedItem} className={selectedItem?.transform.flipY ? "is-active" : ""} title="Flip vertically" aria-label="Flip vertically"><FlipVertical size={16} /></button>
                </div>
              </div>

              <div className="create-transform-section">
                <label className="create-straighten-control">
                  <span>Straighten <strong>{selectedItem?.transform.straightenDegrees ?? 0}°</strong></span>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={0.25}
                    value={selectedItem?.transform.straightenDegrees ?? 0}
                    onPointerDown={beginStraightenTransaction}
                    onFocus={beginStraightenTransaction}
                    onPointerUp={commitStraightenTransaction}
                    onBlur={commitStraightenTransaction}
                    onChange={(event) => selectedItem && updateItemTransform(selectedItem.id, (transform) => ({ ...transform, straightenDegrees: Number(event.target.value), crop: null }), false)}
                    disabled={!selectedItem}
                  />
                </label>
              </div>

              <div className="create-transform-footer">
                <button type="button" onClick={fitSelectedCrop} disabled={!selectedItem || !selectedItem.width || !selectedItem.height} className="mock-btn">Fit selection</button>
                <button type="button" onClick={resetSelectedTransform} disabled={!selectedItem || !hasTransform(selectedItem)} className="mock-btn">Reset</button>
                {cropItems.length > 1 ? <button type="button" onClick={applySelectedCropToAll} disabled={!selectedItem?.transform.crop} className="mock-btn create-apply-all">Apply crop to all</button> : null}
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-between border-t border-[#d7dde5] bg-white px-6">
            <button type="button" onClick={() => selectRelativeItem(-1)} className="mock-btn h-10"><ChevronLeft size={16} />Previous image</button>
            <p className="text-sm font-semibold text-[#101828]">{progressCropped} of {progressTotal} cropped</p>
            <button type="button" onClick={() => selectRelativeItem(1)} className="mock-btn h-10">Next image<ChevronRight size={16} /></button>
          </div>
        </main>
      </div>

      <div className="create-workbench-footer grid gap-2 border-t border-[#d7dde5] bg-white p-2">
        <div className="create-workbench-notice rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="flex gap-2 font-semibold"><AlertTriangle size={18} />{isOnline ? (cropItems.length ? "Crop review ready." : "Add source files to begin.") : "Needs connection to upload source files."}</p>
          <p className="mt-1">{isOnline ? "Project creation uploads the reviewed source files when you start conversion." : "Project creation is disabled while offline."}</p>
        </div>
        <div className="create-workbench-progress mock-card flex items-center justify-between gap-3 p-2">
          <p className="min-w-0 text-sm text-[#475467]"><strong className="text-[#101828]">{progressTotal} {progressTotal === 1 ? "file" : "files"}</strong> · {progressCropped} with custom crop · unchanged files upload at original quality</p>
          <div className="create-workbench-actions flex shrink-0 gap-3">
            <button type="button" onClick={() => setCropItems((current) => current.map((item) => ({ ...item, transform: copyTransform(DEFAULT_CROP_TRANSFORM), undoStack: [...item.undoStack, copyTransform(item.transform)].slice(-30), redoStack: [] })))} disabled={!cropItems.some(hasTransform)} className="mock-btn h-10">Reset all</button>
            <button disabled={pending || previewPending || !isOnline || !cropItems.length || Boolean(fileIssue) || !title.trim()} className="mock-btn mock-btn-primary h-11 min-w-0 sm:min-w-[220px] text-base">
              {pending ? <Loader2 size={18} className="animate-spin" /> : <Scissors size={18} />}
              Start conversion -&gt;
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

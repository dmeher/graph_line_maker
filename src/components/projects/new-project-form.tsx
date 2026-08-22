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
  quickCropWithin,
  type CropPixels,
  type CropTransform,
  type QuickCropSegment,
} from "@/lib/canvas/crop";
import { QuickCropControls } from "@/components/projects/quick-crop-controls";
import {
  ALLOWED_IMAGE_LABEL,
  IMAGE_ACCEPT,
  MAX_PROJECT_UPLOAD_FILES,
  MAX_PROJECT_UPLOAD_TOTAL_BYTES,
  MAX_UPLOAD_BYTES,
  isAllowedImageFile,
  isPdfFile,
} from "@/lib/constants";
import {
  SOURCE_THUMBNAIL_MAX_EDGE,
  uploadWithThumbnail,
  type PresignedUpload,
} from "@/lib/storage/upload-client";
import { cropQueueItemId, cropQueueStatus } from "@/lib/projects/crop-queue";
import {
  DEFAULT_BACKGROUND_TOLERANCE,
  MAX_BACKGROUND_TOLERANCE,
  MIN_BACKGROUND_TOLERANCE,
  clampBackgroundTolerance,
} from "@/lib/editor/layer-extras";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { bytesToSize } from "@/lib/utils/format";

const ManualCropper = dynamic(() => import("@/components/projects/manual-cropper").then((module) => module.ManualCropper), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[420px] place-items-center text-sm font-semibold text-[var(--muted)]">Preparing crop</div>,
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
    backgroundRemoval: transform.backgroundRemoval,
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
    transform.flipY ||
    transform.backgroundRemoval?.enabled,
  );
}

function copyTransform(transform: CropTransform): CropTransform {
  return {
    ...transform,
    crop: transform.crop ? { ...transform.crop } : null,
    backgroundRemoval: transform.backgroundRemoval ? { ...transform.backgroundRemoval } : undefined,
  };
}

function transformsEqual(left: CropTransform, right: CropTransform) {
  return (
    left.rotationDegrees === right.rotationDegrees &&
    left.straightenDegrees === right.straightenDegrees &&
    left.flipX === right.flipX &&
    left.flipY === right.flipY &&
    left.aspectRatio === right.aspectRatio &&
    left.backgroundRemoval?.enabled === right.backgroundRemoval?.enabled &&
    left.backgroundRemoval?.tolerance === right.backgroundRemoval?.tolerance &&
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
  const [vectorizeSources, setVectorizeSources] = useState(true);
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

  function setSelectedBackgroundRemoval(enabled: boolean) {
    if (!selectedItem) return;
    updateItemTransform(selectedItem.id, (transform) => ({
      ...transform,
      backgroundRemoval: enabled
        ? { enabled: true, tolerance: transform.backgroundRemoval?.tolerance ?? DEFAULT_BACKGROUND_TOLERANCE }
        : undefined,
    }));
  }

  function setSelectedBackgroundTolerance(tolerance: number) {
    if (!selectedItem?.transform.backgroundRemoval?.enabled) return;
    updateItemTransform(selectedItem.id, (transform) => ({
      ...transform,
      backgroundRemoval: { enabled: true, tolerance: clampBackgroundTolerance(tolerance) },
    }));
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

  function applyQuickCrop(segment: QuickCropSegment) {
    if (!selectedItem?.width || !selectedItem.height) return;
    const currentCrop = selectedItem.transform.crop ?? fullCrop(selectedItem.width, selectedItem.height);
    const crop = quickCropWithin(currentCrop, segment);
    setAspectPreset("free");
    updateItemTransform(selectedItem.id, (transform) => ({ ...transform, crop, aspectRatio: null }));
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
          vectorizeSources,
          files: uploadFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        }),
      });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok || !prepared.projectId || !Array.isArray(prepared.uploads)) {
        throw new Error(prepared.message || "Unable to prepare project upload.");
      }
      pendingProject = { projectId: prepared.projectId, paths: prepared.uploads.map((upload: { path: string }) => upload.path) };
      // Direct browser-to-R2 PUTs. Nothing transits the Next.js server, so a
      // 150 MB create request no longer has to fit in a serverless function.
      const thumbUploads = await mapWithConcurrency(prepared.uploads, 2, async (upload: PresignedUpload, index) => {
        const result = await uploadWithThumbnail(upload, uploadFiles[index], SOURCE_THUMBNAIL_MAX_EDGE);
        return result.thumbUploaded;
      });

      const finalizeResponse = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: prepared.projectId,
          vectorizeSources: prepared.vectorizeSources !== false,
          uploads: prepared.uploads.map((upload: { id: string; name: string; path: string }, index: number) => ({
            id: upload.id,
            name: upload.name,
            path: upload.path,
            thumbUploaded: thumbUploads[index] === true,
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
    <form
      onSubmit={submit}
      className={`create-workbench create-studio ${cropItems.length ? "has-files" : ""}`}
      data-workflow-state={cropItems.length ? "review" : "intake"}
    >
      <header className="create-studio__command">
        <div className="create-studio__heading">
          <span className="create-studio__eyebrow">New project</span>
          <div>
            <h1>Prepare source artwork</h1>
            <p>Build the queue, frame every image, then open the graph editor.</p>
          </div>
        </div>
        <div className="create-studio__brief" aria-label="Project brief">
          <label className="create-studio__field" htmlFor="title">
            <span>Project name</span>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled graph"
              aria-label="Title"
              required
            />
          </label>
          <label className="create-studio__field create-studio__field--description" htmlFor="description">
            <span>Brief <small>{description.length}/500</small></span>
            <textarea
              id="description"
              value={description}
              maxLength={500}
              rows={1}
              placeholder="Optional production notes"
              aria-label="Description"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="create-studio__health" aria-label="Project preparation status">
          <span className={isOnline ? "is-online" : "is-offline"}><i aria-hidden="true" />{isOnline ? "Online" : "Offline"}</span>
          <strong>{progressCropped}/{progressTotal || 0}</strong>
          <small>framed</small>
        </div>
      </header>

      <div className="create-workbench-main create-studio__workspace grid min-h-0 border-t border-[var(--line)]">
        <aside
          className="create-workbench-details create-source-queue min-h-0 overflow-y-auto border-r border-[var(--line)] bg-[var(--panel)] p-5"
          aria-labelledby="project-intake-heading"
        >
          <div className="create-source-queue__header">
            <div>
              <p className="create-step-label"><span>01</span> Sources</p>
              <h2 id="project-intake-heading">Artwork queue</h2>
            </div>
            <span className="create-source-queue__count">{cropItems.length}</span>
          </div>
          <p className="create-source-queue__hint">Drag in line art, then select a thumbnail to frame it.</p>
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
            className={`create-upload-dropzone mt-4 grid min-h-[112px] cursor-pointer place-items-center rounded-lg border border-dashed bg-[var(--surface)] px-3 py-3 text-center hover:border-[var(--teal)] ${
              isDraggingFiles ? "is-dragging border-[var(--teal)] bg-[var(--teal-wash)]" : "border-[var(--line-strong)]"
            }`}
          >
            <span className="grid w-full min-w-0 place-items-center leading-tight">
              <CloudUpload size={26} className="mx-auto text-[var(--foreground)]" strokeWidth={1.8} />
              <span className="mt-2 block text-sm font-medium text-[var(--foreground)]">Drag & drop files here</span>
              <span className="text-sm font-medium text-[var(--teal)]">or click to browse</span>
              <span className="mt-2 block text-xs leading-4 text-[var(--muted)]">
                <span className="block">PNG, JPG, WEBP, SVG, PDF</span>
                <span className="block">Max {MAX_PROJECT_UPLOAD_FILES} files, 50MB each</span>
              </span>
            </span>
            <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={(event) => { const selectedFiles = Array.from(event.target.files ?? []); event.target.value = ""; selectFiles(selectedFiles); }} />
          </label>

          <div className="create-source-queue__toolbar mt-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--foreground)]">In this project</p>
            <button type="button" aria-label="Clear all" className="text-sm font-semibold text-[var(--teal)] disabled:text-[var(--muted)]" onClick={clearCropItems} disabled={!cropItems.length}>Clear queue</button>
          </div>
          <div className="create-file-filmstrip create-source-queue__list mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-md border border-[var(--line)]">
            {cropItems.length ? (
              cropItems.map((item, itemIndex) => {
                const selected = selectedItem?.id === item.id;
                return (
                  <div key={item.id} className={`create-file-row create-source-card ${selected ? "is-selected" : ""} ${item.issue ? "has-issue" : ""}`}>
                    <button type="button" onClick={() => setSelectedItemId(item.id)} className="create-source-card__select text-left" aria-pressed={selected}>
                      <span className="create-source-card__preview">
                        {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <ImageIcon size={19} aria-hidden="true" />}
                        <i aria-hidden="true">{itemIndex + 1}</i>
                      </span>
                      <span className="create-source-card__copy">
                        <strong>{item.file.name}</strong>
                        <small>{item.issue ?? formatDimensions(item)}</small>
                      </span>
                      <span className={`create-source-card__status ${item.issue ? "is-error" : item.transform.crop ? "is-ready" : ""}`}>{item.issue ? "Issue" : cropQueueStatus(item.transform.crop)}</span>
                    </button>
                    <button type="button" onClick={() => removeCropItem(item.id)} className="create-source-card__remove" title="Remove file" aria-label={`Remove ${item.file.name}`}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="create-source-queue__empty grid min-h-[112px] place-items-center bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
                <span><ImageIcon size={22} className="mx-auto mb-2" />Select files to start crop review.</span>
              </div>
            )}
          </div>
          {fileIssue ? <p role="alert" className="mt-3 flex gap-2 rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm text-[var(--amber)]"><AlertTriangle size={16} aria-hidden="true" />{fileIssue}</p> : null}
          {message ? <p role="status" aria-live="polite" className="mt-3 rounded-md border border-[var(--red)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--red)]">{message}</p> : null}
        </aside>

        <main className="create-workbench-stage create-studio__crop-zone grid min-h-0">
          <div className="create-stage-header flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-6">
            <div className="create-stage-heading">
              <p className="create-step-label"><span>02</span> Production review</p>
              <div className="mt-1 flex items-baseline gap-2">
                <h1 className="text-lg font-semibold text-[var(--foreground)]">Crop studio</h1>
                <span className="text-sm text-[var(--muted)]">Prepare each image for conversion</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="min-w-0 text-sm"><p className="truncate font-semibold text-[var(--foreground)]">{selectedItem?.file.name || "No file selected"}</p><p className="truncate text-[var(--muted)]">{selectedItem ? `${formatDimensions(selectedItem)} - ${selectedItem.file.type || "File"} - ${bytesToSize(selectedItem.file.size)}` : "Upload a source image to begin"}</p></div>
              <button type="button" onClick={viewSelectedOriginal} disabled={!selectedItem?.previewUrl} className="mock-btn">View original <ExternalLink size={15} /></button>
            </div>
          </div>

          <div className="mock-checker create-crop-review create-studio__crop-grid relative grid min-h-0 gap-3 overflow-hidden">
            <section className="create-canvas-stage" aria-label="Crop canvas">
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
              <div className="create-crop-frame relative mx-auto h-full min-h-0 w-full max-h-[760px] max-w-[560px] border-2 border-[var(--teal)] bg-[var(--crop-stage-bg)]">
              {selectedItem?.previewPending ? (
                <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-[var(--teal)]" /></div>
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
                  backgroundRemoval={selectedItem.transform.backgroundRemoval}
                  guide={cropGuide}
                  interactionMode={cropInteractionMode}
                  onImageSizeChange={(size) => updateItemSize(selectedItem.id, size)}
                  onCropChange={(crop) => updateItemCrop(selectedItem.id, crop)}
                  className="h-full"
                />
              ) : (
                <div className="create-crop-empty grid h-full place-items-center p-8 text-center text-sm text-[var(--muted)]">
                  <span><ImageIcon size={34} className="mx-auto mb-3" />Upload a file to activate crop review.</span>
                </div>
              )}
              </div>
            </section>
            <aside className="create-transform-panel create-adjustments-inspector" aria-label="Crop transform controls">
              <div className="create-transform-heading">
                <div>
                  <span className="create-step-label"><span>03</span> Adjust</span>
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
                <QuickCropControls disabled={!selectedItem?.width || !selectedItem.height || autoTrimmingItemId === selectedItem.id} onSelect={applyQuickCrop} />
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

              <div className="create-transform-section">
                <label className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--foreground)]">
                  <span className="inline-flex items-center gap-2"><Scissors size={15} aria-hidden="true" />Remove background</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem?.transform.backgroundRemoval?.enabled)}
                    onChange={(event) => setSelectedBackgroundRemoval(event.target.checked)}
                    disabled={!selectedItem}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                </label>
                {selectedItem?.transform.backgroundRemoval?.enabled ? (
                  <label className="create-straighten-control mt-3">
                    <span>Tolerance <strong>{Math.round(selectedItem.transform.backgroundRemoval.tolerance * 100)}%</strong></span>
                    <input
                      type="range"
                      min={Math.round(MIN_BACKGROUND_TOLERANCE * 100)}
                      max={Math.round(MAX_BACKGROUND_TOLERANCE * 100)}
                      step={1}
                      value={Math.round(selectedItem.transform.backgroundRemoval.tolerance * 100)}
                      onChange={(event) => setSelectedBackgroundTolerance(Number(event.target.value) / 100)}
                    />
                  </label>
                ) : null}
              </div>

              <div className="create-transform-footer">
                <button type="button" onClick={fitSelectedCrop} disabled={!selectedItem || !selectedItem.width || !selectedItem.height} className="mock-btn">Fit selection</button>
                <button type="button" onClick={resetSelectedTransform} disabled={!selectedItem || !hasTransform(selectedItem)} className="mock-btn">Reset</button>
                {cropItems.length > 1 ? <button type="button" onClick={applySelectedCropToAll} disabled={!selectedItem?.transform.crop} className="mock-btn create-apply-all">Apply crop to all</button> : null}
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--panel)] px-6">
            <button type="button" onClick={() => selectRelativeItem(-1)} className="mock-btn h-10"><ChevronLeft size={16} />Previous image</button>
            <p className="text-sm font-semibold text-[var(--foreground)]">{progressCropped} of {progressTotal} cropped</p>
            <button type="button" onClick={() => selectRelativeItem(1)} className="mock-btn h-10">Next image<ChevronRight size={16} /></button>
          </div>
        </main>
      </div>

      <div className="create-workbench-footer border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="create-workbench-notice rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] p-2 text-xs text-[var(--amber)]">
          <p className="flex gap-2 font-semibold"><AlertTriangle size={18} />{isOnline ? (cropItems.length ? "Crop review ready." : "Add source files to begin.") : "Needs connection to upload source files."}</p>
          <p className="mt-1">{isOnline ? "Project creation uploads the reviewed source files when you start conversion." : "Project creation is disabled while offline."}</p>
        </div>
        <div className="create-workbench-progress mock-card">
          <div className="create-workbench-controls flex min-w-0 flex-col gap-1">
            <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--surface)]">
              <input
                type="checkbox"
                checked={vectorizeSources}
                onChange={(event) => setVectorizeSources(event.target.checked)}
                disabled={pending}
                className="h-4 w-4 shrink-0 accent-[var(--teal)]"
              />
              <span className="grid min-w-0">
                <strong className="truncate text-sm">Vectorize imported images</strong>
                <small className="truncate text-xs text-[var(--muted)]">Clear to place original raster pixels directly on the graph.</small>
              </span>
            </label>
          </div>
          <p className="create-workbench-summary text-sm text-[var(--muted)]"><strong className="text-[var(--foreground)]">{progressTotal} {progressTotal === 1 ? "file" : "files"}</strong> · {progressCropped} with custom crop · unchanged files upload at original quality</p>
          <div className="create-workbench-actions">
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

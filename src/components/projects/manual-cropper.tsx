"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { removeBackgroundImageData } from "@/lib/canvas/background-removal";
import { normalizeCrop, transformedImageSize, type CropPixels } from "@/lib/canvas/crop";
import type { GraphBackgroundRemoval } from "@/lib/types";

type ImageBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  rotationDegrees: number;
};

type DragState = {
  pointerId: number;
  mode: "create" | "move" | "resize" | "pan";
  startX: number;
  startY: number;
  startClientX: number;
  startClientY: number;
  startCrop: CropPixels | null;
  startPan: { x: number; y: number };
  handle: CropHandle | null;
};

type PinchState = {
  distance: number;
  centerX: number;
  centerY: number;
  zoom: number;
  pan: { x: number; y: number };
};

type CropHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
export type CropGuide = "none" | "thirds" | "golden" | "center" | "grid";

const CROP_HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CROP_HANDLE_CLASSES: Record<CropHandle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  e: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sameImageBox(left: ImageBox | null, right: ImageBox) {
  return Boolean(
    left &&
      left.left === right.left &&
      left.top === right.top &&
      left.width === right.width &&
      left.height === right.height &&
      left.naturalWidth === right.naturalWidth &&
      left.naturalHeight === right.naturalHeight &&
      left.sourceWidth === right.sourceWidth &&
      left.sourceHeight === right.sourceHeight &&
      left.scale === right.scale &&
      left.rotationDegrees === right.rotationDegrees,
  );
}

function cropFromPoints(startX: number, startY: number, endX: number, endY: number, box: ImageBox, aspectRatio: number | null) {
  const x = clamp(Math.min(startX, endX), 0, box.naturalWidth - 1);
  const y = clamp(Math.min(startY, endY), 0, box.naturalHeight - 1);
  let width = clamp(Math.abs(endX - startX), 1, box.naturalWidth - x);
  let height = clamp(Math.abs(endY - startY), 1, box.naturalHeight - y);
  if (aspectRatio) {
    if (width / height > aspectRatio) width = Math.max(1, Math.round(height * aspectRatio));
    else height = Math.max(1, Math.round(width / aspectRatio));
    width = clamp(width, 1, box.naturalWidth - x);
    height = clamp(height, 1, box.naturalHeight - y);
  }
  return normalizeCrop({ x, y, width, height }, box.naturalWidth, box.naturalHeight);
}

function cropFromMove(startCrop: CropPixels, deltaX: number, deltaY: number, box: ImageBox) {
  return normalizeCrop(
    {
      ...startCrop,
      x: clamp(startCrop.x + deltaX, 0, box.naturalWidth - startCrop.width),
      y: clamp(startCrop.y + deltaY, 0, box.naturalHeight - startCrop.height),
    },
    box.naturalWidth,
    box.naturalHeight,
  );
}

function cropFromResize(startCrop: CropPixels, handle: CropHandle, deltaX: number, deltaY: number, box: ImageBox, aspectRatio: number | null) {
  let left = startCrop.x;
  let top = startCrop.y;
  let right = startCrop.x + startCrop.width;
  let bottom = startCrop.y + startCrop.height;

  if (handle.includes("w")) left = clamp(startCrop.x + deltaX, 0, right - 1);
  if (handle.includes("e")) right = clamp(startCrop.x + startCrop.width + deltaX, left + 1, box.naturalWidth);
  if (handle.includes("n")) top = clamp(startCrop.y + deltaY, 0, bottom - 1);
  if (handle.includes("s")) bottom = clamp(startCrop.y + startCrop.height + deltaY, top + 1, box.naturalHeight);

  let width = right - left;
  let height = bottom - top;
  if (aspectRatio) {
    if (width / height > aspectRatio) width = Math.max(1, Math.round(height * aspectRatio));
    else height = Math.max(1, Math.round(width / aspectRatio));
    if (handle.includes("w")) left = right - width;
    else right = left + width;
    if (handle.includes("n")) top = bottom - height;
    else bottom = top + height;
  }

  return normalizeCrop({ x: left, y: top, width: right - left, height: bottom - top }, box.naturalWidth, box.naturalHeight);
}

function pointerDistance(points: Array<{ x: number; y: number }>) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function pointerCenter(points: Array<{ x: number; y: number }>) {
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

export function ManualCropper({
  imageUrl,
  crop,
  onCropChange,
  aspectRatio = null,
  zoom = 1,
  onZoomChange,
  rotationDegrees = 0,
  straightenDegrees = 0,
  flipX = false,
  flipY = false,
  guide = "thirds",
  interactionMode = "crop",
  backgroundRemoval,
  onImageSizeChange,
  className = "",
}: {
  imageUrl: string;
  crop: CropPixels | null;
  onCropChange: (crop: CropPixels) => void;
  aspectRatio?: number | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  rotationDegrees?: number;
  straightenDegrees?: number;
  flipX?: boolean;
  flipY?: boolean;
  guide?: CropGuide;
  interactionMode?: "crop" | "pan";
  backgroundRemoval?: GraphBackgroundRemoval;
  onImageSizeChange?: (size: { width: number; height: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const backgroundPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const draftCropRef = useRef<CropPixels | null>(crop);
  const onImageSizeChangeRef = useRef(onImageSizeChange);
  const measureImageRef = useRef<() => ImageBox | null>(() => null);
  const reportedImageSizeRef = useRef({ width: 0, height: 0 });
  const [imageBox, setImageBox] = useState<ImageBox | null>(null);
  const [draftCrop, setDraftCrop] = useState<CropPixels | null>(crop);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [backgroundPreviewReady, setBackgroundPreviewReady] = useState(false);

  useEffect(() => {
    onImageSizeChangeRef.current = onImageSizeChange;
  }, [onImageSizeChange]);

  useEffect(() => {
    if (dragStateRef.current) return;
    draftCropRef.current = crop;
    setDraftCrop(crop);
  }, [crop]);

  function measureImage() {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !image.naturalWidth || !image.naturalHeight) return null;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return null;
    const transformed = transformedImageSize(image.naturalWidth, image.naturalHeight, rotationDegrees, straightenDegrees);
    const scale = Math.min(containerRect.width / transformed.width, containerRect.height / transformed.height) * zoom;
    if (!Number.isFinite(scale) || scale <= 0) return null;

    const imageWidth = transformed.width * scale;
    const imageHeight = transformed.height * scale;
    const nextBox = {
      left: (containerRect.width - imageWidth) / 2 + pan.x,
      top: (containerRect.height - imageHeight) / 2 + pan.y,
      width: imageWidth,
      height: imageHeight,
      naturalWidth: transformed.width,
      naturalHeight: transformed.height,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      scale,
      rotationDegrees: transformed.rotationDegrees,
    };
    setImageBox((current) => (sameImageBox(current, nextBox) ? current : nextBox));
    if (
      reportedImageSizeRef.current.width !== transformed.width ||
      reportedImageSizeRef.current.height !== transformed.height
    ) {
      reportedImageSizeRef.current = { width: transformed.width, height: transformed.height };
      onImageSizeChangeRef.current?.(reportedImageSizeRef.current);
    }
    return nextBox;
  }

  measureImageRef.current = measureImage;

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>, box: ImageBox) {
    const containerRect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - containerRect.left - box.left) / box.width) * box.naturalWidth);
    const y = Math.round(((event.clientY - containerRect.top - box.top) / box.height) * box.naturalHeight);
    return { x: clamp(x, 0, box.naturalWidth), y: clamp(y, 0, box.naturalHeight) };
  }

  function beginCrop(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activePointersRef.current.size === 2) {
      const pendingDrag = dragStateRef.current;
      if (pendingDrag?.mode === "create") {
        draftCropRef.current = pendingDrag.startCrop;
        setDraftCrop(pendingDrag.startCrop);
      }
      const points = Array.from(activePointersRef.current.values());
      const center = pointerCenter(points);
      pinchStateRef.current = {
        distance: pointerDistance(points),
        centerX: center.x,
        centerY: center.y,
        zoom,
        pan,
      };
      dragStateRef.current = null;
      return;
    }

    const box = measureImage() ?? imageBox;
    if (!box) return;
    const point = pointFromEvent(event, box);
    const target = event.target as HTMLElement;
    const handleElement = target.closest("[data-crop-handle]") as HTMLElement | null;
    const handle = handleElement?.dataset.cropHandle as CropHandle | undefined;
    const moveElement = target.closest("[data-crop-move='true']");
    const startCrop = draftCropRef.current ? normalizeCrop(draftCropRef.current, box.naturalWidth, box.naturalHeight) : null;
    const panMode = interactionMode === "pan" || event.button === 1 || event.altKey;

    event.preventDefault();
    dragStateRef.current = {
      pointerId: event.pointerId,
      mode: panMode ? "pan" : handle ? "resize" : moveElement ? "move" : "create",
      startX: point.x,
      startY: point.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop,
      startPan: pan,
      handle: handle ?? null,
    };
    if (!panMode && !handle && !moveElement) {
      const next = cropFromPoints(point.x, point.y, point.x + 1, point.y + 1, box, aspectRatio);
      draftCropRef.current = next;
      setDraftCrop(next);
    }
  }

  function moveCrop(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinchStateRef.current && activePointersRef.current.size >= 2) {
      event.preventDefault();
      const points = Array.from(activePointersRef.current.values()).slice(0, 2);
      const center = pointerCenter(points);
      const pinch = pinchStateRef.current;
      const nextZoom = clamp(pinch.zoom * (pointerDistance(points) / Math.max(1, pinch.distance)), 0.5, 3);
      setPan({ x: pinch.pan.x + center.x - pinch.centerX, y: pinch.pan.y + center.y - pinch.centerY });
      onZoomChange?.(Math.round(nextZoom * 100) / 100);
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const box = imageBox;
    if (!box) return;
    event.preventDefault();

    if (dragState.mode === "pan") {
      setPan({
        x: dragState.startPan.x + event.clientX - dragState.startClientX,
        y: dragState.startPan.y + event.clientY - dragState.startClientY,
      });
      return;
    }

    const point = pointFromEvent(event, box);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    let next: CropPixels;
    if (dragState.mode === "move" && dragState.startCrop) {
      next = cropFromMove(dragState.startCrop, deltaX, deltaY, box);
    } else if (dragState.mode === "resize" && dragState.startCrop && dragState.handle) {
      next = cropFromResize(dragState.startCrop, dragState.handle, deltaX, deltaY, box, aspectRatio);
    } else {
      next = cropFromPoints(dragState.startX, dragState.startY, point.x, point.y, box, aspectRatio);
    }
    draftCropRef.current = next;
    setDraftCrop(next);
  }

  function endCrop(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (activePointersRef.current.size < 2) pinchStateRef.current = null;
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (dragState.mode !== "pan" && draftCropRef.current) onCropChange(draftCropRef.current);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!onZoomChange) return;
    event.preventDefault();
    onZoomChange(clamp(Math.round((zoom - event.deltaY * 0.0015) * 100) / 100, 0.5, 3));
  }

  function nudgeCrop(event: KeyboardEvent<HTMLDivElement>) {
    if (!draftCropRef.current || !imageBox) return;
    const step = event.shiftKey ? 10 : 1;
    const delta = { x: 0, y: 0 };
    if (event.key === "ArrowLeft") delta.x = -step;
    else if (event.key === "ArrowRight") delta.x = step;
    else if (event.key === "ArrowUp") delta.y = -step;
    else if (event.key === "ArrowDown") delta.y = step;
    else return;
    event.preventDefault();
    const next = cropFromMove(draftCropRef.current, delta.x, delta.y, imageBox);
    draftCropRef.current = next;
    setDraftCrop(next);
    onCropChange(next);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => measureImage());
    return () => window.cancelAnimationFrame(frame);
  }, [imageUrl, zoom, rotationDegrees, straightenDegrees, flipX, flipY, pan.x, pan.y]);

  useEffect(() => {
    const canvas = backgroundPreviewCanvasRef.current;
    const image = imageRef.current;
    if (!canvas || !imageBox || !image || !backgroundRemoval?.enabled) {
      setBackgroundPreviewReady(false);
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
      return;
    }

    const deviceScale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(imageBox.sourceWidth * imageBox.scale * deviceScale));
    const height = Math.max(1, Math.round(imageBox.sourceHeight * imageBox.scale * deviceScale));
    setBackgroundPreviewReady(false);
    try {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const cleaned = removeBackgroundImageData(imageData, backgroundRemoval.tolerance);
      imageData.data.set(cleaned.data);
      context.putImageData(imageData, 0, 0);
      setBackgroundPreviewReady(true);
    } catch {
      // Keep the unmodified image visible when the browser cannot read a remote preview.
      setBackgroundPreviewReady(false);
    }
  }, [
    backgroundRemoval?.enabled,
    backgroundRemoval?.tolerance,
    imageBox?.scale,
    imageBox?.sourceHeight,
    imageBox?.sourceWidth,
    imageUrl,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measureImageRef.current());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const normalizedCrop = imageBox && draftCrop ? normalizeCrop(draftCrop, imageBox.naturalWidth, imageBox.naturalHeight) : null;
  const cropStyle =
    imageBox && normalizedCrop
      ? {
          left: imageBox.left + (normalizedCrop.x / imageBox.naturalWidth) * imageBox.width,
          top: imageBox.top + (normalizedCrop.y / imageBox.naturalHeight) * imageBox.height,
          width: (normalizedCrop.width / imageBox.naturalWidth) * imageBox.width,
          height: (normalizedCrop.height / imageBox.naturalHeight) * imageBox.height,
        }
      : null;
  const sourceImageStyle = imageBox
    ? {
        left: imageBox.left + imageBox.width / 2 - imageBox.sourceWidth * imageBox.scale / 2,
        top: imageBox.top + imageBox.height / 2 - imageBox.sourceHeight * imageBox.scale / 2,
        width: imageBox.sourceWidth * imageBox.scale,
        height: imageBox.sourceHeight * imageBox.scale,
        transform: "rotate(" + imageBox.rotationDegrees + "deg) scaleX(" + (flipX ? -1 : 1) + ") scaleY(" + (flipY ? -1 : 1) + ")",
      }
    : undefined;

  return (
    <div className={"advanced-cropper " + className}>
      <div
        ref={containerRef}
        onPointerDown={beginCrop}
        onPointerMove={moveCrop}
        onPointerUp={endCrop}
        onPointerCancel={endCrop}
        onWheel={handleWheel}
        onKeyDown={nudgeCrop}
        tabIndex={0}
        aria-label="Image crop canvas. Use arrow keys to move the crop."
        className={"advanced-cropper__stage " + (interactionMode === "pan" ? "cursor-grab" : "cursor-crosshair")}
        style={{ touchAction: "none" }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Crop preview"
          draggable={false}
          onLoad={() => window.requestAnimationFrame(() => measureImage())}
          className={`advanced-cropper__image ${backgroundRemoval?.enabled && backgroundPreviewReady ? "opacity-0" : ""}`}
          style={sourceImageStyle}
        />
        {backgroundRemoval?.enabled ? (
          <canvas
            ref={backgroundPreviewCanvasRef}
            className="advanced-cropper__image"
            aria-hidden="true"
            style={sourceImageStyle}
          />
        ) : null}
        {cropStyle ? (
          <div data-crop-move="true" className="advanced-cropper__selection" style={cropStyle}>
            <CropGuides guide={guide} />
            {CROP_HANDLES.map((handle) => (
              <span
                key={handle}
                data-crop-handle={handle}
                aria-hidden="true"
                className={"advanced-cropper__handle " + CROP_HANDLE_CLASSES[handle]}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CropGuides({ guide }: { guide: CropGuide }) {
  if (guide === "none") return null;
  if (guide === "golden") {
    return <span className="crop-guides crop-guides--golden"><i /><i /><b /><b /></span>;
  }
  if (guide === "grid") {
    return <span className="crop-guides crop-guides--grid" />;
  }
  if (guide === "center") {
    return <span className="crop-guides crop-guides--center"><i /><b /></span>;
  }
  return <span className="crop-guides crop-guides--thirds"><i /><i /><b /><b /></span>;
}

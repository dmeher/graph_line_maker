"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { normalizeCrop, type CropPixels } from "@/lib/canvas/crop";

type ImageBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};

type DragState = {
  pointerId: number;
  mode: "create" | "move" | "resize";
  startX: number;
  startY: number;
  startCrop: CropPixels | null;
  handle: CropHandle | null;
};

type CropHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

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

export function ManualCropper({
  imageUrl,
  crop,
  onCropChange,
  aspectRatio = null,
  zoom = 1,
  onImageSizeChange,
  className = "",
}: {
  imageUrl: string;
  crop: CropPixels | null;
  onCropChange: (crop: CropPixels) => void;
  aspectRatio?: number | null;
  zoom?: number;
  onImageSizeChange?: (size: { width: number; height: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const onImageSizeChangeRef = useRef(onImageSizeChange);
  const [imageBox, setImageBox] = useState<ImageBox | null>(null);

  useEffect(() => {
    onImageSizeChangeRef.current = onImageSizeChange;
  }, [onImageSizeChange]);

  function measureImage() {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !image.naturalWidth || !image.naturalHeight) return null;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return null;

    const scale = Math.min(containerRect.width / image.naturalWidth, containerRect.height / image.naturalHeight) * zoom;
    if (!Number.isFinite(scale) || scale <= 0) return null;

    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const nextBox = {
      left: (containerRect.width - imageWidth) / 2,
      top: (containerRect.height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
    setImageBox(nextBox);
    onImageSizeChangeRef.current?.({ width: image.naturalWidth, height: image.naturalHeight });
    return nextBox;
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>, box: ImageBox) {
    const containerRect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - containerRect.left - box.left) / box.width) * box.naturalWidth);
    const y = Math.round(((event.clientY - containerRect.top - box.top) / box.height) * box.naturalHeight);
    return {
      x: clamp(x, 0, box.naturalWidth),
      y: clamp(y, 0, box.naturalHeight),
    };
  }

  function beginCrop(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const box = measureImage() ?? imageBox;
    if (!box) return;

    const point = pointFromEvent(event, box);
    const target = event.target as HTMLElement;
    const handleElement = target.closest("[data-crop-handle]") as HTMLElement | null;
    const handle = handleElement?.dataset.cropHandle as CropHandle | undefined;
    const moveElement = target.closest("[data-crop-move='true']");
    const startCrop = crop ? normalizeCrop(crop, box.naturalWidth, box.naturalHeight) : null;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      mode: handle ? "resize" : moveElement ? "move" : "create",
      startX: point.x,
      startY: point.y,
      startCrop,
      handle: handle ?? null,
    };
    if (!handle && !moveElement) onCropChange(cropFromPoints(point.x, point.y, point.x + 1, point.y + 1, box, aspectRatio));
  }

  function moveCrop(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const box = imageBox;
    if (!box) return;

    event.preventDefault();
    const point = pointFromEvent(event, box);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (dragState.mode === "move" && dragState.startCrop) {
      onCropChange(cropFromMove(dragState.startCrop, deltaX, deltaY, box));
      return;
    }

    if (dragState.mode === "resize" && dragState.startCrop && dragState.handle) {
      onCropChange(cropFromResize(dragState.startCrop, dragState.handle, deltaX, deltaY, box, aspectRatio));
      return;
    }

    onCropChange(cropFromPoints(dragState.startX, dragState.startY, point.x, point.y, box, aspectRatio));
  }

  function endCrop(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  }

  useEffect(() => {
    setImageBox(null);
    const frame = window.requestAnimationFrame(() => {
      measureImage();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [imageUrl, zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      measureImage();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [imageUrl, zoom]);

  const normalizedCrop = imageBox && crop ? normalizeCrop(crop, imageBox.naturalWidth, imageBox.naturalHeight) : null;
  const cropStyle =
    imageBox && normalizedCrop
      ? {
          left: imageBox.left + (normalizedCrop.x / imageBox.naturalWidth) * imageBox.width,
          top: imageBox.top + (normalizedCrop.y / imageBox.naturalHeight) * imageBox.height,
          width: (normalizedCrop.width / imageBox.naturalWidth) * imageBox.width,
          height: (normalizedCrop.height / imageBox.naturalHeight) * imageBox.height,
        }
      : null;

  return (
    <div className={`flex min-h-0 flex-col gap-3 bg-white ${className}`}>
      <div
        ref={containerRef}
        onPointerDown={beginCrop}
        onPointerMove={moveCrop}
        onPointerUp={endCrop}
        onPointerCancel={endCrop}
        className="relative min-h-0 flex-1 cursor-crosshair overflow-hidden rounded-md bg-white"
        style={{ touchAction: "none" }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Crop preview"
          draggable={false}
          onLoad={() => {
            window.requestAnimationFrame(() => measureImage());
          }}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
        {cropStyle ? (
          <div
            data-crop-move="true"
            className="absolute cursor-move border-2 border-[var(--teal)] bg-teal-400/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
            style={cropStyle}
          >
            {CROP_HANDLES.map((handle) => (
              <span
                key={handle}
                data-crop-handle={handle}
                aria-hidden="true"
                className={`absolute h-4 w-4 rounded-full border-2 border-white bg-[var(--teal)] shadow-sm ${CROP_HANDLE_CLASSES[handle]}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

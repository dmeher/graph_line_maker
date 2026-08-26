export const A4_PREVIEW_DPI = 300;
export const A4_PREVIEW_TARGET_WIDTH_CM = 80;
export const A4_PREVIEW_PADDING_MM = 5;
export const A4_PREVIEW_TOP_MARGIN_MM = 15;
export const A4_PREVIEW_BORDER_HEIGHT_MM = 10;
export const A4_PREVIEW_LANDSCAPE_THRESHOLD_CM = 30;
export const A4_PREVIEW_DEFAULT_SPATA_COUNT = 20;

const MILLIMETRES_PER_INCH = 25.4;

export const A4_PREVIEW_BORDER_OPTIONS = [
  { id: "sambalpuri-spata-default", label: "Default spata (20)", path: "/preview-borders/sambalpuri-spata-default.svg" },
  { id: "geometric-pattern", label: "Geometric pattern", path: "/preview-borders/geometric-pattern.png" },
  { id: "tribal", label: "Tribal figures", path: "/preview-borders/tribal-border.png" },
  { id: "elephant-floral", label: "Elephant floral", path: "/preview-borders/elephant-floral-border.png" },
  { id: "checker", label: "Checker weave", path: "/preview-borders/checker-border.png" },
  { id: "geometric", label: "Geometric weave", path: "/preview-borders/geometric-border.png" },
  { id: "sambalpuri-pasapali", label: "Pasapali rhythm", path: "/preview-borders/sambalpuri-pasapali.svg" },
  { id: "sambalpuri-shankha-chakra", label: "Shankha chakra", path: "/preview-borders/sambalpuri-shankha-chakra.svg" },
  { id: "sambalpuri-padma-vine", label: "Padma vine", path: "/preview-borders/sambalpuri-padma-vine.svg" },
  { id: "sambalpuri-machha-jali", label: "Machha jali", path: "/preview-borders/sambalpuri-machha-jali.svg" },
  { id: "sambalpuri-temple-rudraksha", label: "Temple rudraksha", path: "/preview-borders/sambalpuri-temple-rudraksha.svg" },
  { id: "modern-geo-pulse", label: "Geo pulse", path: "/preview-borders/modern-geo-pulse.svg" },
  { id: "modern-deco-fan", label: "Deco fan", path: "/preview-borders/modern-deco-fan.svg" },
  { id: "modern-monoline-wave", label: "Monoline wave", path: "/preview-borders/modern-monoline-wave.svg" },
  { id: "modern-pixel-circuit", label: "Pixel circuit", path: "/preview-borders/modern-pixel-circuit.svg" },
  { id: "modern-organic-arches", label: "Organic arches", path: "/preview-borders/modern-organic-arches.svg" },
] as const;

/** The supplied 20-spata Sambalpuri strip is the preselected A4 border. */
export const DEFAULT_A4_PREVIEW_BORDER_ID = A4_PREVIEW_BORDER_OPTIONS[0].id;

/**
 * Presentation-only paper choices for the A4 preview. These intentionally do
 * not use the editor's persisted artwork palette: the selection applies only
 * to the downloaded preview and transparent leaves its page backdrop unpainted.
 */
export const A4_PREVIEW_BACKGROUND_OPTIONS = [
  { id: "white", label: "White", color: "#ffffff" },
  { id: "ivory", label: "Ivory", color: "#f5e6b8" },
  { id: "cream", label: "Cream", color: "#f6dda6" },
  { id: "butter", label: "Butter", color: "#f9e36f" },
  { id: "blush", label: "Blush", color: "#f7c6d0" },
  { id: "peach", label: "Peach", color: "#f8c9b7" },
  { id: "apricot", label: "Apricot", color: "#f6c58d" },
  { id: "rose", label: "Rose", color: "#edbdd1" },
  { id: "lavender", label: "Lavender", color: "#dcccf3" },
  { id: "lilac", label: "Lilac", color: "#e7c9f3" },
  { id: "periwinkle", label: "Periwinkle", color: "#c9d5f5" },
  { id: "sky", label: "Sky", color: "#bdddf7" },
  { id: "ice", label: "Ice", color: "#bdeaf1" },
  { id: "mint", label: "Mint", color: "#bde7cf" },
  { id: "sage", label: "Sage", color: "#c9ddbf" },
  { id: "mist", label: "Mist", color: "#d1dbe8" },
  { id: "transparent", label: "Transparent", color: null },
] as const;

export type A4PreviewBorderId = (typeof A4_PREVIEW_BORDER_OPTIONS)[number]["id"];
export type A4PreviewBackgroundId = (typeof A4_PREVIEW_BACKGROUND_OPTIONS)[number]["id"];
export type A4PreviewOrientation = "portrait" | "landscape";

export type A4GraphPreviewLayout = {
  orientation: A4PreviewOrientation;
  dpi: number;
  width: number;
  height: number;
  repeatCount: number;
  padding: number;
  topMargin: number;
  title: { x: number; y: number; width: number; height: number };
  graph: { x: number; y: number; width: number; height: number };
  topBorder: { x: number; y: number; width: number; height: number };
  bottomBorder: { x: number; y: number; width: number; height: number };
};

export type A4GraphPreviewSourceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function positiveInteger(value: number | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.round(numeric)) : fallback;
}

function millimetresToPixels(value: number, dpi: number) {
  return Math.max(1, Math.round((value / MILLIMETRES_PER_INCH) * dpi));
}

/**
 * The stored graph includes one blank 1 cm gutter cell at either side. They
 * are page framing, not design, so they must not affect preview repetition.
 */
export function createA4PreviewArtworkWidthCm(graphWidthCm: number) {
  const width = Number(graphWidthCm);
  if (!Number.isFinite(width) || width <= 0) return 1;
  return width > 2 ? width - 2 : width;
}

/**
 * Uses whole artwork repeats to cover the requested logical preview width.
 * The final A4 canvas still scales those repeats into its printable width.
 */
export function createA4PreviewRepeatCount(artworkWidthCm: number) {
  const width = Number(artworkWidthCm);
  if (!Number.isFinite(width) || width <= 0) return 1;
  return Math.max(1, Math.ceil(A4_PREVIEW_TARGET_WIDTH_CM / width));
}

/**
 * The preview is a full A4 presentation image. Its graph strip represents an
 * 80 cm-wide run of the project, with whole repeats distributed evenly across
 * the printable page width.
 */
export function createA4GraphPreviewLayout({
  graphWidthCm,
  dpi = A4_PREVIEW_DPI,
}: {
  graphWidthCm: number;
  dpi?: number;
}): A4GraphPreviewLayout {
  const safeDpi = positiveInteger(dpi, A4_PREVIEW_DPI);
  const orientation: A4PreviewOrientation = graphWidthCm > A4_PREVIEW_LANDSCAPE_THRESHOLD_CM ? "landscape" : "portrait";
  const pageWidthMm = orientation === "portrait" ? 210 : 297;
  const pageHeightMm = orientation === "portrait" ? 297 : 210;
  const width = millimetresToPixels(pageWidthMm, safeDpi);
  const height = millimetresToPixels(pageHeightMm, safeDpi);
  const padding = millimetresToPixels(A4_PREVIEW_PADDING_MM, safeDpi);
  const topMargin = millimetresToPixels(A4_PREVIEW_TOP_MARGIN_MM, safeDpi);
  const borderHeight = millimetresToPixels(A4_PREVIEW_BORDER_HEIGHT_MM, safeDpi);
  const graphY = topMargin + borderHeight;
  const graphHeight = Math.max(1, height - graphY - padding - borderHeight);
  const graphWidth = Math.max(1, width - padding * 2);
  const repeatCount = createA4PreviewRepeatCount(createA4PreviewArtworkWidthCm(graphWidthCm));

  return {
    orientation,
    dpi: safeDpi,
    width,
    height,
    repeatCount,
    padding,
    topMargin,
    // Keep the 5 mm outer padding, then use the remaining 10 mm of the
    // existing 15 mm top margin as the project-name line.
    title: { x: padding, y: padding, width: width - padding * 2, height: Math.max(1, topMargin - padding) },
    graph: {
      x: padding,
      y: graphY,
      width: graphWidth,
      height: graphHeight,
    },
    topBorder: { x: padding, y: topMargin, width: graphWidth, height: borderHeight },
    bottomBorder: { x: padding, y: height - padding - borderHeight, width: graphWidth, height: borderHeight },
  };
}

/**
 * The first and last graph cells are intentionally blank page gutters in the
 * editor. They are not artwork, so exclude one cell from either side before
 * repeating the design on the A4 preview.
 */
export function createA4GraphPreviewSourceCrop({
  sourceWidth,
  sourceHeight,
  graphWidthCm,
}: {
  sourceWidth: number;
  sourceHeight: number;
  graphWidthCm: number;
}): A4GraphPreviewSourceCrop {
  const width = Math.max(1, Math.round(sourceWidth));
  const height = Math.max(1, Math.round(sourceHeight));
  const graphCells = Number(graphWidthCm);
  if (!Number.isFinite(graphCells) || graphCells <= 2) return { x: 0, y: 0, width, height };

  const artworkWidthCm = createA4PreviewArtworkWidthCm(graphCells);
  const blankGutterWidthCm = graphCells - artworkWidthCm;
  const inset = Math.min((width * blankGutterWidthCm) / (graphCells * 2), (width - 1) / 2);
  return { x: inset, y: 0, width: Math.max(1, width - inset * 2), height };
}

function isA4PreviewBorderId(value: string): value is A4PreviewBorderId {
  return A4_PREVIEW_BORDER_OPTIONS.some((border) => border.id === value);
}

function borderForId(id: A4PreviewBorderId) {
  return A4_PREVIEW_BORDER_OPTIONS.find((border) => border.id === id) ?? A4_PREVIEW_BORDER_OPTIONS[0];
}

function isA4PreviewBackgroundId(value: string): value is A4PreviewBackgroundId {
  return A4_PREVIEW_BACKGROUND_OPTIONS.some((background) => background.id === value);
}

function backgroundForId(id: A4PreviewBackgroundId) {
  return A4_PREVIEW_BACKGROUND_OPTIONS.find((background) => background.id === id) ?? A4_PREVIEW_BACKGROUND_OPTIONS[0];
}

const borderImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadBorderImage(path: string) {
  const existing = borderImageCache.get(path);
  if (existing) return existing;

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected preview border could not be loaded."));
    image.src = path;
  });
  borderImageCache.set(path, pending);
  return pending;
}

function drawHorizontalBorder(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rectangle: { x: number; y: number; width: number; height: number },
  mirrored: boolean,
) {
  context.save();
  if (mirrored) {
    context.translate(rectangle.x + rectangle.width, rectangle.y);
    context.rotate(Math.PI / 2);
  } else {
    context.translate(rectangle.x, rectangle.y + rectangle.height);
    context.rotate(-Math.PI / 2);
  }
  // The supplied artwork is vertical. Rotate and scale the entire source into
  // the horizontal band without cropping any part of the motif.
  context.drawImage(image, 0, 0, image.width, image.height, 0, 0, rectangle.height, rectangle.width);
  context.restore();
}

function truncateTitle(context: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const normalized = title.trim() || "Untitled project";
  if (context.measureText(normalized).width <= maxWidth) return normalized;

  const suffix = "…";
  let end = normalized.length;
  while (end > 1) {
    const candidate = `${normalized.slice(0, end)}${suffix}`;
    if (context.measureText(candidate).width <= maxWidth) return candidate;
    end -= 1;
  }
  return suffix;
}

function drawProjectTitle(
  context: CanvasRenderingContext2D,
  title: string,
  rectangle: { x: number; y: number; width: number; height: number },
) {
  const fontSize = Math.max(18, Math.floor(rectangle.height * 0.56));
  context.save();
  context.fillStyle = "#111111";
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    truncateTitle(context, title, rectangle.width),
    rectangle.x + rectangle.width / 2,
    rectangle.y + rectangle.height / 2,
    rectangle.width,
  );
  context.restore();
}

/** Builds the browser-only A4 preview canvas from settled artwork without grid lines. */
export async function createA4GraphPreview(
  sourceCanvas: HTMLCanvasElement,
  {
    graphWidthCm,
    borderId,
    backgroundId,
    projectTitle,
  }: {
    graphWidthCm: number;
    borderId: A4PreviewBorderId | string;
    backgroundId?: A4PreviewBackgroundId | string;
    projectTitle: string;
  },
) {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
    throw new Error("The graph image is empty. Wait for the canvas to finish rendering.");
  }
  const selectedBorder = borderForId(isA4PreviewBorderId(borderId) ? borderId : DEFAULT_A4_PREVIEW_BORDER_ID);
  const selectedBackground = backgroundForId(
    typeof backgroundId === "string" && isA4PreviewBackgroundId(backgroundId)
      ? backgroundId
      : A4_PREVIEW_BACKGROUND_OPTIONS[0].id,
  );
  const [borderImage, layout] = await Promise.all([
    loadBorderImage(selectedBorder.path),
    Promise.resolve(createA4GraphPreviewLayout({ graphWidthCm })),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  // The selected shade belongs only to the artwork field framed by the two
  // horizontal borders. Keep the title strip and the 5 mm outer padding plain
  // white so the paper does not look tinted outside the frame.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (selectedBackground.color) {
    context.fillStyle = selectedBackground.color;
    context.fillRect(layout.graph.x, layout.graph.y, layout.graph.width, layout.graph.height);
  } else {
    context.clearRect(layout.graph.x, layout.graph.y, layout.graph.width, layout.graph.height);
  }
  context.imageSmoothingEnabled = true;
  drawProjectTitle(context, projectTitle, layout.title);
  drawHorizontalBorder(context, borderImage, layout.topBorder, false);
  drawHorizontalBorder(context, borderImage, layout.bottomBorder, true);

  const tileWidth = layout.graph.width / layout.repeatCount;
  const sourceCrop = createA4GraphPreviewSourceCrop({
    sourceWidth: sourceCanvas.width,
    sourceHeight: sourceCanvas.height,
    graphWidthCm,
  });
  context.save();
  context.beginPath();
  context.rect(layout.graph.x, layout.graph.y, layout.graph.width, layout.graph.height);
  context.clip();
  for (let index = 0; index < layout.repeatCount; index += 1) {
    const x = layout.graph.x + index * tileWidth;
    context.save();
    if (index % 2 === 1) {
      context.translate(x + tileWidth, layout.graph.y);
      context.scale(-1, 1);
      context.drawImage(sourceCanvas, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, tileWidth, layout.graph.height);
    } else {
      context.drawImage(sourceCanvas, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, x, layout.graph.y, tileWidth, layout.graph.height);
    }
    context.restore();
  }
  context.restore();

  return { canvas, layout, border: selectedBorder, background: selectedBackground };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function pngChunk(type: readonly number[], data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(chunk.slice(4, 8 + data.length)));
  return chunk;
}

function isPngSignature(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return signature.every((value, index) => bytes[index] === value);
}

/** Adds a PNG pHYs chunk so print applications recognize the A4 canvas as 300 DPI. */
export function setPngResolution(bytes: Uint8Array, dpi = A4_PREVIEW_DPI) {
  if (!isPngSignature(bytes)) return bytes;
  const pixelsPerMetre = Math.max(1, Math.round(positiveInteger(dpi, A4_PREVIEW_DPI) / 0.0254));
  const resolution = new Uint8Array(9);
  writeUint32(resolution, 0, pixelsPerMetre);
  writeUint32(resolution, 4, pixelsPerMetre);
  resolution[8] = 1;
  const physicalChunk = pngChunk([112, 72, 89, 115], resolution);
  const chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  let inserted = false;

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type !== "pHYs") chunks.push(bytes.slice(offset, end));
    if (type === "IHDR") {
      chunks.push(physicalChunk);
      inserted = true;
    }
    offset = end;
  }
  if (!inserted || offset !== bytes.length) return bytes;

  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

/** Encodes an A4 preview PNG with its 300-DPI physical-resolution metadata. */
export async function createA4PreviewPngBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("Unable to encode the A4 preview PNG."))), "image/png");
  });
  const resolvedBytes = setPngResolution(new Uint8Array(await blob.arrayBuffer()));
  const resolvedBuffer = new ArrayBuffer(resolvedBytes.byteLength);
  new Uint8Array(resolvedBuffer).set(resolvedBytes);
  return new Blob([resolvedBuffer], { type: "image/png" });
}

function escapePreviewPrintHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

/** Opens one exact-size A4 print page for the already generated preview PNG. */
export function printA4PreviewBlob(
  blob: Blob,
  {
    title = "A4 preview",
    orientation,
  }: {
    title?: string;
    orientation: A4PreviewOrientation;
  },
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Unable to open the A4 print window.");
  printWindow.opener = null;

  const imageUrl = URL.createObjectURL(blob);
  let released = false;
  const releaseImageUrl = () => {
    if (released) return;
    released = true;
    URL.revokeObjectURL(imageUrl);
  };
  const pageSize = orientation === "landscape" ? "297mm 210mm" : "210mm 297mm";
  printWindow.addEventListener("afterprint", releaseImageUrl, { once: true });
  printWindow.addEventListener("beforeunload", releaseImageUrl, { once: true });

  try {
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapePreviewPrintHtml(title)}</title>
  <style>
    @page { size: ${pageSize}; margin: 0; }
    html, body {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      height: ${orientation === "landscape" ? "210mm" : "297mm"};
      margin: 0;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: fill;
    }
  </style>
</head>
<body>
  <img id="a4-preview-image" src="${escapePreviewPrintHtml(imageUrl)}" alt="${escapePreviewPrintHtml(title)}" />
  <script>
    (() => {
      const image = document.getElementById("a4-preview-image");
      const openPrintDialog = () => window.setTimeout(() => {
        window.focus();
        window.print();
      }, 100);
      if (image && !image.complete) {
        image.addEventListener("load", openPrintDialog, { once: true });
        image.addEventListener("error", openPrintDialog, { once: true });
      } else {
        openPrintDialog();
      }
    })();
  </script>
</body>
</html>`);
    printWindow.document.close();
  } catch (error) {
    releaseImageUrl();
    printWindow.close();
    throw error;
  }
}

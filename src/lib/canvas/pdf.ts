import { isPdfFile } from "@/lib/constants";

const PDF_RENDER_MAX_DIMENSION = 4200;
const PDF_RENDER_MAX_PIXELS = 14_000_000;

let pdfWorkerConfigured = false;

type PdfSource = Blob | string;

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

async function sourceToArrayBuffer(source: PdfSource) {
  if (typeof source !== "string") return source.arrayBuffer();

  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load PDF source.");
  return response.arrayBuffer();
}

function pdfRenderScale(width: number, height: number) {
  const dimensionScale = Math.min(1, PDF_RENDER_MAX_DIMENSION / width, PDF_RENDER_MAX_DIMENSION / height);
  const pixelScale = Math.min(1, Math.sqrt(PDF_RENDER_MAX_PIXELS / Math.max(1, width * height)));
  return Math.max(0.1, Math.min(dimensionScale, pixelScale));
}

export function isPdfSource(source: Blob | string, fileName?: string) {
  if (typeof source !== "string") return isPdfFile(source);
  return isPdfFile({ name: fileName || source.split("?")[0] });
}

export async function readPdfFirstPageSize(source: PdfSource) {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await sourceToArrayBuffer(source));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    return {
      width: Math.max(1, Math.round(viewport.width)),
      height: Math.max(1, Math.round(viewport.height)),
      pageCount: pdf.numPages,
    };
  } finally {
    await pdf.destroy();
  }
}

export async function renderPdfFirstPageToCanvas(source: PdfSource) {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await sourceToArrayBuffer(source));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: pdfRenderScale(baseViewport.width, baseViewport.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is not available.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport, background: "white" }).promise;
    return {
      canvas,
      width: Math.max(1, Math.round(baseViewport.width)),
      height: Math.max(1, Math.round(baseViewport.height)),
      pageCount: pdf.numPages,
    };
  } finally {
    await pdf.destroy();
  }
}

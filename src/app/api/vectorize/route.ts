import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  DEFAULT_VECTORIZER_INK_THRESHOLD,
  DEFAULT_VECTORIZER_SKETCH_REMOVAL,
  GRAPH_VECTORIZER_FIDELITY_KEYS,
  VECTORIZER_LINE_ADJUST_STEP,
  clampVectorizerInkThreshold,
  clampVectorizerLineAdjust,
  clampVectorizerSketchRemoval,
  type GraphVectorizerFidelity,
} from "@/lib/graph-paper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp"]);
const SHAPE_TAG_PATTERN = /<(path|polygon|polyline|line|rect|circle|ellipse)\b([^>]*?)(\/?)>/gi;
const SVG_ATTR_PATTERN = /\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|style)=("[^"]*"|'[^']*')/gi;

type VectorizerModule = typeof import("@neplex/vectorizer");

function normalizeFidelity(value: FormDataEntryValue | null): GraphVectorizerFidelity {
  return GRAPH_VECTORIZER_FIDELITY_KEYS.includes(value as GraphVectorizerFidelity)
    ? (value as GraphVectorizerFidelity)
    : "exact";
}

function vectorizerConfig(vectorizer: VectorizerModule, fidelity: GraphVectorizerFidelity) {
  const exact = fidelity === "exact";
  return {
    colorMode: vectorizer.ColorMode.Binary,
    hierarchical: vectorizer.Hierarchical.Stacked,
    mode: exact ? vectorizer.PathSimplifyMode.None : vectorizer.PathSimplifyMode.Spline,
    filterSpeckle: exact ? 0 : 4,
    colorPrecision: 6,
    layerDifference: 8,
    cornerThreshold: 60,
    lengthThreshold: exact ? 1 : 4,
    maxIterations: exact ? 0 : 2,
    spliceThreshold: 45,
    pathPrecision: exact ? 2 : 3,
  };
}

function styleSvgForMask(svg: string) {
  return svg.replace(SHAPE_TAG_PATTERN, (_match, tag: string, attrs: string, slash: string) => {
    const cleanedAttrs = attrs.replace(SVG_ATTR_PATTERN, "");
    return `<${tag}${cleanedAttrs} fill="#000000" stroke="none"${slash ? " /" : ""}>`;
  });
}

function imageMaskFromPixels(pixels: Buffer, threshold: number) {
  const mask = new Uint8Array(pixels.length / 4);
  for (let pixel = 0, offset = 0; pixel < mask.length; pixel += 1, offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha <= 8) continue;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    mask[pixel] = luminance <= threshold ? 1 : 0;
  }
  return mask;
}

function erodeMask(mask: Uint8Array, width: number, height: number, includeDiagonals = true) {
  const next = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dy = -1; dy <= 1 && keep; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!includeDiagonals && Math.abs(dx) + Math.abs(dy) > 1) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = 0;
            break;
          }
        }
      }
      next[y * width + x] = keep;
    }
  }
  return next;
}

function dilateMask(mask: Uint8Array, width: number, height: number, includeDiagonals = true) {
  const next = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let fill = 0;
      for (let dy = -1; dy <= 1 && !fill; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!includeDiagonals && Math.abs(dx) + Math.abs(dy) > 1) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) {
            fill = 1;
            break;
          }
        }
      }
      next[y * width + x] = fill;
    }
  }
  return next;
}

/**
 * Removes interior sketch/hatch strokes with a morphological opening.
 *
 * Hand-drawn art commonly shades the inside of a shape with thin scattered
 * lines. Eroding by N steps deletes every stroke narrower than about 2N pixels;
 * dilating by the same N restores the surviving thick outlines to their
 * original weight. Strokes are removed regardless of whether they touch the
 * outline, which connected-component filtering could not do — hatching usually
 * runs edge to edge and is therefore part of the same component.
 *
 * The result is that the shape's interior becomes an empty enclosed region,
 * which the processor then labels as a fill region the user can colour.
 */
function removeSketchStrokes(mask: Uint8Array, width: number, height: number, strength: number) {
  if (strength <= 0) return mask;

  let opened = mask;
  for (let step = 0; step < strength; step += 1) {
    opened = erodeMask(opened, width, height);
  }
  for (let step = 0; step < strength; step += 1) {
    opened = dilateMask(opened, width, height);
  }

  // Erosion is destructive: on artwork whose outlines are themselves thinner
  // than the chosen strength this deletes everything. Falling back to the
  // original mask keeps a too-aggressive setting recoverable in the UI instead
  // of rendering a blank layer.
  return opened.some((value) => value) ? opened : mask;
}

function adjustMaskThickness(mask: Uint8Array, width: number, height: number, lineAdjust: number) {
  let adjusted = mask;
  const amount = Math.abs(lineAdjust);
  const steps = Math.floor(amount);
  const hasHalfStep = amount - steps >= VECTORIZER_LINE_ADJUST_STEP;
  const thicken = lineAdjust > 0;

  for (let step = 0; step < steps; step += 1) {
    adjusted = thicken ? dilateMask(adjusted, width, height) : erodeMask(adjusted, width, height);
  }

  if (hasHalfStep) {
    adjusted = thicken ? dilateMask(adjusted, width, height, false) : erodeMask(adjusted, width, height, false);
  }

  return adjusted;
}

function rawPixelsFromMask(mask: Uint8Array) {
  const pixels = Buffer.alloc(mask.length * 4);
  for (let pixel = 0, offset = 0; pixel < mask.length; pixel += 1, offset += 4) {
    const value = mask[pixel] ? 0 : 255;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return pixels;
}

async function prepareRawVectorInput(
  vectorizer: VectorizerModule,
  image: File,
  lineAdjust: number,
  inkThreshold: number,
  sketchRemoval: number,
) {
  const decoded = await vectorizer.readImage(Buffer.from(await image.arrayBuffer()));
  const mask = imageMaskFromPixels(decoded.pixels, inkThreshold);
  // Strip sketch strokes before any thickness adjustment, so line adjust
  // operates on the cleaned outlines rather than re-thickening the hatching.
  const cleanedMask = removeSketchStrokes(mask, decoded.width, decoded.height, sketchRemoval);
  const adjustedMask = lineAdjust ? adjustMaskThickness(cleanedMask, decoded.width, decoded.height, lineAdjust) : cleanedMask;
  return {
    pixels: rawPixelsFromMask(adjustedMask),
    width: decoded.width,
    height: decoded.height,
  };
}

async function createSvg(
  image: File,
  lineAdjust: number,
  inkThreshold: number,
  fidelity: GraphVectorizerFidelity,
  sketchRemoval: number,
) {
  const vectorizer = await import("@neplex/vectorizer");
  const rawInput = await prepareRawVectorInput(vectorizer, image, lineAdjust, inkThreshold, sketchRemoval);
  const svg = await vectorizer.vectorizeRaw(
    rawInput.pixels,
    { width: rawInput.width, height: rawInput.height },
    vectorizerConfig(vectorizer, fidelity),
  );
  const styledSvg = styleSvgForMask(svg);

  try {
    return await vectorizer.optimize(styledSvg, {
      preset: vectorizer.OptimizePreset.Safe,
      multipass: true,
      multipassIterations: 2,
    });
  } catch {
    return styledSvg;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();

    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ message: "Choose an image file." }, { status: 400 });
    }
    if (image.size <= 0) {
      return NextResponse.json({ message: "The selected image is empty." }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: "Images must be 12 MB or smaller." }, { status: 413 });
    }
    if (!ACCEPTED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ message: "Use a PNG, JPEG, WEBP, or BMP image." }, { status: 415 });
    }

    const lineAdjust = clampVectorizerLineAdjust(formData.get("lineAdjust"));
    const inkThreshold = clampVectorizerInkThreshold(formData.get("inkThreshold") ?? DEFAULT_VECTORIZER_INK_THRESHOLD);
    const fidelity = normalizeFidelity(formData.get("fidelity"));
    const sketchRemoval = clampVectorizerSketchRemoval(formData.get("sketchRemoval") ?? DEFAULT_VECTORIZER_SKETCH_REMOVAL);
    const svg = await createSvg(image, lineAdjust, inkThreshold, fidelity, sketchRemoval);

    return new NextResponse(svg, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Sign in is required.") {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to vectorize image." },
      { status: 500 },
    );
  }
}

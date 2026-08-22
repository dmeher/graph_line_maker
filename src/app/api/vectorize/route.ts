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
import {
  resolveVectorTraceProfile,
  type VectorTraceProfile,
} from "@/lib/canvas/vector-trace-profile";
import {
  binaryMaskToOpaqueRgba,
  prepareVectorTraceMask,
} from "@/lib/canvas/vector-mask-preparation";

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

function vectorizerConfig(vectorizer: VectorizerModule, profile: VectorTraceProfile) {
  return {
    colorMode: vectorizer.ColorMode.Binary,
    hierarchical: vectorizer.Hierarchical.Stacked,
    mode: profile.mode === "none" ? vectorizer.PathSimplifyMode.None : vectorizer.PathSimplifyMode.Spline,
    filterSpeckle: profile.filterSpeckle,
    colorPrecision: profile.colorPrecision,
    layerDifference: profile.layerDifference,
    cornerThreshold: profile.cornerThreshold,
    lengthThreshold: profile.lengthThreshold,
    maxIterations: profile.maxIterations,
    spliceThreshold: profile.spliceThreshold,
    pathPrecision: profile.pathPrecision,
  };
}

function styleSvgForMask(svg: string) {
  return svg.replace(SHAPE_TAG_PATTERN, (_match, tag: string, attrs: string, slash: string) => {
    const cleanedAttrs = attrs.replace(SVG_ATTR_PATTERN, "");
    return `<${tag}${cleanedAttrs} fill="#000000" stroke="none"${slash ? " /" : ""}>`;
  });
}

/**
 * Decodes the raster before the shared vector-mask preparation helper applies
 * thresholding, sketch removal, and Line adjustment.
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
async function prepareRawVectorInput(
  vectorizer: VectorizerModule,
  image: File,
  lineAdjust: number,
  inkThreshold: number,
  sketchRemoval: number,
) {
  const decoded = await vectorizer.readImage(Buffer.from(await image.arrayBuffer()));
  const prepared = prepareVectorTraceMask(
    { data: decoded.pixels, width: decoded.width, height: decoded.height },
    {
      inkThreshold,
      lineAdjust,
      sketchRemoval,
      lineAdjustStep: VECTORIZER_LINE_ADJUST_STEP,
    },
  );
  return {
    prepared,
    pixels: Buffer.from(binaryMaskToOpaqueRgba(prepared.mask)),
    width: prepared.width,
    height: prepared.height,
  };
}

async function createSvg(
  image: File,
  lineAdjust: number,
  inkThreshold: number,
  fidelity: GraphVectorizerFidelity,
  sketchRemoval: number,
): Promise<string> {
  const vectorizer = await import("@neplex/vectorizer");
  const contourProfile = resolveVectorTraceProfile(fidelity, inkThreshold, lineAdjust);
  const rawInput = await prepareRawVectorInput(
    vectorizer,
    image,
    contourProfile.lineAdjust,
    contourProfile.inkThreshold,
    sketchRemoval,
  );
  const svg = await vectorizer.vectorizeRaw(
    rawInput.pixels,
    { width: rawInput.width, height: rawInput.height },
    vectorizerConfig(vectorizer, contourProfile),
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
    const svg = await createSvg(
      image,
      lineAdjust,
      inkThreshold,
      fidelity,
      sketchRemoval,
    );

    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "image/svg+xml; charset=utf-8",
    });
    return new NextResponse(svg, {
      headers,
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

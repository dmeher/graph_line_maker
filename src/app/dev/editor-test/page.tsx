import { notFound } from "next/navigation";
import { EditorClient } from "@/components/editor/editor-client";
import { normalizeGraphSettings } from "@/lib/projects";
import type { Project } from "@/lib/types";

const testSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480">
  <rect width="320" height="480" fill="#fff"/>
  <path d="M18 44 H302" stroke="#bbbbbb" stroke-width="1" fill="none"/>
  <g fill="none" stroke="#111827" stroke-linecap="round" stroke-linejoin="round">
    <path d="M92 458 C116 390 130 318 116 238 C111 205 91 181 70 153" stroke-width="8"/>
    <path d="M145 456 C172 405 202 347 221 280 C234 232 241 183 265 126" stroke-width="7"/>
    <path d="M82 336 C55 303 38 260 24 218" stroke-width="5"/>
    <path d="M132 296 C174 269 206 242 221 197" stroke-width="5"/>
    <path d="M184 371 C224 348 257 318 296 266" stroke-width="5"/>
    <path d="M102 160 C138 140 169 120 185 85" stroke-width="5"/>
    <path d="M54 315 C38 300 31 279 39 264 C57 253 79 270 82 292 C81 310 68 322 54 315 Z" stroke-width="4"/>
    <path d="M75 266 C74 241 88 220 109 221 C130 225 139 251 127 273 C110 295 82 290 75 266 Z" stroke-width="4"/>
    <path d="M181 328 C165 305 169 279 189 269 C214 265 233 290 223 314 C215 337 194 343 181 328 Z" stroke-width="4"/>
    <path d="M218 188 C199 169 199 140 220 129 C243 121 269 142 268 168 C263 196 236 206 218 188 Z" stroke-width="4"/>
    <path d="M123 105 C107 85 112 58 133 48 C155 43 174 64 168 86 C161 109 137 118 123 105 Z" stroke-width="4"/>
    <path d="M245 75 C265 49 288 35 306 24" stroke-width="4"/>
    <path d="M245 75 C244 50 259 23 286 8" stroke-width="4"/>
    <path d="M44 392 C72 375 107 384 122 411 C99 440 60 441 44 392 Z" stroke-width="4"/>
    <path d="M188 420 C203 395 232 390 251 407 C241 438 207 449 188 420 Z" stroke-width="4"/>
    <path d="M236 290 C250 281 263 271 277 255" stroke-width="4"/>
    <path d="M43 285 C58 286 70 292 82 305" stroke-width="4"/>
    <path d="M86 157 C88 130 101 107 124 91" stroke-width="4"/>
    <path d="M166 111 C148 90 134 66 132 45" stroke-width="4"/>
    <path d="M56 314 L29 291 M56 314 L28 319 M56 314 L42 342" stroke-width="3"/>
    <path d="M101 256 L74 237 M101 256 L74 260 M101 256 L83 283 M101 256 L126 240 M101 256 L131 267" stroke-width="3"/>
    <path d="M202 303 L177 285 M202 303 L177 311 M202 303 L188 330 M202 303 L227 288 M202 303 L230 317" stroke-width="3"/>
    <path d="M237 160 L210 141 M237 160 L208 164 M237 160 L219 187 M237 160 L263 145 M237 160 L266 173" stroke-width="3"/>
    <path d="M142 78 L118 63 M142 78 L118 84 M142 78 L130 104 M142 78 L164 65 M142 78 L166 90" stroke-width="3"/>
  </g>
</svg>
`;

const originalImageUrl = `data:image/svg+xml;base64,${Buffer.from(testSvg).toString("base64")}`;

export default function DevEditorTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const settings = normalizeGraphSettings({
    graphWidth: 8,
    graphHeight: 12,
    imageLineThickness: 0,
    strokeGapClosePixels: 0,
    sourceFillMinStrokePixels: 7,
    sourceFillThreshold: 0.58,
  });
  const project: Project = {
    id: "dev-editor-test",
    userId: "dev-user",
    title: "Dev editor test",
    description: "Synthetic flower line-art fixture",
    originalImagePath: null,
    processedImagePath: null,
    settings,
    width: settings.outputWidth,
    height: settings.outputHeight,
    pixelSize: settings.pixelSize,
    gridCellSize: settings.gridCellSize,
    colorCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    palettes: [],
    originalImageUrl,
    processedImageUrl: null,
  };

  return <EditorClient project={project} />;
}

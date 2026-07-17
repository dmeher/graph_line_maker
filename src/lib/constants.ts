export const GRAPH_PIXEL_SCHEMA = "image_to_graph";
export const GRAPH_PIXEL_SESSION_COOKIE = "graph_pixel_session";
export const ORIGINAL_IMAGES_BUCKET = "graph-pixel-original-images";
export const PROCESSED_IMAGES_BUCKET = "graph-pixel-processed-images";
export const BOOTSTRAP_ADMIN_EMAIL = "dmeher1996@gmail.com";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
// Effectively unlimited for real use; a sanity bound keeps validation and payloads safe.
export const MAX_PROJECT_UPLOAD_FILES = 500;
export const MAX_SOURCE_IMAGES = 500;
export const MAX_PROJECT_UPLOAD_TOTAL_BYTES = 150 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf", "application/x-pdf"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "svg", "pdf"]);
export const ALLOWED_IMAGE_LABEL = "PNG, JPG, JPEG, WEBP, SVG, or PDF";
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.svg,.pdf";

export function getImageExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function isPdfFile(input: { name?: string; type?: string }) {
  const type = input.type?.toLowerCase() || "";
  if (type === "application/pdf" || type === "application/x-pdf") return true;
  return getImageExtension(input.name || "") === "pdf";
}

export function isAllowedImageFile(input: { name?: string; type?: string }) {
  const type = input.type?.toLowerCase() || "";
  if (ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) return true;

  const extension = getImageExtension(input.name || "");
  const canTrustExtension = !type || type === "application/octet-stream" || type === "text/xml" || type === "application/xml";
  return canTrustExtension && ALLOWED_IMAGE_EXTENSIONS.has(extension);
}

export function getAllowedImageContentType(input: { name?: string; type?: string }) {
  const type = input.type?.toLowerCase() || "";
  if (ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) return type;

  switch (getImageExtension(input.name || "")) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
}

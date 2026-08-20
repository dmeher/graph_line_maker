/**
 * One-off: regenerate dashboard card thumbnails in the new top-crop shape.
 *
 * Mirrors `createCardThumbnailBlob` in src/lib/storage/upload-client.ts and the
 * card's own `object-fit: cover; object-position: center top`. Idempotent — it
 * rewrites the same deterministic key the editor writes on save.
 */
import fs from "node:fs";
import { createHash, createHmac } from "node:crypto";
import sharp from "sharp";

const ASPECT = 4 / 3;
const MAX_WIDTH = 768;
const QUALITY = 72;
const BUCKET = "graph-pixel-processed-images";
const APPLY = process.argv.includes("--apply");

for (const line of fs.readFileSync("d:/Workspace/Projects/Coaching/graph-pixel-maker/.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (key, value) => createHmac("sha256", key).update(value, "utf8").digest();

/** SigV4 query presigner, matching src/lib/object-storage/presign.ts. */
function presign(method, key, { contentType, contentLength } = {}) {
  const endpoint = new URL(process.env.R2_S3_ENDPOINT);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const uri = `/${[process.env.R2_BUCKET, ...key.split("/")].map(enc).join("/")}`;
  const params = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", `${process.env.R2_ACCESS_KEY_ID}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", "600"],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.map(([n, v]) => `${enc(n)}=${enc(v)}`).join("&");
  const canonical = [method, uri, query, `host:${endpoint.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonical, "utf8").digest("hex"),
  ].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${process.env.R2_SECRET_ACCESS_KEY}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign, "utf8").digest("hex");
  void contentType;
  void contentLength;
  return `${endpoint.origin}${uri}?${query}&X-Amz-Signature=${signature}`;
}

function thumbnailPathFor(path) {
  const separator = path.lastIndexOf("/");
  const directory = separator === -1 ? "" : path.slice(0, separator + 1);
  const fileName = separator === -1 ? path : path.slice(separator + 1);
  const stem = fileName.replace(/\.[^.]+$/, "") || fileName;
  return `${directory}thumbs/${stem}.webp`;
}

const listResponse = await fetch(
  `${SUPABASE}/rest/v1/projects?select=id,title,processed_image_path,processed_thumb_path&processed_image_path=not.is.null`,
  { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "accept-profile": "image_to_graph" } },
);
const projects = await listResponse.json();
console.log(`${projects.length} projects with a processed image${APPLY ? "" : "  (dry run — pass --apply to write)"}\n`);

let written = 0;
let skipped = 0;

for (const project of projects) {
  const label = project.title.slice(0, 40);
  const getUrl = presign("GET", `${BUCKET}/${project.processed_image_path}`);
  const res = await fetch(getUrl);
  if (!res.ok) {
    console.log(`SKIP  ${label} — processed image missing (HTTP ${res.status})`);
    skipped += 1;
    continue;
  }

  const png = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(png).metadata();
  const wider = meta.width / meta.height > ASPECT;
  const cropWidth = wider ? Math.max(1, Math.round(meta.height * ASPECT)) : meta.width;
  const cropHeight = wider ? meta.height : Math.max(1, Math.round(meta.width / ASPECT));
  const scale = Math.min(1, MAX_WIDTH / cropWidth);

  const webp = await sharp(png)
    // Horizontally centred, vertically top-anchored, like the card's own crop.
    .extract({ left: Math.round((meta.width - cropWidth) / 2), top: 0, width: cropWidth, height: cropHeight })
    .resize(Math.round(cropWidth * scale), Math.round(cropHeight * scale), { fit: "fill" })
    .webp({ quality: QUALITY })
    .toBuffer();

  const thumbPath = thumbnailPathFor(project.processed_image_path);
  console.log(
    `${APPLY ? "WRITE" : "PLAN "} ${label} — ${meta.width}x${meta.height} -> ${Math.round(cropWidth * scale)}x${Math.round(cropHeight * scale)} (${webp.length} bytes)`,
  );
  if (!APPLY) continue;

  const putResponse = await fetch(presign("PUT", `${BUCKET}/${thumbPath}`), {
    method: "PUT",
    body: webp,
    headers: { "content-type": "image/webp" },
  });
  if (!putResponse.ok) throw new Error(`PUT failed ${putResponse.status}: ${await putResponse.text()}`);

  if (project.processed_thumb_path !== thumbPath) {
    const patch = await fetch(`${SUPABASE}/rest/v1/projects?id=eq.${project.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        "content-profile": "image_to_graph",
        "content-type": "application/json",
      },
      body: JSON.stringify({ processed_thumb_path: thumbPath }),
    });
    if (!patch.ok) throw new Error(`PATCH failed ${patch.status}: ${await patch.text()}`);
  }
  written += 1;
}

console.log(`\n${written} written, ${skipped} skipped.`);

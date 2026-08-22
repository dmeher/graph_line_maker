# Graph Pixel Maker — Agent Handbook

This file is the source of truth for AI coding agents working on **Graph Pixel Maker**, a Next.js App Router application that converts uploaded line-art images into graph-paper pixel charts. Read this before changing code, and keep it up to date when you modify architecture, build steps, auth, styling primitives, or deployment-related files.

> **Scope:** All files under the project root.
> **Language of this project:** Source code, comments, and docs are written in English.

---

## Efficient context and documentation contract

- Treat this handbook and [`docs/performance-audit.md`](docs/performance-audit.md) as the current baseline. For a localized prompt, **do not re-scan or re-analyze the whole repository**: inspect the requested subsystem, its direct callers/imports, the current diff, and the relevant baseline entries only.
- Run a full audit only when the user explicitly asks, the baseline is contradicted, or a cross-cutting change invalidates it. Use `git log -1 -- docs/performance-audit.md` plus the changes since that commit to scope a targeted re-audit.
- Re-audit the affected entries when changing route/layout or client/server boundaries; auth/session/authorization/rate limiting; schema/index/query/RPC or ownership; bucket policy/path/upload/delete/duplicate behavior; editor state/history/worker/cache/processing/export; service-worker/offline caching; dependencies, environment variables, scripts, build, or deployment behavior.
- **Same-patch rule:** every architecture or behavior change in those areas must update the relevant concise section here and the matching stable issue/status/evidence in `docs/performance-audit.md`. Add a new issue ID for a new performance concern. Styling/copy-only changes do not require an audit edit.
- Before handoff, compare the diff with the trigger list and state either which documentation changed or why no documentation update was needed. Keep detailed evidence out of this always-loaded file.

---

## 1. Project overview

Graph Pixel Maker lets signed-in users upload images (PNG, JPG, WEBP, SVG, PDF), position and crop them on a graph-paper canvas, adjust line thickness / fill / grid / palette settings, and export the result as PNG, tiled PDF, JSON, or a browser print view. Projects, palettes, and source/processed images are persisted in Supabase.

Key product traits:

- Custom **Brevo email OTP** sign-in; no Supabase Auth OTP.
- **Allowlist-based access**: only active `app_users` rows can log in; admins can invite/revoke users and promote any member to admin from `/settings`.
- **Admin project oversight**: admins see every owner's projects on `/dashboard` (scope toggle, `?scope=mine` narrows it) and can open, edit, duplicate, and delete any project. Members remain scoped to their own.
- **Design workspace**: `/design` provides private autosaved Design documents and personal templates, a shared immutable Design/Clipart library, extraction and raster publishing, and copy-based imports into graph projects. Drafts belong to their owner; admins may access all drafts.
- **Service-role-only** Supabase access from the Next.js server; RLS is enabled but anon/authenticated roles are revoked.
- **PWA/offline support**: a service worker (`public/sw.js`) caches the app shell and editable graph-project pages so users can keep working offline. Design routes are online-first and excluded from navigation caching; an already-open Design editor keeps a user/design-scoped IndexedDB recovery draft.
- Heavy client-side **canvas image processing** for graph-pixel conversion, palette generation, and PDF tiling.
- Shared canvas safety limits reject work above 16 million pixels or the estimated 512 MB processing budget before allocation, and normalize malformed saved dimensions before canvas creation.
- **Product graph limits:** one cell renders at 1 cm; the graph is capped at **20 cells wide × 125 cells tall** (`MAX_GRAPH_WIDTH_CELLS`/`MAX_GRAPH_HEIGHT_CELLS` in `src/lib/canvas/performance-limits.ts`, enforced inside `clampGraphCellDimensions`, the Zod save schema, and the Inspector inputs). Oversized legacy projects are clamped per axis on load.
- **Working-image downscale:** source/clipart working canvases are downscaled at load to `MAX_WORKING_SOURCE_PIXELS` (4 MP — the largest possible 800×5000 output). Uploads of any pixel size load instead of erroring. Erase strokes are stored as normalized UV coordinates so they stay aligned across resolutions.
- **Bounded source cache:** source working pixels are divided across the active `PreviewPolicy.imageCacheBytes` by source-layer slot. Sources with the same Storage path share one pristine decoded canvas and preview URL, so duplicated layers do not multiply decoding or retained source memory.
- **Upload counts** are effectively unlimited (sanity bound `MAX_PROJECT_UPLOAD_FILES = MAX_SOURCE_IMAGES = 500`); per-file 50 MB and the 150 MB per-create-request byte caps still apply.

---

## 2. Important: this is not the Next.js in your training data

This project uses **Next.js 16.2.10** with React 19. APIs, conventions, and file structure may differ from older Next.js versions. Before writing framework-level code, read the relevant guide under `node_modules/next/dist/docs/` and heed any deprecation notices.

---

## 3. Technology stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2.10 | App Router, React Server Components by default |
| Runtime | Node.js (Next.js dev/build) | Server-only modules use `import "server-only"` |
| UI library | React 19.2.7 | Client components explicitly marked `"use client"` |
| Design canvas | Konva 10.3 / react-konva 19.2 | Loaded behind a client-only dynamic editor boundary; application JSON is authoritative |
| Styling | Tailwind CSS v4 | CSS-first config in `src/app/globals.css` (`@import "tailwindcss"`, `@theme inline`) |
| Icons | `lucide-react` | Stroke width and size vary by screen |
| Database | Supabase Postgres | Schema `image_to_graph`; accessed via service role |
| Storage | Cloudflare R2 (S3 API) | Private bucket; reads via the media gateway Worker. **Not** Supabase Storage |
| Email | Brevo API (`src/lib/auth/brevo.ts`) | Dev mode prints OTP to console if env missing |
| PDF export | `jspdf` | Multi-page tiled export in `src/lib/canvas/exports.ts` |
| PDF reading | `pdfjs-dist` | First-page preview/size extraction |
| Image vectorization | `@neplex/vectorizer` | Standard VTracer output is generated behind `/api/vectorize`; direct-raster imports bypass tracing. |
| Validation | `zod` | Used in server actions and API routes |
| E2E tests | Playwright 1.61+ | Config in `playwright.config.ts` |
| Unit tests | Node built-in test runner | Run with `--experimental-strip-types` |

---

## 4. Project structure

```
.
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Protected route group
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── layout.tsx      # Auth guard + AppShell wrapper
│   │   │   ├── projects/
│   │   │   │   ├── [id]/page.tsx       # Editor (renders EditorClient)
│   │   │   │   ├── new/page.tsx        # Multi-file crop + create
│   │   │   │   └── actions.ts          # saveProjectState, delete, duplicate
│   │   │   └── settings/page.tsx
│   │   ├── (auth)/login/page.tsx
│   │   ├── api/                # API routes
│   │   │   └── auth/send-otp, verify-otp, logout
│   │   │   └── projects/..., projects/[id]/original-image, processed-image, source-images
│   │   ├── dev/editor-test/page.tsx   # Dev-only fixture; 404 in production
│   │   ├── dev/crop-test/page.tsx     # Dev-only crop fixture; 404 in production
│   │   ├── globals.css         # Tailwind v4 + custom component classes
│   │   ├── layout.tsx          # Root layout, fonts, service-worker registration
│   │   ├── manifest.ts         # PWA manifest
│   │   ├── offline/page.tsx
│   │   └── page.tsx            # Marketing landing page
│   ├── components/
│   │   ├── auth/login-form.tsx
│   │   ├── editor/editor-client.tsx   # Main editor UI + state
│   │   ├── editor/inspector-panel.tsx # Right-hand inspector panel
│   │   ├── editor/inspector/          # Inspector controls, fields, constants, feature suggestions
│   │   ├── layout/app-shell.tsx       # Chrome + off-canvas sidebar
│   │   ├── layout/app-nav.tsx         # Desktop/mobile nav
│   │   ├── layout/offline-session-bridge.tsx
│   │   └── projects/manual-cropper.tsx, new-project-form.tsx
│   └── lib/
│       ├── auth/               # session, security, brevo, offline-session, rate-limit
│       ├── canvas/             # color, crop, exports, grid-numbering, ink-mask,
│       │                       # pdf, pdf-layout, processor, processor.worker.ts,
│       │                       # processor-worker-client, thinning
│       ├── editor/             # session-draft, source-layout
│       ├── projects.ts         # Project DB mapping + normalizeGraphSettings
│       ├── projects/crop-queue.ts
│       ├── supabase/server.ts  # Admin Supabase client (server-only)
│       ├── supabase/env.ts     # Env-driven config
│       ├── types.ts            # Domain TypeScript types
│       ├── constants.ts        # Buckets, allowed file types, bootstrap admin
│       ├── graph-paper.ts      # Defaults, enums, color/preset helpers
│       └── utils/              # debounce, format
├── supabase/migrations/        # SQL schema + seed + bucket setup
├── tests/e2e/                  # Playwright specs
├── public/sw.js                # Service worker
└── package.json, next.config.ts, tsconfig.json, eslint.config.mjs,
    postcss.config.mjs, playwright.config.ts
```

---

## 5. Key configuration files

- **`package.json`** — scripts, dependencies, and the explicit list of unit-test files under `test:unit`.
- **`next.config.ts`** — sets security headers (`X-Content-Type-Options`, `Referrer-Policy`) and a strict CSP for `/sw.js`; keeps native `@neplex/vectorizer` external to server bundles.
- **`tsconfig.json`** — strict TypeScript, `@/*` path alias mapping to `./src/*`.
- **`eslint.config.mjs`** — `eslint-config-next/core-web-vitals` + `typescript`.
- **`postcss.config.mjs`** — Tailwind v4 plugin only.
- **`playwright.config.ts`** — `tests/e2e`, `workers: 1`, `fullyParallel: false`, web server `npm run dev`, Chromium + Pixel 7 projects.

---

## 6. App architecture & routing

### Route groups

- `(app)/layout.tsx` is a **server component** that calls `getCurrentSession()` and redirects to `/login` if missing. It computes `offlineSessionTicket` via `createOfflineSessionTicket(session)` and passes both to `AppShell`.
- `(auth)/login/page.tsx` renders `LoginForm` client component; logged-in users are redirected to `/dashboard`.
- Root `layout.tsx` loads Geist fonts, applies the persisted theme with a critical `next/script` bootstrap before hydration, and registers the service worker after hydration.
- `portal/layout.tsx` is a standalone, unprotected presentation route. It deliberately does not import Graph Pixel Maker auth, storage, canvas, project, or server-action modules; its catch-all pages pass route segments to the local-only `PortalClient` demo.

### Main pages

| URL | File | Purpose |
|-----|------|---------|
| `/` | `src/app/page.tsx` | Landing page |
| `/login` | `(auth)/login/page.tsx` | Email OTP sign-in |
| `/dashboard` | `(app)/dashboard/page.tsx` | Project list, search, duplicate/delete; admins default to the all-owners scope |
| `/design` | `(app)/design/page.tsx` | Shared Design/Clipart library, private drafts, and personal templates |
| `/design/new` | `(app)/design/new/page.tsx` | Create from an upload, blank preset, custom canvas, or copied personal template |
| `/design/[id]` | `(app)/design/[id]/page.tsx` | Chrome-less desktop/tablet Design editor with a reduced phone toolset |
| `/projects/new` | `(app)/projects/new/page.tsx` | Multi-file crop review + create project |
| `/projects/[id]` | `(app)/projects/[id]/page.tsx` | Editor for saved projects |
| `/projects/mock-editor` | same as above | In-memory demo project (`getMockEditorProject`) |
| `/settings` | `(app)/settings/page.tsx` | Account + admin user allowlist (role and status per user) |
| `/offline` | `src/app/offline/page.tsx` | Offline fallback page |
| `/portal` and `/portal/[...segments]` | `src/app/portal/…`, `src/components/portal/portal-client.tsx` | Static, mobile-first Coaching Student Portal prototype with switchable Pulse Campus / Focus Atlas visual directions and client-only interaction state. |
| `/dev/editor-test` | `src/app/dev/editor-test/page.tsx` | **Development only** synthetic fixture |
| `/dev/crop-test` | `src/app/dev/crop-test/page.tsx` | **Development only** advanced-crop fixture |

### Coaching Student Portal preview

`/portal` is a self-contained product-design prototype for a future coaching
student/educator experience. `src/lib/portal/demo-data.ts` contains typed,
static fixtures; `src/components/portal/portal-client.tsx` owns ephemeral UI
state only (sheets, test answers, notes, design direction, and toasts). The
route supports student home, library/course/lesson, live class, practice,
results, doubts, inbox, profile/downloads/offline, and educator classroom,
course, learner, doubt, insights, and profile/settings screens through its
catch-all resolver.

It is **not** a second application backend: do not connect it to Graph Pixel
Maker sessions, Supabase, uploads, PWA caching, or a live-video provider without
a separately approved product and data design. Its scoped stylesheet is
`src/app/portal/portal.css`; all selectors must remain under `.portal-app`, and
the two directions are selected by `data-portal-theme="pulse" | "atlas"` on
`.portal-shell` rather than global design tokens.

### API routes

- `/api/auth/send-otp` — generates a 6-digit OTP, atomically enforces the database cooldown and stores its hash through `create_login_otp_attempt`, sends via Brevo (or logs in dev), and returns `resendAfterSeconds` plus `Retry-After` when limited.
- `/api/auth/verify-otp` — verifies hash, marks attempt consumed, sets `graph_pixel_session` httpOnly cookie.
- `/api/auth/logout` — always clears the session cookie. Fetch/JSON clients receive `{ ok: true, redirectTo: "/login" }`; native form submissions receive a `303 /login` fallback. Client cleanup runs only after a successful response, removes editor drafts/offline tickets, sends `CLEAR_USER_DATA` to the service worker, and then replaces/refreshes the route.
- `/api/projects` — coordinates signed project uploads and finalization.
- `/api/projects` uses a three-step direct-upload contract: JSON `POST` creates the row and exact-path signed upload tokens, the browser uploads directly to Storage, and JSON `PATCH` verifies/finalizes metadata. `DELETE` cleans up a failed pending upload. Multipart project creation is intentionally rejected.
- `/api/projects/[id]/original-image` — PUT replaces the primary source image.
- `/api/projects/[id]/source-images` — prepares, finalizes, or cleans up direct source-image uploads.
- Source-image and clipart upload routes use the same JSON prepare / direct Storage upload / JSON finalize pattern; do not reintroduce multipart bodies into Next.js.
- `/api/projects/[id]/processed-image` — PUT stores the processed PNG output.
- `/api/designs` and `/api/designs/[id]` — list/create and load/revision-save/delete private Design documents and templates.
- `/api/designs/[id]/files`, `/publish`, and `/duplicate` — immutable direct-upload files, immutable published snapshots, and copy-based document/template creation.
- `/api/design-library` and `/api/design-library/[id]` — bounded shared-library browsing plus owner/admin metadata and lifecycle operations; `/remix` creates an independent flattened draft.
- `/api/projects/[id]/library-imports` — copies a published item into project-owner storage before the existing validated project save inserts it as a source or clipart.
- `/api/vectorize` — authenticated Node.js route that accepts multipart raster uploads and returns SVG for source/clipart line-art generation through native VTracer.

---

## 7. Auth model

This app does **not** use Supabase Auth. It uses a custom OTP flow:

1. Server generates a 6-digit OTP with `generateOtp()`.
2. Hashes it with `hashOtp(email, otp)` using `EMAIL_OTP_SECRET`.
3. Atomically rate-limits and stores the hash + expiry through the service-role-only `create_login_otp_attempt` RPC.
4. Sends via Brevo transactional email; in development, logs the OTP to the console if `BREVO_API_KEY` is missing.
5. `verify-otp` checks the hash, max attempts (`5`), expiry, consumed state, and active allowlist status.
6. On success, sets a signed httpOnly `graph_pixel_session` cookie (30-day TTL) via `setSessionCookie`.

Session verification (`getCurrentSession`) reads the cookie, verifies the HMAC signature, validates the user is still active in `app_users`, and returns `{ userId, email, role, displayName }`.

Production session resolution is request-memoized with React `cache()`; never replace it with cross-request caching. OTP creation/cooldown and verification are atomic through the service-role-only `image_to_graph.create_login_otp_attempt` and `image_to_graph.verify_login_otp` RPCs.

**Authorization model.** `requireSession` gates every mutation; `requireAdmin` gates the user allowlist. Project authorization runs through `assertProjectAccess` (full row) or `assertProjectOwnerId` (owner id only, used by the save path) in `src/lib/projects.ts`: a member may act on their own projects, an **admin on any project**. Both return the project's real `user_id`, and every caller must key storage paths and follow-up `user_id` filters off that value rather than the acting session — otherwise an admin edit would scatter a member's assets under the admin's own prefix. `getProjectForCurrentUser` applies the same rule for reads. `duplicateProject` is the deliberate exception: the copy is always owned by whoever duplicated it.

Local development has an explicit opt-in bypass: set `GRAPH_PIXEL_DEV_AUTH_BYPASS=true` while `NODE_ENV=development`, with optional `GRAPH_PIXEL_DEV_USER_EMAIL` (defaults to the bootstrap admin). The bypass is ignored outside development and therefore cannot disable production auth. When Supabase is configured, the email must resolve to an active `app_users` row; that real user ID/role is used so project ownership and admin checks still apply. With no Supabase configuration, a synthetic local identity supports non-persistent fixtures, but database/storage APIs still require Supabase.

**Critical rule:** `src/lib/auth/session.ts` is `server-only` and uses `next/headers`. Never import it into client components. Compute server-only values (session, offline ticket) in server components or API routes and pass them as props.

---

## 8. Database & storage

### Schema

All tables live in the `image_to_graph` schema (migrations in `supabase/migrations/`):

- `app_users` — id, email (unique), display_name, role (`admin`/`member`), status (`active`/`inactive`), invited_by, last_login_at.
- `email_otp_attempts` — OTP hashes, purpose, consumed_at, expires_at, attempt_count.
- `projects` — owner, title, description, original/processed image paths, JSON `settings`, width/height/pixel_size/grid_cell_size/color_count.
- `project_palettes` — per-project colors with name, hex, locked, cell_count, sort_order.
- `designs` — private versioned editable documents/templates with canvas metadata and optimistic revision.
- `design_files` — immutable files owned by one Design/template, including object/thumbnail paths and bounded metadata.
- `design_library_items` — immutable workspace-visible Design or Clipart snapshots with optional originating Design.

Migration `20260710091750_optimize_project_persistence.sql` adds cursor/search indexes plus transactional `save_project_state` and `verify_login_otp` RPCs. Migration `20260714060318_bounded_project_summaries_and_otp_rate_limit.sql` adds bounded six-swatch project summaries and atomic OTP creation/cooldown. Migration `20260730120000_admin_all_project_access.sql` re-declares `get_project_summaries` with `p_include_all_owners`, returns `owner_email`/`owner_display_name`, and adds the all-owners ordering index `projects_updated_id_idx`. Migration `20260802090000_design_workspace.sql` adds the Design tables, indexes, triggers, grants, and bounded `get_design_library_summaries` RPC. Apply all of them before deploying code that calls those RPCs.

`updated_at` columns are maintained by triggers. The migration seeds the bootstrap admin `dmeher1996@gmail.com`.

### Storage — Cloudflare R2, not Supabase

**Supabase is the database only.** File storage moved to Cloudflare R2 because R2 charges nothing for
egress. No app code path calls `supabase.storage`; there is no fallback, and a missing object is an
error.

Objects live in one private R2 bucket (`R2_BUCKET`). Keys keep the legacy Supabase bucket name as
their first segment, so every `original_image_path`, `processed_image_path`, and
`settings.sourceImages[].path` already in the database resolves unchanged:

- `graph-pixel-original-images/…` — source and clipart uploads; 50 MB per object; PNG/JPEG/WEBP/SVG/PDF.
- `graph-pixel-processed-images/…` — processed PNGs and card thumbnails.
- `graph-pixel-design-assets/{userId}/…` — normalized Design files, immutable Design/Clipart publications, and deterministic WebP thumbnails. Server-generated keys always use the persisted owner; clients never provide owner prefixes.

| Concern | Module |
|---|---|
| R2 client, key building, local URL signing | `src/lib/storage/media.ts` (server-only) |
| Pure path helpers (`thumbnailPathFor`) | `src/lib/storage/paths.ts` |
| Browser upload + thumbnail generation | `src/lib/storage/upload-client.ts` |
| Vendored canonical layer — **do not edit** | `src/lib/object-storage/` |

`src/lib/object-storage/` is generated from `packages/object-storage/src`. Change it there and run
`node packages/object-storage/sync.mjs`.

**Reads.** `mediaUrlsForBucket` signs an HMAC URL for the `cloudflare-media-gateway` Worker. This is a
*local computation* — the previous `createSignedUrls` call was an HTTP round trip to Supabase on the
render path, and the editor signs up to 132 paths per open. Expiries are rounded up to a time bucket,
so repeated renders emit byte-identical URLs that browser and edge caches can actually reuse; Supabase
minted a fresh JWT per call, which is why the upload-time `cacheControl` never did anything.

**Writes.** The browser PUTs directly to R2 with a presigned URL. Content type *and* byte length are
folded into the SigV4 signature — the only way to bound a presigned PUT, since R2 has no POST-policy
equivalent — and the finalize step re-checks size with `headObject`, deleting anything oversized.
Uploads deliberately bypass the gateway Worker.

**Thumbnails.** Uploads also generate a bounded WebP derivative client-side at
`…/thumbs/{name}.webp`, persisted as `thumbPath` in settings JSONB and
`projects.processed_thumb_path`. Assets predating derivatives have none and fall back to the
full-size URL, so nothing breaks. Derivatives are copied and deleted alongside their asset.

**Dashboard deletion.** `deleteProject` authorizes and removes the database row first, then
best-effort deletes only validated owner/project-scoped original/source/clipart/processed paths and
thumbnails from R2. R2 is a separate system: unavailable configuration, malformed legacy data, or
one stale object must never keep a project visible on `/dashboard`. Cleanup failures are logged for
later reconciliation and can leave orphaned objects; do not reverse this ordering.

Two shapes, and the difference matters. Sources/cliparts use `createThumbnailBlob` — the whole image
inside a 256px box. Dashboard cards use `createCardThumbnailBlob`, which **crops the top of the image
to `CARD_THUMBNAIL_ASPECT` (4/3) before scaling** to at most `CARD_THUMBNAIL_MAX_WIDTH` (768px, never
upscaling). Graph projects are extremely tall — a 20×102-cell chart is 400×4080 — so a max-edge box
produced a 50×512 strip that the card then had to magnify roughly sevenfold. The crop mirrors the
card's own `object-fit: cover; object-position: center top`, so the derivative renders about
one-to-one. Cards are therefore capped by the processed PNG's own width (400px for a 20-cell chart),
which is the resolution the graph was rendered at, not a thumbnail artifact.

### Required environment

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_SCHEMA=image_to_graph
# Cloudflare R2 + media gateway. MEDIA_GATEWAY_SIGNING_KEY must equal the
# Worker's GPM_SIGNING_KEY, and MEDIA_GATEWAY_URL its GATEWAY_URL.
R2_S3_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
MEDIA_GATEWAY_URL=
MEDIA_GATEWAY_SIGNING_KEY=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Graph Pixel Maker
EMAIL_OTP_SECRET=
GRAPH_PIXEL_SESSION_SECRET=
# Development only; ignored unless NODE_ENV=development.
GRAPH_PIXEL_DEV_AUTH_BYPASS=false
# Optional; defaults to the bootstrap admin and must be active when Supabase is configured.
GRAPH_PIXEL_DEV_USER_EMAIL=
```

`SUPABASE_DB_SCHEMA` must be `image_to_graph`. The Supabase Data API also needs that schema exposed in the project API settings.

---

## 9. Image processing & editor

### Canvas pipeline

- **Optional direct raster imports.** New-project sources persist an optional `vectorize` boolean. It defaults to `true` for compatibility; `false` skips `/api/vectorize`, graph thresholding, and line thinning, then composites the placed original raster directly without trace-derived fill regions. `unmatteWhiteBackgroundImageData` removes the white matte, clears tiny near-white compression residue, and decontaminates pale antialiasing into translucent foreground pixels, so graph paper stays visible without white halos; intentional white artwork is necessarily transparent. Server and editor source normalizers must preserve the explicit `false`; the value participates in the source processing cache key and is validated on every save.
- `src/lib/canvas/processor.ts` is the core conversion engine: fit source canvases, vectorize uploaded artwork through `/api/vectorize`, rasterize returned SVG masks, build ink/fill/outline masks, label connected fill regions, render manual shapes, and produce a palette. Layers merge into one shared `fillRegionMap`, and where two artworks both enclose a pixel the **smaller enclosure wins** — `mergeLayerPixelMasks` compares region areas instead of letting the last-merged layer overwrite, so a click resolves to the tightest region containing it rather than depending on layer order. Outline pixels carry region 0 and are never affected by that comparison. Its `fillRegionMap` keeps ephemeral numeric IDs for hit-testing, while persisted overrides use stable source/clipart-scoped IDs derived from local artwork position and a `generated:artwork` scope derived from document position. Identity uses the editor's exact 15-degree rotation step; prior cardinal-only scoped IDs remain read-time aliases and are promoted to the corrected key. Client normalization and server save validation accept those keys alongside legacy numeric overrides. Every region kind — including generated shapes and lines — carries the `legacyId` its frame assigned it (a single counter running across source layers and then generated artwork), because a legacy project's overrides are keyed by that number and are otherwise unreadable. `migrateLegacyFillRegionOverrides` promotes those numbers to stable scoped IDs on the **first settled frame**, not only from `setSettingsWithHistory` (canvas resizes bypass it), so a bare number can never survive long enough to be renumbered by a resize, shape, or line. Both are inert for projects that hold no numeric keys. Vector source masks are built only for each source's padded placed region, then merged into the graph; the session LRU retains at most 48 MiB of placed masks keyed by the source processing identity.
- **Grid rendering is decoupled from the composite.** `pixelate*` composites now output a **transparent artwork-only** canvas (fills + outline + manual shapes + inline numbers) with **no background fill and no grid lines**. Fill masks stay crisp rather than blurred, so the white paper backdrop cannot show as a halo; fractional-alpha vector contour pixels get a render-only one-pixel fill underlay while the original `fillRegionMap` remains the hit-test map. Before labeling vector fill regions, enclosed low-alpha pinholes of at most seven pixels are restored to opaque ink, preventing paper/grid specks inside solid black artwork while preserving real holes and exterior antialiasing. The editor preview shows that canvas over a white paper backdrop and a crisp **SVG grid overlay** (`src/components/editor/graph-grid-overlay.tsx`, `vector-effect: non-scaling-stroke`), so grid lines stay hairline-thin and sharp at any zoom without re-rendering on zoom. Export/save/processed-PNG consume the historical flattened image via `flattenGraphForOutput(artworkCanvas, settings)` (background + grid + artwork), which is byte-identical to the old baked output for the default `back` grid. The editor keeps `artworkCanvasRef` (preview base) and `processedCanvasRef` (flattened, for export) in sync; the flatten runs only on settled (non-draft) renders. Grid line widths/positions still match the baked grid (spacing `GRAPH_MINOR_PIXEL_SIZE`); do not re-bake the grid into the composite. The unused `generateGridOverlay` helper predates this and is not used.
- **Vector pinhole repair.** Rasterizing a traced contour leaves transparent specks inside solid artwork — typically where JPEG ringing in the source made the vectorizer trace noise as a hole. Left alone they become their own enclosed fill region, and the default enclosed-fill colour is transparent, so they render as white spots showing the paper and grid. `repairVectorizedInkPinholes` in `src/lib/canvas/ink-mask.ts` floods each enclosed low-coverage island and promotes it to solid ink. The island is grown through any pixel below `VECTORIZED_PINHOLE_COVERAGE_LIMIT`, but the size budget counts only pixels below `VECTORIZED_PINHOLE_VISIBLE_COVERAGE` — the ones that actually read as paper. Do not collapse those two thresholds: measuring the whole island grows every one-pixel hole by its antialiased rim, exceeds `MAX_VECTORIZED_PINHOLE_PIXELS`, and disables the repair on all real artwork. Islands touching the canvas edge are never repaired, so outer contour antialiasing keeps its coverage.
- **Interior seam solidification.** For `contour` traces, `styleVectorizedSvgForMask` normalizes every VTracer shape to solid black, and the vectorizer emits many adjacent paths, so rasterizing them antialiases each against its neighbour and their shared borders composite to partial coverage. Those seam pixels are ink and therefore fill barriers, but painted at reduced alpha they show paper through solid artwork. `solidifyInteriorVectorInk` restores full coverage to any ink pixel whose entire eight-neighbourhood is ink. Because contour shapes are solid black by construction, partial alpha strictly inside the ink region is always a rasterization artifact. Pixels adjacent to a hole or to the outside are never promoted, so contour and fill-pocket antialiasing stays smooth. Centerline visuals skip this contour-only repair.
- `src/lib/canvas/processor-worker-client.ts` reuses a persistent Web Worker when `OffscreenCanvas` and `createImageBitmap` are available; aborted/failed workers are terminated and recreated, otherwise processing falls back to the main thread. Any visible source/clipart layer bypasses the worker and uses the async main-thread/server route path because `@neplex/vectorizer` is native Node code.
- `src/lib/canvas/preview-policy.ts` selects low/standard/high resource tiers from browser capabilities. Decode concurrency, history retention, and cache targets follow that policy; full-resolution vector input and settled output remain authoritative.
- Development-only performance marks cover decode, vector request, SVG rasterization, mask creation, region labeling, composition, paint, export, cache hits, payload bytes, and estimated retained canvas bytes.
- `src/lib/canvas/processor.worker.ts` runs the same `pixelateLayeredCanvases` logic in the worker.
- `src/lib/canvas/pdf-layout.ts` plans multi-page PDF/print tiles, respecting paper size, orientation, alignment, margins, and `MAX_PAGES_PER_PDF_FILE = 80`.
- `src/lib/canvas/exports.ts` implements PNG download, PDF download, browser print, and JSON settings export. **PDF and print draw the grid as crisp vector lines** (jsPDF vector lines / per-page SVG) at physical mm widths over the **transparent artwork** tiles, so grid lines stay sharp at any print scale instead of blurring like the old baked raster. They therefore take the artwork-only canvas (`artworkCanvasRef`), not the flattened `processedCanvasRef`. PNG export still uses the flattened raster. PDF retains its established opaque vector-stroke treatment; browser print mirrors it with opaque SVG strokes and requests exact color adjustment. Preview retains the shared opacity hierarchy from `src/lib/canvas/grid-style.ts`. The dot pattern is exported as its equivalent line grid.

### Editor state

`EditorClient` (`src/components/editor/editor-client.tsx`) is a large client component that:

- Holds the canonical `GraphSettings` state and a changed-field command undo/redo history (`MAX_SETTINGS_HISTORY = 80`). Commands are pruned by the active preview policy's history-byte budget; pointer gestures record one before/settled transaction instead of a snapshot per move.
- Manages source images, cell paints, graph shapes, palette colors, fill-region overrides, zoom, selection, drag/resize interactions, and export menus. Imported-layer fill overrides are keyed to source/clipart-local regions, while intersecting generated strokes share a document-scoped `generated:artwork` topology; neither uses the temporary numeric map ID for persistence. After every settled full frame, the editor reconciles existing override keys against the previous settled region map by scope/kind and actual pixel coverage before committing the new frame. Reconciliation first re-homes colours **geometrically**, matching the override keys themselves rather than the previous frame's regions: a scoped key ends in the region's normalized `u`/`v` inside its layer, so a next region within `TRANSFORM_MATCH_TOLERANCE` (4%) of an unowned key adopts it and bypasses the overlap threshold. This carries a fill through a **layer resize** — placement stretches artwork to fill the layer rect, so rescaling preserves normalized position but multiplies pixel area, and an enlargement drops the old region's share of the new one below the 72% overlap ratio. Matching keys rather than previous regions also recovers a colour whose region vanished for a while, which is what happens when shrinking closes a thin pocket that reopens on enlarging. Two guards keep topology changes out of this path: a next region with two or more coloured keys inside the tolerance is a merge and is left to the overlap voting, which already refuses to pick between competing colours; and each key is spent only on its nearest eligible region, so a split colours its far child through overlap voting instead. The next side is deliberately resolved by nearest neighbour rather than by uniqueness — `u`/`v` are normalized per axis, so on a tall layer many unrelated pockets fall inside the tolerance radius and a uniqueness test almost never fires on real artwork. Same-colour split children and their undo merge retain the fill, graph resizes compare the shared graph-coordinate rectangle, and stale async revision/signature results cannot overwrite a newer frame. The map walk is skipped when no override exists; this remains an internal presentation/render reconciliation with no extra persisted canvas or API payload.
  - A single click selects canvas layers or fill regions; a double-click on a processed fill region opens its floating color palette. Generated lines/arrows use segment-distance hit testing rather than their axis-aligned bounds: the selectable radius is the visible half-stroke plus **0.2 cm**, transformed with rotation/flips and extended over arrowheads. Dashed/dotted shafts remain one continuous selection path, and the nearest buffered open path takes priority over broad source/clipart rectangles. Selected source/generated-shape/clipart layers use a high-contrast cyan selection outline. Multi-select and grouped selections render one shared bounds outline and drag every member by the same snapped delta. Single-layer resize controls stay hidden until the pointer reaches the selection boundary or an active resize starts; resize handles keep their directional cursors. They are additionally gated to **select mode only** (`canvasTool === "pointer" && drawingTool === "image"`) — surfacing them while erasing, drawing, or removing a background put crop-looking guides under the pointer in modes where they do nothing. Preview-canvas hover cursors follow the active top tool (custom white-filled, black-bordered selector SVG for select, `grab` for pan), while the image eraser uses a visible brush ring instead of a pointer.
- **Canvas zoom** rules live in `src/lib/editor/canvas-zoom.ts` and are shared by the Navigator controls, the command palette, pinch zoom, and fit-to-view: `MIN_CANVAS_ZOOM` 0.35 to `MAX_CANVAS_ZOOM` 5 (35–500%), `CANVAS_ZOOM_STEP` 0.1 per press, reset to `DEFAULT_CANVAS_ZOOM`. Do not re-inline a clamp at a call site. Every zoom write goes through `roundCanvasZoom`/`stepCanvasZoom` so the stored value stays on whole percents — repeated float addition drifts, and zoom feeds canvas layout maths, not just the readout. The Navigator's percentage field holds a draft string only while focused (so buttons and pinch still drive the display), commits on Enter/blur, reverts on Escape, and restores the current zoom when the text is unusable; an out-of-range number clamps rather than being rejected. Reset returns to 100% **and** clears the pan, so a graph pushed off-screen at high zoom comes back into view; fit-to-view remains the separate action that also centers the scroller. **Actual size** (`actualSizeCanvasZoom`) renders one cell at one physical centimetre: a cell is `GRAPH_MAJOR_CELL_PIXELS` canvas pixels wide and the stage scales by zoom, so the target is `CSS_PIXELS_PER_CM / GRAPH_MAJOR_CELL_PIXELS` (94.49% at a 40-pixel cell). It is deliberately **not** percent-rounded — rounding would stretch a 20-cell graph by about a millimetre — and it leaves the pan alone so measuring does not move the inspected area. The CSS inch (96 reference pixels) is the only physical conversion a browser exposes; there is no API for a display's true pitch, so the result is exact at 100% browser zoom on an unscaled display and off by the OS display-scaling factor otherwise. If a per-device calibration is ever added, it belongs in this module as a multiplier on that constant, not as a second clamp at a call site. Zoom only scales the preview's CSS size — it never reallocates or re-rasterizes a canvas, and the SVG grid overlay keeps hairline strokes at any zoom.
- Debounces canvas reprocessing (`PREVIEW_PROCESSING_DEBOUNCE_MS = 250`) and renders the output to a canvas. A source-position drag uses an immediate source-canvas overlay and skips full composition until pointer-up; resize/draw gestures retain the coalesced `DRAG_PROCESSING_IDLE_DEBOUNCE_MS = 300` / `DRAG_PROCESSING_MAX_WAIT_MS = 1000` behavior. The exact render runs immediately at pointer-up. Tiled PDF controls additionally stay blocked through a queued debounce or active render and accept only a canvas whose settled signature and dimensions match the current graph settings; `exportCanvasAsPDF` independently rejects any mismatched canvas. This prevents a former 20-cell, 800 px frame from being scaled into a new 10-cell, 10 cm PDF graph as 0.5 cm cells. Only a successful **full** render advances the processed signature/revision and flattened export canvas; draft drag renders update the visible artwork only, so they cannot cause the settled pointer-up pass to be skipped.
- Keeps source and clipart working canvases at up to `MAX_WORKING_SOURCE_PIXELS` (4 MP; larger decodes are downscaled at load via `fitCanvasToWorkingPixelBudget` + `resizeImage`), avoids graph-sized per-layer editor caches, and bounds vector SVG/raster caches by retained bytes.
- Tags worker requests and responses with document revisions plus `draft | full` render mode. Stale responses are rejected and transferable bitmaps are closed. Visible native-vector layers still use the bounded async main-thread/server-vector route path; do not claim complete worker offload until vector acquisition and prepared image layers are transferable end to end.
- Saves via the server action `saveProjectState` (`src/app/(app)/projects/actions.ts`) with Zod validation. Explicit manual saves and user-initiated source/clipart upload saves also upload the current processed canvas PNG to `/api/projects/[id]/processed-image`; the editor has no automatic persistence interval.
- Stores an in-flight session draft in `sessionStorage` (`src/lib/editor/session-draft.ts`) for recovery.
- The Command Canvas chrome keeps one mounted canvas plus four rendered modules: **Tools**, Scene, Navigator, and the merged **Focus Console**. Selection summary, copy/paste, orientation, and nudge controls live in Focus's pinned command shelf; Duplicate and Lock/Unlock remain in their existing canvas, Scene, and command-palette surfaces. At desktop widths (>=1280px), Tools, Scene, and Focus drag from their headers, snap to their dedicated dock targets, and resize on both axes from an adaptive bottom corner. At the >=1536x980 reference breakpoint, Scene defaults to `400px × calc(100dvh - 120px)` at `16/108`, Tools to `68×500px` at `426/108`, Navigator to `356×116px` at `right 26/top 112`, and Focus to `430px × calc(100dvh - 253px)` at `right 18/top 241`; Focus remains resizable from 340–720px. Its compact command band must keep graph dimensions and the Shape/Clipart switch reachable, and its shelf may scroll only as an overflow safeguard after an unusually short manual resize. Scene and Focus collapse with one click. Tools is always expanded and uses a compact icon-free drag grip. Navigator is a fixed, non-draggable, non-resizable top-right view sheet; its edge-to-edge header contains only the current processing/readiness icon and text plus an icon-only online/offline signal, and its body is limited to graph-line/source view, grid-number view, and zoom controls (out, an editable percentage field, in, actual size, reset to 100%, fit). A single always-mounted, `aria-hidden` canvas bootstrap loader masks the stage only from the initial draft check through asset settlement and the first successful full graph frame. That first frame latches the loader off for the rest of the editor session, so ordinary edits, drags, and debounced re-renders remain visible in place. Its opaque mat hides artwork, graph numbers, page badges, and selection overlays, and the mounted stage is inert/hidden from assistive technology while the mask is active. An initial asset/render failure changes the same surface to a non-animated error state instead of exposing a partial graph or spinning forever. The independent screen-reader-only `aria-live` footer remains the sole status announcement. Pointer movement for movable modules writes transient position/size CSS variables through refs and commits once at pointer-up; only presentation state persists in `gpm.editor.command-canvas.layout.v1` as optional `x`/`y`/`width`/`height`. Version-1 Selection and Navigator placement data remains readable; the Selection slot is inert and Navigator geometry is ignored. At smaller breakpoints, saved desktop geometry is retained but ignored in favor of the fixed tool deck, overlays, drawers, and mobile sheets. Keep `EditorToolRail`, both panel tabpanels, all Inspector contexts, the merged command shelf, and the primary canvas mounted across those modes.

- **Current desktop docking contract (supersedes the historical offsets above):** the four active slots (`left-main`, `tool-spine`, `right-top`, `right-main`) are exclusive and use a shared 12px viewport inset/gutter. The left lane begins at 92px and the right lane at 96px, keeping them clear of the command bar while reclaiming vertical space. Docked Scene and Focus fill their respective lanes through the 12px bottom inset; only their free-floating form retains a saved height. Left slots are left-anchored and resize right; right slots are right-anchored and resize left. The left pair packs horizontally and the right pair stacks vertically, including when their occupants have swapped. Scene and Focus retain the standard 46px header collapse and expose **Collapse horizontally** in their desktop overflow menu; that persisted opt-in becomes a collision-safe 56px full-height edge tab and the normal chevron expands it. Dragging onto an occupied active slot swaps placements; a free-floating collision swaps with the strongest valid overlap or restores the prior safe position. On desktop restore, any persisted rectangles that breach the gutter are rehomed together into their semantic slots, retaining dimensions but clearing stale free-position coordinates before the repaired layout is persisted; valid free-floating arrangements remain unchanged. The CSS placement selector must match a floating pod's specificity so every active pod receives its individual shared-geometry rectangle rather than the old common floating origin. Navigator remains directly fixed/non-resizable, but may move only as the counterpart of a swap. Desktop presentation state remains local `v1` storage and now accepts optional floating `anchor` plus `right` offset; old `x`-only records derive a safe side anchor. The legacy `left-lower` Selection slot remains readable but is not a snap target. The Focus Console's <=479px container mode keeps the command shelf and detail scroller as separated, padded cards with one scroll surface.

- Command Canvas desktop geometry reserves the command-bar lane. Scene and Focus extend to a 12px bottom inset when their assigned slot allows it, while right-top always leaves the right-main pod plus the gutter reachable; do not restore the removed status-lane reserve or fixed content-pod height ceilings.

- The command bar spans that lane between **symmetric insets** (`left`/`right` 18px at the reference breakpoint, 12px from 1024–1535px, 10px from 768–1023px, 8px below), with `width: auto` and no transform — the same pattern the <768px rule always used. Do not restore the `left: calc(50% + Npx)` / `translateX(-50%)` centring or a `width: min(…, calc(100vw - Npx))` reserve: they were tuned to an older rail offset, so the bar rendered off-centre and short of the right edge at every width. Its flexible grid column is the command-palette trigger (`minmax(0, 1fr)`); giving that column a non-zero minimum pushes the four column minimums past the track and clips the project title. `.editor-command-bar__identity` ends in an `auto` column for the optional owner badge.

- Inspector groups marked `data-layout="flush"` drop the card chrome only. Their body keeps the 10px horizontal gutter (`padding: 0 10px`) so their rows align with sibling card groups in the same tab; `padding: 0` left the Document tab's "Physical sizing" rows hard against the Focus pod edge.

- The selection-relative transform strip applies rotate/flip directly to a single layer’s orientation without moving or resizing its placement box; two-or-more selections retain the shared-bounds transform path. Locked selections disable mutating transform/crop/duplicate actions, but the overflow remains reachable so visibility and unlock controls cannot deadlock. Any locked member disables contextual deletion, and the strip/popover must stay above cyan selection outlines.

### Editor feature contracts (practical v1)

The former read-only “Feature Suggestions” roadmap is now implemented as practical editor tools. Do **not** re-audit the whole app for these features on every prompt; use this section as the current source of truth unless the related files changed.

- **Drawing productivity**
  - Drawing mode is controlled by `drawingTool` in `EditorClient`: `image`, `line`, `shape`, `lasso`, `background-remover`, and `image-eraser` (image lines). The former cell brush is now **Draw Line**; existing saved cell-paint layers remain editable, but the tool rail no longer creates new cell-paint records. The rail still exposes **Remove background** and **Erase image** as explicit destructive modes.
  - The `image-eraser` tool erases **image lines**: it appends reversible brush strokes to every visible, unlocked source whose rendered content intersects the brush (stored as **normalized UV coordinates** of the working canvas, radius as a fraction of canvas width, so strokes survive resolution changes) and never mutates the uploaded original. The user-facing brush radius is owned in **graph-output pixels** and converted to each source's local radius before it is stored, so differently sized/resolved images receive the same on-graph footprint. A contextual canvas toolbar (`.editor-context-toolbar`) exposes the brush size, the brush **Shape** (`circle | square`), and a **Restore** action (clears `eraseStrokes`), while an on-canvas indicator shows the affected brush area and matches the selected shape.
    - **A gesture defers the full pipeline while retaining live feedback.** `eraseStrokesSignature` is part of `sourceVectorizerCacheKey`, so re-running the pipeline mid-gesture re-vectorizes sources through `/api/vectorize` per coalesced batch. An `image-erase` drag is therefore treated like a source-position drag by the processing effect (`previewOnlyDragActive`): the full pass is skipped for the gesture and forced once on release. `paintEraseFootprintPreview` immediately applies each affected source-local circle or square with `destination-out` to the preview canvas, clipped to that source's transformed pristine content frame so it cannot cut graph content outside the image. `artworkCanvasRef`/`processedCanvasRef` remain authoritative until the settled render.
    - **A brush gesture resolves all precise targets** (`collectEraseTargetsAtPoint`): each visible, unlocked source whose transformed *pristine* content frame intersects the full graph-space brush footprint gets its own normalized-UV stroke inside one existing history transaction. Each source keeps its own path state and starts a new stroke after leaving/re-entering the brush. There is no selected/topmost fallback and erasing never selects an image.
  - The **lasso** tool (`drawingTool: "lasso"`) places discrete vertices on click instead of dragging, joins them with straight edges, and encloses the region when a click lands within `LASSO_CLOSE_DISTANCE_CELLS` of the first vertex. It commits a `shape: "polygon"` erase stroke whose points are region vertices rather than a path: `fill` absent erases to transparent, while `#ffffff`/`#000000` paint over the artwork. Vertices map through the same `graphPixelToSourcePixel` inverse the brush uses and are stored as normalized UV, so regions stay aligned across working-canvas downscales. A valid region can enclose one or many sources even when its vertices are outside the images. Esc cancels, Backspace removes the last vertex, and switching tools abandons an in-progress region.
    - **Target resolution uses transformed content, not broad layer bounds** (`resolveLassoTargetSources`): polygon/content intersection collects every visible, unlocked source, with no selected/topmost fallback. Each resulting polygon is clipped in that source's local pristine bounds before UV normalization, so a larger lasso safely applies its overlapping area to smaller images instead of being rejected as out of range.
    - Vertices live in `lassoVerticesRef`, not just state. Pointer handlers are plain functions rebuilt each render, so two clicks inside one render window compared a stale list against the close threshold and added a vertex instead of closing the region. Because it reuses the erase pipeline it inherits Restore, undo/redo, and cache invalidation via `eraseStrokesSignature`.
  - **Draw Line** starts with Line selected and exposes only Line/Arrow plus thickness, color, and solid/dashed/dotted style in its creation workbench. Pointer-down records only the start point; a click or movement of at most three CSS pixels creates no object, selection, history entry, or processing invalidation. A deliberate drag lazily creates one open-path `GraphShapeDrawing`, preserves signed width/height and arrow direction, and commits one undo transaction when released without selecting the new object, so consecutive lines can be drawn immediately. Endpoints within an inclusive **±5°** buffer of horizontal or vertical align to that graph axis; holding **Alt** preserves the free angle.
  - `GraphShapeDrawing.strokeStyle` is an optional persisted `solid | dashed | dotted` value. Client/server normalization defaults older shapes to solid, the processing signature includes the style, and preview/export rendering uses the same dash policy. The selected-line Inspector keeps kind, thickness, color, dimensions, and stroke style editable after placement.
  - **Draw Shape** starts deliberately unarmed. The Focus Console shows only closed-shape choices and appearance controls; graph clicks do nothing until the user explicitly chooses a shape. A subsequent click resolves the containing graph cell and inserts a 1×1-cell shape without automatically selecting it; the user selects it from the canvas or Scene only when property edits are needed. Selecting Draw Shape again clears the armed kind so an old choice cannot place an unintended object.
  - **Generated artwork fill topology:** every visible generated line/arrow/closed-shape stroke is rasterized together as one transient, document-scoped barrier layer, and `resolveGeneratedTopology` (`src/lib/canvas/generated-artwork.ts`) rebuilds the enclosures from that layer **unioned with the imported artwork's ink** — the merged `outlineMask` plus the pixels of every `source`-kind region, which are solid artwork rather than fillable emptiness. The strokes must not be an isolated barrier layer: a line drawn across a gap in an uploaded contour encloses an area whose perimeter is mostly the image's own ink, and a line drawn across an existing enclosure only splits it if both halves are relabeled. Independently drawn strokes that intersect into a closed pocket produce the same `fillRegionMap` hit target and double-click color palette as imported line art.
    - **Ownership.** A recomputed region is handed to `generated:artwork` only when it touches a stroke barrier **and** is not simply an existing region minus the pixels the stroke covered (one existing region covering ≥90% of it and ≥90% of that region surviving into it). Regions the strokes never reach keep the layer-scoped identity the imported pass gave them, so moving an image or reordering layers still carries their fills, and a stroke that merely clips an enclosure does not reset its colour. A lopsided split therefore lets the dominant child keep its fill while the smaller child becomes a new fillable region.
    - **Ordering.** The topology pass runs **before** the imported fill regions are painted, so a region the strokes took over is no longer painted with its previous layer colour underneath the new one. Do not move it back after `drawFillRegions`.
    - **Two generated fill draws, and both are required.** Generated regions are painted once **before** `drawColoredMaskLayers` *with* `outlineMask`/`outlineCoverage`, so they get the same soft outline underlay imported regions get: a vector contour keeps fractional alpha at its antialiased edge, and a fill that stops at the ink boundary leaves those pixels showing bare paper as a white hairline around every filled area. That pass cannot move after the outline — painting an opaque underlay there would replace the antialiased contour with solid fill. The second pass, after `drawManualGraphArtwork`, runs *without* the underlay and only re-asserts a region override over a shape's own `fillColor`.
    - **Gap closing.** Only the *barrier* is dilated by `GENERATED_STROKE_GAP_CLOSE_PIXELS` (2 graph pixels); the painted stroke keeps its own width and the margin pixels are handed back to the enclosures beside it, so a line that stops a pixel short of the artwork still closes the contour without leaving bare paper next to it. Only the painted stroke clears an imported fill from the destination map.
    - Dashed and dotted strokes rasterize **solid** in `graphShapeMode: "topology"` — an enclosure must not depend on where the dash pattern landed — while the visible pass keeps the dash. Visual stroke color, dash style, object identity, selection, and z-order remain in the normal generated-shape render pass. Generated region overrides persist under `generated:artwork:*`; shape interior colors supply the initial fill for closed shapes, while a region override wins. The topology pass never creates a second persisted image or changes an uploaded source.
  - Brush **shape** is persisted per stroke (`GraphEraseStroke.shape`, optional — absent means circle, so strokes saved before the square brush render unchanged) and is part of `eraseStrokesSignature`, because changing shape changes which pixels are erased. Circles use a round-capped polyline; squares **stamp axis-aligned rects along the path** at `radius/2` spacing, since Canvas offers square line *caps* but no square brush footprint.
  - **Erase cache identity:** `eraseStrokesSignature` serializes every normalized stroke's points, radius, shape, and fill, so any destructive geometry change invalidates the working/vector cache instead of reusing a different earlier stroke.
  - The brush indicator stays visible anywhere inside the graph, not only over the image — hiding it when the pointer left the layer made it vanish exactly while lining up an edge stroke. It uses the graph-space brush radius × zoom directly rather than a hovered source's scale, while each target uses `sourcePixelRadiusForGraphBrush` for its persisted source-local stroke. Coordinate mapping uses `graphPixelToSourcePixel` in `src/lib/editor/erase-geometry.ts` (inverse of `placeSourceImageData`).
  - Canvas selection outlines, resize handles, and selection-relative transform chrome render only while the Select tool (`canvasTool: "pointer"`, `drawingTool: "image"`) is active. Other tools preserve selection context for the inspector but never imply that an eraser, lasso, or background operation is bound to one image.
  - Source, cell-paint, shape, and clipart layers share `SelectableLayerKey` multi-select state. The Layers panel exposes a checkbox for each layer and a Select all checkbox; Shift/Ctrl/Cmd-click remains available on canvas and layer rows. Clicking a **grouped** layer selects the whole group (`expandSelectionForGroups`).
  - Layer actions support delete, lock/unlock, show/hide, duplicate, nudge, **group/ungroup**, and **copy/paste** for a single selected layer or a selection. Grouping assigns a shared `groupId` to selected layers plus a `layerGroups` name entry; copy/paste stores cloned layer defs in an in-memory clipboard ref and re-maps `groupId`s on paste so pasted groups are independent. Shortcuts: Ctrl/Cmd+G group, Ctrl/Cmd+Shift+G ungroup, Ctrl/Cmd+C copy, Ctrl/Cmd+V paste. `renderLayerActionToolbar` appears for any layer selection; group controls require the relevant multi/group selection.
  - Moving layers uses grid snapping plus snap-to-layer edges/centers via `snapRectToLayerGuides` in `src/lib/editor/source-layout.ts`; holding Alt temporarily disables snapping for the active drag. A multi-layer/group frame has edge and corner handles plus Inspector width/height fields; it proportionally scales every unlocked member into the requested bounds. Batch Inspector controls rotate a selection around its shared center and flip it horizontally or vertically, preserving each member's relative placement. A locked member disables group resize, rotation, and flips to avoid partial transforms. Padding measurements remain visible but are read-only; use the canvas to reposition layers. Source/clipart fill overrides survive move, resize, rotate, flip, reorder, visibility, and grouping; duplicate/copy-paste clones scoped overrides onto the new layer. A content/vectorization/background/erase change clears only that layer's overrides.
- **Image processing**
  - **Background remover** (client-side): source layers carry an optional `backgroundRemoval` config (`{ enabled, tolerance }`). `removeBackgroundImageData` in `src/lib/canvas/background-removal.ts` flood-fills from the image borders and clears background alpha within the tolerance. Its toggle and tolerance slider appear only after selecting the explicit **Remove background** tool (`MIN/MAX_BACKGROUND_TOLERANCE` in `layer-extras.ts`), never just from selecting a source. It runs best on near-uniform backgrounds and pairs with the image eraser for refinement.
  - **Working-canvas derivation:** `sourceCanvasesRef` holds pristine loaded canvases; `ensureWorkingSourceCanvas` (in `editor-client.tsx`) derives a per-source *working* canvas = pristine → background removal → erase strokes, cached in `sourceWorkingCanvasesRef` keyed by the erase+background signature (`eraseStrokesSignature`/`backgroundRemovalSignature`). The processing pipeline and both source cache keys (`sourceProcessingCacheKey`, `sourceVectorizerCacheKey`) include those signatures so edits reprocess and never reuse a stale vector. Crop still operates on the pristine canvas.
  - **Stable destructive placement:** processing captures content bounds from the pristine decoded source and reuses those immutable bounds when it places or vectorizes a derived working canvas. Removing edge pixels can therefore not recrop, rescale, or shift the remaining artwork.
  - **Source asset sharing:** `sourceCanvasesRef` maps every layer ID to a pristine source canvas, but duplicate source paths resolve to one decoded canvas and one object URL. `sourceVectorizerCacheKey` uses source asset identity rather than layer ID while preserving erase/background signatures, so duplicate layers also share native vectorization work. The source-layer count divides the capability-tier image cache budget to leave room for per-layer derived canvases.
  - Source and clipart layers persist these per-layer vectorizer settings inside `projects.settings` JSONB: `vectorizerLineAdjust`, `vectorizerInkThreshold`, `vectorizerSketchRemoval`, and `vectorizerFidelity`. `GraphSettings` carries the same fields as project-level defaults for new layers. The New Project screen offers only **Vectorize imported images**: checked uses VTracer for every upload; unchecked preserves the original raster artwork. Legacy fields such as `imageTraceEngine`, `imageAutoEnhance`, `imageDenoiseLevel`, `imageEdgeDetection`, `imageColorQuantization`, `vectorizerStrokeWidth`, and `vectorizerStrokeColor` remain only for backward-compatible loading/validation; saved `default` and `image-tracer` engines normalize to the vectorizer path.
  - **Remove sketch lines** (`vectorizerSketchRemoval`, `0..6`, default `0` = off) strips interior hatching/shading from hand-drawn art so the shape's inside becomes an empty enclosed region the user can colour. The shared `prepareVectorTraceMask` helper applies a morphological opening: eroding N steps deletes any stroke narrower than about `2N` pixels, dilating N restores the surviving outlines to their original weight. It runs *before* line adjustment so thickness is applied to cleaned outlines. Strokes are removed whether or not they touch the outline, which connected-component filtering cannot do because hatching usually runs edge to edge. Erosion is destructive: above roughly half the outline thickness the outlines themselves erode, so the control is a bounded slider and an opening that would erase everything falls back to the original mask. The value participates in `vectorizerRequestKey` and the source processing cache key, so changing it re-vectorizes.
  - The selected source/clipart inspector exposes `Line adjustment` (`-8..16`, step `0.5`), `Ink threshold` (`1..254`), `Remove sketch lines` (`0..6`), and `Fidelity` (`exact | smooth | clean-thin`). Exact remains the compatibility default; Smooth retains spline fitting; Clean & thin uses Smooth while tracing the clamped `inkThreshold - 32` darker core. **Apply trace settings to sources and clipart** copies these controls to every source and clipart layer and updates project defaults for future images.
  - The editor sends each vectorized source/clipart at its loaded working resolution plus vectorizer settings to `/api/vectorize` before graph placement/resizing. `prepareVectorTraceMask` applies threshold, alpha, sketch removal, and Line adjustment before the native VTracer route. Vectorized SVG results are cached in editor session memory and in-flight requests are de-duplicated by source/clipart content identity, working dimensions, and trace controls; content-only source asset keys remain placement-independent. Direct-raster sources bypass tracing and use white-matte cleanup before compositing.
- **Grid/layout**
- `majorGridEvery` supports `1 | 2 | 5 | 10`, defaults to `1`, and affects rendered major grid lines. Grid lines use a three-tier **width** hierarchy plus higher opacity, like real graph paper: minor < 5th/10th (mid) < major (cm). `src/lib/canvas/grid-style.ts` is the single source of truth for the per-bucket **width ratios** (`GRID_BUCKET_WIDTH_UNITS`, in graph-pixel units relative to `gridLineThickness`) and **opacities** (`GRID_BUCKET_OPACITY`); the preview overlay and the vector export share it. The preview grid is the SVG overlay (`GraphGridOverlay`) with strokes in viewBox units, so they **scale with zoom** (constant thickness-to-cell ratio) and stay crisp — the hierarchy is visible at every zoom. PDF/print reuse the same ratios as physical mm widths for crisp vector output. The legacy raster path (`flattenGraphForOutput` → `drawGraphPaperGrid`, used only for PNG export and the saved processed PNG) keeps integer widths so `fillRect` lands on whole pixels.
  - `gridLineStyle` supports `solid | dashed | dotted` (overlay maps these to stroke dash arrays).
  - `gridPattern` supports `square | dot` (overlay renders `dot` via tiled `<pattern>` circles).
  - Isometric, hex, logarithmic, and multiple graph regions remain deferred because they require deeper canvas/export geometry changes.
- **Productivity**
  - Built-in templates are applied from the top-bar **Workspace** menu: Cross-stitch, Pixel art, Dot grid, and A4 tiled print.
  - Projects save only through the explicit Save command. Offline or failed manual saves retain a browser-session draft for recovery.
  - Keyboard shortcut help is an editor overlay; shortcut customization remains local/productivity scope, not project schema.
- **Premium editor UI contract**
  - `EditorClient` uses a pro-design-tool IA with theme-aware `--editor-*` tokens driven by the app-level `data-theme` setting. Dark remains the default visual mode, while light mode is available through the shared theme toggle. The layout is: editable project title and primary commands in the top toolbar, a compact tool rail, tabbed **Layers & Library** on the left, canvas in the center, and contextual **Inspector** controls on the right.
  - A **contextual canvas toolbar** (`.editor-context-toolbar`, pinned at the top of the canvas) shows only the active destructive image-tool controls: brush + Restore for **Erase image**, or Remove-background + tolerance for **Remove background**. It does not appear merely because a source layer is selected.
  - **On-canvas cropping opens as a large modal popup** (`.editor-crop-modal`, `createPortal` to `body`, z-index above the shell) with a full-height `ManualCropper`, a source thumbnail filmstrip, and a footer of crop/pan/rotate/flip/straighten/guides/**Remove background** tools plus quick half/quarter selections and Detect/Full/Cancel/Apply. Quick selections split the current crop bounds, including a detected-artwork crop, and create normal, adjustable crop rectangles. Crop-mode background removal is explicit and is baked into the replacement PNG only on Apply. Esc and the backdrop close it. Do not reintroduce the old inline left-panel cropper.
  - The three-panel layout starts at 1200px. On desktop, the canvas host is viewport-height and sticky below the command bar, so its header, view controls, and tool rail remain available while the artwork scrolls inside the canvas panel. Tablet and mobile keep the canvas mounted while Assets/Layers and Inspector open as overlay drawers; mobile adds a safe-area-aware bottom dock.
  - The `EditorCommandBar`, `EditorToolRail`, `EditorViewControls`, and `EditorStatusBar` chrome components are `React.memo`-wrapped; `selectEditorTool` is a stable `useCallback` so the tool rail skips reconciliation during canvas interaction.
  - The top-bar **Workspace** menu owns project description, templates, and shortcut help. Keep roadmap/status content out of the editing UI.
  - `.editor-command-bar__owner` renders beside the title only when an admin opened a project owned by someone else (`ownerLabel` prop on `EditorClient` → `EditorCommandBar`). It must stay visible whenever that condition holds so an admin edit never looks like their own project.
  - Left-panel tabs are `layers` and `library`; source images are image layers and reusable/unplaced content belongs in Library. The layer action strip appears for one or more selected layers; its checkboxes and Select all control make batch grouping explicit, while grouping controls stay disabled until their selection requirements are met.
  - The bottom canvas status bar must show real editor state (processing/ready, graph size, selected layer/fill status, zoom, connection, snap), not placeholder cursor/color values.
  - Source and clipart vectorizer controls stay in the selected layer inspector; do not reintroduce the global image-generation engine selector.
  - Tiled PDF and browser-print output reserves a fixed **10 mm left/right safe area** on every paper page, then splits wide graphs into whole-cell columns inside that width. Export pages are ordered column-major (top-to-bottom within a column, then left-to-right across columns). Dotted cut guides bracket all four tile edges; they remain export-only and must not affect canvas artwork or PNG/JSON output. The editor page-break overlay reads the same `createPdfExportPlan` geometry.
  - Tiled PDF exports and the browser print view add `public/brand/company-hallmark.jpeg` on the second output page only, rotated 90 degrees counter-clockwise. `companyHallmarkPlacement` uses the rotated footprint to choose a centered, non-overlapping page area outside the graph tile; it must remain export-only and must not affect the canvas artwork or PNG/JSON output.
  - **Canvas artwork color policy:** editor artwork and exports allow only white (`#ffffff`), transparent fills/background, black (`#000000`), and light grey (`#b0b0b0`). The graph/grid line setting defaults to red (`#dc2626`) and may additionally use green (`#16a34a`) or the artwork colors. `src/lib/graph-paper.ts` owns these palettes and legacy nearest-color normalization. Do not add freeform color pickers or arbitrary hex values; server save validation enforces the applicable set.

When changing any architecture or logic above, update this section in the same change so future agent prompts do not spend credits rediscovering the contracts.

### Design workspace editor

- Only the exact `/design/[id]` shape is a chrome-less editor route. `/design` and `/design/new` stay inside the normal `AppShell`, including when a trailing slash is present; keep `AppShell` route classification segment-based.
- `DesignDocumentV1` in `src/lib/design/types.ts` is the authoritative, versioned state. It stores document-pixel transforms and discriminated image/text/shape/path/group nodes; Konva nodes, selection, viewport, history, signed URLs, and raw bytes are never serialized. `src/lib/design/schema.ts` validates the same format at client/server boundaries and owns future migration entry points.
- The heavy Konva surface is dynamically imported with `ssr: false` from `design-editor-loader.tsx`. Settled transforms normalize Konva scale into node width/height, and raster publishing waits until every visible image layer has rendered. Documents are bounded to 24,000 px per axis, 16 million canvas pixels, 200 nodes, 100,000 path/mask points, and 4 MiB serialized JSON; undo/redo retains at most 80 settled commands. At 90% of the geometry-point budget the editor flattens the current frame into a new immutable Design file as an undoable command instead of crossing the validation limit.
- Konva node drags use document-local top-left coordinates, while the viewport pan is separate transient state. Layers are draggable and transformable only in Select mode; Pan owns viewport dragging, and drawing/mask tools own their pointer gestures. Child `dragend` events must stop bubbling, and the viewport handler must also verify that the viewport itself was the drag target; otherwise dragging a layer reinterprets its center as pan and displaces the entire editor surface.
- Design uploads normalize PNG/JPEG/WebP/SVG and first-page PDF content into bounded PNG working files before the existing exact-length direct R2 lifecycle. File IDs and paths are immutable. Templates, remixes, published items, and graph-project imports copy dependent objects so later mutation/deletion cannot break consumers.
- Extraction analyzes at most 2 MP in `extraction.worker.ts`, with bounded main-thread fallback, eight-connected foreground components, one-pixel closing, spatial grouping, and a 100-piece review limit. Candidate edits occur before any upload; accepted files upload in batches.
- Server autosave sends the latest complete validated document at most once per two-minute dirty window with `baseRevision`; later edits do not reset the active deadline. Saves are serialized and a response marks the editor/recovery copy as synced only when it matches the exact submitted snapshot; edits made during a request remain dirty and schedule the next two-minute window. A genuinely stale server revision returns `409` and requires Reload or Save as Copy. IndexedDB still writes a user/design-scoped crash-recovery draft shortly after local edits so the longer server interval does not create a crash-loss window; it is cleared on logout and is not collaborative or offline synchronization.
- Design file and publication uploads use the existing prepare/exact-length PUT/HEAD-finalize lifecycle. If PUT, thumbnail generation, or finalization fails, the client calls the matching cleanup endpoint before allowing a retry; thumbnail generation is best-effort for publication and never blocks the primary asset.
- Shared library access is workspace-wide for active users, but only the item owner/admin may mutate metadata or delete. Draft/template access is owner/admin. All R2 keys derive from persisted ownership on the server, including admin operations.

### New-project crop flow

`NewProjectForm` (`src/components/projects/new-project-form.tsx`) lets users upload up to `MAX_PROJECT_UPLOAD_FILES` (500) files and review them in the shared advanced `ManualCropper`. Crop state is normalized in `CropTransform` and supports pan/zoom, eight handles, guides, numeric bounds, quick left/right/top/bottom and quarter presets, aspect presets, quarter-turn rotation, flip, straighten, undo/redo, batch normalized crops, and explicit background removal with a tolerance slider. Quick crops split the current crop bounds (including a detected-artwork crop), clear aspect locking, and remain freely adjustable. The shared cropper retains its measured image box during pan/drag and ignores duplicate resize measurements so it does not briefly unposition the image while a gesture is active.

**Critical crop rule:** file selection never runs edge detection or changes the upload. **Detect artwork** is an explicit, undoable user action that calls `detectContentCropResult`; it analyzes a worker-side copy capped at 2 MP, reports confidence, and only proposes visible bounds. **Remove background** is likewise opt-in; its checkerboard preview runs at the displayed crop resolution and the exact crop output applies the same tolerance once before the lossless PNG is written. Unchanged files upload byte-for-byte. A transformed raster is rendered once at native dimensions as lossless PNG, while oversized files are rejected instead of silently reduced. The crop-detection worker imports only `crop-geometry.ts`; do not import `crop.ts` from the worker because `crop.ts` dynamically loads the worker client.

---

## 10. PWA / offline support

- `public/sw.js` cache v43 caches only public non-redirecting shell resources plus immutable `/_next/static` assets, and keeps at most 20 canonical editable-project documents when an offline session marker is fresh. On localhost, it bypasses runtime caching and clears this app's caches to avoid stale development hydrations.
- `OfflineSessionBridge` writes the offline session ticket into `sessionStorage` and notifies the service worker when the user is logged in.
- `/offline` is shown when the network fails and no cached project page is available.
- `BLOCKED_OFFLINE_NAVIGATION_PATHS` includes `/projects/new` and every `/design` route. Design library reads, uploads, autosave, and publishing are online-first; only an already-open editor's IndexedDB recovery copy remains usable during a temporary disconnect.
- `CLEAR_USER_DATA` removes the active offline marker, cached protected project documents, and user-scoped Design recovery drafts on successful logout while preserving public shell and immutable static assets.
- `layout.tsx` uses `next/script` for its executable inline bootstraps: the theme runs before hydration and service-worker registration runs after hydration, then tells installing workers to `SKIP_WAITING`.

---

## 11. Build & run commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build (Webpack; Turbopack is not the current stable production path)
npm run build

# Lint
npm run lint

# Type-check (useful sanity check)
npx tsc --noEmit --pretty false --allowImportingTsExtensions

# Unit tests (Node built-in runner, --experimental-strip-types)
npm run test:unit

# E2E tests (starts Next.js dev server automatically)
npm run test:e2e

# PDF-layout focused unit test
npm run test:pdf-export
```

> **Do not run `npm run build` or `npm start` without explicit user confirmation.** The repo workflow intentionally avoids production builds by default.

---

## 12. Testing

### Unit tests

Files listed in `package.json` under `test:unit`:

- `src/lib/auth/dev-bypass.test.ts`
- `src/lib/canvas/artwork-detection.test.ts`
- `src/lib/canvas/grid-numbering.test.ts`
- `src/lib/canvas/crop.test.ts`
- `src/lib/canvas/ink-mask.test.ts`
- `src/lib/canvas/pdf-layout.test.ts`
- `src/lib/canvas/performance-limits.test.ts`
- `src/lib/canvas/preview-policy.test.ts`
- `src/lib/canvas/processor.test.ts`
- `src/lib/canvas/thinning.test.ts`
- `src/lib/canvas/vector-trace-profile.test.ts`
- `src/lib/canvas/white-matte.test.ts`
- `src/lib/editor/session-draft.test.ts`
- `src/lib/editor/history.test.ts`
- `src/lib/editor/source-layout.test.ts`
- `src/lib/performance/byte-lru.test.ts`
- `src/lib/projects/crop-queue.test.ts`
- `src/lib/projects/creation-settings.test.ts`
- `src/lib/utils/concurrency.test.ts`

Run with `npm run test:unit`. They use Node's built-in `node:test` and `node:assert`; TypeScript is stripped via `--experimental-strip-types`.

### E2E tests

- Located in `tests/e2e/`.
- `app-ui.spec.ts` — verifies logout JSON/form contracts, the login stepper, explicit Detect artwork crop flow, desktop editor, and canvas-preserving mobile drawers using development-only fixtures.
- `graph-generation.spec.ts` — uses `/dev/editor-test` to inspect rendered canvas pixels, confirm vector fill-region behavior/current native-quality controls, and reject framework overlays.
- `playwright.config.ts` uses `workers: 1` and `fullyParallel: false` to avoid cross-test conflicts.
- The web server command is `npm run dev`; reuse an existing server on `http://localhost:3000` if one is running.

---

## 13. Code style & conventions

- **TypeScript strict mode** is enabled. Prefer explicit types for function signatures and domain models in `src/lib/types.ts`.
- **Path alias:** use `@/lib/...` and `@/components/...` instead of relative paths across packages.
- **Server-only modules** start with `import "server-only";` and live under `src/lib/auth/`, `src/lib/supabase/`, and `src/lib/projects.ts`. Never import these into client components.
- **Client components** start with `"use client";`. Keep server components as server components when possible.
- **Server actions** (`"use server"`) live next to the pages that use them (`src/app/(app)/projects/actions.ts`, `src/app/(app)/settings/actions.ts`). They validate with `zod` and revalidate paths via `revalidatePath`.
- **Tailwind v4** configuration is CSS-first. Custom component classes are defined in `src/app/globals.css` inside `@layer components`. Key prefixes:
  - `ui-*` — generic reusable UI primitives.
  - `mock-*` — dashboard/settings/chrome UI.
  - `editor-*` — project editor chrome and workspace.
  - `create-*` — new-project crop workbench.
- **CSS variables** for the design system are in `:root, :root[data-theme="dark"]` and `:root[data-theme="light"]` in `src/app/globals.css`. `ThemeToggle` stores the selected mode in `localStorage` as `graph-pixel-theme`.
- **Portal prototype CSS** lives only in `src/app/portal/portal.css`. It uses the `portal-*` prefix and is fully scoped below `.portal-app`; do not move portal tokens or component rules into `:root`, `ui-*`, or editor selectors.
- **Magic numbers** for graph paper (cell size, defaults, clamps) are centralized in `src/lib/graph-paper.ts`.
- **Prefer minimal diffs** for behavior fixes; verify rendered DOM classes before broad refactors.

---

## 14. Security considerations

- Session cookies are **httpOnly, signed with HMAC-SHA256**, and secure in production (`sameSite: "lax"`).
- OTPs are hashed (SHA-256 with a secret pepper) before storage; raw OTPs are not persisted.
- Rate limiting is in-memory per IP/email in `src/lib/auth/rate-limit.ts`.
- All DB/storage access is performed with the **service-role** Supabase client; authorization checks (`assertProjectAccess`/`assertProjectOwnerId`, `requireSession`, `requireAdmin`) run before mutations. Admins are authorized for any project by design; the dashboard scope parameter is never trusted on its own — `getProjectSummaries` forces `mine` for non-admins.
- The bootstrap admin cannot be demoted or deactivated.
- File uploads are validated against an allowlist of MIME types and extensions and capped at 50 MB (`MAX_UPLOAD_BYTES`).
- `next.config.ts` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a strict CSP for `/sw.js`.
- Environment secrets (`SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_OTP_SECRET`, `GRAPH_PIXEL_SESSION_SECRET`, `BREVO_API_KEY`) must never be exposed to the browser.

---

## 15. Layout & CSS constraints to preserve

These rules were hard-won; changing them tends to break navigation, editor scroll, or page overflow.

- **The whole app is theme-aware with dark as the default.** `:root, :root[data-theme="dark"]` in `globals.css` defines the dark design system, and `:root[data-theme="light"]` defines the light counterpart. Do not hard-code mode-specific values in components; use shared vars (`--background/--foreground/--muted/--line/--panel/--surface*`) or editor vars (`--editor-*`). Crop review and the advanced cropper use `--crop-stage-*` and follow the active theme. Surfaces that display uploaded dark line-art stay **light** on purpose: project-card previews (`.project-card__preview`), generic `.mock-checker` previews outside crop review, editor layer thumbnails, and the graph artboard itself.
- `AppShell` (`src/components/layout/app-shell.tsx`) renders a **fixed 76px icon rail** (`.shell-rail`) on desktop ≥1024px (logo, nav items, online dot, avatar, sign-out) and, below 1024px, a sticky top bar (`.shell-mobilebar`) plus a floating bottom dock (`.shell-dock`, includes sign-out). There is no hamburger/off-canvas sidebar anymore. `AppNav` exposes `rail` and `dock` variants plus the shared `SignOutButton`. Editor routes render only `shell-main--editor` with no rail.
- `.shell-main` carries `margin-left: 76px` on desktop; full-screen workbenches must offset themselves (`.create-workbench { left: 76px }` at ≥1024px, defined **after** its base rule because the base sets `inset-inline: 0`).
- The creation workbench uses independent `auto minmax(0, 1fr) auto` header/workspace/footer rows. Never return it to a fixed-height footer: trace controls, upload status, reset, and conversion actions must remain visible. At short desktop/tablet heights the footer itself scrolls while its action row remains sticky; the crop workspace yields height first. Mobile keeps its normal single-column, wrapping flow.
- `src/app/globals.css` layout primitives:
  - `.editor-dark-shell` stays `position: relative` with `min-height: 0` and `overflow: visible` for page flow. Its surfaces must use the `--editor-*` tokens from the active root theme; keep the dark and light token sets in sync.
  - `.editor-dark-toolbar` is the premium command bar. Keep related actions grouped with `.editor-toolbar-group`; project renaming belongs in the top-bar title input, not a buried side-panel field. Do not reintroduce horizontal toolbar scrolling: desktop compresses/hides button labels below 1500px, and mobile wraps toolbar groups.
  - `.editor-context-toolbar` (image-tool contextual bar) and `.editor-crop-modal` (crop popup) are theme-aware surfaces built on the `--editor-*` tokens; the crop modal must render above the shell (`z-index: 10000`, portal to `body`).
  - `.editor-workspace-menu` is the popover surface for workspace-level controls (description, templates, shortcuts, feature status).
  - `.editor-workspace` uses `grid-template-rows: auto` and flexible columns; do not force child overflow that breaks scroll.
  - `.editor-side-column` is sticky in the three-panel desktop layout (`min-width: 1200px`, `top: 72px`) and becomes an overlay drawer below 1200px.
- The editor page (`/projects/{id}`) renders no shell chrome; `AppShell` detects `isProjectEditor` and renders only `main.shell-main--editor`.

---

## 16. Recent fixes on this branch

- **Whole-app dark UX redesign:** replaced the topbar + hamburger sidebar with the icon-rail shell, redesigned the dashboard cards, split-screen login, dark landing page, settings cards, and dark new-project workbench. `manifest.ts`/viewport `themeColor` are `#0b1017`.
- **Editor scroll issue (`/projects/{id}`):** fixed by removing fixed shell constraints and removing restrictive child overflow in CSS.
- **Build break "only available in the App Router / Pages Router":** caused by importing `createOfflineSessionTicket` from `session.ts` inside client `AppShell`. Fixed by computing the ticket in `src/app/(app)/layout.tsx` and passing it as a nullable prop.

---

## 17. Recommended edit style

- Keep changes scoped to existing layout/editor primitives:
  - `src/app/globals.css`
  - `src/components/layout/app-shell.tsx`
  - `src/components/layout/app-nav.tsx`
  - `src/components/editor/editor-client.tsx`
- Prefer minimal CSS diffs for behavior fixes (menu, scroll, overflow, viewport constraints).
- Verify behavior by reading rendered DOM structure and class names first; avoid broad refactors.
- Follow the same-patch documentation contract near the top of this file for architecture, logic, performance, auth, data/storage, editor pipeline, offline, and build/deployment changes.

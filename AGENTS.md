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
- **Allowlist-based access**: only active `app_users` rows can log in; admins can invite/revoke users from `/settings`.
- **Service-role-only** Supabase access from the Next.js server; RLS is enabled but anon/authenticated roles are revoked.
- **PWA/offline support**: a service worker (`public/sw.js`) caches the app shell and editable project pages so users can keep working offline.
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
| Styling | Tailwind CSS v4 | CSS-first config in `src/app/globals.css` (`@import "tailwindcss"`, `@theme inline`) |
| Icons | `lucide-react` | Stroke width and size vary by screen |
| Database | Supabase Postgres | Schema `image_to_graph`; accessed via service role |
| Storage | Supabase Storage | Private buckets for original and processed images |
| Email | Brevo API (`src/lib/auth/brevo.ts`) | Dev mode prints OTP to console if env missing |
| PDF export | `jspdf` | Multi-page tiled export in `src/lib/canvas/exports.ts` |
| PDF reading | `pdfjs-dist` | First-page preview/size extraction |
| Image vectorization | `@neplex/vectorizer` | Required vector line-art generation engine behind `/api/vectorize` |
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
- Root `layout.tsx` registers the service worker and loads Geist fonts.

### Main pages

| URL | File | Purpose |
|-----|------|---------|
| `/` | `src/app/page.tsx` | Landing page |
| `/login` | `(auth)/login/page.tsx` | Email OTP sign-in |
| `/dashboard` | `(app)/dashboard/page.tsx` | Project list, search, duplicate/delete |
| `/projects/new` | `(app)/projects/new/page.tsx` | Multi-file crop review + create project |
| `/projects/[id]` | `(app)/projects/[id]/page.tsx` | Editor for saved projects |
| `/projects/mock-editor` | same as above | In-memory demo project (`getMockEditorProject`) |
| `/settings` | `(app)/settings/page.tsx` | Account + admin user allowlist |
| `/offline` | `src/app/offline/page.tsx` | Offline fallback page |
| `/dev/editor-test` | `src/app/dev/editor-test/page.tsx` | **Development only** synthetic fixture |
| `/dev/crop-test` | `src/app/dev/crop-test/page.tsx` | **Development only** advanced-crop fixture |

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
- `/api/vectorize` — authenticated Node.js route that accepts multipart raster uploads, runs native `@neplex/vectorizer`, and returns SVG for source/clipart line-art generation.

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

Migration `20260710091750_optimize_project_persistence.sql` adds cursor/search indexes plus transactional `save_project_state` and `verify_login_otp` RPCs. Migration `20260714060318_bounded_project_summaries_and_otp_rate_limit.sql` adds bounded six-swatch project summaries and atomic OTP creation/cooldown. Apply both before deploying code that calls those RPCs.

`updated_at` columns are maintained by triggers. The migration seeds the bootstrap admin `dmeher1996@gmail.com`.

### Storage buckets

- `graph-pixel-original-images` — source uploads; private; 50 MB per object; PNG/JPEG/WEBP/SVG/PDF.
- `graph-pixel-processed-images` — processed PNGs/PDFs; private.

Signed URLs (1-hour TTL) are generated server-side for display in the editor/dashboard.

### Required environment

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_SCHEMA=image_to_graph
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

- `src/lib/canvas/processor.ts` is the core conversion engine: fit source canvases, vectorize uploaded artwork through `/api/vectorize`, rasterize returned SVG masks, build ink/fill/outline masks, label connected fill regions, draw grid lines/numbers, render manual shapes, and produce a palette. Its `fillRegionMap` keeps ephemeral numeric IDs for hit-testing, while persisted overrides use stable source/clipart-scoped region IDs derived from local normalized artwork position; client normalization and server save validation accept those keys alongside legacy numeric overrides, which migrate on the next edit/save. Vector source masks are built only for each source's padded placed region, then merged into the graph; the session LRU retains at most 48 MiB of placed masks keyed by the source processing identity.
- `src/lib/canvas/processor-worker-client.ts` reuses a persistent Web Worker when `OffscreenCanvas` and `createImageBitmap` are available; aborted/failed workers are terminated and recreated, otherwise processing falls back to the main thread. Any visible source/clipart layer bypasses the worker and uses the async main-thread/server route path because `@neplex/vectorizer` is native Node code.
- `src/lib/canvas/preview-policy.ts` selects low/standard/high resource tiers from browser capabilities. Decode concurrency, history retention, and cache targets follow that policy; full-resolution vector input and settled output remain authoritative.
- Development-only performance marks cover decode, vector request, SVG rasterization, mask creation, region labeling, composition, paint, export, cache hits, payload bytes, and estimated retained canvas bytes.
- `src/lib/canvas/processor.worker.ts` runs the same `pixelateLayeredCanvases` logic in the worker.
- `src/lib/canvas/pdf-layout.ts` plans multi-page PDF/print tiles, respecting paper size, orientation, alignment, margins, and `MAX_PAGES_PER_PDF_FILE = 80`.
- `src/lib/canvas/exports.ts` implements PNG download, PDF download, browser print, and JSON settings export.

### Editor state

`EditorClient` (`src/components/editor/editor-client.tsx`) is a large client component that:

- Holds the canonical `GraphSettings` state and a changed-field command undo/redo history (`MAX_SETTINGS_HISTORY = 80`). Commands are pruned by the active preview policy's history-byte budget; pointer gestures record one before/settled transaction instead of a snapshot per move.
- Manages source images, cell paints, graph shapes, palette colors, fill-region overrides, zoom, selection, drag/resize interactions, and export menus. Layer fill overrides are keyed to source/clipart-local artwork regions, so color changes cannot leak to a different image that happens to receive the same temporary region number.
  - A single click selects canvas layers or fill regions; a double-click on a processed fill region opens its floating color palette. Selected source/generated-shape/clipart layers use a high-contrast cyan selection outline. Multi-select and grouped selections render one shared bounds outline and drag every member by the same snapped delta. Single-layer resize controls stay hidden until the pointer reaches the selection boundary or an active resize starts; resize handles keep their directional cursors. Preview-canvas hover cursors follow the active top tool (custom white-filled, black-bordered selector SVG for select, `grab` for pan), while the image eraser uses a visible brush ring instead of a pointer.
- Debounces canvas reprocessing (`PREVIEW_PROCESSING_DEBOUNCE_MS = 250`) and renders the output to a canvas. A source-position drag uses an immediate source-canvas overlay and skips full composition until pointer-up; resize/draw gestures retain the coalesced `DRAG_PROCESSING_IDLE_DEBOUNCE_MS = 300` / `DRAG_PROCESSING_MAX_WAIT_MS = 1000` behavior. The exact render runs immediately at pointer-up, and save/export controls wait for it to finish. Render signatures are marked processed only after worker/fallback success.
- Keeps source and clipart working canvases at up to `MAX_WORKING_SOURCE_PIXELS` (4 MP; larger decodes are downscaled at load via `fitCanvasToWorkingPixelBudget` + `resizeImage`), avoids graph-sized per-layer editor caches, and bounds vector SVG/raster caches by retained bytes.
- Tags worker requests and responses with document revisions plus `draft | full` render mode. Stale responses are rejected and transferable bitmaps are closed. Visible native-vector layers still use the bounded async main-thread/server-vector route path; do not claim complete worker offload until vector acquisition and prepared image layers are transferable end to end.
- Saves via the server action `saveProjectState` (`src/app/(app)/projects/actions.ts`) with Zod validation. Explicit manual saves and user-initiated source/clipart upload saves also upload the current processed canvas PNG to `/api/projects/[id]/processed-image`; the editor has no automatic persistence interval.
- Stores an in-flight session draft in `sessionStorage` (`src/lib/editor/session-draft.ts`) for recovery.

### Editor feature contracts (practical v1)

The former read-only “Feature Suggestions” roadmap is now implemented as practical editor tools. Do **not** re-audit the whole app for these features on every prompt; use this section as the current source of truth unless the related files changed.

- **Drawing productivity**
  - Drawing mode is controlled by `drawingTool` in `EditorClient`: `image`, `cell`, `shape`, `background-remover`, and `image-eraser` (image lines). The tool rail (`EditorToolRail` in `editor-chrome.tsx`) intentionally has no erase-cell tool; it exposes **Remove background** and **Erase image** as explicit destructive modes.
  - The `image-eraser` tool erases **image lines**: it appends reversible brush strokes to the target source's `eraseStrokes` (stored as **normalized UV coordinates** of the working canvas, radius as a fraction of canvas width, so strokes survive resolution changes) and never mutates the uploaded original. A contextual canvas toolbar (`.editor-context-toolbar`) exposes the brush size and a **Restore** action (clears `eraseStrokes`), while an on-canvas ring shows the affected brush area. Coordinate mapping uses `graphPixelToSourcePixel` in `src/lib/editor/erase-geometry.ts` (inverse of `placeSourceImageData`).
  - Source, cell-paint, shape, and clipart layers share `SelectableLayerKey` multi-select state. The Layers panel exposes a checkbox for each layer and a Select all checkbox; Shift/Ctrl/Cmd-click remains available on canvas and layer rows. Clicking a **grouped** layer selects the whole group (`expandSelectionForGroups`).
  - Layer actions support delete, lock/unlock, show/hide, duplicate, nudge, **group/ungroup**, and **copy/paste** for a single selected layer or a selection. Grouping assigns a shared `groupId` to selected layers plus a `layerGroups` name entry; copy/paste stores cloned layer defs in an in-memory clipboard ref and re-maps `groupId`s on paste so pasted groups are independent. Shortcuts: Ctrl/Cmd+G group, Ctrl/Cmd+Shift+G ungroup, Ctrl/Cmd+C copy, Ctrl/Cmd+V paste. `renderLayerActionToolbar` appears for any layer selection; group controls require the relevant multi/group selection.
  - Moving layers uses grid snapping plus snap-to-layer edges/centers via `snapRectToLayerGuides` in `src/lib/editor/source-layout.ts`; holding Alt temporarily disables snapping for the active drag. A multi-layer/group frame has edge and corner handles plus Inspector width/height fields; it proportionally scales every unlocked member into the requested bounds. Batch Inspector controls rotate a selection around its shared center and flip it horizontally or vertically, preserving each member's relative placement. A locked member disables group resize, rotation, and flips to avoid partial transforms. Padding measurements remain visible but are read-only; use the canvas to reposition layers. Source/clipart fill overrides survive move, resize, rotate, flip, reorder, visibility, and grouping; duplicate/copy-paste clones scoped overrides onto the new layer. A content/vectorization/background/erase change clears only that layer's overrides.
- **Image processing**
  - **Background remover** (client-side): source layers carry an optional `backgroundRemoval` config (`{ enabled, tolerance }`). `removeBackgroundImageData` in `src/lib/canvas/background-removal.ts` flood-fills from the image borders and clears background alpha within the tolerance. Its toggle and tolerance slider appear only after selecting the explicit **Remove background** tool (`MIN/MAX_BACKGROUND_TOLERANCE` in `layer-extras.ts`), never just from selecting a source. It runs best on near-uniform backgrounds and pairs with the image eraser for refinement.
  - **Working-canvas derivation:** `sourceCanvasesRef` holds pristine loaded canvases; `ensureWorkingSourceCanvas` (in `editor-client.tsx`) derives a per-source *working* canvas = pristine → background removal → erase strokes, cached in `sourceWorkingCanvasesRef` keyed by the erase+background signature (`eraseStrokesSignature`/`backgroundRemovalSignature`). The processing pipeline and both source cache keys (`sourceProcessingCacheKey`, `sourceVectorizerCacheKey`) include those signatures so edits reprocess and never reuse a stale vector. Crop still operates on the pristine canvas.
  - **Source asset sharing:** `sourceCanvasesRef` maps every layer ID to a pristine source canvas, but duplicate source paths resolve to one decoded canvas and one object URL. `sourceVectorizerCacheKey` uses source asset identity rather than layer ID while preserving erase/background signatures, so duplicate layers also share native vectorization work. The source-layer count divides the capability-tier image cache budget to leave room for per-layer derived canvases.
  - Source and clipart layers persist these per-layer vectorizer settings inside `projects.settings` JSONB: `vectorizerLineAdjust`, `vectorizerInkThreshold`, and `vectorizerFidelity`.
  - `GraphSettings` also carries the same fields as project-level render defaults for new layers. Legacy fields such as `imageTraceEngine`, `imageAutoEnhance`, `imageDenoiseLevel`, `imageEdgeDetection`, `imageColorQuantization`, `vectorizerStrokeWidth`, and `vectorizerStrokeColor` remain only for backward-compatible loading/validation; saved `default` and `image-tracer` engines normalize to the vectorizer path.
  - The selected source/clipart inspector exposes `Line adjustment` (`-8..16`, step `0.5`), `Ink threshold` (`1..254`), and `Fidelity` (`exact | smooth`). Smooth matches the sibling Image Vector app's spline/speckle configuration; it smooths surviving contours after thickness adjustment and does not reconnect ink removed by a negative adjustment. **Apply image properties to all** copies the selected source's image-processing/vectorizer settings to every source and clipart layer and updates project defaults for future images; later per-image edits remain independent. Final visible colors still come from the existing outline/fill/stroke controls, not from `/api/vectorize`.
  - The editor sends each source/clipart at its loaded working resolution plus vectorizer settings to `/api/vectorize` before graph placement/resizing. Working canvases are capped at `MAX_WORKING_SOURCE_PIXELS` (4 MP, matching the maximum 20×125-cell output canvas), superseding the earlier native-resolution policy now that the output is hard-bounded; pixel-based negative line adjustment keeps at least 1× output sampling headroom. The route thresholds the raster, applies half-step line adjustment, runs `@neplex/vectorizer.vectorizeRaw`, optimizes the SVG, and returns a black mask SVG. The processor rasterizes that SVG at source resolution, places/transforms it on the graph, and treats every non-zero-alpha contour pixel as authoritative for binary fill topology while carrying the original SVG alpha coverage through layer merging and final outline rendering. Vector ink is painted only by this alpha-aware outline pass; it is not also classified and blurred as a source-fill region. This preserves the sibling app's contour weight and smooth antialiased curves instead of thickening or redrawing them as opaque square pixels. The vector path bypasses the legacy thinning/scanline cleanup that would otherwise collapse paths to one-pixel centerlines. Enclosed fill-region/grid processing still runs; route or rasterization failures fall back to the legacy composed-image mask path.
  - Vectorized SVG results are cached in editor session memory and in-flight `/api/vectorize` calls are de-duplicated by source/clipart content identity, working dimensions, and vectorizer settings; moving, resizing, rotating, or flipping a layer reuses the source-resolution SVG. Source moves also reuse unchanged layers' padded placed masks; the moved source gets a transient overlay while dragging and its exact mask is rebuilt only after release.
- **Grid/layout**
- `majorGridEvery` supports `1 | 2 | 5 | 10`, defaults to `1`, and affects rendered major grid lines. Major lines are half a pixel thicker than the configured grid thickness (capped at 10 px) and use higher opacity so cell boundaries remain clear without becoming heavy.
  - `gridLineStyle` supports `solid | dashed | dotted`.
  - `gridPattern` supports `square | dot`.
  - Isometric, hex, logarithmic, and multiple graph regions remain deferred because they require deeper canvas/export geometry changes.
- **Productivity**
  - Built-in templates are applied from the top-bar **Workspace** menu: Cross-stitch, Pixel art, Dot grid, and A4 tiled print.
  - Projects save only through the explicit Save command. Offline or failed manual saves retain a browser-session draft for recovery.
  - Keyboard shortcut help is an editor overlay; shortcut customization remains local/productivity scope, not project schema.
- **Premium editor UI contract**
  - `EditorClient` uses a pro-design-tool IA with theme-aware `--editor-*` tokens driven by the app-level `data-theme` setting. Dark remains the default visual mode, while light mode is available through the shared theme toggle. The layout is: editable project title and primary commands in the top toolbar, a compact tool rail, tabbed **Layers & Library** on the left, canvas in the center, and contextual **Inspector** controls on the right.
  - A **contextual canvas toolbar** (`.editor-context-toolbar`, pinned at the top of the canvas) shows only the active destructive image-tool controls: brush + Restore for **Erase image**, or Remove-background + tolerance for **Remove background**. It does not appear merely because a source layer is selected.
  - **On-canvas cropping opens as a large modal popup** (`.editor-crop-modal`, `createPortal` to `body`, z-index above the shell) with a full-height `ManualCropper`, a source thumbnail filmstrip, and a footer of crop/pan/rotate/flip/straighten/guides/**Remove background** tools plus Detect/Full/Cancel/Apply. Crop-mode background removal is explicit and is baked into the replacement PNG only on Apply. Esc and the backdrop close it. Do not reintroduce the old inline left-panel cropper.
  - The three-panel layout starts at 1200px. On desktop, the canvas host is viewport-height and sticky below the command bar, so its header, view controls, and tool rail remain available while the artwork scrolls inside the canvas panel. Tablet and mobile keep the canvas mounted while Assets/Layers and Inspector open as overlay drawers; mobile adds a safe-area-aware bottom dock.
  - The `EditorCommandBar`, `EditorToolRail`, `EditorViewControls`, and `EditorStatusBar` chrome components are `React.memo`-wrapped; `selectEditorTool` is a stable `useCallback` so the tool rail skips reconciliation during canvas interaction.
  - The top-bar **Workspace** menu owns project description, templates, and shortcut help. Keep roadmap/status content out of the editing UI.
  - Left-panel tabs are `layers` and `library`; source images are image layers and reusable/unplaced content belongs in Library. The layer action strip appears for one or more selected layers; its checkboxes and Select all control make batch grouping explicit, while grouping controls stay disabled until their selection requirements are met.
  - The bottom canvas status bar must show real editor state (processing/ready, graph size, selected layer/fill status, zoom, connection, snap), not placeholder cursor/color values.
  - Source and clipart vectorizer controls stay in the selected layer inspector; do not reintroduce the global image-generation engine selector.
  - Tiled PDF exports and the browser print view add `public/brand/company-hallmark.jpeg` on the second output page only, rotated 90 degrees counter-clockwise. `companyHallmarkPlacement` uses the rotated footprint to choose a centered, non-overlapping page area outside the graph tile; it must remain export-only and must not affect the canvas artwork or PNG/JSON output.
  - **Canvas artwork color policy:** editor artwork and exports allow only white (`#ffffff`), transparent fills/background, black (`#000000`), and light grey (`#b0b0b0`). The graph/grid line setting defaults to red (`#dc2626`) and may additionally use green (`#16a34a`) or the artwork colors. `src/lib/graph-paper.ts` owns these palettes and legacy nearest-color normalization. Do not add freeform color pickers or arbitrary hex values; server save validation enforces the applicable set.

When changing any architecture or logic above, update this section in the same change so future agent prompts do not spend credits rediscovering the contracts.

### New-project crop flow

`NewProjectForm` (`src/components/projects/new-project-form.tsx`) lets users upload up to `MAX_PROJECT_UPLOAD_FILES` (500) files and review them in the shared advanced `ManualCropper`. Crop state is normalized in `CropTransform` and supports pan/zoom, eight handles, guides, numeric bounds, aspect presets, quarter-turn rotation, flip, straighten, undo/redo, batch normalized crops, and explicit background removal with a tolerance slider. The shared cropper retains its measured image box during pan/drag and ignores duplicate resize measurements so it does not briefly unposition the image while a gesture is active.

**Critical crop rule:** file selection never runs edge detection or changes the upload. **Detect artwork** is an explicit, undoable user action that calls `detectContentCropResult`; it analyzes a worker-side copy capped at 2 MP, reports confidence, and only proposes visible bounds. **Remove background** is likewise opt-in; its checkerboard preview runs at the displayed crop resolution and the exact crop output applies the same tolerance once before the lossless PNG is written. Unchanged files upload byte-for-byte. A transformed raster is rendered once at native dimensions as lossless PNG, while oversized files are rejected instead of silently reduced. The crop-detection worker imports only `crop-geometry.ts`; do not import `crop.ts` from the worker because `crop.ts` dynamically loads the worker client.

---

## 10. PWA / offline support

- `public/sw.js` cache v41 caches only public non-redirecting shell resources plus immutable `/_next/static` assets, and keeps at most 20 canonical editable-project documents when an offline session marker is fresh. On localhost, it bypasses runtime caching and clears this app's caches to avoid stale development hydrations.
- `OfflineSessionBridge` writes the offline session ticket into `sessionStorage` and notifies the service worker when the user is logged in.
- `/offline` is shown when the network fails and no cached project page is available.
- `BLOCKED_OFFLINE_NAVIGATION_PATHS` includes `/projects/new`, which is not available offline because source uploads require a connection.
- `CLEAR_USER_DATA` removes the active offline marker and cached protected project documents on successful logout while preserving public shell and immutable static assets.
- `layout.tsx` registers the service worker and tells installing workers to `SKIP_WAITING`.

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
- `src/lib/editor/session-draft.test.ts`
- `src/lib/editor/history.test.ts`
- `src/lib/editor/source-layout.test.ts`
- `src/lib/performance/byte-lru.test.ts`
- `src/lib/projects/crop-queue.test.ts`
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
- **Magic numbers** for graph paper (cell size, defaults, clamps) are centralized in `src/lib/graph-paper.ts`.
- **Prefer minimal diffs** for behavior fixes; verify rendered DOM classes before broad refactors.

---

## 14. Security considerations

- Session cookies are **httpOnly, signed with HMAC-SHA256**, and secure in production (`sameSite: "lax"`).
- OTPs are hashed (SHA-256 with a secret pepper) before storage; raw OTPs are not persisted.
- Rate limiting is in-memory per IP/email in `src/lib/auth/rate-limit.ts`.
- All DB/storage access is performed with the **service-role** Supabase client; ownership checks (`assertProjectOwner`, `requireSession`) run before mutations.
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

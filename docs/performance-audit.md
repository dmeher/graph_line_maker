# Graph Pixel Maker performance audit

This document is the reusable performance baseline for the repository. It is intentionally separate from `AGENTS.md` so routine prompts do not need a fresh whole-application audit or carry the full audit in their context.

## Baseline metadata

- **Last full audit:** 2026-07-10
- **Scope:** Next.js routes and rendering, React editor state, canvas/PDF processing, Supabase queries and Storage, authentication, uploads, and service-worker/offline behavior.
- **Audited versions:** Next.js 16.2.10, React 19.2.7, Supabase JS 2.110.0, jsPDF 4.2.1, pdfjs-dist 5.4.296.
- **Working-tree note:** build/bundle measurements include the in-progress inspector extraction already present in the working tree but predate the local-development auth-bypass files added in the same work session. The unit-test result below includes the bypass tests. Do not treat this baseline as a clean-HEAD benchmark.
- **Status meanings:** `Open` is confirmed in the current code; `Partial` has a validated mitigation but still has a listed follow-up; `Measure` needs runtime data before a larger rewrite; `Guard` is a known-good boundary to preserve; `Resolved` has code plus validation evidence.
- **Priority meanings:** `P0` can crash, exhaust memory, or prevent core workflows; `P1` materially affects common workflows or backend cost; `P2` is worthwhile after higher-priority work.

When updating an entry, retain its ID, change its status, add the validation result, and update the date. Add a new ID only for a genuinely different issue.
For `Resolved` and `Partial` entries, the remediation table below supersedes the original evidence/solution text, which is retained as regression context.

## Build, test, and bundle baseline

| Check | Result on 2026-07-10 |
|---|---|
| Next.js production build (Turbopack) | Passed after remediation; compile 4.9s, TypeScript 6.0s, and 12 static pages generated in 303ms. `/` and `/login` are now static. |
| Next.js production build (`--webpack`) | Passed; compile 7.8s, TypeScript 5.4s, static generation 1.89s. The first sandboxed attempt could not fetch fonts; the approved network-enabled retry passed. |
| Unit tests | 51/51 passed after remediation, including canvas-budget and bounded-concurrency tests. |
| Supabase migration runtime check | Pending: no local Supabase database was listening on `127.0.0.1:54322`. Apply the migration before the app deployment, then run database lint/advisors and smoke-test both RPCs. |
| Rendered browser/E2E validation | Not run; repository instructions require explicit user authorization for rendered UI automation. |

The Turbopack build manifests reported these initial client-JavaScript contributions. Values are raw/gzip bytes and are a comparison baseline, not a user-visible timing metric.

| Boundary | Raw | Gzip |
|---|---:|---:|
| Base application | 58,023 | 14,327 |
| Protected layout addition | 18,073 | 6,424 |
| Editor route addition | 214,743 | 55,980 |
| Editor initial total | 290,839 | 76,731 |
| New-project route addition | 30,535 | 9,686 |

Before claiming an optimization, measure at least one representative small project and one stress project. Record processing latency, peak canvas/typed-array bytes, React commit count during a drag, request count, response bytes, and database/storage round trips.

## Remediation update - 2026-07-10

The first implementation pass addressed the confirmed allocation, upload, request-fan-out, and cache cliffs without re-running a whole-repository audit:

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-001/002/003`, `PERF-REACT-001/002/003` | `src/lib/canvas/performance-limits.ts` enforces side, total-pixel, and estimated-byte budgets in normalization, server validation, and the processor. Malformed saved dimensions are normalized before canvas allocation, and zero-size decoded/cached canvases are rejected or skipped before `drawImage`, worker `createImageBitmap`, or export slicing. Worker reuse, abort reset, complete render signatures, 128 MB layer caches, a 64 MB estimated undo budget, memoized PDF guides, and `content-visibility` layer rows are implemented. Full-frame layer composition, patch-based history, and component/state decomposition remain follow-ups. |
| `PERF-IMPORT-001/002`, `PERF-UPLOAD-001/002` | Preview/PDF preparation and crop work use concurrency two. New-project, source, and clipart files use exact-path signed direct Storage uploads with prepare/finalize/cleanup requests; multipart creation is rejected. The migration aligns buckets to 50 MB and PDF MIME types. Resumable TUS for unreliable networks remains an incremental follow-up, not a server-memory blocker. |
| `PERF-EXPORT-001` | PDF/print tiling uses async PNG blobs, sequential yielding, object URLs, and a 240-page total cap. |
| `PERF-DATA-001/002/003/004/005` | Private paths are batch-signed; save+palette persistence is one transactional RPC; normal saves no longer encode/upload an unused processed PNG; dashboard/users use 25-row cursors and trigram/composite indexes; create/delete/duplicate paths now clean up or deep-copy nested assets. Palette preview aggregation is still a bounded follow-up. |
| `PERF-AUTH-001/002`, `PERF-NET-001` | Session resolution is request-memoized; OTP verification is a locked transactional RPC; limiter keys are pruned/bounded; Brevo has an 8-second timeout. A shared multi-instance limiter and OTP retention job remain follow-ups. |
| `PERF-PAYLOAD-001`, `PERF-ROUTE-001`, `PERF-NAV-001/002`, `PERF-UI-001` | Server Action body limit is 2 MB behind strict schemas; public pages are static; light-route prefetch is restored; duplicate login refresh was removed; dashboard previews use one gradient node. |
| `PERF-PWA-001/002/003/004` | Cache v40 uses canonical direct lookup, a 20-editor bound, app-prefixed eviction, public-only precache, user-switch cleanup, immutable Next static caching, local-development cache bypass/cleanup, and deduplicated bridge messages. Offline RSC/private source persistence still needs authorized browser validation. |

## Known-good boundaries to preserve

| ID | Status | Evidence | Contract |
|---|---|---|---|
| `PERF-GUARD-001` | Guard | `src/components/editor/editor-client.tsx`, `src/components/projects/new-project-form.tsx` | `ManualCropper` is dynamically imported with SSR disabled. Keep crop-only UI outside the initial route chunk. |
| `PERF-GUARD-002` | Guard | `src/lib/canvas/pdf.ts`, `src/components/projects/new-project-form.tsx` | `pdfjs-dist` is reached through dynamic imports. Do not statically import it into editor or new-project entry modules. |
| `PERF-GUARD-003` | Guard | `src/lib/canvas/exports.ts`, editor export handlers | `jspdf` and export code are loaded on export intent. Keep them out of initial editor JavaScript. |
| `PERF-GUARD-004` | Guard | `src/lib/canvas/processor-worker-client.ts`, production build output | Both Turbopack and Webpack builds compiled the module worker. Turbopack's raw `.ts` media artifact was not the runtime worker entry; do not switch bundlers solely because that artifact exists. Add a production-server worker smoke test before changing this conclusion. |

## Editor, canvas, and React issues

### `PERF-CANVAS-001` - canvas limits do not enforce a memory budget

- **Priority / status:** P0 / Resolved
- **Evidence:** `MAX_CANVAS_DIMENSION = 24000` in `src/lib/projects.ts`, `src/app/(app)/projects/actions.ts`, and `src/components/editor/inspector/inspector-constants.ts`; `GRAPH_MAJOR_CELL_PIXELS = 40` in `src/lib/graph-paper.ts`; full-frame canvases and typed arrays in `src/lib/canvas/processor.ts`.
- **Impact:** A 24,000 x 24,000 RGBA canvas alone is about 2.15 GiB, and one same-size `Uint16Array` is about 1.07 GiB. Processing holds multiple canvases and masks, so the current per-axis clamp can allow an allocation well beyond browser memory. Even the 150 x 150-cell fixture is 6,000 x 6,000 pixels, about 137 MiB for one RGBA surface.
- **Solution:** Create one shared allocation policy that checks side length, total pixels, estimated bytes per active layer/stage, and device-safe preview limits before allocating. Decouple logical graph size from preview resolution; tile or stream full-resolution export rather than materializing every layer at full output size.
- **Risks / validation:** A lower hard cap can reject existing projects. Version the policy, show the estimated memory in UI, and test boundary values in normalization, processing, crop, save, and export. Validate peak memory on target desktop and mobile hardware.

### `PERF-CANVAS-002` - every placed source becomes a full-frame canvas and is copied through a short-lived worker

- **Priority / status:** P0 / Partial
- **Evidence:** `composePlacedImageLayerCanvas` and the source/clipart caches in `src/components/editor/editor-client.tsx`; `createImageBitmap` and `new Worker(...)` per call in `src/lib/canvas/processor-worker-client.ts`; bitmap-to-`OffscreenCanvas` copies in `src/lib/canvas/processor.worker.ts`; preview and overview copies in `drawPreview`.
- **Impact:** Each source or clipart layer is expanded to graph dimensions, cached by entry count rather than bytes, transferred as a bitmap, copied again inside a newly created worker, and copied back to DOM canvases. At the default 400 x 4,480 output, one RGBA surface is about 6.84 MiB; four cached versions across 12 sources are roughly 328 MiB before masks, worker copies, output, and overview.
- **Solution:** Keep one persistent worker with request IDs and cancellation. Transfer source-sized bitmaps plus placement metadata and compose inside the worker. Replace count-based maps with a byte-budget LRU, remove irrelevant fields from cache keys, and render the overview at its display resolution.
- **Risks / validation:** Persistent workers need stale-response protection and deterministic cleanup. Add worker cancellation/restart tests, compare output pixels with the main-thread fallback, and record transfer bytes and peak heap/canvas memory.

### `PERF-CANVAS-003` - processing invalidation is both coarse and incomplete

- **Priority / status:** P1 / Partial
- **Evidence:** `buildProcessingSignature` and the processing effect in `src/components/editor/editor-client.tsx`. The signature serializes large arrays but omits processing inputs including global outline/fill colors, fill-region overrides, and grid/render settings.
- **Impact:** Unrelated edits can repeat decode, mask, thinning, region labeling, and composition, while omitted fields can leave a stale preview. Building the signature is itself linear in all source, paint, shape, asset, and clipart records.
- **Solution:** Split the pipeline into typed stages: decode, placement, source analysis, merged masks/region IDs, and cheap composite/grid/manual overlays. Give each stage an explicit dependency key or revision counter and test that every setting invalidates exactly the required stages.
- **Risks / validation:** Incorrect stage boundaries can reuse stale masks. Build a setting-to-stage test matrix and pixel-regression fixtures before removing the current full rerender fallback.

### `PERF-CANVAS-004` - full-frame pixel loops and repeated thinning passes scale poorly

- **Priority / status:** P1 / Measure
- **Evidence:** full-frame `getImageData`, `Uint8Array`/`Uint16Array` allocations, connected-component scans, color masks, and render loops in `src/lib/canvas/processor.ts`, `src/lib/canvas/ink-mask.ts`, and `src/lib/canvas/thinning.ts`; thinning loops until no pixels change.
- **Impact:** Runtime and allocation grow with total output pixels and layer count, even when ink occupies a small region. Per-color masks add more full-size arrays.
- **Solution:** Instrument each stage first. Then process content/dirty bounds, use numeric typed lookup/count tables, render colors in one pass, and consider a frontier-based or WASM implementation only if profiles show thinning remains dominant.
- **Risks / validation:** Bounds optimizations can clip effects near edges. Compare masks, region IDs, palette counts, and rendered pixels against existing fixtures, including rotated and gap-closed sources.

### `PERF-REACT-001` - the editor rerenders too much state for high-frequency interactions

- **Priority / status:** P1 / Partial
- **Evidence:** `src/components/editor/editor-client.tsx` is about 244 KB and owns dozens of independent state values plus settings, selection, panels, pan/zoom, drag/resize, processing, and export state. Drag and panel-resize handlers update React state; `InspectorPanel` receives a broad prop surface.
- **Impact:** Pointer movement can rerender the editor tree, inspector, layer lists, overlays, and derived labels even when only one transient coordinate changed.
- **Solution:** Move transient pointer/pan/panel values to refs or CSS variables and commit once per interaction. Split state by concern behind a reducer/store with selectors, memoize extracted panels and expensive labels/guides, and keep callbacks stable.
- **Risks / validation:** Ref-based interaction state can diverge from committed state. Measure React commits and scripting time during drag, resize, pan, scroll, and drawing; add interaction tests for final committed values.

### `PERF-REACT-002` - normalization and undo history duplicate large settings objects

- **Priority / status:** P1 / Partial
- **Evidence:** `deriveGraphSettings`, `areSettingsEqual` (reference equality), `MAX_SETTINGS_HISTORY = 80`, and history snapshots in `src/components/editor/editor-client.tsx`. Settings can contain 2,000 paints, 500 shapes, 120 assets, and 500 clipart placements.
- **Impact:** Normalization recreates arrays, reference-only equality cannot detect equivalent snapshots, and up to 80 full settings snapshots retain large object graphs. Continuous interactions can create excessive allocations and GC pressure.
- **Solution:** Normalize only at load/save boundaries, use structural sharing, and store reversible patches/transactions. Coalesce an entire drag or paint gesture into one undo entry and bound history by estimated bytes as well as count.
- **Risks / validation:** Patch history must remain lossless across every settings type. Add undo/redo round-trip tests for source, paint, shape, clipart, palette, grid, and crop operations, plus a retained-byte stress benchmark.

### `PERF-REACT-003` - large layer/control lists are not virtualized

- **Priority / status:** P1 / Partial
- **Evidence:** limits in `src/app/(app)/projects/actions.ts` and editor normalizers allow up to 2,000 paints, 500 shapes, and 500 clipart placements; the editor and inspector render layer controls as normal React lists.
- **Impact:** Large projects can create thousands of DOM nodes and event handlers, increasing reconciliation, layout, and scroll cost.
- **Solution:** Virtualize long lists, keep selection state outside row components, memoize rows, and use an O(1) ID-to-index map instead of repeated linear lookup.
- **Risks / validation:** Virtualization can break focus, keyboard navigation, and drag ordering. Test accessibility and selection while scrolling and reordering; measure DOM node count and scroll frame time.

### `PERF-ASSET-001` - all clipart assets are signed, fetched, and decoded eagerly

- **Priority / status:** P1 / Partial
- **Evidence:** `signedClipartAssets`/`mapProject` in `src/lib/projects.ts` signs every asset; the clipart-loading effect in `src/components/editor/editor-client.tsx` loads every asset with concurrency two and gates `clipartReady` on all URL/data-URL assets.
- **Impact:** A project may contain 120 assets even when only a few are placed. Editor readiness, network usage, decode memory, and signed-URL calls scale with the whole library; one failed unused asset can keep placed clipart processing blocked.
- **Solution:** Sign and load referenced visible assets first, fetch library thumbnails or selected assets on demand, track readiness per asset, and retain decoded images in a byte-budget LRU.
- **Risks / validation:** On-demand loading needs explicit loading/error states. Verify projects with missing unused assets still render and placed assets never appear stale after replacement.

### `PERF-IMPORT-001` - new-project preview preparation has unbounded fan-out and duplicates PDF work

- **Priority / status:** P1 / Resolved
- **Evidence:** `selectFiles`, `previewUrlFor`, and `readImageSize` in `src/components/projects/new-project-form.tsx`. Up to 12 files are prepared with `Promise.all`; a PDF is rendered once for preview and parsed again for dimensions.
- **Impact:** Multiple image decodes/PDF parses can compete for CPU and memory and make cancellation slow.
- **Solution:** Use a cancellable queue with concurrency one or two. Make the PDF first-page render return dimensions/page count with the preview, enforce a decoded-pixel limit, and resize during decode where supported.
- **Risks / validation:** Lower concurrency can increase best-case wall time. Compare time-to-first-preview and total completion while monitoring peak memory for mixed PDF/raster queues; ensure selecting a new queue cancels old work.

### `PERF-IMPORT-002` - crop transforms and project uploads are prepared concurrently at full resolution

- **Priority / status:** P1 / Resolved
- **Evidence:** `submit` in `src/components/projects/new-project-form.tsx` crops all queued files with `Promise.all`, then sends one multipart request; crop helpers decode natural-size images.
- **Impact:** Twelve large files can create multiple full-resolution canvases and blobs simultaneously before a potentially very large request is buffered.
- **Solution:** Crop and upload sequentially or with bounded concurrency, release object URLs/blobs after each step, resize on decode, report progress, and support cancellation/retry per file.
- **Risks / validation:** Partial completion needs cleanup and resumability. Test cancellation, one-file failure, retry, and navigation away; record peak memory rather than only total duration.

### `PERF-EXPORT-001` - PDF/print export creates synchronous base64 tiles without a total-page budget

- **Priority / status:** P1 / Resolved
- **Evidence:** `slice.toDataURL("image/png")` and full-canvas `toDataURL` in `src/lib/canvas/exports.ts`; `MAX_PAGES_PER_PDF_FILE = 80` in `src/lib/canvas/pdf-layout.ts` limits pages per file but not total output pages.
- **Impact:** Base64 conversion is synchronous and expands memory. A large plan can retain many page strings/HTML and generate hundreds of pages, blocking the main thread or exhausting memory.
- **Solution:** Convert tiles with async `toBlob`, generate sequentially with yielding/progress/cancel, use object URLs for print, and add an estimated-byte plus total-page warning/cap. Move PDF generation to a worker after output parity tests.
- **Risks / validation:** Async ordering and multi-file splits must stay deterministic. Test margins, numbering, page order, 80-page boundaries, cancellation, URL cleanup, and memory on a near-cap export.

## Network, Supabase, storage, and authentication issues

### `PERF-DATA-001` - signed Storage URLs are generated with an N+1 request pattern

- **Priority / status:** P1 / Resolved
- **Evidence:** `signedImageUrl`, `signedSourceImages`, `signedClipartAssets`, and `mapProject` in `src/lib/projects.ts`; each path calls `createSignedUrl` separately. Limits permit 12 sources plus 120 clipart assets.
- **Impact:** Opening an editor can make roughly 132 Storage signing requests before asset downloads, increasing latency and backend work.
- **Solution:** Deduplicate paths by bucket and use one `createSignedUrls(paths, ttl)` call per bucket per request. Map results back to assets and sign only immediately needed assets as described in `PERF-ASSET-001`.
- **Risks / validation:** Preserve per-path errors and original-image URL reuse. Assert request count for 0, 1, duplicate, and maximum path sets and test expired/missing objects.

### `PERF-DATA-002` - a save repeats session/owner checks and performs non-transactional palette fan-out

- **Priority / status:** P1 / Resolved
- **Evidence:** `saveProjectState` in `src/app/(app)/projects/actions.ts`; `requireSession`, `assertProjectOwner`, and `replaceProjectPalettes` in `src/lib/projects.ts`. A normal save re-enters session/owner checks, updates the project, then deletes and reinserts palettes.
- **Impact:** One save is about eight database calls before the separate processed-image request, and a failure between palette delete/insert can leave partial state.
- **Solution:** Resolve a request-scoped authenticated/owned-project context once and pass it through the DAL. Use one service-role-only, `SECURITY INVOKER` transactional RPC to update the project and synchronize palettes; enforce a unique `(project_id, sort_order)` constraint if order is the identity.
- **Risks / validation:** Never cache sessions across requests. Test rollback on invalid palettes, cross-user ownership, admin/member behavior, and a call-budget assertion for a save.

### `PERF-DATA-003` - every manual save persists a full processed PNG with no production reader

- **Priority / status:** P1 / Resolved
- **Evidence:** `saveProcessedImage` and save flows in `src/components/editor/editor-client.tsx`; `src/app/api/projects/[id]/processed-image/route.ts`; repository search finds no production UI consumer of `processedImageUrl`/`processed_image_path` beyond mapping and persistence.
- **Impact:** Canvas encoding plus auth/owner checks, optional removal, Storage upload, and database update add several operations and bandwidth to each save without a visible benefit.
- **Solution:** Stop persisting the full processed image until a consumer requires it. If dashboard previews are desired, generate a bounded thumbnail with explicit dimensions and lifecycle instead.
- **Risks / validation:** Confirm no external integration depends on the stored object before removal. Add a migration/cleanup plan for existing processed objects and verify save/reopen/export parity.

### `PERF-UPLOAD-001` - large multipart bodies are buffered and proxied through Next.js

- **Priority / status:** P0 / Resolved
- **Evidence:** `request.formData()` in project, original-image, source-images, and clipart API routes; app limits allow 12 files at 50 MiB each; routes upload blobs to Supabase after parsing.
- **Impact:** A project-create request can approach 600 MiB before overhead. Buffering and proxying consumes function memory, duration, and egress and is unsuitable for serverless limits.
- **Solution:** After production auth/ownership and metadata validation, issue an exact immutable Storage path plus a signed upload token. Upload directly from the browser; use signed TUS/resumable upload for files above 6 MiB, bounded concurrency, and a finalize endpoint that verifies path, owner, size, and MIME before committing metadata.
- **Risks / validation:** Never let clients select arbitrary paths or overwrite another user's object. Test forged paths, MIME mismatch, interrupted/resumed uploads, duplicate finalize, expiry, cleanup, and local-development behavior.

### `PERF-UPLOAD-002` - application and bucket upload policies disagree

- **Priority / status:** P0 / Resolved
- **Evidence:** `MAX_UPLOAD_BYTES = 50 MiB` and PDF support in `src/lib/constants.ts`; migrations configure both buckets at 10 MiB, and the original-image bucket MIME list omits PDF (`supabase/migrations/20260705094008_init_graph_pixel_schema.sql`, `20260705101627_allow_svg_original_uploads.sql`).
- **Impact:** Files accepted by the UI/API can fail only at Storage, wasting decode, crop, request, and upload work.
- **Solution:** Define one upload policy source and align app validation, signed-upload issuance, migrations, and user copy. Product-preserving option: migrate the original bucket to 50 MiB and include PDF MIME types while adopting resumable upload; otherwise lower the app limit to the intentional bucket cap.
- **Risks / validation:** Increasing bucket limits raises abuse and cost risk. Verify deployed bucket metadata, not only migration text, and test every accepted extension/MIME at the exact size boundary.

### `PERF-UPLOAD-003` - upload capacity and object-URL cleanup happen too late in editor additions

- **Priority / status:** P2 / Resolved
- **Evidence:** source/clipart addition paths and object-URL refs in `src/components/editor/editor-client.tsx`; URLs are largely released on later reconciliation or unmount.
- **Impact:** Files beyond remaining capacity may still be decoded/prepared, and replaced/failed items can retain blobs longer than necessary.
- **Solution:** Compute remaining capacity before URL creation, decode, or requests. Track URLs by asset ID and revoke immediately on replace, delete, failure, successful persistence, and cancellation.
- **Risks / validation:** Revoking a URL still used by an image causes blank previews. Add lifecycle tests for add/replace/delete/failure and inspect retained Blob URLs after repeated cycles.

### `PERF-DATA-004` - dashboard and settings queries are unbounded while the UI implies pagination

- **Priority / status:** P1 / Partial
- **Evidence:** `getProjectSummaries` in `src/lib/projects.ts` has no `limit`/`range`, fetches all palettes for all returned project IDs, and uses `%query%` `ilike`; dashboard renders "25 / page". `getAppUsers` in `src/lib/auth/session.ts` also returns all users while settings renders the same control. The migration's full-text GIN index is not used by `ilike`.
- **Impact:** Database rows, response serialization, palette work, and DOM grow with account history. Substring search will scan unless an appropriate trigram index exists.
- **Solution:** Add 25-row keyset pagination on `(updated_at DESC, id DESC)` with a matching `(user_id, updated_at DESC, id DESC)` index. Return only the top six palette colors per project through a summary RPC/lateral query. Either switch explicitly to full-text semantics or add `pg_trgm` indexing for substring search. Paginate admin users too.
- **Risks / validation:** Cursor ordering must be stable under updates, and search semantics are a product decision. Use `EXPLAIN (ANALYZE, BUFFERS)` with representative data and test no duplicates/gaps between pages.

### `PERF-DATA-005` - project asset lifecycle leaks objects and duplication can retain source references

- **Priority / status:** P1 / Resolved
- **Evidence:** project creation inserts the row before concurrent uploads in `src/app/api/projects/route.ts`; `deleteProject` removes only top-level original/processed paths; source/clipart paths live inside settings; `duplicateProject` copies top-level paths but initially duplicates settings unchanged.
- **Impact:** Failed creates and deletes can leave orphaned source/clipart files. A duplicate may reference the original project's nested assets, making ownership/lifecycle ambiguous and cleanup unsafe.
- **Solution:** Short term, clean the entire validated project prefix on failure/delete and rewrite every nested path during a deep-copy duplicate. Longer term, add a `project_assets` registry with owner, project, kind, path, size, MIME, state, and optional reference count, plus periodic orphan reconciliation.
- **Risks / validation:** Prefix deletion is destructive if paths are not strongly validated. Test partial upload failure, delete, duplicate, source replacement, shared-reference policy, and idempotent cleanup.

### `PERF-AUTH-001` - session validation is repeated within one request/render

- **Priority / status:** P1 / Resolved
- **Evidence:** `getCurrentSession` checks `app_users` in production; nested `requireSession`/`assertProjectOwner` calls in project routes/actions and `getAppUsers` repeat it. Layout/page combinations can also call session helpers more than once. `src/lib/auth/dev-bypass.ts`, `src/lib/auth/session.ts`, and `src/proxy.ts` now provide an opt-in development-only bypass.
- **Impact:** Route handlers and actions incur redundant database calls. Identical React Server Component fetches may be deduplicated by framework behavior, so wire-level impact there must be measured rather than assumed.
- **Solution:** Introduce a request-scoped auth context (React `cache()` for RSC DAL calls, explicit context passing in routes/actions) and a single owner/admin authorization step. Do not use cross-request `use cache`/`unstable_cache` for session data.
- **Current local contract:** `GRAPH_PIXEL_DEV_AUTH_BYPASS=true` is honored only for `NODE_ENV=development`; `GRAPH_PIXEL_DEV_USER_EMAIL` optionally selects the identity. Production cannot bypass. With Supabase configured, the email resolves to an active `app_users` record so ownership/admin checks use a real user ID and role. This improves local iteration but does not resolve production request fan-out.
- **Risks / validation:** Incorrect cache scope can leak identity. Test two concurrent users, deactivation during a session, owner/admin enforcement, exact database calls per route/action, bypass rejection in production/test, and inactive/missing development users.

### `PERF-AUTH-002` - OTP limiting and verification are process-local and non-atomic

- **Priority / status:** P1 / Partial
- **Evidence:** unbounded module-level `Map` in `src/lib/auth/rate-limit.ts`; select-then-update flow and sequential user/attempt/update calls in `src/app/api/auth/verify-otp/route.ts`; no retention cleanup for consumed/expired attempts.
- **Impact:** Limits differ across instances, stale keys accumulate in a long-lived process, and concurrent verification requests can race attempt counts/consumption.
- **Solution:** Use a shared atomic TTL limiter and a transactional database RPC that validates, increments, consumes, and updates login time. Add a partial index for current unconsumed attempts, supersede older codes, and schedule retention cleanup.
- **Risks / validation:** Auth changes are security-sensitive. Test concurrency, expiry boundaries, max attempts, multiple instances, code supersession, and cleanup without exposing raw OTPs.

### `PERF-NET-001` - Brevo email calls have no timeout budget

- **Priority / status:** P2 / Resolved
- **Evidence:** `fetch` in `src/lib/auth/brevo.ts` has no abort signal or deadline.
- **Impact:** A degraded provider can occupy a request until platform timeout and produce ambiguous retry behavior.
- **Solution:** Add an `AbortSignal.timeout`/controller deadline, typed provider errors, a bounded retry policy only for safe transient failures, and latency/error metrics.
- **Risks / validation:** Retrying can send duplicate OTP emails. Use an idempotency strategy or avoid retry after an uncertain accepted request; test timeout and 4xx/5xx behavior.

### `PERF-PAYLOAD-001` - full settings saves can exceed the default Server Action body limit

- **Priority / status:** P1 / Resolved
- **Evidence:** `saveProjectSchema` allows 2,000 paints, 500 shapes, 120 assets, 500 clipart placements, 256 palettes, and long strings; `next.config.ts` does not override the Next.js 1 MiB default documented in `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`.
- **Impact:** Static estimates put allowed payloads around 0.8-1.7 MiB depending on string lengths, so valid large projects may fail before the action executes.
- **Solution:** Record serialized byte size and stored JSON size, then persist dirty sections or versioned deltas instead of the entire document. A modest temporary `bodySizeLimit` increase is only a bridge after platform request limits are checked.
- **Risks / validation:** Raising the limit increases memory/DoS exposure. Add tests just below/above the configured limit and round-trip maximum realistic projects.

## Routing, navigation, and offline issues

### `PERF-ROUTE-001` - public landing and login pages are forced dynamic for session redirects

- **Priority / status:** P2 / Resolved
- **Evidence:** `export const dynamic = "force-dynamic"` plus `getCurrentSession()` in `src/app/page.tsx` and `src/app/(auth)/login/page.tsx`.
- **Impact:** Public pages require server/session/database work and cannot use a static CDN response solely to redirect an already signed-in user.
- **Solution:** Make the public pages static and allow signed-in users to navigate explicitly, or perform a cheap cookie-presence redirect in the request-routing layer while protected pages still validate the session fully.
- **Risks / validation:** A cookie-presence check is not authorization and can redirect stale sessions. Ensure `/dashboard` performs the real check and redirects invalid sessions back to login without loops.

### `PERF-NAV-001` - link prefetching is disabled globally, including light destinations

- **Priority / status:** P2 / Resolved
- **Evidence:** `prefetch={false}` in `src/components/layout/app-nav.tsx`, `src/components/layout/app-shell.tsx`, and dashboard links.
- **Impact:** Dashboard/settings/brand navigation loses Next.js prefetch benefits, while enabling editor prefetch indiscriminately could trigger expensive auth/data/signing work.
- **Solution:** After request fan-out is fixed, restore default prefetch for light destinations and use intent-based prefetch for heavy editor routes. Measure background request cost and click-to-render latency before/after.
- **Risks / validation:** Prefetch can increase database and signed-URL traffic. Test viewport and hover behavior on desktop/mobile and track requests per idle page.

### `PERF-NAV-002` - login success schedules replace and refresh back-to-back

- **Priority / status:** P2 / Resolved
- **Evidence:** `router.replace(...)` followed by `router.refresh()` in `src/components/auth/login-form.tsx`.
- **Impact:** The refresh may duplicate navigation/RSC work immediately after the cookie-setting response.
- **Solution:** Keep only `replace` unless a production trace proves refresh is required for cookie visibility.
- **Risks / validation:** Verify protected layout sees the new cookie on the first navigation and back-button behavior remains correct.

### `PERF-UI-001` - dashboard graph thumbnails use many decorative DOM nodes

- **Priority / status:** P2 / Resolved
- **Evidence:** `GraphPreview` in `src/app/(app)/dashboard/page.tsx` renders 48 `<span>` cells per row.
- **Impact:** Project-list DOM and reconciliation grow by dozens of nodes per project for a purely decorative preview.
- **Solution:** Render the pattern with CSS gradients, one inline SVG, or a single canvas/image thumbnail.
- **Risks / validation:** Preserve contrast and responsive appearance; static DOM inspection is sufficient unless visual validation is explicitly authorized.

### `PERF-PWA-001` - cached navigation lookup scans the entire cache and editor entries are unbounded

- **Priority / status:** P1 / Resolved
- **Evidence:** `findCachedNavigation` calls `cache.keys()` and then `cache.match()` per candidate in `public/sw.js`; every cacheable editor navigation can be retained until cache-version replacement/session cleanup.
- **Impact:** Offline lookup becomes O(number of cached requests), and project HTML can grow without a per-user/project quota.
- **Solution:** Canonicalize editor document keys by pathname, match directly, and keep a bounded per-user LRU/age policy with explicit metadata.
- **Risks / validation:** Cache keys must not mix users or query variants. Test logout, session expiry, project rename/delete, quota eviction, and offline exact-path navigation.

### `PERF-PWA-002` - app-shell installation can cache a personalized redirect response and activation deletes unrelated caches

- **Priority / status:** P1 / Resolved
- **Evidence:** `APP_SHELL` includes `/`; `/` is dynamic and redirects authenticated users; install uses `cache.addAll(APP_SHELL)`; activation deletes every origin cache except the current version in `public/sw.js`.
- **Impact:** Installation can perform unnecessary auth/database work and risks storing personalized dashboard content under the root request. Activation can remove caches owned by another application feature on the same origin.
- **Solution:** Remove `/` until it is truly static. Precache only public, non-redirected, credential-independent resources and reject redirected responses. Delete only cache names with the app's explicit prefix.
- **Risks / validation:** A failed precache must not prevent worker installation. Test signed-in and signed-out installs, redirects, upgrades, and coexistence with an unrelated cache.

### `PERF-PWA-003` - the offline strategy does not guarantee a cold-startable editor

- **Priority / status:** P1 / Partial
- **Evidence:** `public/sw.js` skips `/_next/` and cross-origin Supabase assets, and only navigation-mode requests use cached editor HTML. Next Link RSC requests are not normal document navigations.
- **Impact:** Cached HTML may still depend on uncached framework chunks or expired/unavailable source URLs, and client-side navigation may bypass the document cache.
- **Solution:** Define and test an explicit offline document/RSC strategy, cache immutable build assets safely, persist only the minimum project data/assets needed for offline editing, and version data by user/session/build.
- **Risks / validation:** Caching authenticated RSC/data is a privacy risk. This item requires explicitly authorized browser tests: warm editor, close all tabs, disable network, cold reopen, edit, refresh, logout, and user switch.

### `PERF-PWA-004` - offline-session bridge work repeats on every render

- **Priority / status:** P2 / Resolved
- **Evidence:** the main effect in `src/components/layout/offline-session-bridge.tsx` has no dependency array and posts to both controller and active registration.
- **Impact:** Parent rerenders can repeat sessionStorage writes, service-worker registration lookup, and duplicate messages.
- **Solution:** Add stable dependencies, de-duplicate controller/active delivery, and send only when the ticket/user snapshot changes.
- **Risks / validation:** Ensure a newly activated worker still receives the current ticket. Test initial load, rerender, controller change, logout, and expiry.

## Recommended remediation order

1. **Add measurement and safety rails:** per-stage processing timing, estimated/peak memory, request counters, payload bytes, and `PERF-CANVAS-001` allocation guards.
2. **Remove request/memory cliffs:** direct resumable uploads (`PERF-UPLOAD-001/002`), processed-image write removal (`PERF-DATA-003`), signed-URL batching (`PERF-DATA-001`), and bounded import/export work.
3. **Reduce backend fan-out:** request-scoped auth/owner context, transactional save/palette RPC, keyset dashboard/settings queries, and explicit asset lifecycle.
4. **Refactor the processing pipeline:** persistent worker, source-sized transfers, byte LRU, staged invalidation, then profile-guided pixel-loop changes.
5. **Refactor editor rendering:** structural sharing/patch history, transient refs, memoized state slices, and virtualized lists.
6. **Tighten route/PWA behavior:** public-page caching decision, selective prefetch, canonical bounded offline cache, and an authorized offline browser test matrix.

## Reference links

- Supabase batch signed URLs: <https://supabase.com/docs/reference/javascript/file-buckets-createsignedurls>
- Supabase signed upload URLs: <https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl>
- Supabase upload to signed URL: <https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl>
- Supabase resumable uploads: <https://supabase.com/docs/guides/storage/uploads/resumable-uploads>
- Local Next.js 16 Server Action guidance: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`

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

### Targeted validation update - 2026-07-14

- The user explicitly authorized rendered validation. Login was checked at 1440px and Pixel 7; the editor was checked at 1440px, 1024px tablet, Pixel 7 portrait, and mobile landscape; advanced crop was checked on desktop and Pixel 7. The canvas remained mounted when tablet/mobile drawers opened. A synthetic 800 x 600 upload retained full bounds until **Detect artwork** was pressed, then proposed an undoable 345 x 345 crop at 80% confidence.
- The refreshed browser suites passed **10/10** responsive application/auth scenarios and **4/4** graph/vector rendering scenarios across desktop Chromium and Pixel 7/mobile Chromium.
- `npm run test:unit` passed **77/77** tests, including crop geometry/edge detection, resource-tier policy, vector-mask topology, smooth/exact fidelity, negative line adjustment, changed-field history round trips/byte pruning, byte-budgeted LRU disposal, source-layout cache keys, and logout session-draft cleanup.
- The current production build was not run because repository policy requires separate confirmation. The 2026-07-10 bundle numbers remain the comparison baseline.
- The new Supabase migration could not be runtime-tested because the local Docker/Supabase service was unavailable. Apply it before deployment and run database lint/advisors plus RPC smoke tests.

The Turbopack build manifests reported these initial client-JavaScript contributions. Values are raw/gzip bytes and are a comparison baseline, not a user-visible timing metric.

| Boundary | Raw | Gzip |
|---|---:|---:|
| Base application | 58,023 | 14,327 |
| Protected layout addition | 18,073 | 6,424 |
| Editor route addition | 214,743 | 55,980 |
| Editor initial total | 290,839 | 76,731 |
| New-project route addition | 30,535 | 9,686 |

Before claiming an optimization, measure at least one representative small project and one stress project. Record processing latency, peak canvas/typed-array bytes, React commit count during a drag, request count, response bytes, and database/storage round trips.

## Remediation update - 2026-07-14

The current implementation extends the allocation, upload, request-fan-out, cache, auth, crop, and responsive-editor safeguards while retaining unresolved items below:

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-001/002/003/005`, `PERF-REACT-001/002/003` | Allocation guards remain in place. Source/clipart vectorization now uses native working resolution before placement, graph-sized per-layer editor caches were removed, SVG/raster vector caches use the disposal-aware `ByteLru`, source moves reuse cached native vectors, and development marks cover processing stages, payloads, cache hits, and retained canvas bytes. Worker requests carry document revision and `draft | full` mode; stale transferable responses are rejected/closed. Capability tiers set 1/1.5/2.5 MP draft targets, 64/96/128 MB image budgets, 24/48/64 MB history budgets, and task concurrency one/two. Undo/redo stores structurally changed top-level fields, prunes commands by bytes/count, and commits pointer gestures once at settle. Entity-granular normalized storage, full prepared-layer worker transfer, and measured target-device latency remain follow-ups. |
| `PERF-IMPORT-001/002`, `PERF-UPLOAD-001/002` | Preview/PDF preparation and crop work use concurrency two. New-project, source, and clipart files use exact-path signed direct Storage uploads with prepare/finalize/cleanup requests; multipart creation is rejected. The migration aligns buckets to 50 MB and PDF MIME types. Resumable TUS for unreliable networks remains an incremental follow-up, not a server-memory blocker. |
| `PERF-EXPORT-001` | PDF/print tiling uses async PNG blobs, sequential yielding, object URLs, and a 240-page total cap. |
| `PERF-DATA-001/002/003/004/005` | Read URLs are signed **locally** against the Cloudflare media gateway with no network call, and their expiry is rounded to a time bucket so repeat renders emit byte-identical, cacheable URLs; save+palette persistence is transactional and occurs only through explicit user saves; dashboard summaries are returned by a bounded RPC with six palette swatches and render a bounded WebP card thumbnail; users use 25-row cursors; create/delete/duplicate paths clean up or deep-copy nested assets and their derivatives. |
| `PERF-STORAGE-001` | Storage moved from Supabase to Cloudflare R2, whose egress is free. Writes use presigned direct-to-R2 PUTs with content-type and byte-length bound into the signature; reads go through the `cloudflare-media-gateway` Worker, which verifies an HMAC before any storage access and caches objects at the edge. A missing object is a hard 404 — there is no Supabase fallback. |
| `PERF-AUTH-001/002`, `PERF-NET-001` | Session resolution is request-memoized; OTP creation/cooldown and verification use atomic service-role-only RPCs; the bounded in-memory limiter remains an early guard; Brevo has an 8-second timeout. An OTP retention job remains a follow-up. |
| `PERF-PAYLOAD-001`, `PERF-ROUTE-001`, `PERF-NAV-001/002`, `PERF-UI-001` | Server Action body limit is 2 MB behind strict schemas; public pages are static; light-route prefetch is restored; duplicate login refresh was removed; dashboard previews use one gradient node. |
| `PERF-PWA-001/002/003/004` | Cache v42 uses canonical direct lookup, a 20-editor bound, app-prefixed eviction, public-only precache, explicit `CLEAR_USER_DATA` logout cleanup, immutable Next static caching, local-development cache bypass/cleanup, and deduplicated bridge messages. Successful logout clears only user-scoped drafts/tickets/protected documents; network failure retains the authenticated UI for retry. Offline RSC/private source cold-start still needs a signed-in offline browser matrix. |

## Remediation update - 2026-07-16 (editor image tools + dark reskin)

New editor features (image-line eraser, background remover, layer group/copy-paste, on-canvas crop modal) and a full editor dark reskin were added. Performance-relevant notes:

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-002/003/005` | Per-source **working canvases** (`sourceWorkingCanvasesRef`) are derived from pristine loaded canvases via `ensureWorkingSourceCanvas` (pristine → client background-removal flood-fill → `destination-out` erase strokes) and cached by an erase+background signature. The derivation runs inside the already-debounced processing pass, so erase/background edits reuse the cache until the signature changes. `buildProcessingSignature`, `sourceProcessingCacheKey`, and `sourceVectorizerCacheKey` all include `eraseStrokesSignature`/`backgroundRemovalSignature`, so no stale vector/mask is reused. Follow-up: incremental in-place erase painting during a drag (currently the working canvas is rebuilt from pristine on each coalesced processing tick). |
| `PERF-REACT-001/003` | `EditorCommandBar`, `EditorToolRail`, `EditorViewControls`, and `EditorStatusBar` are now `React.memo` leaves; `selectEditorTool` is a stable `useCallback`, so the tool rail no longer reconciles during canvas interaction. The large `InspectorPanel` and left-panel lists still re-render on unrelated updates because their prop surface / inline handlers are not yet stabilized — that broader memoization remains the tracked follow-up. |
| `PERF-PAYLOAD-001` | Erase strokes are bounded in `src/lib/editor/layer-extras.ts` (`MAX_ERASE_STROKES_PER_LAYER=80`, `MAX_ERASE_POINTS_PER_STROKE=400`, `MAX_ERASE_POINTS_PER_LAYER=6000`, integer coords) and capture simplifies by min-distance so a source's erase state stays well under the 2 MB Server Action limit. All new layer fields (`groupId`, `eraseStrokes`, `backgroundRemoval`, `layerGroups`) live in the `settings` JSONB — no schema migration. |

New unit tests: `src/lib/canvas/background-removal.test.ts`, `src/lib/editor/erase-geometry.test.ts`, `src/lib/editor/layer-extras.test.ts` (added to the `test:unit` script). Suite is 91/91. Rendered validation: the editor dark theme, image-eraser contextual toolbar, background-removal toggle+tolerance, and the crop popup were verified at 1440px via the dev fixture `/dev/editor-test`.

## Remediation update - 2026-07-17 (graph caps, working downscale, dark UX redesign)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-001` | The graph is now hard-capped at **20 × 125 cells** (`MAX_GRAPH_WIDTH_CELLS`/`MAX_GRAPH_HEIGHT_CELLS` applied inside `clampGraphCellDimensions`, the save schema, and Inspector inputs), bounding the output canvas at 800 × 5000 px (4 MP) — far below the 16 MP/512 MB guards. Oversized legacy projects clamp per axis on load. |
| `PERF-CANVAS-002/004` | Source/clipart working canvases are downscaled at load to `MAX_WORKING_SOURCE_PIXELS = 4 MP` (`fitCanvasToWorkingPixelBudget` now resizes via `resizeImage` instead of rejecting >16 MP decodes). Full-frame pixel loops, vectorize payloads, and retained canvas bytes shrink proportionally (a 48 MP photo now retains 1/12 of its former working pixels). Erase strokes moved to normalized UV coordinates so the cap cannot misalign saved strokes. |
| Upload counts | `MAX_PROJECT_UPLOAD_FILES`/`MAX_SOURCE_IMAGES` raised to a 500 sanity bound (effectively unlimited); the 50 MB per-file and 150 MB per-create-request byte caps remain the real resource guards. |
| UX redesign note | The whole app now uses the dark design system on `:root` with a fixed icon-rail shell (no off-canvas sidebar/topbar). Navigation chrome is lighter than before (rail is pure CSS + three links); no new client JS beyond the previous shell. Line-art preview surfaces intentionally stay light. |

Validation: `npm run test:unit` 94/94 (includes new 20×125 clamp cases and normalized-stroke tests); rendered DOM verification of landing, login, dashboard (12 real projects), settings, new-project workbench, mobile dock, and the editor fixture; Inspector width/height entries of 50/200 clamp to 20/125.

## Remediation update - 2026-07-17 (bounded editor layers and four-color canvas policy)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-001/002` | The renderer still rejects oversized dimensions/pixel counts and a 512 MB estimated peak, but the estimate now models one sequential layer scratch buffer instead of multiplying scratch allocation by every visible layer. This admits the 320 x 4480, 83-layer project whose old estimate was 1,160 MB despite its sequential processing path. Source load groups layers by Storage path, sharing one decoded canvas/object URL, and `workingImagePixelCap` divides each preview tier's image-cache budget by source-layer slot before retaining pristine or derived working canvases. |
| `PERF-CANVAS-002` | Source vector cache identity now uses source asset path/URL plus erase/background signatures rather than layer ID. Duplicate editable layers share vectorization work but transformations still invalidate the cache correctly. |
| `PERF-CANVAS-003/004`, `PERF-REACT-001` | Source-position drags now render a transient source-canvas overlay and defer the exact graph render until release, so pointer movement no longer starts a full 83-layer composition every frame. The async vector path builds masks only for each source's padded placed rectangle, merges them into the authoritative graph map, and retains unchanged source masks in a 48 MiB byte-bounded LRU keyed by source processing identity. Explicit Save and export wait for the final exact render, preserving persisted/exported correctness. |
| `PERF-REACT-004` | Selection drag captures all selected/grouped layer start bounds and translates them in one settings update, excluding the selection itself from snap targets. Layers now have checkbox and Select all selection controls; a shared selection frame scales every unlocked member proportionally through edge/corner handles or exact Width/Height fields, and Batch Inspector controls rotate or flip every member around the shared bounds. A locked member disables these transforms so a group never partially changes. Fill overrides now use source/clipart-scoped normalized artwork IDs instead of render-order numeric IDs: the numeric map remains only for hit-testing, legacy numeric entries migrate on the next edit/save, and duplicate/copy-paste copies the original layer's scoped overrides. Moves, geometry transforms, reordering, and visibility retain fills; content/vectorization/background/erase changes clear only the affected layer's overrides. |
| Canvas color policy | `graph-paper.ts` defines the only persisted artwork colors: white `#ffffff`, black `#000000`, light grey `#b0b0b0`, plus transparent fills/background. The graph/grid line setting defaults to red `#dc2626` and may also use green `#16a34a` or the artwork colors. Legacy hex values normalize to the nearest applicable fixed color on load, editor controls expose only fixed swatches, and the Server Action schema rejects unsupported future colors. No schema migration is required; normalized values persist on the next save. |
| Grid defaults | `DEFAULT_MAJOR_GRID_EVERY` is `1`, so new graphs emphasize every cell boundary by default. Major grid lines are two integer pixels thicker than the configured line thickness, with higher opacity, so cm boundaries clearly stand out; minor/5th lines keep the base width. Existing saved major-grid intervals remain unchanged. |
| Grid rendering | Composites output transparent artwork only. Fill masks are composited crisp, rather than blurred, so their boundary cannot reveal the white paper backdrop; fractional-alpha vector contour pixels receive a render-only adjacent-fill underlay while `fillRegionMap` stays unchanged for hit testing. Before fill-region labeling, the vector mask restores enclosed low-alpha pinholes of at most seven pixels to opaque ink; this removes paper/grid specks from solid black artwork without changing exterior antialiasing or real fill holes. The preview grid is an **SVG overlay** (`GraphGridOverlay`) with strokes in viewBox units, so lines scale with zoom (constant thickness-to-cell ratio) and stay crisp with a visible minor/mid/major hierarchy. PDF and print draw the grid as **vector lines** (jsPDF lines / per-page SVG) at physical mm widths over transparent artwork tiles, so print output no longer blurs the grid. Weights/opacities are shared via `src/lib/canvas/grid-style.ts`. PNG export and the saved processed PNG still flatten via `flattenGraphForOutput` (raster grid). Net render cost is unchanged (grid drawn once, in the flatten instead of the composite) plus one small artwork→flatten `drawImage` on settled renders only. |
| Canvas navigation | Desktop canvas hosts are viewport-height sticky frames. The graph itself scrolls in the center panel, retaining access to the canvas header, view controls, and tool rail without duplicating canvas state or creating a second renderer. |

Current interaction contract: the action strip appears for any selected layer; Layers has per-layer and Select all checkboxes for explicit batch grouping. Group/multi-select overlays use one shared bounds box, with hovered edge/corner resize controls and Inspector Width/Height fields that proportionally scale all unlocked members. Batch Inspector controls rotate around the shared center and flip the whole selected group. Padding fields are read-only placement measurements. The erase-cell command is removed. Background removal and image-line erasing expose their controls only in their explicit tool modes, and image erasing renders a brush ring. Both crop surfaces offer quick left/right/top/bottom and quarter selections that split the current crop bounds, including detected artwork, and create a normal, freely adjustable crop rectangle. The selected source can apply its processing/vectorizer settings to all source and clipart layers, after which each layer remains independently editable. Source/clipart fill overrides are region-local and survive duplicate/copy-paste and geometric transforms; destructive source processing clears only its own overrides. Client/server normalization accepts the structured scoped fill IDs as well as legacy numeric IDs, so paint changes persist through the next render and explicit save. Tiled PDF/print page two includes the supplied company hallmark rotated 90 degrees counter-clockwise in a non-overlapping area outside the graph. Projects save only after an explicit Save command; offline and failed saves retain a session draft.

Validation on 2026-07-17: `npx tsc --noEmit --pretty false --allowImportingTsExtensions`, `npm run test:unit` (111/111, including quick-crop and stable fill-region identity regression coverage), and `git diff --check` passed. Rendered browser validation remains intentionally skipped unless explicitly authorized.

## Remediation update - 2026-07-28 (line and shape drawing contracts)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-003`, `PERF-REACT-001/002` | Draw Line now stores its pointer start in the existing drag ref and does not create a graph object, history entry, selection change, or processing invalidation until movement exceeds three CSS pixels. A deliberate drag updates one lazily created line/arrow and settles as one existing gesture-history transaction. The ±5-degree graph-axis alignment is pure endpoint geometry and does not add a render pass. Draw Shape adds one 1×1-cell object only after an explicit shape choice and click. Neither creation path selects its new object, avoiding an extra Inspector context transition and preserving consecutive drawing. |
| `PERF-PAYLOAD-001` | `GraphShapeDrawing.strokeStyle` adds one optional bounded enum (`solid`, `dashed`, or `dotted`) per generated shape. Legacy records normalize to solid, save validation remains strict, and the processing signature includes the style so previews cannot reuse stale stroke rendering. No database, worker, canvas-allocation, or export-pipeline boundary changed. |
| `PERF-CANVAS-001/003` | When at least one generated shape is visible, the settled processor rasterizes their strokes together into one transient output-sized topology canvas, derives a bounded barrier/enclosure mask, and labels the result once per document. This lets three or more independent lines form one fillable region without processing each shape as a separate source. The pass is capped by the existing 20×125-cell / 4 MP graph limit, is skipped when no generated artwork is visible, and retains no additional canvas after processing returns. |
| `PERF-PAYLOAD-001` | Generated-region color overrides reuse the existing bounded `fillRegions` record under validated `generated:artwork:*` keys. No database column, API envelope, worker message, upload, or export format changed. |
| `PERF-REACT-001/002` | Generated line/arrow selection now uses pure point-to-segment geometry with a physical 0.2 cm buffer, exact rotation/flip/arrowhead handling, and nearest-open-path resolution. The calculation runs only for selection hit testing; eraser pointer movement uses a source-only hit path and does not scan generated shapes. No render, processing, history, or persistence pass was added. |

Targeted validation on 2026-07-28: generated geometry, generated fill identity, enclosure topology, drawing geometry, and mask-merge regression tests passed **41/41**. Six affected TS/TSX files passed static TypeScript parser checks, and `git diff --check` passed. Rendered browser validation, Playwright, full type/lint checks, and a production build were intentionally not run.

Selection-hit validation on 2026-07-28: the expanded drawing-geometry suite passed **14/14**, covering the physical tolerance boundary, unit conversion, nearest-hit metrics, signed endpoints, rotations, flips, continuous dashed/dotted vector paths, arrowheads, and invalid inputs. Rendered browser validation remains intentionally skipped unless explicitly authorized.

## Remediation update - 2026-07-28 (Command Canvas module interactions)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-REACT-001` | Tools uses the same mounted pod boundary as Scene and the merged Focus Console; Navigator remains a fixed top-right sheet. The former standalone Selection pod is no longer rendered: its summary and lightweight commands share Focus's pinned command shelf while the contextual detail pane is the primary internal scroller. The shelf stays pinned at normal sizes and gains overflow safety only if a user deliberately resizes the console below its content height, preventing controls from becoming unreachable. Tools, Scene, and Focus keep drag/resize pointer geometry in refs plus imperative CSS variables, then commit one small presentation-layout update at pointer-up. Navigator has no drag, resize, docking menu, observer, scroll listener, preview canvas, or recenter pointer path. The existing local-only `gpm.editor.command-canvas.layout.v1` payload still deserializes and round-trips the legacy Selection slot, but active-module iteration ignores it; legacy Navigator geometry is also ignored. No project setting, processing signature, history entry, API payload, or primary canvas render is touched. |
| Desktop module reachability | The >=1536x980 reference composition defaults Scene to `400px × calc(100dvh - 120px)` at `16/108`, Tools to `68×500px` at `426/108`, Navigator to `356×116px` at `right 26/top 112`, and Focus to `430px × calc(100dvh - 253px)` at `right 18/top 241`. Scene and Focus therefore retain the 12px bottom safety inset while deriving their resize ceiling from the live viewport instead of fixed content-height caps or the removed status-lane reserve. A pod's first transition to floating captures its rendered dimensions so responsive CSS sizing cannot make it jump after release; existing user-resized dimensions remain authoritative. Pointer movement remains ref/CSS-variable based and still commits presentation state only at interaction end. |
| Responsive editor guard | The dedicated `tool-spine` target prevents Tools from colliding with Scene. Below 1280px, persisted desktop docks, coordinates, and dimensions stay stored but semantic responsive placements win, preserving the single mounted tool rail/canvas across tablet drawers and mobile sheets. |
| Status surface | The canvas-bottom capsule was removed. The fixed Navigator header renders only the current processing/readiness icon and text plus an icon-only online/offline signal. One always-mounted, `aria-hidden` canvas bootstrap loader reuses the existing asset readiness and full-render completion state. It masks the stage continuously from draft recovery through asset settlement and the first successful full graph frame, then latches off for normal edits and debounced re-renders. Draft results no longer advance the settled processed signature/revision, preventing pointer-up from accepting stale flattened output. While the bootstrap surface is active, its opaque mat masks artwork, graph numbers, page badges, and selection overlays and the mounted stage is inert/hidden from assistive technology; initial failures settle into a non-animated error mask rather than spinning forever. One independent screen-reader-only `aria-live` footer remains the sole status announcement. |
| Selection action dispatch | Single-layer rotate/flip now uses an orientation-only helper, preserving the layer’s placement rectangle and recording one existing settings-history update. Multi-layer shared-bounds transforms are unchanged. The contextual More menu remains reachable for Show/Hide and Unlock while direct mutations are locked, and the menu/toolbar stacking context stays above the selection frame without adding canvas processing or pointer-move state. |

Targeted validation on 2026-07-28: the Command Canvas layout-model suite passed **11/11**, including five-slot v1 restore with four active pods, inert legacy Selection round-tripping, the Tools dock, independent width/height clamping, responsive placement, docking, movement bounds, and serialization. Affected TS/TSX and CSS files passed static parser checks. Playwright, rendered screenshots, full lint/type checks, and a production build were intentionally not run.

Navigator/Tools follow-up validation on 2026-07-28: the affected TSX and CSS files passed static parser checks and `git diff --check`; rendered browser validation remained intentionally skipped.

Fixed-Navigator follow-up validation on 2026-07-28: the Navigator is statically pinned to `right-top` with no drag, docking-menu, persisted-size, or resize props. Its header status row and graph-line/grid/zoom controls, the affected TSX files, and the final studio CSS passed targeted content and parser checks; `git diff --check` passed. Rendered browser validation remained intentionally skipped.

Bottom-reach follow-up validation on 2026-07-28: the Command Canvas layout-model suite passed **10/10**, including the shared 12px bottom-inset clamp. The affected TS/TSX and studio CSS passed static parser checks, and `git diff --check` passed. Rendered browser validation remained intentionally skipped.

Selection-action follow-up validation on 2026-07-28: the source-layout suite passed **17/17**, including single-layer rotate/flip orientation and locked-layer no-op coverage. The affected TS/TSX files passed static parser checks and `git diff --check`; Playwright, rendered screenshots, full lint/type checks, and a production build were intentionally not run.

## Remediation update - 2026-07-29 (stable destructive source edits)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-002/003/005` | Derived background-removal/eraser canvases retain immutable content bounds captured from their pristine decoded source whenever they are placed or vectorized. Removing edge pixels therefore cannot recrop, rescale, or shift the remaining artwork. `eraseStrokesSignature` serializes every normalized stroke point, radius, shape, and fill, so cache identities cannot collide when earlier stroke geometry changes. The eraser owns one graph-output-pixel radius and converts it to every target source's local radius before hit testing, immediate preview, and normalized-UV persistence, so source resolution or placement scale cannot change the on-graph footprint. Destructive hit testing inverse-maps through transformed pristine content frames (including offset, rotation, and flips): each brush sample independently updates every intersected visible, unlocked source in one existing history transaction, while lasso clips one polygon to every intersected source-local content frame before persisting UV points. Neither tool selects or falls back to a selected/topmost source. The drag-time preview applies the same source-local footprint immediately with `destination-out`, but clips it to each transformed pristine content frame; the settled bounded processing pass remains authoritative. These are pure placement/key/hit-test changes: they add no canvas allocation, processing pass, API payload, or persistence contract. |

Targeted validation on 2026-07-29: erase geometry (including graph-space brush conversion across source resolutions, rotated/flipped brush-edge intersections, and per-source lasso clipping), erase normalization, and history tests passed **30/30**. The affected TS/TSX files passed static parser checks and `git diff --check`; rendered browser validation, Playwright, full lint/type checks, and a production build were intentionally not run.

## Remediation update - 2026-07-29 (durable fill-region overrides)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-REACT-005` | Persisted fill overrides now use the exact editor 15-degree rotation transform, with pre-correction cardinal scoped keys retained as read-time aliases and promoted on the next settled result. The client retains only the last settled fill-region frame and reconciles a changed result by artwork scope/kind plus region-pixel coverage before committing it. A same-colour parent can fan out to split children, and same-colour children recombine during undo/redo; competing colours do not silently win. Graph resizes compare the shared graph-coordinate rectangle instead of unrelated linear map indexes. Stale vector/render completions are rejected by both document revision and processing signature. The reconciliation exits before any map walk when no user fill override exists; it adds no canvas, API field, or database value, and only holds the prior bounded map reference until the next settled frame replaces it. |

Targeted validation on 2026-07-29: fill-identity, fill-reconciliation (including split/undo-merge, resize, legacy alias, scope isolation, and explicit-colour precedence), history, and source-layout tests passed **38/38**. Rendered browser validation, Playwright, full lint/type checks, and a production build were intentionally not run.

## Architecture update - 2026-07-30 (Coaching Student Portal prototype)

`/portal` adds a standalone presentation-only route family for reviewing two
mobile-first coaching designs, Pulse Campus and Focus Atlas. The server route
layout and catch-all resolver import only static fixtures from
`src/lib/portal/demo-data.ts` and one client presentation controller; they do
not call Graph Pixel Maker auth, Supabase, storage, canvas, or video-provider
code, and add no service-worker caching behavior. The portal stylesheet is
scoped under `.portal-app`, so it cannot affect the existing global/editor
design system. This introduces no new API contract, persistence model,
processing path, or cache entry. Static source inspection and `git diff --check`
are the appropriate validation boundary; no rendered-browser automation or
production build is implied by this prototype.

## Remediation update - 2026-08-01 (export frame and grid contrast)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-003` | Tiled PDF export now rejects a queued debounce, active render, failed current render, stale processed signature, or canvas dimensions that do not match the current graph. `exportCanvasAsPDF` repeats the dimension check at the export boundary. An immediate PDF export after a resize therefore cannot map an old 40 px cell into the new physical graph dimensions. Browser Print keeps its established layout and availability behavior. |
| `PERF-EXPORT-001` | PDF retains its established opaque vector-stroke grid treatment. Browser print now explicitly uses opaque SVG grid strokes and exact color adjustment on its root and SVG grid, matching the PDF's strong line contrast rather than browser-economy-faded output. Print layout and physical cell-size calculations are unchanged. |

Targeted validation on 2026-08-01: the export-readiness regression suite covers queued, stale-dimension, settled, processing, drag, missing-canvas, and failed-render states. PDF layout regression coverage verifies that every tiled 40 px rendered cell maps to exactly 10 mm, and export-grid regression coverage verifies that Print uses opaque SVG strokes to match PDF. Static checks verify exact-color print CSS. Rendered browser/print validation and a production build remain intentionally unrun unless explicitly authorized.

## Remediation update - 2026-08-02 (generated strokes join the imported fill topology)

| Issue IDs | Implemented evidence |
|---|---|
| `PERF-CANVAS-004` | The generated-shape pass previously flood-filled a barrier layer containing only the strokes, so a line closing an open uploaded contour enclosed nothing and a line across an existing enclosure left both halves carrying one region number. `resolveGeneratedTopology` now builds the barrier from the strokes unioned with the merged imported ink (`outlineMask` plus `source`-kind region pixels) and relabels the result. The pass runs at the same point in the pipeline and still executes only when a visible generated shape exists; it replaces the previous full-graph `createEnclosedRegionMask` + `labelFillRegions` pair with an equivalent enclosure/labeling pair and adds one sparse stroke dilation, one barrier/gap union pass, one statistics pass, and two bounded gap-expansion rounds — all O(width × height) over the same graph-sized typed arrays already allocated for this pass. It adds no new canvas, worker message, API payload, or persisted field, and is instrumented as the development-only `generated-topology` stage. |
| `PERF-REACT-005` | Regions the strokes never touch keep their layer-scoped identity, so a stroke anywhere on the graph cannot renumber unrelated imported fills, and a stroke that only clips an enclosure leaves ≥90%-surviving regions with the imported layer. The topology pass moved ahead of the imported `drawFillRegions` call so a taken-over region is not first painted with its former layer colour. Small centroid drift from the gap margin stays far inside the existing 4% reconciliation tolerance, so previously saved `generated:artwork:*` fills are re-homed rather than dropped. |

| `PERF-CANVAS-004` (render pass) | Generated regions are painted twice: once before the outline with `outlineMask`/`outlineCoverage` so they receive the same soft outline underlay imported regions get, and once after the shape artwork without it so a region override still beats a shape's own `fillColor`. Without the first pass every fractional-alpha vector contour pixel beside a generated-owned fill rendered as bare paper — a white hairline around every filled region. The added pass is one composite over the already-allocated sparse generated map and runs only when generated fill regions exist. The gap-closing ring is now recovered with `2 × gapClosePixels` four-connected rounds, matching the square dilation kernel so no unlabeled paper specks remain beside a drawn line; growth is still confined to the ring mask. |

Targeted validation on 2026-08-02: `resolveGeneratedTopology` regression coverage asserts both reported behaviors — a line closing an open contour produces one fillable region where the same artwork alone produces none, and a line across an enclosure produces two distinct regions with the painted stroke excluded from both — plus gap-close tolerance versus its `gapClosePixels: 0` control, solid artwork regions acting as barriers, untouched enclosures keeping their imported identity, and a clipping stroke changing nothing. A separate case asserts that a generated region's own sparse map still resolves the soft outline underlay, which is what keeps the white hairline from returning. `npm run test:unit` passed **218/218**; `npx tsc --noEmit` and ESLint on the changed files are clean. Rendered browser validation, Playwright, and a production build were intentionally not run.

## Build update - 2026-07-17 (Webpack production compiler)

`next build` with the default Turbopack compiler can remain indefinitely at `Creating an optimized production build` with a flat CPU counter and no compiler diagnostics in this workspace. `next build --webpack` completes compilation and reaches TypeScript checking, so the `build` script explicitly selects Webpack until the Turbopack stall can be reproduced and resolved upstream. Do not remove the flag without a successful Turbopack production build. The Webpack build also catches strict TypeScript errors that the stalled path never reports.

Validation on 2026-07-17: `npm run build` completed compilation, TypeScript checking, static generation (14 routes), and trace collection without the former non-fatal Webpack runtime chunk-cycle warnings (`2919` / `webpack-runtime` and `7915` / `webpack`). They were traced to `crop-detection.worker.ts` importing `crop.ts`, which dynamically loads the crop-detection client. The worker now imports the geometry-only helper, preventing that entry-point cycle without changing crop behavior.

## Known-good boundaries to preserve

| ID | Status | Evidence | Contract |
|---|---|---|---|
| `PERF-GUARD-001` | Guard | `src/components/editor/editor-client.tsx`, `src/components/projects/new-project-form.tsx` | `ManualCropper` is dynamically imported with SSR disabled. Keep crop-only UI outside the initial route chunk. |
| `PERF-GUARD-002` | Guard | `src/lib/canvas/pdf.ts`, `src/components/projects/new-project-form.tsx` | `pdfjs-dist` is reached through dynamic imports. Do not statically import it into editor or new-project entry modules. |
| `PERF-GUARD-003` | Guard | `src/lib/canvas/exports.ts`, editor export handlers | `jspdf` and export code are loaded on export intent. Keep them out of initial editor JavaScript. |
| `PERF-GUARD-004` | Guard | `src/lib/canvas/processor-worker-client.ts`, production build output | Both Turbopack and Webpack builds compiled the module worker. Turbopack's raw `.ts` media artifact was not the runtime worker entry; do not switch bundlers solely because that artifact exists. Add a production-server worker smoke test before changing this conclusion. |
| `PERF-GUARD-005` | Guard | `src/components/projects/manual-cropper.tsx`, `src/components/projects/new-project-form.tsx`, `src/components/editor/editor-client.tsx`, `src/lib/canvas/crop.ts`, `src/lib/canvas/crop-geometry.ts`, `src/lib/canvas/crop-detection.worker.ts` | Edge detection and crop-mode background removal are opt-in. File selection must not call `detectContentCropResult`; Detect artwork analyzes a worker-side copy capped at 2 MP, reports confidence, and proposes one undoable crop. The remover previews at the displayed crop resolution and runs once on the native crop output only after an explicit transform. `ManualCropper` retains its measured image box across drag/pan and suppresses duplicate measurements, avoiding transient unpositioned frames. Unchanged files upload byte-for-byte. The worker must use the geometry-only helper rather than `crop.ts`, whose dynamic client import would recreate a runtime chunk cycle. |

## Editor, canvas, and React issues

### `PERF-CANVAS-001` - canvas limits do not enforce a memory budget

- **Priority / status:** P0 / Resolved
- **Evidence:** `MAX_CANVAS_DIMENSION = 24000` in `src/lib/projects.ts`, `src/app/(app)/projects/actions.ts`, and `src/components/editor/inspector/inspector-constants.ts`; `GRAPH_MAJOR_CELL_PIXELS = 40` in `src/lib/graph-paper.ts`; full-frame canvases and typed arrays in `src/lib/canvas/processor.ts`.
- **Impact:** A 24,000 x 24,000 RGBA canvas alone is about 2.15 GiB, and one same-size `Uint16Array` is about 1.07 GiB. Processing holds multiple canvases and masks, so the current per-axis clamp can allow an allocation well beyond browser memory. Even the 150 x 150-cell fixture is 6,000 x 6,000 pixels, about 137 MiB for one RGBA surface.
- **Solution:** Create one shared allocation policy that checks side length, total pixels, estimated bytes per active layer/stage, and device-safe preview limits before allocating. Decouple logical graph size from preview resolution; tile or stream full-resolution export rather than materializing every layer at full output size.
- **Risks / validation:** A lower hard cap can reject existing projects. Version the policy, show the estimated memory in UI, and test boundary values in normalization, processing, crop, save, and export. Validate peak memory on target desktop and mobile hardware.

### `PERF-CANVAS-002` - image layers need bounded source-sized processing and worker transfer

- **Priority / status:** P0 / Partial
- **Evidence:** The editor now retains source-sized working canvases and passes placement metadata to the async processor; it no longer caches a graph-sized canvas per source/clipart. The non-vector path reuses a persistent worker with transferable bitmaps and stale request cleanup. Visible vectorized layers still use the bounded async main-thread path because `/api/vectorize` is an authenticated native Node route.
- **Impact:** Source working canvases and one graph output remain necessary, but visible vector layers currently keep vector acquisition/rasterization on the main thread before composition. Stress projects can still exceed the target retained-memory or long-task budgets even though the previous graph-sized per-layer cache multiplication is gone.
- **Solution:** Transfer prepared native vector bitmaps plus placement/revision metadata to the persistent worker, enforce the capability-tier image budget across decoded canvases, and discard stale stage responses without restarting unrelated work.
- **Risks / validation:** Persistent workers need stale-response protection and deterministic cleanup. Add worker cancellation/restart tests, compare output pixels with the main-thread fallback, and record transfer bytes and peak heap/canvas memory.

### `PERF-CANVAS-003` - processing invalidation is both coarse and incomplete

- **Priority / status:** P1 / Partial
- **Evidence:** `buildProcessingSignature` and the processing effect in `src/components/editor/editor-client.tsx`. The signature serializes global outline/fill colours, fill-region overrides, grid/render settings, and all source/shape/clipart inputs; settled async results also gate on both the request revision and the current signature.
- **Impact:** Unrelated edits can still repeat decode, mask, thinning, region labeling, and composition, and building the signature is itself linear in all source, paint, shape, asset, and clipart records. The prior missing-input stale-preview path is resolved.
- **Solution:** Split the pipeline into typed stages: decode, placement, source analysis, merged masks/region IDs, and cheap composite/grid/manual overlays. Give each stage an explicit dependency key or revision counter and test that every setting invalidates exactly the required stages.
- **Risks / validation:** Incorrect stage boundaries can reuse stale masks. Build a setting-to-stage test matrix and pixel-regression fixtures before removing the current full rerender fallback.

### `PERF-CANVAS-004` - full-frame pixel loops and repeated thinning passes scale poorly

- **Priority / status:** P1 / Measure
- **Evidence:** full-frame `getImageData`, `Uint8Array`/`Uint16Array` allocations, connected-component scans, color masks, and render loops in `src/lib/canvas/processor.ts`, `src/lib/canvas/ink-mask.ts`, and `src/lib/canvas/thinning.ts`; thinning loops until no pixels change.
- **Impact:** Runtime and allocation grow with total output pixels and layer count, even when ink occupies a small region. Per-color masks add more full-size arrays.
- **Solution:** Instrument each stage first. Then process content/dirty bounds, use numeric typed lookup/count tables, render colors in one pass, and consider a frontier-based or WASM implementation only if profiles show thinning remains dominant.
- **Risks / validation:** Bounds optimizations can clip effects near edges. Compare masks, region IDs, palette counts, and rendered pixels against existing fixtures, including rotated and gap-closed sources.

### `PERF-CANVAS-005` - vectorized line generation adds a per-source analysis stage

- **Priority / status:** P1 / Partial
- **Evidence:** Authenticated `/api/vectorize` accepts native-resolution raster input and runs `@neplex/vectorizer.readImage` / `vectorizeRaw` with per-layer line adjustment, threshold, and fidelity. SVG and rasterized mask results use byte-budgeted LRU caches and in-flight request de-duplication keyed independently of placement. Development marks record request payload, route duration, SVG bytes, rasterization, and cache hits. Alpha coverage remains separate from binary topology so smooth contours are not squared or double-painted.
- **Impact:** Vectorization can improve line contours, but it adds a same-origin request and server CPU/native-library stage before region labeling and rendering. Source-sized encoding avoids the previous full-frame payload, while each placement still needs client raster composition and mask analysis.
- **Solution:** Measure vectorized processing latency, request payload size, server duration, cache-hit rate, and peak memory on small, typical, and near-limit projects. If vectorization still dominates latency, persist bounded intermediate masks when a real reuse policy is defined.
- **Risks / validation:** Vectorization can alter fill-region topology and palette counts. Compare rendered pixels, fill-region selection, exports, and worker/main-thread/server-route fallback behavior across JPEG/PNG/SVG-derived sources and exact/smooth fidelity modes.

### `PERF-REACT-001` - the editor rerenders too much state for high-frequency interactions

- **Priority / status:** P1 / Partial
- **Evidence:** `src/components/editor/editor-client.tsx` remains a large controller with dozens of state values plus settings, selection, pan/zoom, processing, and export state. Command Canvas module drag/resize movement now stays in refs and CSS variables until pointer-up, but canvas selection/drawing paths and the broad `InspectorPanel` prop surface still make unrelated editor updates expensive.
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

- **Priority / status:** P1 / Resolved
- **Evidence:** The decode side was bounded earlier (`requiredAssetIds` + `mapWithConcurrency` in `src/components/editor/editor-client.tsx`), but the library grid still rendered `asset.url` — the full-resolution original, which the bucket allows to be 50 MB — into a 40x40 box for every asset in the library.
- **Solution:** Uploads now generate a bounded 256px WebP derivative client-side and PUT it beside the asset (`thumbnailPathFor` in `src/lib/storage/paths.ts`, `uploadWithThumbnail` in `src/lib/storage/upload-client.ts`). `settings.clipartAssets[].thumbPath` persists it and the library grid renders `asset.thumbUrl ?? asset.url`. Signing is no longer a network call at all, so signing the whole library costs nothing (see `PERF-DATA-001`).
- **Risks / validation:** Assets uploaded before derivatives existed have `thumbPath: null` and fall back to the full-size URL, so nothing breaks pre-backfill. PDFs and undecodable files produce no derivative and fall back the same way. Verify the library grid on a project with a mixed old/new asset set.

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
- **Evidence:** Originally one `createSignedUrl` call per path — roughly 132 Storage requests per editor open. Batching to `createSignedUrls` cut that to one request per bucket; moving to Cloudflare R2 removed it entirely.
- **Solution:** `signedUrlsForBucket` in `src/lib/projects.ts` now delegates to `mediaUrlsForBucket` (`src/lib/storage/media.ts`), which is a **local HMAC computation** against the media gateway with no network call on the render path.
- **Follow-on win:** Supabase minted a fresh JWT per call, so the URL string changed on every render and no browser cache entry was ever reusable — the `cacheControl: "3600"` set at upload time never took effect. Gateway URLs round their expiry up to a bucket boundary (`computeExpiry` in `src/lib/object-storage/canonical.ts`), so repeated renders emit byte-identical URLs and revalidate as 304s.
- **Risks / validation:** Signing degrades to an empty map when the gateway is unconfigured, matching the previous behaviour. `src/lib/storage/paths.test.ts` covers key derivation; `packages/object-storage/tests/sign.test.ts` covers URL stability.

### `PERF-DATA-002` - a save repeats session/owner checks and performs non-transactional palette fan-out

- **Priority / status:** P1 / Resolved
- **Evidence:** `saveProjectState` in `src/app/(app)/projects/actions.ts`; `requireSession`, `assertProjectAccess`/`assertProjectOwnerId`, and `replaceProjectPalettes` in `src/lib/projects.ts`. A normal save re-enters session/authorization checks, updates the project, then deletes and reinserts palettes. The save path resolves authorization through `assertProjectOwnerId`, which selects only `user_id` and therefore never reads the `settings` blob.
- **Impact:** One save is about eight database calls before the separate processed-image request, and a failure between palette delete/insert can leave partial state.
- **Solution:** Resolve a request-scoped authenticated/owned-project context once and pass it through the DAL. Use one service-role-only, `SECURITY INVOKER` transactional RPC to update the project and synchronize palettes; enforce a unique `(project_id, sort_order)` constraint if order is the identity.
- **Risks / validation:** Never cache sessions across requests. Test rollback on invalid palettes, cross-user ownership, admin/member behavior, and a call-budget assertion for a save.

### `PERF-DATA-003` - processed PNG persistence must stay explicit and bounded

- **Priority / status:** P1 / Resolved
- **Evidence:** `saveProjectSnapshot` in `src/components/editor/editor-client.tsx` uploads `processedCanvasRef.current` as PNG only for explicit manual saves and user-initiated source/clipart upload saves. The dashboard then rendered that full processed PNG as its card image, up to 25 cards per page.
- **Solution:** The audit's own recommendation is now implemented — `uploadProcessedCanvasImage` also generates a 512px WebP card thumbnail and PUTs it to `/api/projects/[id]/processed-image?variant=thumbnail`, stored in `projects.processed_thumb_path` (migration `20260725120000_add_processed_thumbnail_path.sql`, which also re-declares `get_project_summaries` to return it). `ProjectThumbnail` in `src/app/(app)/dashboard/page.tsx` prefers `processedThumbUrl`.
- **Risks / validation:** The thumbnail upload is best effort and deliberately cannot fail the save — the processed PNG is already committed when it runs. Projects saved before this exists have `processed_thumb_path: null` and fall back to the full-size image until their next save. Verify a card renders for a legacy project, a newly saved project, and one with no processed image at all.

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

- **Priority / status:** P1 / Resolved
- **Evidence:** `getProjectSummaries` calls `get_project_summaries` with a 25-row cursor, requests one lookahead row, returns only six palette swatches, and batch-signs thumbnail paths for the current page. `getAppUsers` is cursor-bounded, and the migrations provide matching composite/trigram indexes. The admin `all` scope (`p_include_all_owners`) drops the `user_id` predicate, so it uses the `projects_updated_id_idx` ordering index added by `20260730120000_admin_all_project_access.sql`; every other bound (page size, lookahead, six swatches, per-page signing) is unchanged, and the owner join is a primary-key lookup per row.
- **Impact:** The previous row, palette, and DOM growth is bounded to one page. Query-plan quality still depends on applying the new migration in the deployed database.
- **Solution:** Apply the migration, then verify cursor stability and run `EXPLAIN (ANALYZE, BUFFERS)` for empty and substring searches with representative data.
- **Risks / validation:** Cursor ordering must be stable under updates, and search semantics are a product decision. Use `EXPLAIN (ANALYZE, BUFFERS)` with representative data and test no duplicates/gaps between pages. Re-check the plan for the all-owners scope separately: it scans across owners, and its title/owner-email search is two `ilike` predicates rather than one.

### `PERF-DATA-005` - project asset lifecycle leaks objects and duplication can retain source references

- **Priority / status:** P1 / Resolved
- **Evidence:** project creation inserts the row before concurrent uploads in `src/app/api/projects/route.ts`; `deleteProject` removes only top-level original/processed paths; source/clipart paths live inside settings; `duplicateProject` copies top-level paths but initially duplicates settings unchanged.
- **Impact:** Failed creates and deletes can leave orphaned source/clipart files. A duplicate may reference the original project's nested assets, making ownership/lifecycle ambiguous and cleanup unsafe.
- **Solution:** Short term, clean the entire validated project prefix on failure/delete and rewrite every nested path during a deep-copy duplicate. Longer term, add a `project_assets` registry with owner, project, kind, path, size, MIME, state, and optional reference count, plus periodic orphan reconciliation.
- **Risks / validation:** Prefix deletion is destructive if paths are not strongly validated. Test partial upload failure, delete, duplicate, source replacement, shared-reference policy, and idempotent cleanup.

### `PERF-AUTH-001` - session validation is repeated within one request/render

- **Priority / status:** P1 / Resolved
- **Evidence:** `getCurrentSession` checks `app_users` in production; nested `requireSession`/`assertProjectAccess` calls in project routes/actions and `getAppUsers` repeat it. The editor page adds one `app_users` lookup (`getProjectOwnerLabel`) only when an admin opens a project they do not own. Layout/page combinations can also call session helpers more than once. `src/lib/auth/dev-bypass.ts`, `src/lib/auth/session.ts`, and `src/proxy.ts` now provide an opt-in development-only bypass.
- **Impact:** Route handlers and actions incur redundant database calls. Identical React Server Component fetches may be deduplicated by framework behavior, so wire-level impact there must be measured rather than assumed.
- **Solution:** Introduce a request-scoped auth context (React `cache()` for RSC DAL calls, explicit context passing in routes/actions) and a single owner/admin authorization step. Do not use cross-request `use cache`/`unstable_cache` for session data.
- **Current local contract:** `GRAPH_PIXEL_DEV_AUTH_BYPASS=true` is honored only for `NODE_ENV=development`; `GRAPH_PIXEL_DEV_USER_EMAIL` optionally selects the identity. Production cannot bypass. With Supabase configured, the email resolves to an active `app_users` record so ownership/admin checks use a real user ID and role. This improves local iteration but does not resolve production request fan-out.
- **Risks / validation:** Incorrect cache scope can leak identity. Test two concurrent users, deactivation during a session, owner/admin enforcement, exact database calls per route/action, bypass rejection in production/test, and inactive/missing development users.

### `PERF-AUTH-002` - OTP limiting and verification are process-local and non-atomic

- **Priority / status:** P1 / Partial
- **Evidence:** OTP creation/cooldown now runs in `create_login_otp_attempt`, and verification/attempt consumption runs in `verify_login_otp`; both are service-role-only atomic RPCs. The bounded in-memory limiter is only a fast early guard. Consumed/expired attempt retention cleanup is not yet scheduled.
- **Impact:** Multi-instance cooldown and verification races are removed. Database rows still accumulate until retention cleanup is scheduled.
- **Solution:** Keep the atomic RPCs authoritative and add scheduled retention cleanup for consumed/expired attempts.
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
2. **Remove request/memory cliffs:** direct resumable uploads (`PERF-UPLOAD-001/002`), processed-image write bounding (`PERF-DATA-003`), signed-URL batching (`PERF-DATA-001`), and bounded import/export work.
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

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
- **`next.config.ts`** — sets security headers (`X-Content-Type-Options`, `Referrer-Policy`) and a strict CSP for `/sw.js`.
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

### API routes

- `/api/auth/send-otp` — generates 6-digit OTP, stores hash in `email_otp_attempts`, sends via Brevo (or logs in dev).
- `/api/auth/verify-otp` — verifies hash, marks attempt consumed, sets `graph_pixel_session` httpOnly cookie.
- `/api/auth/logout` — clears session cookie.
- `/api/projects` — coordinates signed project uploads and finalization.
- `/api/projects` uses a three-step direct-upload contract: JSON `POST` creates the row and exact-path signed upload tokens, the browser uploads directly to Storage, and JSON `PATCH` verifies/finalizes metadata. `DELETE` cleans up a failed pending upload. Multipart project creation is intentionally rejected.
- `/api/projects/[id]/original-image` — PUT replaces the primary source image.
- `/api/projects/[id]/source-images` — prepares, finalizes, or cleans up direct source-image uploads.
- Source-image and clipart upload routes use the same JSON prepare / direct Storage upload / JSON finalize pattern; do not reintroduce multipart bodies into Next.js.
- `/api/projects/[id]/processed-image` — PUT stores the processed PNG output.

---

## 7. Auth model

This app does **not** use Supabase Auth. It uses a custom OTP flow:

1. Server generates a 6-digit OTP with `generateOtp()`.
2. Hashes it with `hashOtp(email, otp)` using `EMAIL_OTP_SECRET`.
3. Stores the hash + expiry in `email_otp_attempts`.
4. Sends via Brevo transactional email; in development, logs the OTP to the console if `BREVO_API_KEY` is missing.
5. `verify-otp` checks the hash, max attempts (`5`), expiry, consumed state, and active allowlist status.
6. On success, sets a signed httpOnly `graph_pixel_session` cookie (30-day TTL) via `setSessionCookie`.

Session verification (`getCurrentSession`) reads the cookie, verifies the HMAC signature, validates the user is still active in `app_users`, and returns `{ userId, email, role, displayName }`.

Production session resolution is request-memoized with React `cache()`; never replace it with cross-request caching. OTP verification is atomic through the service-role-only, `SECURITY INVOKER` `image_to_graph.verify_login_otp` RPC.

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

Migration `20260710091750_optimize_project_persistence.sql` adds cursor/search indexes plus transactional `save_project_state` and `verify_login_otp` RPCs. Apply this migration before deploying code that calls those RPCs.

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

- `src/lib/canvas/processor.ts` is the core conversion engine: fit source canvases, build ink/fill/outline masks, label connected fill regions, draw grid lines/numbers, render manual shapes, and produce a palette.
- `src/lib/canvas/processor-worker-client.ts` reuses a persistent Web Worker when `OffscreenCanvas` and `createImageBitmap` are available; aborted/failed workers are terminated and recreated, otherwise processing falls back to the main thread.
- `src/lib/canvas/processor.worker.ts` runs the same `pixelateLayeredCanvases` logic in the worker.
- `src/lib/canvas/pdf-layout.ts` plans multi-page PDF/print tiles, respecting paper size, orientation, alignment, margins, and `MAX_PAGES_PER_PDF_FILE = 80`.
- `src/lib/canvas/exports.ts` implements PNG download, PDF download, browser print, and JSON settings export.

### Editor state

`EditorClient` (`src/components/editor/editor-client.tsx`) is a large client component that:

- Holds the canonical `GraphSettings` state and an undo/redo history (`MAX_SETTINGS_HISTORY = 80`).
- Manages source images, cell paints, graph shapes, palette colors, fill-region overrides, zoom, selection, drag/resize interactions, and export menus.
- A single click selects canvas layers or fill regions; a double-click on a processed fill region opens its floating color palette. Selected source/generated-shape/clipart boxes use a high-contrast cyan selection outline. Source and generated-shape corner resize controls stay visible while selected; top/right/bottom/left resize controls appear only when the pointer reaches the selection boundary or during that resize. Preview-canvas hover cursors follow the active top tool (custom white-filled, black-bordered selector SVG for select, `grab` for pan) instead of placement/copy/crosshair/hand cursors; resize handles keep their directional resize cursors.
- Debounces canvas reprocessing (`PREVIEW_PROCESSING_DEBOUNCE_MS = 250`) and renders the output to a canvas. During active drag/resize/draw gestures, processing is coalesced with `DRAG_PROCESSING_IDLE_DEBOUNCE_MS = 300`, forced at least every `DRAG_PROCESSING_MAX_WAIT_MS = 1000`, and rerun immediately on pointer-up for the latest committed state. Render signatures are marked processed only after worker/fallback success.
- Caps each source/clipart full-frame canvas cache at 128 MB and checks total canvas/estimated processing memory before allocation.
- Saves via the server action `saveProjectState` (`src/app/(app)/projects/actions.ts`) with Zod validation.
- Stores an in-flight session draft in `sessionStorage` (`src/lib/editor/session-draft.ts`) for recovery.

### New-project crop flow

`NewProjectForm` (`src/components/projects/new-project-form.tsx`) lets users upload up to 12 files, preview/crop/rotate each in `ManualCropper`, then uses signed direct-to-Storage uploads with concurrency two and a 150 MB aggregate limit. The first file becomes the primary `original_image_path`; additional files become source images.

---

## 10. PWA / offline support

- `public/sw.js` caches only public non-redirecting shell resources plus immutable `/_next/static` assets, and keeps at most 20 canonical editable-project documents when an offline session marker is fresh. On localhost, it bypasses runtime caching and clears this app's caches to avoid stale development hydrations.
- `OfflineSessionBridge` writes the offline session ticket into `sessionStorage` and notifies the service worker when the user is logged in.
- `/offline` is shown when the network fails and no cached project page is available.
- `BLOCKED_OFFLINE_NAVIGATION_PATHS` includes `/projects/new`, which is not available offline because source uploads require a connection.
- `layout.tsx` registers the service worker and tells installing workers to `SKIP_WAITING`.

---

## 11. Build & run commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

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
- `src/lib/canvas/grid-numbering.test.ts`
- `src/lib/canvas/ink-mask.test.ts`
- `src/lib/canvas/pdf-layout.test.ts`
- `src/lib/canvas/performance-limits.test.ts`
- `src/lib/canvas/processor.test.ts`
- `src/lib/canvas/thinning.test.ts`
- `src/lib/editor/session-draft.test.ts`
- `src/lib/editor/source-layout.test.ts`
- `src/lib/projects/crop-queue.test.ts`
- `src/lib/utils/concurrency.test.ts`

Run with `npm run test:unit`. They use Node's built-in `node:test` and `node:assert`; TypeScript is stripped via `--experimental-strip-types`.

### E2E tests

- Located in `tests/e2e/`.
- `app-ui.spec.ts` — verifies dashboard, settings, login, create-project crop flow, and mock editor layout on desktop/mobile.
- `graph-generation.spec.ts` — uses `/dev/editor-test` to inspect rendered canvas pixels and confirm fill-region behavior, line-thickness changes, and no framework overlays.
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
- **CSS variables** for the design system are in `:root` in `src/app/globals.css`.
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

These rules were hard-won; changing them tends to break the mobile menu, editor scroll, or page overflow.

- `AppShell` (`src/components/layout/app-shell.tsx`) owns menu state (`isMenuOpen`) and closes it on route changes. It is a client component and receives `session` + `offlineSessionTicket` as props from `(app)/layout.tsx`.
- `AppNav` renders both desktop (inside the sidebar) and mobile (fixed bottom bar) variants. Sidebar links are hidden by default and toggled via hamburger.
- `src/app/globals.css` layout primitives:
  - `.mock-shell` — `position: relative; isolation: isolate;` normal flow, **not** a fixed overlay host.
  - `.mock-sidebar` — hidden by default with `transform: translateX(-100%)` and `visibility: hidden`; `.mock-sidebar--open` brings it onscreen.
  - `.mock-nav-backdrop` is fixed with z-index below the menu; clicking it closes the menu.
  - `.editor-dark-shell` stays `position: relative` with `min-height: 0` and `overflow: visible` for page flow.
  - `.editor-workspace` uses `grid-template-rows: auto` and flexible columns; do not force child overflow that breaks scroll.
  - `.editor-side-column` is sticky on desktop (`top: 62px`) and static on mobile.
- The editor page (`/projects/{id}`) hides the normal topbar/bottom nav chrome; `AppShell` detects `isProjectEditor` and renders only the sidebar + main area.

---

## 16. Recent fixes on this branch

- **Hamburger menu issue:** links were always visible; fixed by making the desktop nav an off-canvas panel toggled by the hamburger.
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

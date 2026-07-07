<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:sparx-app-handbook -->
## 5.3-Codex-Sparx App Handbook

Use this section only as a compact handoff for low-context runs of the 5.3-Codex-Sparx model.

### High-leverage app map
- Route shell and auth: `src/app/(app)/layout.tsx` (redirects to `/login` when no session).
- Main app chrome: `src/components/layout/app-shell.tsx` + `src/app/globals.css` + `src/components/layout/app-nav.tsx`.
- Project editor page: `src/app/(app)/projects/[id]/page.tsx` renders `EditorClient`.
- Editor internals: `src/components/editor/editor-client.tsx`.

### Current behavior contracts
- Sidebar links are hidden by default and opened via hamburger in header; do not expose Dashboard/Create/Settings/Help/Sign out outside menu state.
  - `AppShell` now owns menu state (`isMenuOpen`) and closes on route changes.
- Mobile bottom nav remains in `AppNav` (`variant="mobile"`), desktop nav uses `variant="desktop"` as a hidden off-canvas panel at small widths when menu is closed.
- Editor must remain vertically scrollable on large content; keep layout flexible:
  - `mock-shell` is normal flow (`position: relative`) and not a fixed overlay host for app content.
  - Sidebar animation is transform-based (`.mock-sidebar` off-screen by default, `.mock-sidebar--open` when toggled).
  - `.mock-nav-backdrop` click closes menu.
- `AppShell` is a client component; do not import `src/lib/auth/session.ts` directly there (it is `server-only` and uses `next/headers`).
  - Create any server-only values (offline session ticket, current session validation) in server components and pass them into `AppShell` via props.

### CSS/layout gotchas to preserve
- `src/app/globals.css`
  - `.mock-shell`: currently uses `position: relative; isolation: isolate;`.
  - `.mock-sidebar`: hidden by default with `transform: translateX(-100%)` and `visibility: hidden`; `.mock-sidebar--open` makes it visible/onscreen.
  - `.mock-nav-backdrop` is fixed with z-index below menu.
  - In editor styles, keep `grid-template-rows: minmax(0, 1fr)` and avoid forcing panel overflow that breaks scroll.
  - `.editor-dark-shell` should stay `position: relative` for page flow and `min-height: 0`.
- `AppShell` currently sets classes `mock-sidebar--open` on `<aside>` and does not rely on permanent desktop margin shifts.

### What was fixed recently (for this branch)
- Hamburger menu issue: links were always visible; fixed by making desktop nav off-canvas and toggleable.
- Editor scroll issue (`/projects/{id}`): fixed by removing fixed shell constraints and removing restrictive child overflow where needed in CSS.
- Build break "only available in the App Router / Pages Router":
  - caused by importing `createOfflineSessionTicket` from `session.ts` inside client `AppShell`.
  - fixed by computing the ticket in `src/app/(app)/layout.tsx` and passing as nullable prop.

### Useful commands
- Fast sanity checks used successfully:
  - `git diff --check`
  - `npx tsc --noEmit --pretty false --allowImportingTsExtensions`
- Do not run production build/start without explicit user confirmation (per repo instructions).

### Recommended edit style for future patches
- Keep changes scoped to existing layout/editor primitives:
  - `src/app/globals.css`
  - `src/components/layout/app-shell.tsx`
  - `src/components/layout/app-nav.tsx`
  - `src/components/editor/editor-client.tsx`
- Prefer minimal CSS diffs for behavior fixes (menu, scroll, overflow, viewport constraints).
- Verify behavior by reading rendered DOM structure and class names first; avoid broad refactors.
<!-- END:sparx-app-handbook -->

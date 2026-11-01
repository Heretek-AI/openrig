# Hermes dispatch prompt: C06: Sidebar shell (replaces the rail)

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C06, Sidebar shell (replaces the rail)
**Depends on (must already be merged into `ui-redesign`):** C03, C04, C05
**Your branch:** `ui-redesign/c06-sidebar-shell-replaces-the-rail`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C06): Sidebar shell (replaces the rail)`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C06): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C06: Sidebar shell (replaces the rail)

## What changed
- ...

## Acceptance
- [ ] <each acceptance line from the card, ticked, with the command output summary>

## Test assertions changed for the new design
- `<file> > <test>`: <old> → <new>   (or "none")

## Notes for later cards
- ... (copy of what you added to NOTES.md)
```

---

### C06: Sidebar shell (replaces the rail)

This is the riskiest card. Read section 4.7 again first.

**Do:**
1. `src/lib/sidebar-mode.ts`:
   ```ts
   export type SidebarMode = "auto" | "expanded" | "collapsed";
   export const SIDEBAR_MODE_STORAGE_KEY = "openrig.sidebar.mode";
   export function readSidebarMode(): SidebarMode;           // localStorage; invalid/missing -> "auto"
   export function writeSidebarMode(mode: SidebarMode): void;
   /** auto: collapsed when an Explorer column is visible on desktop, expanded otherwise. */
   export function isSidebarCollapsed(mode: SidebarMode, explorerVisible: boolean): boolean;
   ```
   Wrap `localStorage` access in try/catch (Safari private mode throws).
2. `src/components/shell/SidebarNavItem.tsx`: props `{ item: NavItem | (chat item with resolved to); pathname: string; collapsed: boolean; badge?: number; onNavigate?: () => void }`. Renders a TanStack `<Link>` with `data-testid={item.testId}`, `data-active`, `aria-label={item.label}`, `aria-current={active ? "page" : undefined}`. Classes: `"flex h-11 lg:h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors"`; active `"bg-surface-mid text-on-surface"`, idle `"text-on-surface-variant hover:bg-surface-low hover:text-on-surface"`. Icon `h-4 w-4`, `strokeWidth={1.75}`. When `collapsed`: hide the label (`sr-only`), center the icon (`justify-center px-0 w-11 lg:w-9`), and wrap in the existing `Tooltip` (`components/ui/tooltip.tsx`, side `right`) showing the label. `badge > 0` renders a right-aligned `rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums` (in collapsed mode: a small dot on the icon's top-right).
3. `src/components/shell/SidebarSection.tsx`: `{ label: string | null; collapsed: boolean; children }`. Renders `<div role="group" aria-label={label ?? undefined}>`; when `label` and not collapsed, a heading `px-3 pt-4 pb-1 text-xs font-medium text-on-surface-variant` (sentence case, **not uppercase**). Use `@radix-ui/react-collapsible` so the user can fold a section; persist folded section ids in localStorage key `openrig.sidebar.folded` (JSON array). The `top` section has no label and is never foldable.
4. `src/components/shell/SidebarRigList.tsx`: inside the "Fleet" section, under "Rigs", when not collapsed: up to 8 rigs from `useRigSummary()`, each a `Link` to `/topology/rig/$rigId` (use `to="/topology/rig/$rigId" params={{ rigId }}`) with `StatusDot status={rig.lifecycleState ?? "unknown"}` and the rig name (`truncate text-sm`, indented `pl-9`). More than 8 → a "See all rigs" link to `/topology`. Loading → 3 `Skeleton` rows `h-6`. Error or 0 rigs → render nothing. testids: `sidebar-rig-<rigId>`, `sidebar-rigs-see-all`.
5. `src/components/shell/Sidebar.tsx`: `export function Sidebar({ pathname, onMobileClose, vertical, collapsed, onToggleCollapsed }: {...})`. Structure (one `<nav data-testid="app-rail" aria-label="Primary navigation" data-collapsed={collapsed}>`):
   1. Header row: on desktop a collapse toggle button `data-testid="sidebar-toggle"` (`PanelLeftClose` / `PanelLeftOpen` icons, `aria-label` "Collapse sidebar" / "Expand sidebar").
   2. Primary action: `Button` `data-testid="sidebar-new-rig"`, label "New rig", icon `Plus`, links to `/specs/rig` (use `asChild` with `<Link>`). Collapsed → icon-only with tooltip.
   3. Search button `data-testid="sidebar-search"`: label "Search", right side `<Kbd>⌘K</Kbd>`; `onClick` dispatches `window.dispatchEvent(new CustomEvent("openrig:open-palette"))` (C08 listens).
   4. `NAV_SECTIONS` rendered with `SidebarSection` + `SidebarNavItem`; Inbox item gets `badge` = `useAttentionItems(50, useFeedSubscriptions().anyRemoteEnabled).data?.items.length ?? 0` (same subscription-dependent flag `Feed.tsx` passes, verified at `components/for-you/Feed.tsx` ~line 255: `const remoteFeedActive = subs.anyRemoteEnabled; useAttentionItems(50, remoteFeedActive)`; `useFeedSubscriptions` is in `hooks/useFeedSubscriptions.ts`); `SidebarRigList` right after the Rigs item.
   5. Spacer `flex-1`.
   6. Chat group (label "Chat"): `NAV_CHAT` items with `to` from `resolveChatTo(readSettingString(useSettings().data, "agents.<role>_session"), role)`, `activeWhen: () => false`.
   7. `NAV_FOOTER` (Settings).
   Width: `style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}` on desktop; `w-full` inside the mobile tray. Background `bg-surface-low border-r`. Scroll: the middle part `overflow-y-auto scrollbar-none`.
6. `AppShell.tsx`:
   1. Delete the `Rail` function, `RailIconSpec`, `RAIL_ICONS`. Render `<Sidebar … />` in both places `Rail` was rendered (desktop `hidden lg:flex` wrapper, and inside `mobile-rail-tray` with `collapsed={false}`).
   2. Add state `const [sidebarMode, setSidebarMode] = useState(readSidebarMode)`; compute `const sidebarCollapsed = isWideLayout && isSidebarCollapsed(sidebarMode, explorerVisible && desktopExplorerOpen)`; the toggle sets `"expanded"` or `"collapsed"` explicitly and persists it.
   3. Compute `const sidebarWidth = sidebarCollapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)";`. Set `style={{ "--sidebar-current-width": isWideLayout ? sidebarWidth : "0rem" } as CSSProperties}` on the `<div className="flex flex-1 min-h-0 relative">` wrapper (the "Main: rail + explore + center + drawer" div that contains the sidebar, the Explorer and `<main>`). **Not** on `workspaceStyle`: verified that `workspaceStyle` is applied only to `<main>` (AppShell.tsx ~line 628), which is a sibling of the Explorer, so a variable set there never reaches the Explorer.
   4. Replace `"21rem"` with `"calc(var(--sidebar-current-width) + 18rem)"` and `"3rem"` with `"var(--sidebar-current-width)"` in `explorerAnchorLeft`. Update the comment above it.
   5. **Important:** `main` is a flex sibling *after* the sidebar, so it already starts at the sidebar's right edge, and today's `paddingLeft: var(--workspace-left-offset)` double-counts the rail (verified: content starts at x=384 when explorer ends at 336, a 48px gutter). Keep that behavior exactly (do not "fix" it in this card). With a 240px sidebar this gutter would become 240px, so instead set `workspaceLeftOffset` to: opaque + explorer open → `"18rem"`; otherwise `"0rem"` when the explorer is not open; overlay → `"0rem"`. Then verify with `layout-check.cjs` (acceptance). Log the before/after numbers in NOTES.md.
   6. In `Explorer.tsx`, replace `lg:left-12` with `lg:left-[var(--sidebar-current-width)]` (the variable comes from the wrapper in step 3).
   7. `headerAnchorOffset` (overlay mode on topology) has the same double-count: it is measured from `<main>`'s left edge, which is already past the sidebar. Set it to `"18rem"` when the explorer is open in overlay mode and `"0rem"` otherwise. Check the result in the `/topology/rig/rig_alpha` screenshot: the Graph/Table/Terminal tabs start just right of the Explorer, not 240px further right.
   8. Remove the old top bar brand block only in C07; leave the top bar alone in this card.
7. Update the `routes.tsx` comments for `/agents`, `/fleet`, `/workflows` (rule in section 4.2).
8. Tests:
   - New `test/sidebar.test.tsx` (render via `createAppTestRouter` with `rootComponent: ({children}) => <AppShell>{children}</AppShell>`, mirroring `renderAt` in `test/app-shell.test.tsx`; stub `fetch` to return `[]`/`{}` as the existing app-shell test does): (a) all 12 sidebar testids in section 4.2 exist at `/`; (b) visible text "Inbox", "Rigs", "Projects", "Library" present; (c) at `/topology` with explorer the nav has `data-collapsed="true"` (auto mode); (d) clicking `sidebar-toggle` flips `data-collapsed` and writes `openrig.sidebar.mode`; (e) `rail-topology` has `aria-current="page"` at `/topology/rig/x`; (f) `sidebar-search` click dispatches `openrig:open-palette` (spy with `window.addEventListener`).
   - Expected breakage in `test/app-shell.test.tsx` (predicted, confirm by running): the "slice 20: rail icon tap targets…" test asserts `w-11`/`lg:w-10` on `rail-dashboard`. Replace its assertions with: className matches `/\bh-11\b/` and `/\blg:h-9\b/` (mobile ≥44px, desktop 36px). Rename it to "nav items keep a ≥44px tap target on mobile". The SC-1 count test must still pass **unchanged** (2 chromes). The "6 destination icons" test must still pass unchanged (testids kept). Log every assertion you change.
   - Also run and fix as needed (rule 4): `test/p5-mobile-polish.test.tsx`, `test/slice-20-mobile-density.test.tsx`, `test/explorer-mobile-zindex-layering.test.tsx`.

**Acceptance:**
- `npx vitest run test/sidebar.test.tsx test/app-shell.test.tsx` passes; full suite 0 failed.
- Twin + layout check, each must exit 0:
  ```bash
  for r in / /specs /project /settings; do TWIN_ROUTE=$r npm run twin:build >/dev/null && node twin/capture/layout-check.cjs twin-out/intent.html 1440 || { echo "FAIL $r"; exit 1; }; done
  ```
  (prints no `FAIL` line and the loop's exit status is 0; run it in a subshell `( … )` so `exit 1` doesn't close your terminal). For `/specs` the JSON shows `rail.width` 56 (auto-collapsed with explorer) and `explorer.left == rail.right`. For `/` it shows `rail.width` 240.
- `TWIN_ROUTE=/topology/rig/rig_alpha npm run twin:build && node twin/capture/layout-check.cjs twin-out/intent.html` exits 0.
- At width 800 (`layout-check.cjs … 800`) the desktop sidebar is hidden: the JSON has `"rail":null` and the script exits 1 with `app-rail not visible`. That is the **expected** result on mobile; record it.
- Screenshot `/` at 1440: labeled sidebar with sections Fleet / Work / Build, "New rig" button, Search ⌘K.

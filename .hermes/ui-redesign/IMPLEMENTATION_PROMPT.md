# OpenRig web UI redesign: implementation brief

> Location: `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` (per-card prompts are in `.hermes/ui-redesign/cards/`).
> Status: plan, ready to hand to a coding agent (or to a kanban orchestrator that hands one card at a time to coding agents).
> Written 2026-11-01 against `Heretek-AI/openrig` `main` at `eb6c158`. Every fact in "Verified facts" was checked by running it at that commit.

---

## 1. Mission

Rebuild the OpenRig web UI (`packages/ui`) so it is friendly to a first-time operator: a labeled, sectioned sidebar, plain-language names, a calm neutral theme with light and dark modes, a ⌘K command palette, breadcrumbs, consistent status badges, useful empty states, toasts for actions, and a dashboard and inbox that answer "what is happening, does it need me, what do I do". The visual and interaction reference is Paperclip's board UI (`Heretek-AI/paperclip`, `ui/`), but you rebuild the patterns inside OpenRig's existing stack. You do not port Paperclip's code.

**Read this whole file before you write any code.** Your training data is out of date for this project: OpenRig's UI uses React 19, TanStack Router 1.168, React Query 5, Tailwind **3.4** (not 4), and a large set of contract tests that pin today's layout. Trust this file and the repo over your memory.

---

## 2. How to work (rules)

1. Work the cards in section 6 **in dependency order**. A card is done only when every line of its **Acceptance** passes. Do not start a card whose dependencies are not merged into the integration branch.
2. **Branching.** Integration branch: `ui-redesign` (created by card C00 from `main`). Each card gets its own branch `ui-redesign/<card-id>-<slug>` cut from the latest `ui-redesign`, and one PR back into `ui-redesign`. The last card opens the single PR from `ui-redesign` into `main`.
3. **Commit per card** with explicit staging (`git add <paths>`; never `git add -A` or `git add .`). Commit message format: `ui(<card-id>): <what changed>`.
4. **Never skip, delete, or weaken a test to get green.** Section 4.6 lists the exact tests that encode the old design and *must* be rewritten, and gives the replacement. Any other test that fails is a bug in your change: fix the code. If you are certain a test asserts old *copy or layout* that this brief explicitly changes (for example a rail label), you may update **that assertion only**, and you must log the before/after in `docs/ui-redesign/NOTES.md` with the test name.
5. **Never invent an API.** Look it up in this order: (a) this file, (b) the TypeScript types in `node_modules/<pkg>/dist/*.d.ts` or the repo source, (c) a throwaway experiment in `packages/ui/test/_scratch/` that you delete before committing.
6. **Log every discovery or discrepancy** in `docs/ui-redesign/NOTES.md` with evidence (command + output, or `file:line`). Create the file in C00.
   **This folder is deliberately untracked.** The repo `.gitignore` ignores `docs/*` except `docs/as-built/`, `docs/reference/`, `docs/releases/`, and `scripts/check-docs-guard.mjs` fails CI on any other tracked `docs/` file except `docs/DESIGN.md` (repo policy: "loose plans and notes stay untracked"). Never `git add -f` anything under `docs/ui-redesign/`. NOTES.md and the screenshots live only in your local clone; the final PR body carries their summary (C18). If several agents work in different clones, the orchestrator must copy NOTES.md between them, or each agent appends its card's notes to its PR description instead.
7. **Stop after 3 failed attempts on the same error.** Write what you tried in NOTES.md, mark the card blocked, and move to an independent card.
8. **No daemon changes.** Nothing under `packages/daemon`, `packages/cli`, `packages/tui` changes. No `/api/*` contract changes. The UI only re-presents data the hooks in `packages/ui/src/hooks/` already fetch.
9. **No URL changes.** Every route path in `packages/ui/src/routes.tsx` keeps working exactly as today. You change labels, layout and styling, not paths.
10. **Keep these `data-testid`s stable** (dozens of tests depend on them): `app-rail`, `rail-dashboard`, `rail-topology`, `rail-for-you`, `rail-project`, `rail-specs`, `rail-settings`, `rail-advisor`, `rail-operator`, `app-topbar`, `explorer`, `content-area`, `mobile-rail-tray`, `settings-explorer`, `explorer-edge-toggle`. New elements get new testids named in this file.
11. **Do not copy Paperclip source.** Paperclip is MIT-licensed, so copying is legal with attribution, but it is written for Tailwind 4 and react-router 7 and will not drop in. Read it for layout and behavior only. If you ever paste more than 10 lines from it, add `// Adapted from paperclipai/paperclip (MIT), <path>` above the block and add an entry to the repo `NOTICE` file (create it if missing) with Paperclip's copyright line `Copyright (c) 2025 Paperclip AI`.
12. **Before every card**, re-read section 7 (Gotchas).
13. **Path convention.** Paths in this brief that start with `src/`, `test/`, `twin/`, `tailwind.config.ts` or `vite.config.ts` are relative to `packages/ui/` (so `src/lib/nav.ts` means `packages/ui/src/lib/nav.ts`). Bare `components/…`, `hooks/…` and `lib/…` mean `packages/ui/src/components/…`, `packages/ui/src/hooks/…`, `packages/ui/src/lib/…`. Paths that start with `packages/`, `docs/`, `scripts/` or `.hermes/` are relative to the repo root. Commands run from `packages/ui` unless the step says "repo root" or shows `cd`.
14. After every card run, in `packages/ui`: `npx tsc --noEmit -p tsconfig.json` (must print nothing and exit 0) and `npx vitest run` (must end with `Test Files  N passed (N)` and **0 failed**). The test count may go *up*, never down, except where a card says otherwise.

---

## 3. Paths and setup

Paths below are relative to the repo root (`openrig/`). Use your own clone location; nothing in this brief depends on an absolute path.

### 3.1 Toolchain

```bash
node --version   # must be v22.x or v24.x   (verified with v22.23.4)
npm --version    # must be >= 10           (verified with 10.9.9)
```

### 3.2 First-time setup

```bash
git clone https://github.com/Heretek-AI/openrig.git && cd openrig
git checkout main && git pull
npm ci
npm run build -w packages/daemon      # the UI typecheck imports daemon types; build it once
```

Reference clone of Paperclip (read-only, git-ignored):

```bash
mkdir -p .scratch && echo ".scratch/" >> .git/info/exclude
git clone --depth 1 https://github.com/Heretek-AI/paperclip.git .scratch/paperclip
```

### 3.3 What to look at in Paperclip (reference only)

| Paperclip file | What to take from it |
|---|---|
| `ui/src/components/Sidebar.tsx`, `SidebarNavItem.tsx`, `SidebarSection.tsx` | Sidebar structure: primary action button at top, search, ungrouped top items, collapsible labeled sections, counts/badges on the right of an item. |
| `ui/src/components/BreadcrumbBar.tsx` | Breadcrumb bar in the page header ("Tasks > Onboarding v4: …"). |
| `ui/src/components/CommandPalette.tsx` | ⌘K palette with grouped results (pages, entities, actions). Uses `cmdk`. |
| `ui/src/components/PropertiesPanel.tsx`, `IssueProperties.tsx` | Right-hand "Properties" panel: label column + value column, links with ↗. |
| `ui/src/components/StatusBadge.tsx`, `ui/src/lib/status-colors.ts` | One status vocabulary used identically everywhere, sentence-case labels. |
| `ui/src/components/EmptyState.tsx` | Icon + title + one sentence + one primary action. |
| `ui/src/pages/Dashboard.tsx` | Dashboard: active agent cards row, 4 metric tiles, recent activity. |
| `ui/src/pages/Inbox.tsx` | Inbox list with tabs and unread count. |
| `ui/src/components/MobileBottomNav.tsx` | Opaque bottom nav on mobile. |
| `DESIGN.md` (repo root) | The principles in section 4.1 below are adapted from it. |

Screenshots of Paperclip are in `.scratch/paperclip/screenshots/` (`PR-8000-home-flag-off.png` is the dashboard, `PR-8000-task-thread-flag-off.png` is a detail page with Properties panel).

### 3.4 Where things live in OpenRig today

| Path | What it is |
|---|---|
| `packages/ui/src/routes.tsx` | All routes (TanStack Router, code-based). Root route wraps everything in `AppShell`. |
| `packages/ui/src/components/AppShell.tsx` | Top bar + `Rail` (48px icon rail, `function Rail` at ~line 248) + `Explorer` + `<main data-testid="content-area">` + drawer + `MobileBottomNav` (~line 681). |
| `packages/ui/src/components/Explorer.tsx` | Per-destination tree sidebar (topology tree, library tree, settings list…). Absolutely positioned at `lg:left-12` (= the 48px rail). |
| `packages/ui/src/globals.css` | Design tokens (`:root`, `.dark`) and the Vellum decorations (`.vellum`, `.hard-shadow`, `.reg-*`, body dot-grid). |
| `packages/ui/tailwind.config.ts` | Maps tokens to Tailwind colors; **forces every border radius to 0px**. |
| `packages/ui/src/components/ui/` | Primitives: `button.tsx`, `empty-state.tsx`, `section-header.tsx`, `status-pip.tsx`, `vellum-card.tsx`, `tabs.tsx`, `dialog.tsx`, `tooltip.tsx`, … |
| `packages/ui/src/hooks/` | Data hooks (React Query). Reuse them. Never call `fetch` from a component. |
| `packages/ui/twin/` | "Digital twin": builds the real UI with fixture data into one HTML file. Your visual check tool (section 4.4). |
| `packages/ui/test/` | 202 vitest files (jsdom). `test/setup.ts` is the shared setup. `test/helpers/test-router.tsx` exports `createAppTestRouter`. |
| `docs/DESIGN.md` | The current (Vellum) design doc. C17 rewrites it. |

### 3.5 License

OpenRig is Apache-2.0. Paperclip is MIT. See rule 11.

---

## 4. Verified facts

### 4.1 Design principles for the new UI (decided; do not re-litigate)

1. **The screen answers, in order: what is happening, does it need me, what do I do.** Put "needs you" items above everything else on Dashboard and Inbox.
2. **Plain words, sentence case.** Labels and headings are sentence case ("Needs you", not "NEEDS YOU"). No `uppercase` + `tracking-widest` on anything a human reads as prose. Uppercase is allowed only for tiny section labels in the sidebar (`text-xs font-medium text-on-surface-variant`, *not* uppercase is preferred; see C05).
3. **Machine values look machine-made.** IDs, session names (`coordinator@acme-build`), token counts, timestamps, commands: `font-mono`. Everything else: the body font (Inter).
4. **One status vocabulary.** Every state renders through `StatusBadge` / `StatusDot` (C04) with the same tone and label everywhere.
5. **Hierarchy through structure, not decoration.** No paper grid, no registration marks, no hard offset shadows, no translucent blur sheets. Cards: `rounded-lg border bg-surface-lowest` and at most `shadow-sm`.
6. **Every empty state says what to do first** and offers one button that does it.
7. **Show local action results in place; toast only for actions** (start, stop, snapshot, restore, import, approve). Never toast state that is already visible on the current screen.
8. **Everything reachable in two clicks from the sidebar, or one ⌘K.**

### 4.2 Names (copy only; URLs do not change)

| Today (label) | New label | URL (unchanged) | Sidebar testid |
|---|---|---|---|
| Dashboard | Dashboard | `/` | `rail-dashboard` |
| For You | Inbox | `/for-you` | `rail-for-you` |
| Topology | Rigs | `/topology` | `rail-topology` |
| (zoom-only) | Agents | `/agents` | `rail-agents` (new) |
| (zoom-only) | Fleet | `/fleet` | `rail-fleet` (new) |
| Project | Projects | `/project` | `rail-project` |
| (zoom-only) | Workflows | `/workflows` | `rail-workflows` (new) |
| (no nav) | Files | `/files` | `rail-files` (new) |
| Library | Library | `/specs` | `rail-specs` |
| Settings | Settings | `/settings` | `rail-settings` |
| Advisor | Advisor | (resolved, see `resolveChatTo`) | `rail-advisor` |
| Operator | Operator | (resolved) | `rail-operator` |

In **new or rewritten** UI copy, say "agent" where the old copy said "seat", and "rig" stays "rig". Do not sweep the whole codebase for "seat": only components you touch in a card.

Decision log for the names: `/agents`, `/fleet`, `/workflows` were deliberately left out of the old rail ("zoom-addressed, not nav chrome"). This redesign reverses that because discoverability is the main complaint. The route comments in `routes.tsx` that say "deliberately NOT added to any nav rail" must be updated in C06 to say they are now in the sidebar.

### 4.3 Stack facts (checked at `eb6c158`)

| Claim | Verdict | Evidence |
|---|---|---|
| UI uses Tailwind 3.4, config file `tailwind.config.ts` | true | `packages/ui/package.json`: `"tailwindcss": "^3.4.19"` |
| UI uses TanStack Router, code-based routes | true | `packages/ui/src/routes.tsx` (`createRoute`, `createRouter`) |
| React 19 | true | `"react": "^19.0.0"` |
| Radix in use: dialog, separator, slot, tabs, tooltip | true | `packages/ui/package.json` |
| `cmdk`, `sonner`, Radix dropdown/popover/collapsible are **not** installed | true | not in `packages/ui/package.json` |
| `cmdk@1.1.1` peer-supports React 19 | true | `npm view cmdk@1.1.1 peerDependencies` → `"react": "^18 \|\| ^19 \|\| ^19.0.0-rc"` |
| `sonner@2.0.8` peer-supports React 19 | true | `npm view sonner@2.0.8 peerDependencies` |
| Baseline UI tests: 202 files, 1787 passed, 1 skipped | true | `cd packages/ui && npx vitest run` → `Test Files  202 passed (202)` / `Tests  1787 passed \| 1 skipped (1788)` (≈90 s) |
| `npm run build` in `packages/ui` succeeds | true | `✓ built in 10.00s` (a chunk-size warning is normal) |
| The UI is in "maintenance mode" per project docs | true | `docs/reference/developing.md` "Wording rule": *experimental, maintenance mode, best-effort; the CLI is primary; PRs are welcome*. Keep `UiMaintenanceNotice` in `App.tsx` and its test `test/ui-maintenance-notice.test.tsx` untouched. |
| Vite dev server proxies `/api` and `/healthz` to `OPENRIG_URL` (default `http://localhost:7433`) | true | `packages/ui/vite.config.ts` |

### 4.4 The twin (your visual check), exact commands

```bash
cd packages/ui
TWIN_ROUTE=/ npm run twin:build                 # writes twin-out/intent.html (≈3.7 MB, single file)
```

* Twin fixture rig ids are **`rig_alpha`**, **`rig_bravo`**, **`rig_gamma`** (names `acme-build`, `acme-comms`, `acme-core`). Agent example: rig `rig_alpha`, logical id `lead.coordinator`.
* Routes that render meaningful fixture data: `/`, `/topology/rig/rig_alpha`, `/for-you`, `/project`, `/specs`.
* Known fixture gaps (not your bug; do not "fix" by changing components): the dashboard shows `host registry unreadable: HTTP 404`; `/rigs/<id>/nodes/<id>` and `/topology/seat/...` show `HTTP 404`; topology shows `RESOLVING SELECTED HOST…`. You may add fixtures in `twin/fixtures.ts` + `twin/fetch-stub.ts` to fill these, following `twin/README.md` ("Adding a new surface").
* `twin-out/` is git-ignored. Never commit it.
* `twin:build` runs `tsc -p tsconfig.twin.json` first, so a type error anywhere fails it.

Screenshot + layout check use Playwright (added as a dev dependency in C01):

```bash
cd packages/ui
npx playwright install chromium        # once per machine
node twin/capture/shot.cjs twin-out/intent.html /tmp/out.png 1440
node twin/capture/layout-check.cjs twin-out/intent.html 1440
```

Both scripts are given verbatim in C01. Verified output of `layout-check.cjs` on today's UI:

```
/specs:                     {"width":1440,"mode":"opaque","rail":{"left":0,"right":48,"width":48},"explorer":{"left":48,"right":336,"width":288},"content":{"left":384,"right":1440,"width":1056},"errors":[]}
/topology/rig/rig_alpha:    {"width":1440,"mode":"overlay", ... "errors":[]}
/:                          {"width":1440,"mode":"opaque","rail":{"left":0,"right":48,"width":48},"explorer":null,"content":{"left":96,"right":1440,"width":1344},"errors":[]}
```

### 4.5 New dependencies: verified behavior under the test runner

Install (C01):

```bash
npm i -w packages/ui cmdk@1.1.1 sonner@2.0.8 @radix-ui/react-dropdown-menu@2.2.1 @radix-ui/react-popover@1.3.1 @radix-ui/react-collapsible@1.2.1
npm i -w packages/ui -D playwright@1.63.0
```

**Surprise 1: `cmdk` crashes in jsdom** with `TypeError: e.scrollIntoView is not a function` as soon as you type in `Command.Input`. Fix: polyfill in `test/setup.ts` (C01 gives the lines).

**Surprise 2: Radix `DropdownMenu` does not open from `fireEvent.click` or a bare `fireEvent.pointerDown` in jsdom.** Open it in tests with `fireEvent.keyDown(trigger, { key: "Enter" })`, after adding the `hasPointerCapture` / `releasePointerCapture` polyfills. Verified: with the polyfills plus `keyDown Enter`, `screen.queryByText("<item>")` finds the menu item.

**Surprise 3: `sonner` toasts render in jsdom** without polyfills: `render(<Toaster />)`, then inside `act(async () => { toast.success("Saved"); await new Promise(r => setTimeout(r, 50)); })`, then `await screen.findByText("Saved")` passes.

`package-lock.json` grows by roughly 1,400 lines (nested `@radix-ui/*` copies under the new packages). That is expected; commit it.

### 4.6 Tests that pin the OLD design (and their replacements)

Verified by applying the C02 theme change and running the full suite: **exactly 3 tests fail**, all in two files. Nothing else breaks from the token change.

```
FAIL test/design-compliance.test.tsx > Design System Compliance > no non-zero border-radius in any component
FAIL test/tailwind-foundation.test.tsx > Tailwind Foundation > ALL borderRadius tokens are 0px
FAIL test/tailwind-foundation.test.tsx > Tailwind Foundation > design tokens are present on :root via globals.css
```

C02 gives the replacement test code verbatim. Later cards (C06 sidebar) will break assertions in `test/app-shell.test.tsx`; C06 lists those and their replacements.

### 4.7 Layout coupling (the trap in the shell)

The 48px rail width is hard-coded in three places. If you change the sidebar width without changing all three, the Explorer overlaps the sidebar or leaves a gap:

1. `packages/ui/src/components/AppShell.tsx` ~line 470: `explorerAnchorLeft = ... ? "21rem" : "3rem"` (21rem = 3rem rail + 18rem explorer).
2. Same file: `workspaceLeftOffset` uses `explorerAnchorLeft`.
3. `packages/ui/src/components/Explorer.tsx` ~line 370: `"lg:absolute lg:top-0 lg:bottom-0 lg:left-12 lg:w-72 ..."` (`left-12` = 3rem).

C06 replaces all three with a CSS variable `--sidebar-current-width`.

The SC-1 test counts visible `nav` and `aside` elements on desktop and expects **exactly 2** (rail + explorer). The new sidebar is one `<nav data-testid="app-rail">`; do **not** nest another `<nav>` or `<aside>` inside it (use `<div role="group" aria-label="…">` for sections).

### 4.8 Data available to the new pages (hooks to reuse)

```ts
// hooks/useRigSummary.ts
export interface RigSummary {
  id: string; name: string; nodeCount: number; hasServices?: boolean;
  latestSnapshotAt: string | null; latestSnapshotId: string | null;
  lifecycleState?: "running" | "recoverable" | "stopped" | "degraded" | "attention_required";
}
export function useRigSummary(): UseQueryResult<RigSummary[]>;      // GET /api/rigs/summary

// hooks/usePsEntries.ts
export interface PsEntry {
  rigId: string; name: string; nodeCount: number; runningCount: number;
  activeCount?: number;      // terminal-active agents (use this for "Active")
  hasWorkCount?: number;     // agents with pending queue items
  status: "running" | "partial" | "stopped";
  lifecycleState?: "running" | "recoverable" | "stopped" | "degraded" | "attention_required";
  uptime: string | null; latestSnapshot: string | null;
}
export function usePsEntries(): UseQueryResult<PsEntry[]>;          // GET /api/ps

// hooks/useAttentionItems.ts
export interface AttentionQueueItem {
  qitemId: string; tsCreated: string; tsUpdated: string;
  sourceSession: string; destinationSession: string;
  state: string; priority: string; tier: string | null; tags: string[] | null;
  blockedOn: string | null; handedOffTo: string | null; handedOffFrom: string | null;
  body: string; summary?: string | null; evidenceRef?: string | null; hostId?: string;
}
export interface AttentionData { items: AttentionQueueItem[]; hosts: AttentionHostStatus[] }
export function useAttentionItems(limit?: number /* 50 */, aggregated?: boolean /* false */): UseQueryResult<AttentionData>;

// hooks/useNodeInventory.ts  (per rig)
export interface NodeInventoryEntry {
  rigId: string; rigName: string; logicalId: string; podId: string | null; podNamespace?: string | null;
  canonicalSessionName: string | null; nodeKind: "agent" | "infrastructure"; runtime: string | null;
  sessionStatus: string | null; startupStatus: "pending" | "ready" | "attention_required" | "failed" | null;
  restoreOutcome: string; tmuxAttachCommand: string | null; resumeCommand: string | null; latestError: string | null;
  contextUsage?: { usedPercentage: number | null; /* … */ fresh: boolean };
  agentActivity?: AgentActivitySummary | null; terminalActive?: boolean | null;
  hasAssignedWork?: boolean; pendingWorkCount?: number; /* … */
}
export function useNodeInventory(rigId: string | null): UseQueryResult<NodeInventoryEntry[]>;

// hooks/useNodeDetail.ts
export function useNodeDetail(rigId: string | null, logicalId: string | null); // returns NodeDetailData

// hooks/useActivityFeed.ts
export interface ActivityEvent { seq: number; type: string; payload: Record<string, unknown>; createdAt: string; receivedAt: number }
export function useActivityFeed(): { events: ActivityEvent[]; /* … */ };

// hooks/useDaemonHealth.ts
export function useDaemonHealthSignal(): DaemonHealthSignal;      // context; already provided by DaemonHealthProvider

// hooks/mutations.ts (rig actions — wire toasts to these in C09)
useCreateSnapshot(rigId), useRestoreSnapshot(rigId), useTeardownRig(rigId), useStartRig(rigId), useLaunchRig(rigId), useImportRig(), useExpandRig()

// lib/feed-classifier.ts / lib/attention-feed.ts (Inbox logic — reuse, do not rewrite)
export type FeedCardKind = "action-required" | "approval" | "shipped" | "progress" | "observation";
export function classifyFeed(events: ActivityEvent[]): FeedCard[];
export function sortFeedByDecisionBand(cards: FeedCard[]): FeedCard[];
export function mergeAttentionIntoFeed(/* … */);

// components/mission-control/components/VerbActions.tsx — the approve/deny/route/hold/drop buttons
export interface VerbActionsProps { qitemId: string; actorSession: string; bare?: boolean; hostId?: string;
  enabledVerbs?: MissionControlVerb[]; oneClickVerbs?: Array<"approve">; onSettled?: () => void; /* … */ }

// Other helpers
lib/utils.ts:          export function cn(...inputs: ClassValue[]): string
lib/copy-text.ts:      export async function copyText(text: string): Promise<boolean>
lib/session-name.ts:   export function parseSessionName(raw: string): ParsedSessionName; export function sessionMemberLabel(session: string): string
lib/display-name.ts:   export function displayAgentName(logicalId): string; export function displayPodName(podId): string
lib/theme.ts:          export type ThemeId = "light" | "dark" | "system"; THEME_STORAGE_KEY = "openrig.theme"
components/HostIndicator.tsx, components/ThemeSelector.tsx — reuse in the top bar
```

There is **no** single "all agents across all rigs" endpoint. To list agents across rigs, call `usePsEntries()` for the rig list and `useQueries` over `/api/rigs/:rigId/nodes` (copy the fetch from `useNodeInventory.ts`, including `withHostParam`). C10 gives the exact hook.

### 4.9 Not verified, be careful

Check these early (in the card that first needs them) and record the answer in NOTES.md:

1. Whether `Explorer` on `/settings` still needs to exist once Settings gets in-page tabs. This brief keeps it (C14d) to avoid churn.
2. The exact assertions in `test/app-shell.test.tsx`, `test/p5-mobile-polish.test.tsx`, `test/slice-20-mobile-density.test.tsx`, `test/explorer-mobile-zindex-layering.test.tsx` that break in C06. The brief predicts them (C06), but run the suite and log the actual list.
3. Whether any component outside `components/ui/` hard-codes `#2e342e` / `rgba(46,52,46,…)` shadows that look wrong in the new theme (19 files contain 6-digit hex; `components/graphics/RuntimeMark.tsx` has 94 of them and **is brand logos: leave it alone**).
4. Real-daemon behavior. Everything here was checked against the twin and unit tests, not a live daemon. In C18, run against a real daemon (`npm run dev -w packages/ui` with `openrig` daemon on :7433) if one is available, and note what you saw.

---

## 5. Target layout (new and changed files)

```
packages/ui/
  package.json                                  # + cmdk, sonner, 3 radix pkgs, devDep playwright (C01)
  tailwind.config.ts                            # radius from --radius; `brand` color (C02)
  src/
    globals.css                                 # + CLEAN THEME block appended LAST (C02)
    lib/
      nav.ts                                    # NAV_SECTIONS: single source for sidebar, palette, mobile nav (C05)
      chat-targets.ts                           # resolveChatTo + readSettingString moved out of AppShell (C05)
      status-vocabulary.ts                      # raw state -> { tone, label } (C04)
      breadcrumbs.ts                            # pathname (+ names) -> Crumb[] (C07)
      notify.ts                                 # toast wrapper: notifySuccess/notifyError (C09)
      sidebar-mode.ts                           # "auto" | "expanded" | "collapsed" persisted in localStorage (C06)
    hooks/
      useAllAgents.ts                           # agents across all rigs (C10)
    components/
      ui/
        button.tsx                              # restyled variants, same API (C03)
        empty-state.tsx                         # restyled, same API + optional `title` (C03)
        section-header.tsx                      # restyled (C03)
        vellum-card.tsx                         # restyled to plain card, same API (C03)
        status-badge.tsx                        # StatusBadge + StatusDot (C04)
        page-header.tsx                         # title, description, breadcrumbs, actions (C03)
        metric-tile.tsx                         # big number + label + sublabel + icon (C03)
        dropdown-menu.tsx                       # thin Radix wrappers (C03)
        kbd.tsx                                 # <kbd> chip (C03)
        skeleton.tsx                            # loading placeholder (C03)
      shell/
        Sidebar.tsx                             # replaces Rail (C06)
        SidebarNavItem.tsx                      # (C06)
        SidebarSection.tsx                      # collapsible labeled group (C06)
        SidebarRigList.tsx                      # live rig list with status dots (C06)
        TopBar.tsx                              # breadcrumbs + search button + host + theme (C07)
        CommandPalette.tsx                      # ⌘K (C08)
        MobileBottomNav.tsx                     # moved out of AppShell + restyled (C16)
      AppShell.tsx                              # uses Sidebar/TopBar/CommandPalette/Toaster (C06–C09)
      Explorer.tsx                              # left offset from CSS var (C06)
      dashboard/Dashboard.tsx                   # rebuilt (C10)
      dashboard/GettingStarted.tsx              # first-run checklist (C15)
      for-you/Feed.tsx, FeedCard.tsx            # restyled to inbox list (C11)
      topology/ScopePages.tsx                   # page headers, rig actions menu (C12)
      LiveNodeDetails.tsx                       # + AgentPropertiesPanel (C13)
      AgentPropertiesPanel.tsx                  # (C13)
  test/
    setup.ts                                    # + jsdom polyfills (C01)
    ui-primitives-deps.test.tsx                 # proves cmdk/sonner/radix work (C01)
    status-vocabulary.test.ts                   # (C04)
    nav.test.ts                                 # (C05)
    sidebar.test.tsx                            # (C06)
    breadcrumbs.test.ts                         # (C07)
    command-palette.test.tsx                    # (C08)
    notify.test.tsx                             # (C09)
    dashboard-v2.test.tsx                       # (C10)
    use-all-agents.test.tsx                     # (C10)
    inbox-v2.test.tsx                           # (C11)
    agent-properties-panel.test.tsx             # (C13)
    getting-started.test.tsx                    # (C15)
  twin/capture/
    shot.cjs                                    # screenshot helper (C01)
    layout-check.cjs                            # sidebar/explorer/content geometry check (C01)
docs/
  DESIGN.md                                     # rewritten for the Clean theme (C17)
  ui-redesign/
    NOTES.md                                    # your discovery log (C00)
    screenshots/before/*.png, after/*.png       # (C00, C18)
  # NOTE: everything under docs/ui-redesign/ is git-ignored by repo policy; never commit it.
```

---

## 6. Cards (milestones)

### Card index (for the kanban board)

| Card | Title | Depends on | Can run in parallel with |
|---|---|---|---|
| C00 | Baseline, branch, notes, before-screenshots | none | none |
| C01 | Dependencies, test polyfills, capture scripts | C00 | none |
| C02 | Clean theme tokens + replace the 3 radius/token tests | C01 | C05 |
| C03 | Restyle primitives + new primitives | C02 | C04, C05 |
| C04 | Status vocabulary + StatusBadge | C01, C02 | C03, C05 |
| C05 | Nav model + chat-target helpers | C01 | C02, C03, C04 |
| C06 | Sidebar shell (replaces rail) | C03, C04, C05 | none |
| C07 | Top bar + breadcrumbs | C06 | C08, C09 |
| C08 | Command palette (⌘K) | C06 | C07, C09 |
| C09 | Toasts for rig actions | C06 | C07, C08 |
| C10 | Dashboard v2 + useAllAgents | C07 | C11, C12, C13, C14a–e |
| C11 | Inbox v2 (restyle For You) | C07 | C10, C12, C13, C14a–e |
| C12 | Rigs pages: header, actions menu | C07, C09 | C10, C11, C13, C14a–e |
| C13 | Agent page Properties panel | C07 | C10, C11, C12, C14a–e |
| C14a | Sweep: Projects pages | C07 | other C1x |
| C14b | Sweep: Library pages | C07 | other C1x |
| C14c | Sweep: Workflows + Fleet + Agents pages | C07 | other C1x |
| C14d | Sweep: Settings pages | C07 | other C1x |
| C14e | Sweep: Files, Import, Packages, Bundles, Bootstrap | C07 | other C1x |
| C15 | First-run "Getting started" | C10 | C16 |
| C16 | Mobile bottom nav | C06 | C15 |
| C17 | DESIGN.md rewrite | C10–C16 | none |
| C18 | Final audit, after-screenshots, PR to main | all | none |

---

### C00: Baseline, branch, notes, before-screenshots

**Do:**
1. `git checkout main && git pull && git checkout -b ui-redesign && git push -u origin ui-redesign`.
2. `npm ci && npm run build -w packages/daemon`.
3. Run the baseline: `cd packages/ui && npx vitest run 2>&1 | tail -5`. Record the two summary lines in NOTES.md.
4. Create `docs/ui-redesign/NOTES.md` with this header:
   ```markdown
   # UI redesign notes
   Discoveries, discrepancies, and test-assertion changes, each with evidence.

   ## Baseline (C00)
   ```
5. Build the twin for each route and keep a copy (screenshots come in C01 once Playwright is installed):
   ```bash
   cd packages/ui && mkdir -p ../../.scratch/twin-before
   for r in / /topology/rig/rig_alpha /for-you /project /specs /settings; do
     n=$(echo "$r" | tr '/' '_'); TWIN_ROUTE="$r" npm run twin:build >/dev/null && cp twin-out/intent.html "../../.scratch/twin-before/$n.html"
   done
   ls ../../.scratch/twin-before
   ```

**Acceptance:**
- `vitest` summary shows `Test Files  202 passed (202)` and `Tests  1787 passed | 1 skipped (1788)` (or higher counts if `main` moved; record what you saw).
- `.scratch/twin-before/` contains 6 `.html` files (`_.html`, `_topology_rig_rig_alpha.html`, `_for-you.html`, `_project.html`, `_specs.html`, `_settings.html`).
- `docs/ui-redesign/NOTES.md` exists locally (untracked; `git status --short --ignored docs/ui-redesign` lists it with `!!`). Nothing to commit in this card except creating and pushing the branch.

---

### C01: Dependencies, test polyfills, capture scripts

**Do:**
1. Install exactly (from repo root):
   ```bash
   npm i -w packages/ui cmdk@1.1.1 sonner@2.0.8 @radix-ui/react-dropdown-menu@2.2.1 @radix-ui/react-popover@1.3.1 @radix-ui/react-collapsible@1.2.1
   npm i -w packages/ui -D playwright@1.63.0
   cd packages/ui && npx playwright install chromium
   ```
2. Append to `packages/ui/test/setup.ts` (at the end of the file):
   ```ts
   // ui-redesign C01: jsdom lacks these; cmdk calls scrollIntoView on the active
   // item, and Radix menus call the pointer-capture APIs.
   if (!Element.prototype.scrollIntoView) {
     Element.prototype.scrollIntoView = function scrollIntoView() {};
   }
   if (!Element.prototype.hasPointerCapture) {
     Element.prototype.hasPointerCapture = () => false;
   }
   if (!Element.prototype.releasePointerCapture) {
     Element.prototype.releasePointerCapture = () => {};
   }
   ```
3. Create `packages/ui/test/ui-primitives-deps.test.tsx`:
   ```tsx
   import { render, screen, fireEvent } from "@testing-library/react";
   import { describe, it, expect } from "vitest";
   import { act } from "react";
   import { Command } from "cmdk";
   import { Toaster, toast } from "sonner";
   import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

   describe("ui-redesign dependencies work under jsdom", () => {
     it("cmdk filters items as you type", () => {
       render(
         <Command label="Palette">
           <Command.Input placeholder="Search" />
           <Command.List>
             <Command.Empty>No results</Command.Empty>
             <Command.Item value="Rigs">Rigs</Command.Item>
             <Command.Item value="Inbox">Inbox</Command.Item>
           </Command.List>
         </Command>,
       );
       fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "inb" } });
       expect(screen.queryByText("Rigs")).toBeNull();
       expect(screen.getByText("Inbox")).toBeTruthy();
     });

     it("sonner renders a toast", async () => {
       render(<Toaster />);
       await act(async () => {
         toast.success("Saved");
         await new Promise((r) => setTimeout(r, 50));
       });
       expect(await screen.findByText("Saved")).toBeTruthy();
     });

     it("radix dropdown opens from the keyboard", () => {
       render(
         <DropdownMenu.Root>
           <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
           <DropdownMenu.Portal>
             <DropdownMenu.Content>
               <DropdownMenu.Item>Stop rig</DropdownMenu.Item>
             </DropdownMenu.Content>
           </DropdownMenu.Portal>
         </DropdownMenu.Root>,
       );
       fireEvent.keyDown(screen.getByText("Open"), { key: "Enter" });
       expect(screen.queryByText("Stop rig")).toBeTruthy();
     });
   });
   ```
4. Create `packages/ui/twin/capture/shot.cjs`:
   ```js
   // Usage: node twin/capture/shot.cjs <html-path> <png-path> [width=1440]
   const path = require("node:path");
   const { chromium } = require("playwright");
   (async () => {
     const [html, png, w] = process.argv.slice(2);
     const b = await chromium.launch();
     const p = await b.newPage({ viewport: { width: Number(w || 1440), height: 900 } });
     await p.goto("file://" + path.resolve(html));
     await p.waitForTimeout(3500);
     await p.screenshot({ path: png });
     await b.close();
     console.log("wrote " + png);
   })();
   ```
5. Create `packages/ui/twin/capture/layout-check.cjs`:
   ```js
   // Usage: node twin/capture/layout-check.cjs <html-path> [width=1440]
   // Prints JSON boxes for sidebar/explorer/content; exits 1 on overlap or gap.
   const path = require("node:path");
   const { chromium } = require("playwright");
   (async () => {
     const html = process.argv[2];
     const width = Number(process.argv[3] || 1440);
     const b = await chromium.launch();
     const p = await b.newPage({ viewport: { width, height: 900 } });
     await p.goto("file://" + path.resolve(html));
     await p.waitForTimeout(3000);
     const box = async (sel) => {
       const el = await p.$(sel);
       if (!el) return null;
       const bb = await el.boundingBox();
       return bb && bb.width > 0 ? { left: Math.round(bb.x), right: Math.round(bb.x + bb.width), width: Math.round(bb.width) } : null;
     };
     const rail = await box("[data-testid='app-rail']");
     const explorer = await box("[data-testid='explorer']");
     const content = await box("[data-testid='content-area'] > div");
     const mode = await p.getAttribute("[data-testid='content-area']", "data-explorer-mode").catch(() => null);
     const out = { width, mode, rail, explorer, content, errors: [] };
     if (!rail) out.errors.push("app-rail not visible");
     if (!content) out.errors.push("content-area not visible");
     if (rail && explorer && Math.abs(explorer.left - rail.right) > 1) out.errors.push(`explorer.left ${explorer.left} != rail.right ${rail.right}`);
     if (mode === "opaque" && explorer && content && content.left < explorer.right) out.errors.push(`content.left ${content.left} < explorer.right ${explorer.right}`);
     if (rail && content && content.left < rail.right) out.errors.push(`content.left ${content.left} < rail.right ${rail.right}`);
     console.log(JSON.stringify(out));
     await b.close();
     process.exit(out.errors.length ? 1 : 0);
   })();
   ```
6. Take the before-screenshots: for each file in `.scratch/twin-before/*.html`, run `node twin/capture/shot.cjs <file> ../../docs/ui-redesign/screenshots/before/<same-name>.png 1440`.

**Acceptance:**
- `npx vitest run test/ui-primitives-deps.test.tsx` → `Tests  3 passed (3)`.
- Full suite: 203 files passed, 0 failed.
- `node twin/capture/layout-check.cjs ../../.scratch/twin-before/_specs.html` prints JSON containing `"rail":{"left":0,"right":48,"width":48}` and `"errors":[]`, exit code 0.
- `docs/ui-redesign/screenshots/before/` has 6 PNGs (untracked, do not commit).
- Commit: `packages/ui/package.json`, `package-lock.json`, `packages/ui/test/setup.ts`, `packages/ui/test/ui-primitives-deps.test.tsx`, `packages/ui/twin/capture/shot.cjs`, `packages/ui/twin/capture/layout-check.cjs`.

---

### C02: Clean theme tokens + replace the 3 radius/token tests

**Do:**
1. Append this block **at the very end** of `packages/ui/src/globals.css` (after the last `.dark .react-flow__node-podGroup` rule). It keeps every token *name* and only changes *values*, so every existing Tailwind class keeps working:
   ```css

   /* =====================================================================
      CLEAN THEME (ui-redesign C02). Overrides the Vellum token VALUES while
      keeping every token NAME, so all existing Tailwind classes keep working.
      This block must stay LAST in globals.css so it wins the cascade.
      --secondary stays a NEUTRAL slate on purpose: many components use
      text-secondary for small labels. Links/focus use the new --brand.
      ===================================================================== */
   :root {
     --background: 0 0% 100%;
     --surface-container-lowest: 0 0% 100%;
     --surface-container-low: 240 5% 97%;
     --surface-container: 240 5% 95%;
     --surface-container-high: 240 5% 92%;
     --surface-container-highest: 240 4% 89%;
     --on-surface: 240 10% 10%;
     --on-surface-variant: 240 4% 42%;
     --secondary: 240 4% 46%;
     --secondary-container: 240 5% 94%;
     --brand: 221 83% 53%;
     --brand-foreground: 0 0% 100%;
     --tertiary: 0 72% 51%;
     --error: 0 72% 51%;
     --primary: 240 6% 10%;
     --inverse-surface: 240 6% 10%;
     --outline: 240 5% 65%;
     --outline-variant: 240 6% 88%;
     --success: 142 71% 36%;
     --warning: 38 92% 50%;
     --ring: var(--brand);
     --radius: 0.5rem;
     --shadow-card: 0 1px 2px 0 rgb(0 0 0 / 0.05);
     --sidebar-width: 15rem;
     --sidebar-width-collapsed: 3.5rem;
   }
   .dark {
     --background: 240 6% 6%;
     --surface-container-lowest: 240 6% 8%;
     --surface-container-low: 240 5% 10%;
     --surface-container: 240 5% 13%;
     --surface-container-high: 240 4% 16%;
     --surface-container-highest: 240 4% 20%;
     --on-surface: 0 0% 95%;
     --on-surface-variant: 240 5% 65%;
     --secondary: 240 5% 65%;
     --secondary-container: 240 4% 16%;
     --brand: 217 91% 60%;
     --brand-foreground: 0 0% 100%;
     --tertiary: 0 84% 60%;
     --error: 0 84% 60%;
     --primary: 0 0% 95%;
     --inverse-surface: 0 0% 95%;
     --outline: 240 4% 46%;
     --outline-variant: 240 4% 20%;
     --success: 142 69% 45%;
     --warning: 38 92% 55%;
     --shadow-card: 0 1px 2px 0 rgb(0 0 0 / 0.4);
   }
   * { border-color: hsl(var(--outline-variant)); }
   body, .dark body { background-image: none; }
   .vellum, .vellum-heavy, .dark .vellum, .dark .vellum-heavy {
     background: hsl(var(--surface-container-lowest));
     backdrop-filter: none;
     -webkit-backdrop-filter: none;
   }
   .hard-shadow, .hard-shadow-light, .dark .hard-shadow { box-shadow: var(--shadow-card); }
   .hard-shadow-hover:hover, .dark .hard-shadow-hover:hover { box-shadow: var(--shadow-card); translate: none; }
   .reg-tl, .reg-tr, .reg-bl, .reg-br, .reg-mark::before, .reg-mark::after { display: none; }
   ```
2. In `packages/ui/tailwind.config.ts`, replace the whole `borderRadius: { ... },` object (the one under `theme`, currently all `"0px"` except `full`) with exactly:
   ```ts
   borderRadius: {
     none: "0px",
     sm: "calc(var(--radius) - 4px)",
     DEFAULT: "calc(var(--radius) - 2px)",
     md: "calc(var(--radius) - 2px)",
     lg: "var(--radius)",
     xl: "calc(var(--radius) + 4px)",
     "2xl": "calc(var(--radius) + 8px)",
     "3xl": "calc(var(--radius) + 12px)",
     full: "9999px",
   },
   ```
   and add to `theme.extend.colors`:
   ```ts
   brand: { DEFAULT: "hsl(var(--brand))", foreground: "hsl(var(--brand-foreground))" },
   ring: "hsl(var(--ring))",
   ```
   (Verified: there is no `ring` key in `theme.extend.colors` today. Put both lines right after the existing `accent: "hsl(var(--secondary))",` line.)
3. Replace the 3 failing tests. In `test/tailwind-foundation.test.tsx`:
   - Replace the body of `it("design tokens are present on :root via globals.css", …)` with:
     ```tsx
     render(<div>probe</div>);
     const styles = getComputedStyle(document.documentElement);
     // Clean theme (ui-redesign C02) values; the CLEAN THEME block is last in globals.css.
     expect(styles.getPropertyValue("--background").trim()).toContain("0 0% 100%");
     expect(styles.getPropertyValue("--on-surface").trim()).toContain("240 10% 10%");
     expect(styles.getPropertyValue("--primary").trim()).toContain("240 6% 10%");
     expect(styles.getPropertyValue("--tertiary").trim()).toContain("0 72% 51%");
     expect(styles.getPropertyValue("--brand").trim()).toContain("221 83% 53%");
     ```
   - Rename `it("ALL borderRadius tokens are 0px", …)` to `it("borderRadius tokens derive from --radius (Clean theme)", …)` and make its body:
     ```tsx
     const config = readFileSync(resolve(__dirname, "../tailwind.config.ts"), "utf-8");
     const radiusMatch = config.match(/borderRadius:\s*\{([^}]+)\}/);
     expect(radiusMatch).not.toBeNull();
     // Matches bare keys (sm, DEFAULT) and quoted keys ("2xl", "3xl").
     const pairs = [...radiusMatch![1]!.matchAll(/"?(\w+)"?:\s*"([^"]+)"/g)];
     expect(pairs.map(([, k]) => k).sort()).toEqual(["2xl", "3xl", "DEFAULT", "full", "lg", "md", "none", "sm", "xl"]);
     for (const [, key, value] of pairs) {
       if (key === "full") expect(value).toBe("9999px");
       else if (key === "none") expect(value).toBe("0px");
       else expect(value).toContain("var(--radius)");
     }
     const css = readFileSync(resolve(__dirname, "../src/globals.css"), "utf-8");
     expect(css).toMatch(/--radius:\s*0\.5rem;/);
     ```
   - In `test/design-compliance.test.tsx`, in `it("no non-zero border-radius in any component", …)`: rename it to `it("border radius comes only from the --radius token scale", …)`. Replace the `const pairs = …matchAll(…)` line with the quoted-key-aware regex above (`/"?(\w+)"?:\s*"([^"]+)"/g`), and replace the **config loop** (the `for (const [, key, value] of pairs)` block that expects `"0px"`) with the same three-branch loop as above. **Keep** the second half that scans component sources for inline `borderRadius: <number>` and expects 0. Do not touch the other tests in that file.
4. Do **not** delete the Vellum `:root` / `.dark` blocks or the `.reg-*` / `.vellum` rules above. Other tests read those CSS sources (`test/registration-marks.test.tsx` asserts the `.reg-*` rules exist). The override block neutralizes them.

**Acceptance:**
- `npx vitest run test/tailwind-foundation.test.tsx test/design-compliance.test.tsx test/registration-marks.test.tsx` → all pass.
- Full suite: 0 failed; test count unchanged from C01.
- `TWIN_ROUTE=/ npm run twin:build && node twin/capture/shot.cjs twin-out/intent.html /tmp/c02.png` → the top bar and rail are white and there is **no dot grid**. The dashboard's own beige, diagonally hatched panel stays: it comes from `components/dashboard/dashboard-fidelity.css` and goes away in C10. Pages still look "uppercase mono"; that is fixed card by card.
- `npx tsc --noEmit -p tsconfig.json` prints nothing (verified with this exact block applied: 203 test files passed, 1790 tests passed, tsc clean).
- In the same screenshot, small labels such as "HOSTS" are grey, **not blue**. (If they are blue, you set `--secondary` to the brand blue; see Gotcha 3.)

---

### C03: Restyle primitives + new primitives

Primitives are used widely (`ui/button` in 22 files, `ui/empty-state` in 22, `ui/section-header` in 19), so restyling them in place moves the whole app. **Keep every exported name, prop and variant key**, so call sites need no change.

**Do:**
1. `components/ui/button.tsx`: keep the `cva` keys (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `tactical`; sizes `default`, `sm`, `lg`, `icon`). New classes:
   ```ts
   base:        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
   default:     "bg-primary text-primary-foreground hover:bg-primary/90"
   destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
   outline:     "border border-outline-variant bg-background hover:bg-surface-low text-on-surface"
   secondary:   "bg-surface-mid text-on-surface hover:bg-surface-high"
   ghost:       "text-on-surface-variant hover:bg-surface-low hover:text-on-surface"
   link:        "text-brand underline-offset-4 hover:underline"
   tactical:    "border border-outline-variant bg-background text-xs text-on-surface-variant hover:bg-surface-low hover:text-on-surface"
   size.default "h-9 px-4", sm "h-8 px-3 text-xs", lg "h-10 px-6", icon "h-9 w-9"
   ```
   Note: `primary.foreground` is already `hsl(var(--background))` in tailwind config, which is correct in both themes.
2. `components/ui/empty-state.tsx`: keep `EmptyStateProps` and add optional `title?: string`. Render: centered column, `py-12`, icon in a `rounded-lg bg-surface-low p-3 text-on-surface-variant` box, then `title` as `text-sm font-semibold text-on-surface` (fallback to `label`), then `description` as `text-sm text-on-surface-variant max-w-md`, then the action as a `Button` (`size="sm"`): when `action.href` is set render `<Button asChild size="sm"><a href={action.href}>{action.label}</a></Button>` (keeps today's link navigation), otherwise `<Button size="sm" onClick={action.onClick}>`. Put `data-testid={testId ? testId + "-action" : undefined}` on the `<a>` or the `<button>`. Variant `card` wraps it in `rounded-lg border bg-surface-lowest`. Keep the `testId` and `${testId}-action` testids.
3. `components/ui/section-header.tsx` and `components/ui/vellum-card.tsx`: remove `uppercase`, `tracking-*`, `font-mono` from prose text, use `rounded-lg border bg-surface-lowest shadow-sm` for cards and `text-sm font-semibold` for headers. Keep props and testids. Read `test/section-header.test.tsx` and `test/slice-16-typography-vellum.test.tsx` first: they assert some classes. If one asserts `uppercase` or `font-mono` on a header, follow rule 4 (update that one assertion, log it).
4. New files (each exports exactly what is listed; all use `cn` from `@/lib/utils`):
   ```tsx
   // components/ui/page-header.tsx
   export interface PageHeaderProps {
     title: string;
     description?: React.ReactNode;
     actions?: React.ReactNode;     // right-aligned buttons
     meta?: React.ReactNode;        // a row under the title (badges, ids)
     testId?: string;               // default "page-header"
   }
   export function PageHeader(props: PageHeaderProps): React.JSX.Element;
   // Layout: <header data-testid> flex justify-between items-start gap-4 pb-6;
   // h1 "text-xl font-semibold text-on-surface"; description "mt-1 text-sm text-on-surface-variant".

   // components/ui/metric-tile.tsx
   export interface MetricTileProps {
     label: string; value: React.ReactNode; sublabel?: React.ReactNode;
     icon?: React.ComponentType<{ className?: string }>; to?: string; testId?: string;
   }
   export function MetricTile(props: MetricTileProps): React.JSX.Element;
   // value "text-3xl font-semibold tabular-nums"; label "text-sm font-medium"; sublabel "text-xs text-on-surface-variant".
   // If `to` is set, wrap in TanStack <Link to={to}> with hover:bg-surface-low.

   // components/ui/dropdown-menu.tsx  — re-export Radix with styled Content/Item:
   export const DropdownMenu = RadixDropdown.Root;
   export const DropdownMenuTrigger = RadixDropdown.Trigger;
   export function DropdownMenuContent(props: RadixDropdown.DropdownMenuContentProps): React.JSX.Element; // Portal + "z-50 min-w-[10rem] rounded-md border bg-popover p-1 shadow-md", sideOffset default 4
   export function DropdownMenuItem(props: RadixDropdown.DropdownMenuItemProps & { destructive?: boolean }): React.JSX.Element; // "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-low", destructive adds "text-destructive"
   export const DropdownMenuSeparator: React.FC; // "my-1 h-px bg-outline-variant"

   // components/ui/kbd.tsx
   export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element; // "rounded border bg-surface-low px-1.5 font-mono text-[11px] text-on-surface-variant"

   // components/ui/skeleton.tsx
   export function Skeleton({ className }: { className?: string }): React.JSX.Element; // "animate-pulse rounded-md bg-surface-mid"
   ```
5. Add one test file `test/ui-primitives-v2.test.tsx` with at least: PageHeader renders title/description/actions; MetricTile renders value and links when `to` is set (use `createAppTestRouter` from `test/helpers/test-router.tsx` for the Link case); DropdownMenu opens via `keyDown Enter` and a `destructive` item has class `text-destructive`.

**Acceptance:**
- `npx vitest run test/ui-primitives-v2.test.tsx` passes (≥5 tests).
- Full suite: 0 failed. Every assertion change is logged in NOTES.md with test name, old, new.
- `grep -n "uppercase" packages/ui/src/components/ui/button.tsx` prints nothing.

---

### C04: Status vocabulary + StatusBadge

**Do:**
1. Create `src/lib/status-vocabulary.ts`:
   ```ts
   export type StatusTone = "success" | "running" | "warning" | "danger" | "info" | "neutral";
   export interface StatusPresentation { tone: StatusTone; label: string }

   /** Map any raw OpenRig state string to one tone + one sentence-case label. */
   export function presentStatus(raw: string | null | undefined): StatusPresentation;
   ```
   Algorithm: lowercase and trim `raw`; if empty → `{ tone: "neutral", label: "Unknown" }`. Then look up this table (exact keys); if not found, tone `neutral` and label = raw with `_`/`-` replaced by spaces, first letter uppercased.
   ```ts
   export const TABLE: Record<string, StatusPresentation> = {
     running:            { tone: "running", label: "Running" },
     active:             { tone: "running", label: "Active" },
     ready:              { tone: "success", label: "Ready" },
     done:               { tone: "success", label: "Done" },
     shipped:            { tone: "success", label: "Shipped" },
     clean:              { tone: "success", label: "Healthy" },
     partial:            { tone: "warning", label: "Partly running" },
     degraded:           { tone: "warning", label: "Degraded" },
     recoverable:        { tone: "warning", label: "Recoverable" },
     pending:            { tone: "info",    label: "Starting" },
     draft:              { tone: "neutral", label: "Draft" },
     idle:               { tone: "neutral", label: "Idle" },
     stopped:            { tone: "neutral", label: "Stopped" },
     blocked:            { tone: "danger",  label: "Blocked" },
     failed:             { tone: "danger",  label: "Failed" },
     error:              { tone: "danger",  label: "Error" },
     attention_required: { tone: "danger",  label: "Needs attention" },
     "needs-input":      { tone: "danger",  label: "Needs input" },
     needs_input:        { tone: "danger",  label: "Needs input" },
     unknown:            { tone: "neutral", label: "Unknown" },
   };
   ```
   Also export `const TONE_CLASSES: Record<StatusTone, { dot: string; badge: string }>`:
   ```ts
   success: { dot: "bg-success", badge: "bg-success/10 text-success" },
   running: { dot: "bg-success animate-pulse", badge: "bg-success/10 text-success" },
   warning: { dot: "bg-warning", badge: "bg-warning/15 text-on-surface" },
   danger:  { dot: "bg-destructive", badge: "bg-destructive/10 text-destructive" },
   info:    { dot: "bg-brand", badge: "bg-brand/10 text-brand" },
   neutral: { dot: "bg-outline", badge: "bg-surface-mid text-on-surface-variant" },
   ```
   (Respect reduced motion: the `animate-pulse` is fine because Tailwind's `motion-safe:` is not required here; but add `motion-reduce:animate-none` to the running dot.)
2. Create `src/components/ui/status-badge.tsx`:
   ```tsx
   export function StatusBadge({ status, label, className, testId }: { status: string | null | undefined; label?: string; className?: string; testId?: string }): React.JSX.Element;
   // <span data-testid={testId} data-tone={tone} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {badge}"> <span dot h-1.5 w-1.5 rounded-full/> {label ?? presented.label}</span>
   export function StatusDot({ status, className, title }: { status: string | null | undefined; className?: string; title?: string }): React.JSX.Element;
   // <span role="img" aria-label={presented.label} title={title ?? presented.label} data-tone={tone} className="inline-block h-2 w-2 rounded-full {dot}"/>
   ```
3. `test/status-vocabulary.test.ts`: import `TABLE` and loop over `Object.entries(TABLE)` (do not copy the keys into the test), plus: `presentStatus(null)` → Unknown/neutral; `presentStatus("  RUNNING ")` → Running/running; `presentStatus("in_review")` → `{ tone: "neutral", label: "In review" }`. And a render test: `<StatusBadge status="attention_required" testId="b" />` has `data-tone="danger"` and text "Needs attention".
4. Do **not** replace `StatusPip` or `getStatusColorClass` usages in this card. Later cards use `StatusBadge` in the screens they touch.

**Acceptance:** `npx vitest run test/status-vocabulary.test.ts` passes with ≥23 tests; full suite 0 failed.

---

### C05: Nav model + chat-target helpers

**Do:**
1. Create `src/lib/chat-targets.ts` and **move** (not copy) `readSettingString` and `resolveChatTo` from `AppShell.tsx` into it, exported unchanged. Update `AppShell.tsx` to import them. Behavior must be byte-for-byte the same.
2. Create `src/lib/nav.ts`:
   ```ts
   import type { ComponentType } from "react";
   import { LayoutDashboard, Inbox, Network, Users, Globe, FolderKanban, Workflow, FileText, Library, Settings, Brain, Wrench } from "lucide-react";

   export interface NavItem {
     id: string;                 // stable id
     label: string;              // sentence case, shown in sidebar + palette
     to: string;                 // URL (unchanged routes)
     icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
     testId: string;             // data-testid on the sidebar link
     activeWhen: (pathname: string) => boolean;
     keywords?: string[];        // extra palette search terms (old names!)
   }
   export interface NavSection { id: string; label: string | null; items: NavItem[] }

   export const NAV_SECTIONS: NavSection[] = [
     { id: "top", label: null, items: [
       { id: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, testId: "rail-dashboard", activeWhen: (p) => p === "/", keywords: ["home"] },
       { id: "inbox", label: "Inbox", to: "/for-you", icon: Inbox, testId: "rail-for-you", activeWhen: (p) => p.startsWith("/for-you"), keywords: ["for you", "attention", "approvals", "needs you"] },
     ]},
     { id: "fleet", label: "Fleet", items: [
       { id: "rigs", label: "Rigs", to: "/topology", icon: Network, testId: "rail-topology", activeWhen: (p) => p.startsWith("/topology") || p.startsWith("/rigs/"), keywords: ["topology", "graph"] },
       { id: "agents", label: "Agents", to: "/agents", icon: Users, testId: "rail-agents", activeWhen: (p) => p === "/agents", keywords: ["seats"] },
       { id: "fleet", label: "Hosts", to: "/fleet", icon: Globe, testId: "rail-fleet", activeWhen: (p) => p.startsWith("/fleet"), keywords: ["fleet", "machines"] },
     ]},
     { id: "work", label: "Work", items: [
       { id: "projects", label: "Projects", to: "/project", icon: FolderKanban, testId: "rail-project", activeWhen: (p) => p.startsWith("/project"), keywords: ["missions", "slices", "workspace"] },
       { id: "workflows", label: "Workflows", to: "/workflows", icon: Workflow, testId: "rail-workflows", activeWhen: (p) => p.startsWith("/workflow"), keywords: [] },
       { id: "files", label: "Files", to: "/files", icon: FileText, testId: "rail-files", activeWhen: (p) => p.startsWith("/files"), keywords: [] },
     ]},
     { id: "build", label: "Build", items: [
       { id: "library", label: "Library", to: "/specs", icon: Library, testId: "rail-specs", activeWhen: (p) => p.startsWith("/specs") || p.startsWith("/plugins"), keywords: ["specs", "skills", "plugins", "context packs"] },
     ]},
   ];

   export const NAV_FOOTER: NavItem[] = [
     { id: "settings", label: "Settings", to: "/settings", icon: Settings, testId: "rail-settings", activeWhen: (p) => p.startsWith("/settings"), keywords: ["preferences", "policies", "log", "status"] },
   ];

   /** Advisor/Operator: `to` is resolved at render time with resolveChatTo(). */
   export const NAV_CHAT: Array<Omit<NavItem, "to" | "activeWhen"> & { role: "advisor" | "operator" }> = [
     { id: "advisor", role: "advisor", label: "Advisor", icon: Brain, testId: "rail-advisor" },
     { id: "operator", role: "operator", label: "Operator", icon: Wrench, testId: "rail-operator" },
   ];

   export function allNavItems(): NavItem[] { return [...NAV_SECTIONS.flatMap((s) => s.items), ...NAV_FOOTER]; }
   ```
   Note: the `/fleet` item's label is **"Hosts"** (it is the cross-host view; "Fleet" is the section). Before using an icon name, confirm it exists: `grep -c "export.*\bFolderKanban\b" node_modules/lucide-react/dist/lucide-react.d.ts` (repeat per icon). If one is missing, pick the nearest that exists and log it.
3. `test/nav.test.ts`: every `testId` unique; every `to` matches a route path in `routes.tsx` (read the file as text and check `path: "<to>"` appears); `allNavItems().map(i=>i.testId)` contains all of `rail-dashboard, rail-topology, rail-for-you, rail-project, rail-specs, rail-settings`; `activeWhen` truth table: `/topology/rig/x` → rigs only; `/rigs/x` → rigs; `/plugins/x` → library; `/` → dashboard only.

**Acceptance:** `npx vitest run test/nav.test.ts` passes; `npx vitest run test/app-shell.test.tsx` still passes (nothing visible changed yet); full suite 0 failed.

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

---

### C07: Top bar + breadcrumbs

**Do:**
1. `src/lib/breadcrumbs.ts`:
   ```ts
   export interface Crumb { label: string; to?: string }
   export interface CrumbNames { rigName?: (rigId: string) => string | undefined }
   export function breadcrumbsFor(pathname: string, names?: CrumbNames): Crumb[];
   ```
   Rules (first match wins; the last crumb never has `to`):
   | pathname | crumbs |
   |---|---|
   | `/` | `[Dashboard]` |
   | `/for-you` | `[Inbox]` |
   | `/topology` | `[Rigs]` |
   | `/topology/rig/:rigId` | `[Rigs→/topology, <rigName ?? rigId>]` |
   | `/topology/pod/:rigId/:pod` | `[Rigs→/topology, <rig>→/topology/rig/:rigId, <pod> pod]` |
   | `/topology/seat/:rigId/:logicalId` | `[Rigs→/topology, <rig>→/topology/rig/:rigId, <displayAgentName(logicalId)>]` |
   | `/rigs/:rigId` | same as `/topology/rig/:rigId` |
   | `/rigs/:rigId/nodes/:logicalId` | same as seat |
   | `/agents` | `[Agents]` ; `/fleet` → `[Hosts]` ; `/workflows` → `[Workflows]` ; `/workflow/instance/:id` → `[Workflows→/workflows, :id]` |
   | `/project` | `[Projects]` ; `/project/mission/:id` → `[Projects→/project, Mission :id]` ; `/project/slice/:id` → `[Projects→/project, Slice :id]` |
   | `/specs` | `[Library]` ; `/specs/skills` → `[Library→/specs, Skills]` ; `/specs/skills/:t` → `[Library, Skills→/specs/skills, :t]` ; `/specs/plugins` → `[Library→/specs, Plugins]` ; `/plugins/:id` → `[Library→/specs, Plugins→/specs/plugins, :id]` ; any other `/specs/...` → `[Library→/specs, <last segment>]` |
   | `/files` | `[Files]` |
   | `/settings` | `[Settings]` ; `/settings/policies` → `[Settings→/settings, Policies]` ; `/settings/log` → `[Settings→/settings, Log]` ; `/settings/status` → `[Settings→/settings, Status]` |
   | anything else | `[<last segment, decoded>]` |
   Decode every segment with `decodeURIComponent` inside try/catch.
2. `src/components/shell/TopBar.tsx`: replaces the contents of the existing `<header data-testid="app-topbar">` (keep that testid and the mobile hamburger button and its testid/behavior). Left: on mobile the hamburger, then on all sizes the breadcrumbs as `<div role="navigation" aria-label="Breadcrumb" data-testid="breadcrumbs">`. Do not use a `<nav>` element: it would be a third `nav` in the SC-1 count. `role="navigation"` on a `div` is fine, because that test queries the tag names `nav, aside` only. Crumbs separated by `ChevronRight h-3.5 w-3.5 text-on-surface-variant`; linked crumbs `text-on-surface-variant hover:text-on-surface`, last crumb `text-on-surface font-medium truncate`. Right: `HostIndicator`, then `ThemeSelector`. Height `h-12`, `border-b bg-background`. Brand: show a small "OpenRig" wordmark (`text-sm font-semibold`) at the far left **only on mobile**; on desktop, put the wordmark in the sidebar header row (C06 header) instead. Keep the brand link `to="/"` and whatever testid the existing brand link has (find it in AppShell; the app-shell test "brand link visible at desktop and links to /" must keep passing: if it requires the brand inside the top bar at desktop, keep a desktop brand in the top bar and log it).
3. Rig names for crumbs come from `useRigSummary()` (`names.rigName = (id) => data?.find(r => r.id === id)?.name`).
4. `test/breadcrumbs.test.ts`: one case per table row (≥20 cases, including `/settings/log` and `/settings/status`), plus a percent-encoded logical id (`/topology/seat/rig_alpha/lead%2Ecoordinator` decodes).

**Acceptance:** breadcrumbs test passes; app-shell test passes (log any changed assertion); full suite 0 failed; twin screenshot of `/topology/rig/rig_alpha` shows "Rigs › acme-build" in the top bar.

---

### C08: Command palette (⌘K)

**Do:**
1. `src/components/shell/CommandPalette.tsx` using `cmdk`'s `Command.Dialog` (it renders a Radix dialog; give it `label="Command palette"`, `data-testid="command-palette"` on the inner container). Open on: `keydown` with `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"` (call `preventDefault`), or the `openrig:open-palette` window event. Close on Escape (cmdk/radix default) and after selecting an item.
2. Groups, in this order:
   1. **Go to**: every `allNavItems()` entry. `value` = `label + " " + keywords.join(" ")` so old names still match ("topology" finds Rigs, "for you" finds Inbox).
   2. **Rigs**: every rig from `useRigSummary()` → `/topology/rig/$rigId`, with a `StatusDot`.
   3. **Actions**: "New rig" → `/specs/rig`; "Import a rig" → `/import`; "Bootstrap a host" → `/bootstrap`; "Toggle dark mode" → `const { resolved, setTheme } = useTheme()` from `components/ThemeProvider.tsx` (verified exports: `ThemeProvider`, `useTheme(): { theme: ThemeId; resolved: "light" | "dark"; themes; setTheme }`), then `setTheme(resolved === "dark" ? "light" : "dark")`; "Keyboard shortcuts" → opens a small dialog listing `⌘K` Search, `g d` Dashboard, `g i` Inbox, `g r` Rigs (only list what you implement; implement exactly these 4).
3. Navigate with `useNavigate()` from `@tanstack/react-router`.
4. Implement `g`-then-key shortcuts in the palette module: a `keydown` listener that ignores events whose target is an `input`, `textarea`, `select` or `[contenteditable]`; after `g`, the next key within 1000 ms: `d` → `/`, `i` → `/for-you`, `r` → `/topology`.
5. Mount `<CommandPalette />` once inside `AppShellInner`.
6. `test/command-palette.test.tsx`: (a) ⌘K opens (`fireEvent.keyDown(window, { key: "k", metaKey: true })`) and an input with placeholder "Search pages, rigs, actions…" appears; (b) typing "topology" shows "Rigs" in Go to; (c) pressing Enter on it navigates to `/topology` (assert via router state or the rendered stub route); (d) Escape closes; (e) `g` then `i` navigates to `/for-you`; (f) `g` then `i` while focus is in an `<input>` does nothing.

**Acceptance:** command-palette test passes (≥6 tests); full suite 0 failed.

---

### C09: Toasts for rig actions

**Do:**
1. Mount `<Toaster position="bottom-right" richColors={false} closeButton />` from `sonner` once in `AppShellInner`. Pass `theme={useTheme().resolved}` (sonner's `theme` prop accepts `'light' | 'dark' | 'system'`, verified in `node_modules/sonner/dist/index.d.ts`).
2. `src/lib/notify.ts`:
   ```ts
   import { toast } from "sonner";
   export function notifySuccess(title: string, description?: string): void { toast.success(title, { description }); }
   export function notifyError(title: string, error: unknown): void {
     const description = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
     toast.error(title, { description });
   }
   ```
3. In `hooks/mutations.ts`, for `useCreateSnapshot`, `useRestoreSnapshot`, `useTeardownRig`, `useStartRig`, `useLaunchRig`, `useImportRig`: add `onSuccess`/`onError` that call `notifySuccess`/`notifyError` **in addition to** existing callbacks (keep existing `onSuccess` bodies; call notify after them). Titles: "Snapshot saved", "Snapshot restored", "Rig stopped", "Rig started", "Rig launched", "Rig imported"; errors: "Couldn't save snapshot", "Couldn't restore snapshot", "Couldn't stop rig", "Couldn't start rig", "Couldn't launch rig", "Couldn't import rig".
4. Do **not** toast from queries, SSE events, or the For You `UndoToast` flow (leave `components/for-you/UndoToast.tsx` as is).
5. `test/notify.test.tsx`: `notifyError("X", new Error("boom"))` shows "X" and "boom"; and one mutation test (pick `useStartRig`, mock `fetch` to return `ok:false, status 500`) shows "Couldn't start rig".

**Acceptance:** notify test passes; full suite 0 failed (existing mutation tests may need a `<Toaster/>`-free render to still pass: toasts without a mounted Toaster are a no-op, which is fine).

---

### C10: Dashboard v2 + useAllAgents

**Do:**
1. `src/hooks/useAllAgents.ts`:
   ```ts
   export interface AgentRow extends NodeInventoryEntry {}
   export function useAllAgents(): { agents: AgentRow[]; isLoading: boolean; error: Error | null };
   ```
   Implementation: `const hostId = useSelectedHostId(); const ps = usePsEntries();` then `useQueries({ queries: (ps.data ?? []).map(r => ({ queryKey: ["rig", r.rigId, "nodes", hostId], queryFn: () => fetchNodeInventory(r.rigId, hostId), staleTime: 15_000 })) })`. **Reuse the same queryKey shape as `useNodeInventory`** (`["rig", rigId, "nodes", hostId]`) so the caches are shared and SSE invalidation (`useActivityFeed` invalidates `["rig", rigId, "nodes"]`) refreshes it. Get `hostId` first, exactly as `useNodeInventory` does: `const hostId = useSelectedHostId();` (from `hooks/useHosts.ts`). Export `fetchNodeInventory` from `useNodeInventory.ts` (add `export`, no other change). Filter to `nodeKind === "agent"`. `isLoading` = ps loading or any query loading; `error` = first error.
2. Rewrite `components/dashboard/Dashboard.tsx` body (keep the exported name `Dashboard` and keep any testids that existing tests assert: run `grep -l "Dashboard" test/*.tsx` and read them first; keep the kernel card component `KernelStatusCard` reachable, see 2.5). Layout, top to bottom, inside `mx-auto max-w-6xl px-6 py-6`:
   1. `PageHeader title="Dashboard" description="What's running, and what needs you."` with actions: `Button variant="outline"` "Import" → `/import`, `Button` "New rig" → `/specs/rig`.
   2. **Needs you** (`data-testid="dashboard-needs-you"`): top 5 of `(useAttentionItems(50, useFeedSubscriptions().anyRemoteEnabled).data?.items ?? [])` (same flag as the Inbox, so remote-host approvals show here too), each row: `StatusDot status="attention_required"`, title = `item.summary ?? first line of item.body`, mono `item.sourceSession`, relative time from `tsUpdated` ("5m ago"; write a tiny `relativeTime(iso)` in `lib/relative-time.ts` with tests), and the `VerbActions` component with `bare`, `qitemId`, `actorSession="human@host"`, `hostId={item.hostId}` (so a remote approval acts on its own host, as `FeedCard.tsx` does), `enabledVerbs={["approve"]}`, `oneClickVerbs={["approve"]}`. Footer link "Open inbox" → `/for-you`. Empty → `EmptyState title="You're all caught up" label="Nothing needs you" description="Approvals and questions from your agents show up here."`.
   3. **Metric tiles** (4-column grid on lg, 2 on sm): "Rigs running" = count of `ps` with `status !== "stopped"`, sublabel "`<n>` total", `to="/topology"`; "Active agents" = sum of `activeCount ?? 0`, sublabel "`<sum runningCount>` alive", `to="/agents"`; "Needs you" = attention count, sublabel "approvals and questions", `to="/for-you"`; "Daemon" = `const { query, signal } = useDaemonHealth()` (hooks/useDaemonHealth.ts; `signal` is `{ controlPlaneUnhealthy: boolean; evidence }`, `query` is the React Query result for `/healthz`) mapped exactly: `query.isError` → `StatusBadge status="error" label="Offline"`; else `signal.controlPlaneUnhealthy` → `status="degraded" label="Degraded"`; else `query.isSuccess` → `status="ready" label="Healthy"`; else → `status="unknown" label="Checking"`. Put this mapping in `lib/daemon-status.ts` as `export function daemonStatus(query, signal): { status: string; label: string }` so C15 reuses it. `to="/settings/status"`.
   4. **Rigs** (`data-testid="dashboard-rigs"`): a table (`components/ui/table.tsx`) of `ps` rows: name (link to `/topology/rig/$rigId`), `StatusBadge status={lifecycleState ?? status}`, agents `activeCount/nodeCount`, "has work" `hasWorkCount`, uptime (mono). Empty → `EmptyState title="No rigs yet" description="A rig is a team of agents defined by a spec. Create one from the Library or import an existing one." action={{ label: "New rig", href: "/specs/rig" }}`.
   5. **Recent activity** (`data-testid="dashboard-activity"`): last 10 events from `useActivityFeed().events`, each one line: relative time, event `type` humanized (`rig.started` → "Rig started"), and the rig/session if present in payload (`payload.rigId`, `payload.session` when string). If none → a one-line muted "No activity yet."
   6. Keep host/kernel controls: move the existing kernel card and host list into a collapsible "Host" section at the bottom (`@radix-ui/react-collapsible`, default closed, `data-testid="dashboard-host-section"`). Do not change their internals.
3. Delete the dashboard's vellum-only decorations from **this component** (destination cards with drawings, "WELCOME BACK, OPERATOR.", field-environment box). Do not delete the files under `components/dashboard/vellum/` in this card (labs still import them); just stop rendering them from `Dashboard.tsx`. If a test asserts they render on `/`, apply rule 4 and log.
4. Tests: `test/use-all-agents.test.tsx` (mock fetch for `/api/ps` and two `/api/rigs/:id/nodes`, expect merged agent rows, infrastructure filtered out) and `test/dashboard-v2.test.tsx` (sections render with seeded query data via a `QueryClient` you pre-fill with `setQueryData` using the exact keys from the hooks; empty states render with empty data). `test/relative-time.test.ts` (now→"just now", 5 min→"5m ago", 3 h→"3h ago", 2 d→"2d ago").

**Acceptance:** the three new test files pass; full suite 0 failed; twin screenshot of `/` shows Needs you, 4 tiles with numbers (twin fixtures: 3 rigs, Active agents 9 = 6+2+1), Rigs table with acme-build / acme-comms / acme-core.

---

### C11: Inbox v2 (restyle For You)

Keep all data logic in `components/for-you/Feed.tsx` (classification, merge, dismissal, undo, subscriptions). Change presentation only.

**Do:**
1. Page header: `PageHeader title="Inbox" description="Approvals, questions and updates from your agents."`.
2. Replace the "SHOW ME" black box (`LevelControl`) presentation with a row of tabs (`components/ui/tabs.tsx` or simple buttons with `role="tab"`): "Needs you", "Highlights", "Everything". Map them to the existing levels in `lib/feed-levels.ts` (verified: `FeedLevel` values `"needs-you" | "highlights" | "all-activity"`, labels in `FEED_LEVEL_LABELS` are already sentence case and only *rendered* uppercase by CSS; keep the values and storage keys, and change the "All activity" tab label to "Everything" in the tab only). Keep `LevelControl`'s testids on the new tab elements if tests reference them.
3. Replace the kind filter chips row ("ALL / ACTION REQ / APPROVALS / …") with a compact segmented control using sentence case: "All", "Action required", "Approvals", "Shipped", "Progress", "Audit".
4. `FeedCard.tsx`: render as a list row instead of a framed card: left `StatusDot` by kind (`action-required`/`approval` → `attention_required`, `shipped` → `done`, `progress` → `running`, `observation` → `idle`), then title (`text-sm font-medium`), a muted one-line body preview (`line-clamp-1`), author session in mono, relative time right-aligned. Actions (`VerbActions`, Chat, Show context, Live terminal) appear on the row: keep them visible for `action-required`/`approval` kinds; for other kinds show them on hover/focus-within (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`). No registration-mark corners, no hard shadows, no uppercase. Rows separated by `divide-y` inside one `rounded-lg border` container.
5. Move the "Subscriptions" toggles (left Explorer content for `/for-you`) unchanged; just restyle `SubscriptionToggleList` labels to sentence case.
6. Keep every existing testid in `components/for-you/*`. Run `grep -l "for-you\|FeedCard\|feed-card" test/*.tsx` and make sure all pass; apply rule 4 for pure styling assertions.
7. `test/inbox-v2.test.tsx`: page title "Inbox"; three tabs present; an `approval` card shows its approve button without hover; an `observation` card's action container has class `opacity-0`.

**Acceptance:** inbox test passes; all existing for-you tests pass; full suite 0 failed; twin `/for-you` screenshot shows a list (no framed cards).

---

### C12: Rigs pages (header and actions menu)

**Do:**
1. In `components/topology/ScopePages.tsx`:
   - `HostScopePage` (`/topology`): add `PageHeader title="Rigs" description="Every rig on this host. Open one to see its agents."` with action `Button` "New rig" → `/specs/rig`. Keep the view-mode tabs; restyle `TopologyViewModeTabs` labels to sentence case ("Graph", "Table", "Terminal", "Overview") and the active tab as `border-b-2 border-on-surface`.
   - `RigScopePage` (`/topology/rig/$rigId`): `PageHeader title={rigName}` with `meta` = `StatusBadge` of the rig's lifecycle + mono rig id, and `actions` = a `DropdownMenu` ("Actions", `data-testid="rig-actions"`) with items: Start (`useStartRig`), Launch (`useLaunchRig`), Save snapshot (`useCreateSnapshot`), separator, Stop rig (`useTeardownRig`, `destructive`). "Stop rig" must open a confirm `Dialog` (`components/ui/dialog.tsx`): title "Stop <rigName>?", body "All agents in this rig will be stopped. You can start it again later.", buttons "Cancel" and destructive "Stop rig". Read the mutation signatures in `hooks/mutations.ts` before calling them (log the exact `mutate` argument shapes).
2. Keep the header-anchor offset logic (`--header-anchor-offset`) working in overlay mode: the page header must sit at the same left as today's tab bar. Verify with a screenshot.
3. Tests: add to `test/topology-view-mode.test.tsx` or a new `test/rig-actions.test.tsx`: the actions menu opens with `keyDown Enter`, "Stop rig" opens the confirm dialog, "Cancel" closes it without calling fetch (spy), "Stop rig" in the dialog calls the teardown endpoint (spy on `fetch`, assert the URL contains the rig id).

**Acceptance:** tests pass; full suite 0 failed; `layout-check.cjs` on `/topology/rig/rig_alpha` exits 0.

---

### C13: Agent page Properties panel

**Do:**
1. `src/components/AgentPropertiesPanel.tsx`: `export function AgentPropertiesPanel({ rigId, logicalId }: { rigId: string; logicalId: string })`. Uses `useNodeDetail(rigId, logicalId)` (read `NodeDetailData` in `hooks/useNodeDetail.ts` for exact field names; log them). Renders `<section data-testid="agent-properties" aria-label="Properties">` (not `<aside>`, which would break the SC-1 count), width `w-80 shrink-0 border-l bg-surface-lowest p-4`, heading "Properties". Rows (label column `w-28 text-xs text-on-surface-variant`, value column `text-sm`):
   Status: `<StatusBadge status={data.agentActivity?.state ?? data.sessionStatus ?? "unknown"} />` (verified types: `agentActivity?: AgentActivitySummary | null` whose `state` is `"running" | "needs_input" | "idle" | "unknown"`; `sessionStatus: string | null`; all four `state` values are keys in C04's `TABLE`), Runtime (mono), Rig (link to `/topology/rig/$rigId`), Pod, Session (mono, with a copy button using `copyText`, shows "Copied" for 1.5 s), Context used (`<n>%` + a thin bar; `--` if unknown), Current work (count of current qitems or "None"), Attach (mono `tmuxAttachCommand` with copy button), Latest error (only if present, `text-destructive`).
   Loading → 6 `Skeleton` rows. Error → `EmptyState title="Couldn't load this agent" description={error.message}`.
2. In `LiveNodeDetails.tsx`, wrap the existing body in `flex` and render the panel on the right on `lg:` and above (`hidden lg:block`). Add `PageHeader` with `title={displayAgentName(logicalId)}`, `meta` = mono `canonicalSessionName`. Keep all existing tabs and testids.
3. `test/agent-properties-panel.test.tsx`: seeded data shows Runtime "claude-code", Context used "58%", copy button calls `navigator.clipboard.writeText` (mock it) with the attach command; error state shows "Couldn't load this agent".

**Acceptance:** tests pass, `test/live-node-details.test.tsx` passes; full suite 0 failed.

---

### C14a–C14e: Page sweeps

Each sweep card applies the same recipe to a set of pages. **Recipe** (apply to every component file listed, and to their direct child components that render visible text):
1. Add a `PageHeader` at the top of the page with a sentence-case title and a one-sentence description of what the page is for and what to do there.
2. Remove `uppercase`, `tracking-wide`, `tracking-wider`, `tracking-widest`, `tracking-[…]`, and `font-mono` from **prose** (titles, labels, buttons, descriptions, table headers). Keep `font-mono` for machine values (ids, sessions, paths, commands, timestamps, token counts).
3. Replace bespoke status renderings with `StatusBadge`/`StatusDot`.
4. Replace framed/vellum cards with `rounded-lg border bg-surface-lowest` (+ `shadow-sm` only for top-level cards).
5. Every empty list gets an `EmptyState` with a `title`, a one-sentence `description`, and an `action` when there is an obvious next step.
6. Text sizes: page body `text-sm`; secondary `text-xs text-on-surface-variant`. Never below `text-[11px]`.
7. Keep every testid. Apply rule 4 for pure styling assertions and log each.

**Acceptance for every sweep card:**
- `grep -nE "uppercase|tracking-(wide|wider|widest|\[)|font-mono" <each listed file and each direct child component you touched>` prints only lines you justified in NOTES.md. `uppercase`/`tracking-*` matches are expected to be zero; `font-mono` matches are fine where they style machine values (ids, sessions, paths, commands, timestamps, counts) and each one is listed in NOTES.md as `file:line — machine value: <what>`.
- Full suite 0 failed.
- Twin screenshot of the card's main route saved to `docs/ui-redesign/screenshots/after/<route>.png`.

Card file lists:
- **C14a Projects**: `components/project/ScopePages.tsx` (`WorkspaceScopePage`, `MissionScopePage`, `SliceScopePage`) and `components/project/*`, `components/slices/tabs/*`. Header: "Projects" / "Missions and slices your agents are working through."
- **C14b Library**: `components/specs/SpecsLibraryPage.tsx`, `SkillsIndexPage.tsx`, `SkillDetailPage.tsx`, `PluginsIndexPage.tsx`, `PluginDetailPage.tsx`, `LibraryReview.tsx`, `RigSpecReview.tsx`, `AgentSpecReview.tsx`. Library page: replace the 5 toolbar buttons with one primary "New rig" + a `DropdownMenu` "More" (Add spec, Import, Discover, Generate workflow), and collapse empty sections into a single `EmptyState` when **all** library counts are 0 ("Your library is empty" / "Specs, skills and plugins you add or discover show up here." / action "Discover").
- **C14c Workflows, Hosts, Agents**: `components/workflow/WorkflowsPage.tsx`, `WorkflowInstancePage.tsx`, `components/review/FleetPage.tsx` (header "Hosts"), `components/review/RigAgentsPage.tsx` (header "Agents"; when `?rig` is absent, keep today's behavior and add the description "Pick a rig to see its agents." if it renders empty).
- **C14d Settings**: `components/system/SettingsCenter.tsx`, `PoliciesPage.tsx`, `LogPage.tsx`, `StatusPage.tsx`, `SettingsExplorer.tsx`, `SettingsTab.tsx`. Use sentence case for setting names; group settings under `h2 text-sm font-semibold` headings; show the setting source (`env`/`file`/`default`) as a small neutral badge.
- **C14e Flows**: `components/files/FilesWorkspace.tsx`, `ImportFlow.tsx`, `PackageList.tsx`, `PackageInstallFlow.tsx`, `PackageDetail.tsx`, `BundleInspector.tsx`, `BundleInstallFlow.tsx`, `BootstrapWizard.tsx`, `AgentSpecValidateFlow.tsx`. Wizards: one shared footer row, secondary action left, primary action right (Paperclip DESIGN.md "Form and wizard footers"); primary button names the action ("Install bundle", not "Submit").

---

### C15: First-run "Getting started"

**Do:**
1. `components/dashboard/GettingStarted.tsx`: shown at the top of the Dashboard **only** when `usePsEntries().data` is an empty array **and** `localStorage["openrig.getting-started.dismissed"] !== "1"`. `data-testid="getting-started"`. A card titled "Get started with OpenRig" with 4 steps, each with a check state:
   1. "Connect to the daemon": done when `daemonStatus(...)` from `lib/daemon-status.ts` (C10) returns label "Healthy".
   2. "Add a rig spec": done when `useSpecLibrary()` returns ≥1 rig spec (read the hook for the shape; log it); action "Open library" → `/specs`.
   3. "Launch your first rig": done when ps has ≥1 entry (never true while shown; fine); action "New rig" → `/specs/rig`.
   4. "Check your inbox": action "Open inbox" → `/for-you`.
   A "Dismiss" ghost button sets the storage key and hides the card.
2. `test/getting-started.test.tsx`: shows with empty ps; hidden with one ps entry; Dismiss hides it and persists across remount.

**Acceptance:** test passes; full suite 0 failed.

---

### C16: Mobile bottom nav

**Do:**
1. Move `MobileBottomNav` out of `AppShell.tsx` into `components/shell/MobileBottomNav.tsx` (same props). Keep it a `<nav … className="… lg:hidden">` (the SC-1 test filters by `lg:hidden`, so this class must stay on the nav element itself).
2. Items: Dashboard, Inbox (with badge), Rigs, Projects, and "More" (opens the existing mobile tray: call the same `setExplorerOpen(true)` the hamburger uses; pass it as a prop `onMore`). Labels under icons `text-[11px]`. Opaque `bg-background border-t`, `pb-[env(safe-area-inset-bottom)]`. Item tap targets `h-14`.
3. Keep existing testids of the mobile nav (grep the old function for `data-testid` and reuse them).

**Acceptance:** `test/p5-mobile-polish.test.tsx`, `test/slice-20-mobile-density.test.tsx` pass (rule 4 for styling assertions); full suite 0 failed; twin screenshot at width 390 shows the bottom nav with 5 items.

---

### C17: DESIGN.md rewrite

**Do:** Rewrite `docs/DESIGN.md` to describe the Clean theme. Keep the existing front sections' purpose (Essence, Design Language, Color Tokens, …) but replace their content with: the principles in section 4.1, the names table in 4.2 (labels only), the token values from C02 (light and dark), radius scale, typography rules (Inter for prose, JetBrains Mono for machine values, sentence case), status vocabulary table from C04, components inventory (PageHeader, MetricTile, StatusBadge/Dot, EmptyState, DropdownMenu, Kbd, Skeleton, Sidebar, TopBar, CommandPalette), and a short "Vellum (retired)" paragraph saying the Vellum classes remain in `globals.css` only as neutralized compatibility shims. Keep the maintenance-mode wording exactly as `docs/reference/developing.md` requires.

**Acceptance:** `node scripts/check-docs-guard.mjs` (repo root) exits 0. `grep -n "tactical dossier" docs/DESIGN.md` prints nothing. `grep -c "experimental" docs/DESIGN.md` and `grep -c "maintenance mode" docs/DESIGN.md` and `grep -c "CLI is primary\|the CLI is primary" docs/DESIGN.md` each print 1 or more (the wording rule in `docs/reference/developing.md`: *experimental*, *maintenance mode*, *best-effort*, *the CLI is primary*), and `grep -niE "deprecated|end[- ]of[- ]life|will be removed" docs/DESIGN.md` prints nothing.

---

### C18: Final audit, after-screenshots, PR to main

**Do:**
1. Rebase `ui-redesign` on `main` if `main` moved; re-run everything.
2. Full checks from repo root: `npm run lint` (exit 0) and `npm run test:ui` (0 failed). Record both summary lines in NOTES.md.
3. Screenshots: for `/`, `/for-you`, `/topology/rig/rig_alpha`, `/project`, `/specs`, `/settings` at 1440, and `/` at 390: build the twin and save to `docs/ui-redesign/screenshots/after/`. Also take `/` with `localStorage["openrig.theme"]="dark"` (add `await p.addInitScript(() => localStorage.setItem("openrig.theme","dark"))` in a copy of `shot.cjs` named `shot-dark.cjs`).
4. Layout check: `/`, `/specs`, `/project`, `/settings`, `/topology/rig/rig_alpha` at 1440 all exit 0.
5. Spec audit: go through sections 4.1, 4.2 and every card's **Do** list; for each statement, write one line in NOTES.md under "## Final audit": `✓ <statement> — <file:line>` or `✗ <statement> — <why>`. Fix every ✗ you can; list the rest in the PR.
6. If you have access to a real daemon, run `npm run dev -w packages/ui` against it and click through Dashboard → a rig → an agent → Inbox → Library → Settings. Note anything broken in NOTES.md.
7. Open the PR `ui-redesign` → `main` with exactly this body:
   ```markdown
   ## What
   Friendlier OpenRig web UI: labeled sidebar, plain names, Clean light/dark theme, ⌘K palette, breadcrumbs, status badges, empty states, toasts, new Dashboard and Inbox.

   ## Why
   The old icon rail, jargon labels and uppercase-mono styling made the UI hard to learn. Patterns follow Paperclip's board UI; no Paperclip code was copied (or: list attributed snippets).

   ## Screenshots
   | Before | After |
   |---|---|
   | (8 rows: `/`, `/for-you`, `/topology/rig/rig_alpha`, `/project`, `/specs`, `/settings` at 1440, plus `/` at 390 (mobile) and `/` in dark mode. Drag the PNGs from docs/ui-redesign/screenshots/ into the PR description in the GitHub web editor; if you cannot upload, write "screenshots available on request" and list the routes) |

   ## Tests
   - `npm run lint`: <result>
   - `npm run test:ui`: <summary line>
   - Assertions changed for the new design (<count>), pasted from NOTES.md:
     - `<test file> > <test name>`: <old> → <new>

   ## Not done / follow-ups
   - <from the final audit>
   ```

**Acceptance:** PR open; CI `package-tests (ui)` green; NOTES.md has the final audit with no unexplained ✗.

---

## 7. Gotchas (re-read before every card)

1. Tailwind is **3.4** with `tailwind.config.ts`. Tailwind 4 syntax (`@theme`, `bg-(--x)`, `@import "tailwindcss"`) will silently do nothing or fail the build.
2. Every border radius was forced to `0px` in the config; until C02 lands, `rounded-*` classes render square. After C02, existing components still look square because nobody wrote `rounded-*`: radius arrives only where you add it.
3. `--secondary` is used as the **text color of small labels** across the app ("HOSTS", "SEATS RUNNING"). Keep it a neutral grey. Use the new `--brand` / `text-brand` for links, focus rings and the badge on Inbox.
4. The Clean theme block must be **last** in `globals.css`. Anything appended after it can re-break the cascade.
5. `test/registration-marks.test.tsx` reads the `.reg-*` CSS rules from source. Neutralize them with the override block; never delete them.
6. SC-1: exactly **2** visible `nav`/`aside` elements on desktop. Sidebar = `nav`, Explorer = `aside`. Breadcrumbs, Properties panel and sidebar sections must not be `nav`/`aside` (use `div role="navigation"`/`section`). The mobile bottom nav keeps `lg:hidden` on its own element.
7. The rail width (48px) is hard-coded as `"3rem"`, `"21rem"` in `AppShell.tsx` and `lg:left-12` in `Explorer.tsx`. Change all three together (C06).
8. Keep the `rail-*` testids even though it is no longer a rail. Many tests use them.
9. `cmdk` needs `Element.prototype.scrollIntoView` in jsdom; Radix menus need `hasPointerCapture`/`releasePointerCapture`. Polyfills live in `test/setup.ts` (C01).
10. Open Radix dropdowns in tests with `fireEvent.keyDown(trigger, { key: "Enter" })`. `fireEvent.click` does not open them.
11. `vitest` `globals` is **false** in this repo; import `describe/it/expect/vi` from `vitest` in every test file.
12. Hooks share caches by queryKey. When composing (useAllAgents) reuse the exact key shape `["rig", rigId, "nodes", hostId]` or SSE invalidation will not refresh your data.
13. Respect the selected host: any new fetch must go through `withHostParam(path, hostId)` with `useSelectedHostId()` like the existing hooks.
14. Don't remove `UiMaintenanceNotice` or change its text.
15. `twin-out/`, `.scratch/` and `test/_scratch/` are never committed.
16. `components/graphics/RuntimeMark.tsx` hex colors are brand logos (Claude, Codex…); don't tokenise them.
17. Don't toast on queries or SSE; only on user-initiated mutations (C09).
18. Use `asChild` on `Button` to render a TanStack `<Link>`; never nest `<a>` in `<button>`.
19. Use relative imports with the `.js` suffix like the rest of `src/` (`import { cn } from "../lib/utils.js"`), or the `@/` alias where the file you're editing already uses it. Don't mix in one file.
20. `docs/*` is git-ignored except `as-built/`, `reference/`, `releases/` and the single file `docs/DESIGN.md`; CI's docs guard fails on any other tracked docs path. Plans, notes and screenshots stay local.
21. If `main` moves while you work, rebase the card branch on `ui-redesign` and re-run the suite before opening the PR.

---

## 8. Definition of done

- [ ] All cards C00–C18 merged into `ui-redesign`; PR to `main` open with the body from C18.
- [ ] `npm run lint` exits 0; `npm run test:ui` 0 failed; test count ≥ 1787 + new tests.
- [ ] Every route in `routes.tsx` still resolves (no path changed).
- [ ] Sidebar shows labeled sections (Fleet, Work, Build, Chat), New rig, Search ⌘K, live rig list, Inbox badge; collapses to icons with tooltips; auto-collapses when an Explorer is open.
- [ ] Breadcrumbs on every page; ⌘K palette finds pages by new and old names, rigs, and actions; `g d` / `g i` / `g r` work.
- [ ] Clean light and dark themes; no dot grid, no registration marks, no hard shadows, no uppercase prose.
- [ ] Dashboard: Needs you, 4 metric tiles, Rigs table, Recent activity, Host section, Getting started on first run.
- [ ] Inbox list with tabs and inline approve.
- [ ] Rig page actions menu with confirm on Stop; agent page Properties panel.
- [ ] Toasts on rig mutations only.
- [ ] Every empty state has a title, one sentence and (where obvious) an action.
- [ ] `docs/DESIGN.md` rewritten; `docs/ui-redesign/NOTES.md` (local, untracked) complete with final audit, summarized in the PR body; before/after screenshots taken.

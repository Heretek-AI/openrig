# Hermes dispatch prompt: C03: Restyle primitives + new primitives

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C03, Restyle primitives + new primitives
**Depends on (must already be merged into `ui-redesign`):** C02
**Your branch:** `ui-redesign/c03-restyle-primitives-new-primitives`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C03): Restyle primitives + new primitives`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C03): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C03: Restyle primitives + new primitives

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

# Hermes dispatch prompt: C04: Status vocabulary + StatusBadge

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C04, Status vocabulary + StatusBadge
**Depends on (must already be merged into `ui-redesign`):** C01, C02
**Your branch:** `ui-redesign/c04-status-vocabulary-statusbadge`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C04): Status vocabulary + StatusBadge`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C04): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C04: Status vocabulary + StatusBadge

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

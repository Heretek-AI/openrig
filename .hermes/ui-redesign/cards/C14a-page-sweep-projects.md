# Hermes dispatch prompt: C14a: Page sweep, Projects

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C14a, Page sweep, Projects
**Depends on (must already be merged into `ui-redesign`):** C07
**Your branch:** `ui-redesign/c14a-page-sweep-projects`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C14a): Page sweep, Projects`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C14a): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C14a: Page sweep, Projects

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

### C14a: Page sweep, Projects

Each sweep card applies the same recipe to a set of pages. **Recipe** (apply to every component file listed, and to their direct child components that render visible text):
1. Add a `PageHeader` at the top of the page with a sentence-case title and a one-sentence description of what the page is for and what to do there.
2. Remove `uppercase`, `tracking-wide`, `tracking-wider`, `tracking-widest`, `tracking-[…]`, and `font-mono` from **prose** (titles, labels, buttons, descriptions, table headers). Keep `font-mono` for machine values (ids, sessions, paths, commands, timestamps, token counts).
3. Replace bespoke status renderings with `StatusBadge`/`StatusDot`.
4. Replace framed/vellum cards with `rounded-lg border bg-surface-lowest` (+ `shadow-sm` only for top-level cards).
5. Every empty list gets an `EmptyState` with a `title`, a one-sentence `description`, and an `action` when there is an obvious next step.
6. Text sizes: page body `text-sm`; secondary `text-xs text-on-surface-variant`. Never below `text-[11px]`.
7. Keep every testid. Apply rule 4 for pure styling assertions and log each.

**Acceptance for every sweep card:**
- `grep -nE "uppercase|tracking-(wide|wider|widest|\[)" <each listed file>` prints only lines that you justified in NOTES.md (expected: none).
- Full suite 0 failed.
- Twin screenshot of the card's main route saved to `docs/ui-redesign/screenshots/after/<route>.png`.

**This card's files and specifics:**

`components/project/ScopePages.tsx` (`WorkspaceScopePage`, `MissionScopePage`, `SliceScopePage`) and `components/project/*`, `components/slices/tabs/*`. Header: "Projects" / "Missions and slices your agents are working through."


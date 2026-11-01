# Hermes dispatch prompt: C17: DESIGN.md rewrite

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C17, DESIGN.md rewrite
**Depends on (must already be merged into `ui-redesign`):** C10, C11, C12, C13, C14a, C14b, C14c, C14d, C14e, C15, C16
**Your branch:** `ui-redesign/c17-design-md-rewrite`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C17): DESIGN.md rewrite`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C17): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C17: DESIGN.md rewrite

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

### C17: DESIGN.md rewrite

**Do:** Rewrite `docs/DESIGN.md` to describe the Clean theme. Keep the existing front sections' purpose (Essence, Design Language, Color Tokens, …) but replace their content with: the principles in section 4.1, the names table in 4.2 (labels only), the token values from C02 (light and dark), radius scale, typography rules (Inter for prose, JetBrains Mono for machine values, sentence case), status vocabulary table from C04, components inventory (PageHeader, MetricTile, StatusBadge/Dot, EmptyState, DropdownMenu, Kbd, Skeleton, Sidebar, TopBar, CommandPalette), and a short "Vellum (retired)" paragraph saying the Vellum classes remain in `globals.css` only as neutralized compatibility shims. Keep the maintenance-mode wording exactly as `docs/reference/developing.md` requires.

**Acceptance:** `node scripts/check-docs-guard.mjs` (repo root) exits 0. `grep -n "tactical dossier" docs/DESIGN.md` prints nothing.

# Hermes dispatch prompt: C16: Mobile bottom nav

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C16, Mobile bottom nav
**Depends on (must already be merged into `ui-redesign`):** C06
**Your branch:** `ui-redesign/c16-mobile-bottom-nav`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C16): Mobile bottom nav`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C16): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C16: Mobile bottom nav

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

### C16: Mobile bottom nav

**Do:**
1. Move `MobileBottomNav` out of `AppShell.tsx` into `components/shell/MobileBottomNav.tsx` (same props). Keep it a `<nav … className="… lg:hidden">` (the SC-1 test filters by `lg:hidden`, so this class must stay on the nav element itself).
2. Items: Dashboard, Inbox (with badge), Rigs, Projects, and "More" (opens the existing mobile tray: call the same `setExplorerOpen(true)` the hamburger uses; pass it as a prop `onMore`). Labels under icons `text-[11px]`. Opaque `bg-background border-t`, `pb-[env(safe-area-inset-bottom)]`. Item tap targets `h-14`.
3. Keep existing testids of the mobile nav (grep the old function for `data-testid` and reuse them).

**Acceptance:** `test/p5-mobile-polish.test.tsx`, `test/slice-20-mobile-density.test.tsx` pass (rule 4 for styling assertions); full suite 0 failed; twin screenshot at width 390 shows the bottom nav with 5 items.

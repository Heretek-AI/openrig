# Hermes dispatch prompt: C08: Command palette (⌘K)

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C08, Command palette (⌘K)
**Depends on (must already be merged into `ui-redesign`):** C06
**Your branch:** `ui-redesign/c08-command-palette-k`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C08): Command palette (⌘K)`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C08): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C08: Command palette (⌘K)

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

# Hermes dispatch prompt: C18: Final audit, after-screenshots, PR to main

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C18, Final audit, after-screenshots, PR to main
**Depends on (must already be merged into `ui-redesign`):** C00, C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C12, C13, C14a, C14b, C14c, C14d, C14e, C15, C16, C17
**Your branch:** `ui-redesign/c18-final-audit-after-screenshots-pr`, cut from the latest `origin/ui-redesign`. **Exception:** C18 works on `ui-redesign` itself and opens the final PR.
**Your PR:** into `main`, titled `ui(C18): Final audit, after-screenshots, PR to main`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C18): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C18: Final audit, after-screenshots, PR to main

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

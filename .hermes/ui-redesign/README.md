# OpenRig web UI redesign: hermes kit

This folder is a ready-to-run work package for **hermes** (or any orchestrator that hands one task at a time to coding agents). It rebuilds `packages/ui` into a friendlier UI modeled on Paperclip's board UI: a labeled sidebar, plain names, a clean light and dark theme, ⌘K search, breadcrumbs, status badges, toasts, and new Dashboard and Inbox pages. Tracking issue: see the PR description.

| File | What it is |
|---|---|
| `IMPLEMENTATION_PROMPT.md` | The full brief: rules, setup, verified facts, target layout, every card, gotchas, definition of done. Every coding agent reads sections 1 to 5 and 7 before its card. |
| `cards/<id>-<slug>.md` | One **dispatch prompt per card**. Paste the part below the line into the coding agent's task, as is. |
| `cards.json` | Machine-readable card list: `id`, `title`, `depends_on`, `prompt` (path), `branch`, `pr_base`. Use it to build the kanban board. |

## 1. One-time setup (orchestrator)

1. Merge the PR that adds this folder into `main` first, so every agent's checkout has the prompts.
2. Make sure each worker machine has:
   - Node `v22.x` or `v24.x` and npm `>= 10` (verified with Node 22.23.4, npm 10.9.9).
   - Git with push access to `Heretek-AI/openrig`, and the ability to open PRs.
   - About 2 GB free disk (node_modules, a Playwright Chromium, twin builds).
   - Outbound access to `registry.npmjs.org`, `github.com`, and the Playwright CDN (for `npx playwright install chromium`).
3. Each worker, once per clone:
   ```bash
   git clone https://github.com/Heretek-AI/openrig.git && cd openrig
   npm ci
   npm run build -w packages/daemon
   mkdir -p .scratch && echo ".scratch/" >> .git/info/exclude
   git clone --depth 1 https://github.com/Heretek-AI/paperclip.git .scratch/paperclip   # read-only UX reference
   ```
   After C01 is merged, also run `cd packages/ui && npx playwright install chromium`.
4. Expected baseline (checked at commit `eb6c158`): `cd packages/ui && npx vitest run` ends with `Test Files  202 passed (202)` and `Tests  1787 passed | 1 skipped (1788)`, in about 90 seconds.

## 2. Building the board

Create one kanban card per entry in `cards.json`, in this order, with its `depends_on` as blockers:

```
C00 → C01 → { C02 → { C03 , C04 } , C05 } → C06 → { C07 , C08 , C09 , C16 }
C07 → { C10 , C11 , C13 , C14a , C14b , C14c , C14d , C14e } ; C07 + C09 → C12 ; C10 → C15
C10…C16 → C17 → C18
```

A card is ready when every card in `depends_on` has its PR **merged into `ui-redesign`**. **Exception: C00 has no PR.** C00 is done when the `ui-redesign` branch exists on `origin` (`git ls-remote --heads origin ui-redesign` prints one line) and its baseline acceptance checks are reported; then C01 is ready. Every later dependency uses the merged-PR rule. Most parallelism is available after C07: up to 9 cards can run at once.

## 3. Dispatching a card

1. Pick a ready card. Give the coding agent the text below the line in `cards/<id>-*.md`. Paths in the prompts follow the brief's path convention (section 2, rule 13): `src/`, `test/`, `twin/` are under `packages/ui/`; bare `components/`, `hooks/`, `lib/` are under `packages/ui/src/`. It already names the branch, the PR base and the PR body format.
2. Each agent works in its own clone or worktree, on `ui-redesign/<id>-<slug>` cut from the latest `origin/ui-redesign`.
3. **Notes travel through PRs.** `docs/ui-redesign/NOTES.md` is git-ignored by repo policy (CI's docs guard rejects tracked files under `docs/` except `as-built/`, `reference/`, `releases/` and `docs/DESIGN.md`). Each card's PR body ends with "Notes for later cards". Before dispatching a card, paste the "Notes for later cards" sections of its merged dependencies into the agent's task, below the card prompt.
4. Review gate before merging a card PR into `ui-redesign`:
   - CI is green (the `package-tests (ui)` job runs the UI suite).
   - Every Acceptance line in the PR body is ticked with evidence.
   - Changed test assertions are listed, and each one is about old copy or layout the brief explicitly changes. A deleted or skipped test means the card goes back.
5. If an agent reports it is blocked (3 failed attempts), don't re-dispatch the same prompt. Read its notes and either fix the blocker or dispatch an independent ready card.

## 4. Finishing

C18 rebases `ui-redesign` on `main`, runs the full checks, takes after-screenshots, writes the final audit, and opens the PR from `ui-redesign` into `main`. That PR needs a human review.

## 5. Ground rules every agent follows (summary of the brief's section 2)

- No daemon, CLI or TUI changes, and no `/api/*` contract changes. No route path changes.
- Keep the listed `data-testid`s (`app-rail`, `rail-*`, `explorer`, `content-area`, …).
- Never skip, delete or weaken tests; replace the old-design tests only as the brief specifies.
- Don't copy Paperclip source (MIT, but Tailwind 4 / react-router; it won't fit). Use it as a visual reference only.
- Keep the "experimental, maintenance mode, CLI is primary" notice and its wording.

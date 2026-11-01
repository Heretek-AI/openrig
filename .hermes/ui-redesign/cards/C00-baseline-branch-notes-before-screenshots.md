# Hermes dispatch prompt: C00: Baseline, branch, notes, before-screenshots

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C00, Baseline, branch, notes, before-screenshots
**Depends on (must already be merged into `ui-redesign`):** none
**Your branch:** `ui-redesign/c00-baseline-branch-notes-before-screenshots`, cut from the latest `origin/ui-redesign`. **Exception:** C00 creates `ui-redesign` itself from `main`; it has no card branch or PR, it pushes `ui-redesign` directly.
**Your PR:** into `(none, push ui-redesign)`, titled `ui(C00): Baseline, branch, notes, before-screenshots`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C00): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C00: Baseline, branch, notes, before-screenshots

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

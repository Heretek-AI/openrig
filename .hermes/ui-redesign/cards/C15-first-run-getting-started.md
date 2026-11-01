# Hermes dispatch prompt: C15: First-run "Getting started"

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C15, First-run "Getting started"
**Depends on (must already be merged into `ui-redesign`):** C10
**Your branch:** `ui-redesign/c15-first-run-getting-started`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C15): First-run "Getting started"`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C15): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C15: First-run "Getting started"

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

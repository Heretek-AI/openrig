# Hermes dispatch prompt: C09: Toasts for rig actions

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C09, Toasts for rig actions
**Depends on (must already be merged into `ui-redesign`):** C06
**Your branch:** `ui-redesign/c09-toasts-for-rig-actions`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C09): Toasts for rig actions`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C09): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C09: Toasts for rig actions

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

### C09: Toasts for rig actions

**Do:**
1. Mount `<Toaster position="bottom-right" richColors={false} closeButton />` from `sonner` once in `AppShellInner`. Pass `theme={useTheme().resolved}` (sonner's `theme` prop accepts `'light' | 'dark' | 'system'`, verified in `node_modules/sonner/dist/index.d.ts`).
2. `src/lib/notify.ts`:
   ```ts
   import { toast } from "sonner";
   export function notifySuccess(title: string, description?: string): void { toast.success(title, { description }); }
   export function notifyError(title: string, error: unknown): void {
     const description = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
     toast.error(title, { description });
   }
   ```
3. In `hooks/mutations.ts`, for `useCreateSnapshot`, `useRestoreSnapshot`, `useTeardownRig`, `useStartRig`, `useLaunchRig`, `useImportRig`: add `onSuccess`/`onError` that call `notifySuccess`/`notifyError` **in addition to** existing callbacks (keep existing `onSuccess` bodies; call notify after them). Titles: "Snapshot saved", "Snapshot restored", "Rig stopped", "Rig started", "Rig launched", "Rig imported"; errors: "Couldn't save snapshot", "Couldn't restore snapshot", "Couldn't stop rig", "Couldn't start rig", "Couldn't launch rig", "Couldn't import rig".
4. Do **not** toast from queries, SSE events, or the For You `UndoToast` flow (leave `components/for-you/UndoToast.tsx` as is).
5. `test/notify.test.tsx`: `notifyError("X", new Error("boom"))` shows "X" and "boom"; and one mutation test (pick `useStartRig`, mock `fetch` to return `ok:false, status 500`) shows "Couldn't start rig".

**Acceptance:** notify test passes; full suite 0 failed (existing mutation tests may need a `<Toaster/>`-free render to still pass: toasts without a mounted Toaster are a no-op, which is fine).

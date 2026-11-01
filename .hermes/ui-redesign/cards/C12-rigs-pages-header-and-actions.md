# Hermes dispatch prompt: C12: Rigs pages (header and actions menu)

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C12, Rigs pages (header and actions menu)
**Depends on (must already be merged into `ui-redesign`):** C07, C09
**Your branch:** `ui-redesign/c12-rigs-pages-header-and-actions`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C12): Rigs pages (header and actions menu)`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C12): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C12: Rigs pages (header and actions menu)

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

### C12: Rigs pages (header and actions menu)

**Do:**
1. In `components/topology/ScopePages.tsx`:
   - `HostScopePage` (`/topology`): add `PageHeader title="Rigs" description="Every rig on this host. Open one to see its agents."` with action `Button` "New rig" → `/specs/rig`. Keep the view-mode tabs; restyle `TopologyViewModeTabs` labels to sentence case ("Graph", "Table", "Terminal", "Overview") and the active tab as `border-b-2 border-on-surface`.
   - `RigScopePage` (`/topology/rig/$rigId`): `PageHeader title={rigName}` with `meta` = `StatusBadge` of the rig's lifecycle + mono rig id, and `actions` = a `DropdownMenu` ("Actions", `data-testid="rig-actions"`) with items: Start (`useStartRig`), Launch (`useLaunchRig`), Save snapshot (`useCreateSnapshot`), separator, Stop rig (`useTeardownRig`, `destructive`). "Stop rig" must open a confirm `Dialog` (`components/ui/dialog.tsx`): title "Stop <rigName>?", body "All agents in this rig will be stopped. You can start it again later.", buttons "Cancel" and destructive "Stop rig". Read the mutation signatures in `hooks/mutations.ts` before calling them (log the exact `mutate` argument shapes).
2. Keep the header-anchor offset logic (`--header-anchor-offset`) working in overlay mode: the page header must sit at the same left as today's tab bar. Verify with a screenshot.
3. Tests: add to `test/topology-view-mode.test.tsx` or a new `test/rig-actions.test.tsx`: the actions menu opens with `keyDown Enter`, "Stop rig" opens the confirm dialog, "Cancel" closes it without calling fetch (spy), "Stop rig" in the dialog calls the teardown endpoint (spy on `fetch`, assert the URL contains the rig id).

**Acceptance:** tests pass; full suite 0 failed; `layout-check.cjs` on `/topology/rig/rig_alpha` exits 0.

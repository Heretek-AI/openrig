# Hermes dispatch prompt: C11: Inbox v2 (restyle For You)

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C11, Inbox v2 (restyle For You)
**Depends on (must already be merged into `ui-redesign`):** C07
**Your branch:** `ui-redesign/c11-inbox-v2-restyle-for-you`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C11): Inbox v2 (restyle For You)`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C11): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C11: Inbox v2 (restyle For You)

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

### C11: Inbox v2 (restyle For You)

Keep all data logic in `components/for-you/Feed.tsx` (classification, merge, dismissal, undo, subscriptions). Change presentation only.

**Do:**
1. Page header: `PageHeader title="Inbox" description="Approvals, questions and updates from your agents."`.
2. Replace the "SHOW ME" black box (`LevelControl`) presentation with a row of tabs (`components/ui/tabs.tsx` or simple buttons with `role="tab"`): "Needs you", "Highlights", "Everything". Map them to the existing levels in `lib/feed-levels.ts` (verified: `FeedLevel` values `"needs-you" | "highlights" | "all-activity"`, labels in `FEED_LEVEL_LABELS` are already sentence case and only *rendered* uppercase by CSS; keep the values and storage keys, and change the "All activity" tab label to "Everything" in the tab only). Keep `LevelControl`'s testids on the new tab elements if tests reference them.
3. Replace the kind filter chips row ("ALL / ACTION REQ / APPROVALS / …") with a compact segmented control using sentence case: "All", "Action required", "Approvals", "Shipped", "Progress", "Audit".
4. `FeedCard.tsx`: render as a list row instead of a framed card: left `StatusDot` by kind (`action-required`/`approval` → `attention_required`, `shipped` → `done`, `progress` → `running`, `observation` → `idle`), then title (`text-sm font-medium`), a muted one-line body preview (`line-clamp-1`), author session in mono, relative time right-aligned. Actions (`VerbActions`, Chat, Show context, Live terminal) appear on the row: keep them visible for `action-required`/`approval` kinds; for other kinds show them on hover/focus-within (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`). No registration-mark corners, no hard shadows, no uppercase. Rows separated by `divide-y` inside one `rounded-lg border` container.
5. Move the "Subscriptions" toggles (left Explorer content for `/for-you`) unchanged; just restyle `SubscriptionToggleList` labels to sentence case.
6. Keep every existing testid in `components/for-you/*`. Run `grep -l "for-you\|FeedCard\|feed-card" test/*.tsx` and make sure all pass; apply rule 4 for pure styling assertions.
7. `test/inbox-v2.test.tsx`: page title "Inbox"; three tabs present; an `approval` card shows its approve button without hover; an `observation` card's action container has class `opacity-0`.

**Acceptance:** inbox test passes; all existing for-you tests pass; full suite 0 failed; twin `/for-you` screenshot shows a list (no framed cards).

# Hermes dispatch prompt: C13: Agent page Properties panel

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C13, Agent page Properties panel
**Depends on (must already be merged into `ui-redesign`):** C07
**Your branch:** `ui-redesign/c13-agent-page-properties-panel`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C13): Agent page Properties panel`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C13): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C13: Agent page Properties panel

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

### C13: Agent page Properties panel

**Do:**
1. `src/components/AgentPropertiesPanel.tsx`: `export function AgentPropertiesPanel({ rigId, logicalId }: { rigId: string; logicalId: string })`. Uses `useNodeDetail(rigId, logicalId)` (read `NodeDetailData` in `hooks/useNodeDetail.ts` for exact field names; log them). Renders `<section data-testid="agent-properties" aria-label="Properties">` (not `<aside>`, which would break the SC-1 count), width `w-80 shrink-0 border-l bg-surface-lowest p-4`, heading "Properties". Rows (label column `w-28 text-xs text-on-surface-variant`, value column `text-sm`):
   Status: `<StatusBadge status={data.agentActivity?.state ?? data.sessionStatus ?? "unknown"} />` (verified types: `agentActivity?: AgentActivitySummary | null` whose `state` is `"running" | "needs_input" | "idle" | "unknown"`; `sessionStatus: string | null`; all four `state` values are keys in C04's `TABLE`), Runtime (mono), Rig (link to `/topology/rig/$rigId`), Pod, Session (mono, with a copy button using `copyText`, shows "Copied" for 1.5 s), Context used (`<n>%` + a thin bar; `--` if unknown), Current work (count of current qitems or "None"), Attach (mono `tmuxAttachCommand` with copy button), Latest error (only if present, `text-destructive`).
   Loading → 6 `Skeleton` rows. Error → `EmptyState title="Couldn't load this agent" description={error.message}`.
2. In `LiveNodeDetails.tsx`, wrap the existing body in `flex` and render the panel on the right on `lg:` and above (`hidden lg:block`). Add `PageHeader` with `title={displayAgentName(logicalId)}`, `meta` = mono `canonicalSessionName`. Keep all existing tabs and testids.
3. `test/agent-properties-panel.test.tsx`: seeded data shows Runtime "claude-code", Context used "58%", copy button calls `navigator.clipboard.writeText` (mock it) with the attach command; error state shows "Couldn't load this agent".

**Acceptance:** tests pass, `test/live-node-details.test.tsx` passes; full suite 0 failed.

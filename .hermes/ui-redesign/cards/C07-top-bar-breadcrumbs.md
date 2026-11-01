# Hermes dispatch prompt: C07: Top bar + breadcrumbs

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C07, Top bar + breadcrumbs
**Depends on (must already be merged into `ui-redesign`):** C06
**Your branch:** `ui-redesign/c07-top-bar-breadcrumbs`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C07): Top bar + breadcrumbs`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C07): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C07: Top bar + breadcrumbs

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

### C07: Top bar + breadcrumbs

**Do:**
1. `src/lib/breadcrumbs.ts`:
   ```ts
   export interface Crumb { label: string; to?: string }
   export interface CrumbNames { rigName?: (rigId: string) => string | undefined }
   export function breadcrumbsFor(pathname: string, names?: CrumbNames): Crumb[];
   ```
   Rules (first match wins; the last crumb never has `to`):
   | pathname | crumbs |
   |---|---|
   | `/` | `[Dashboard]` |
   | `/for-you` | `[Inbox]` |
   | `/topology` | `[Rigs]` |
   | `/topology/rig/:rigId` | `[Rigs→/topology, <rigName ?? rigId>]` |
   | `/topology/pod/:rigId/:pod` | `[Rigs→/topology, <rig>→/topology/rig/:rigId, <pod> pod]` |
   | `/topology/seat/:rigId/:logicalId` | `[Rigs→/topology, <rig>→/topology/rig/:rigId, <displayAgentName(logicalId)>]` |
   | `/rigs/:rigId` | same as `/topology/rig/:rigId` |
   | `/rigs/:rigId/nodes/:logicalId` | same as seat |
   | `/agents` | `[Agents]` ; `/fleet` → `[Hosts]` ; `/workflows` → `[Workflows]` ; `/workflow/instance/:id` → `[Workflows→/workflows, :id]` |
   | `/project` | `[Projects]` ; `/project/mission/:id` → `[Projects→/project, Mission :id]` ; `/project/slice/:id` → `[Projects→/project, Slice :id]` |
   | `/specs` | `[Library]` ; `/specs/skills` → `[Library→/specs, Skills]` ; `/specs/skills/:t` → `[Library, Skills→/specs/skills, :t]` ; `/specs/plugins` → `[Library→/specs, Plugins]` ; `/plugins/:id` → `[Library→/specs, Plugins→/specs/plugins, :id]` ; any other `/specs/...` → `[Library→/specs, <last segment>]` |
   | `/files` | `[Files]` |
   | `/settings` | `[Settings]` ; `/settings/policies` → `[Settings→/settings, Policies]` ; `/log` → `Log` ; `/status` → `Status` |
   | anything else | `[<last segment, decoded>]` |
   Decode every segment with `decodeURIComponent` inside try/catch.
2. `src/components/shell/TopBar.tsx`: replaces the contents of the existing `<header data-testid="app-topbar">` (keep that testid and the mobile hamburger button and its testid/behavior). Left: on mobile the hamburger, then on all sizes the breadcrumbs as `<div role="navigation" aria-label="Breadcrumb" data-testid="breadcrumbs">`. Do not use a `<nav>` element: it would be a third `nav` in the SC-1 count. `role="navigation"` on a `div` is fine, because that test queries the tag names `nav, aside` only. Crumbs separated by `ChevronRight h-3.5 w-3.5 text-on-surface-variant`; linked crumbs `text-on-surface-variant hover:text-on-surface`, last crumb `text-on-surface font-medium truncate`. Right: `HostIndicator`, then `ThemeSelector`. Height `h-12`, `border-b bg-background`. Brand: show a small "OpenRig" wordmark (`text-sm font-semibold`) at the far left **only on mobile**; on desktop, put the wordmark in the sidebar header row (C06 header) instead. Keep the brand link `to="/"` and whatever testid the existing brand link has (find it in AppShell; the app-shell test "brand link visible at desktop and links to /" must keep passing: if it requires the brand inside the top bar at desktop, keep a desktop brand in the top bar and log it).
3. Rig names for crumbs come from `useRigSummary()` (`names.rigName = (id) => data?.find(r => r.id === id)?.name`).
4. `test/breadcrumbs.test.ts`: one case per table row (≥20 cases), plus a percent-encoded logical id (`/topology/seat/rig_alpha/lead%2Ecoordinator` decodes).

**Acceptance:** breadcrumbs test passes; app-shell test passes (log any changed assertion); full suite 0 failed; twin screenshot of `/topology/rig/rig_alpha` shows "Rigs › acme-build" in the top bar.

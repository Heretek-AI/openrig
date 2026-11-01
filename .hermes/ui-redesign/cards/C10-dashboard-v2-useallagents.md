# Hermes dispatch prompt: C10: Dashboard v2 + useAllAgents

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C10, Dashboard v2 + useAllAgents
**Depends on (must already be merged into `ui-redesign`):** C07
**Your branch:** `ui-redesign/c10-dashboard-v2-useallagents`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C10): Dashboard v2 + useAllAgents`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C10): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C10: Dashboard v2 + useAllAgents

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

### C10: Dashboard v2 + useAllAgents

**Do:**
1. `src/hooks/useAllAgents.ts`:
   ```ts
   export interface AgentRow extends NodeInventoryEntry {}
   export function useAllAgents(): { agents: AgentRow[]; isLoading: boolean; error: Error | null };
   ```
   Implementation: `const hostId = useSelectedHostId(); const ps = usePsEntries();` then `useQueries({ queries: (ps.data ?? []).map(r => ({ queryKey: ["rig", r.rigId, "nodes", hostId], queryFn: () => fetchNodeInventory(r.rigId, hostId), staleTime: 15_000 })) })`. **Reuse the same queryKey shape as `useNodeInventory`** (`["rig", rigId, "nodes", hostId]`) so the caches are shared and SSE invalidation (`useActivityFeed` invalidates `["rig", rigId, "nodes"]`) refreshes it. Get `hostId` first, exactly as `useNodeInventory` does: `const hostId = useSelectedHostId();` (from `hooks/useHosts.ts`). Export `fetchNodeInventory` from `useNodeInventory.ts` (add `export`, no other change). Filter to `nodeKind === "agent"`. `isLoading` = ps loading or any query loading; `error` = first error.
2. Rewrite `components/dashboard/Dashboard.tsx` body (keep the exported name `Dashboard` and keep any testids that existing tests assert: run `grep -l "Dashboard" test/*.tsx` and read them first; keep the kernel card component `KernelStatusCard` reachable, see 2.5). Layout, top to bottom, inside `mx-auto max-w-6xl px-6 py-6`:
   1. `PageHeader title="Dashboard" description="What's running, and what needs you."` with actions: `Button variant="outline"` "Import" → `/import`, `Button` "New rig" → `/specs/rig`.
   2. **Needs you** (`data-testid="dashboard-needs-you"`): top 5 of `(useAttentionItems(50, useFeedSubscriptions().anyRemoteEnabled).data?.items ?? [])` (same flag as the Inbox, so remote-host approvals show here too), each row: `StatusDot status="attention_required"`, title = `item.summary ?? first line of item.body`, mono `item.sourceSession`, relative time from `tsUpdated` ("5m ago"; write a tiny `relativeTime(iso)` in `lib/relative-time.ts` with tests), and the `VerbActions` component with `bare`, `qitemId`, `actorSession="human@host"`, `hostId={item.hostId}` (so a remote approval acts on its own host, as `FeedCard.tsx` does), `enabledVerbs={["approve"]}`, `oneClickVerbs={["approve"]}`. Footer link "Open inbox" → `/for-you`. Empty → `EmptyState title="You're all caught up" label="Nothing needs you" description="Approvals and questions from your agents show up here."`.
   3. **Metric tiles** (4-column grid on lg, 2 on sm): "Rigs running" = count of `ps` with `status !== "stopped"`, sublabel "`<n>` total", `to="/topology"`; "Active agents" = sum of `activeCount ?? 0`, sublabel "`<sum runningCount>` alive", `to="/agents"`; "Needs you" = attention count, sublabel "approvals and questions", `to="/for-you"`; "Daemon" = `const { query, signal } = useDaemonHealth()` (hooks/useDaemonHealth.ts; `signal` is `{ controlPlaneUnhealthy: boolean; evidence }`, `query` is the React Query result for `/healthz`) mapped exactly: `query.isError` → `StatusBadge status="error" label="Offline"`; else `signal.controlPlaneUnhealthy` → `status="degraded" label="Degraded"`; else `query.isSuccess` → `status="ready" label="Healthy"`; else → `status="unknown" label="Checking"`. Put this mapping in `lib/daemon-status.ts` as `export function daemonStatus(query, signal): { status: string; label: string }` so C15 reuses it. `to="/settings/status"`.
   4. **Rigs** (`data-testid="dashboard-rigs"`): a table (`components/ui/table.tsx`) of `ps` rows: name (link to `/topology/rig/$rigId`), `StatusBadge status={lifecycleState ?? status}`, agents `activeCount/nodeCount`, "has work" `hasWorkCount`, uptime (mono). Empty → `EmptyState title="No rigs yet" description="A rig is a team of agents defined by a spec. Create one from the Library or import an existing one." action={{ label: "New rig", href: "/specs/rig" }}`.
   5. **Recent activity** (`data-testid="dashboard-activity"`): last 10 events from `useActivityFeed().events`, each one line: relative time, event `type` humanized (`rig.started` → "Rig started"), and the rig/session if present in payload (`payload.rigId`, `payload.session` when string). If none → a one-line muted "No activity yet."
   6. Keep host/kernel controls: move the existing kernel card and host list into a collapsible "Host" section at the bottom (`@radix-ui/react-collapsible`, default closed, `data-testid="dashboard-host-section"`). Do not change their internals.
3. Delete the dashboard's vellum-only decorations from **this component** (destination cards with drawings, "WELCOME BACK, OPERATOR.", field-environment box). Do not delete the files under `components/dashboard/vellum/` in this card (labs still import them); just stop rendering them from `Dashboard.tsx`. If a test asserts they render on `/`, apply rule 4 and log.
4. Tests: `test/use-all-agents.test.tsx` (mock fetch for `/api/ps` and two `/api/rigs/:id/nodes`, expect merged agent rows, infrastructure filtered out) and `test/dashboard-v2.test.tsx` (sections render with seeded query data via a `QueryClient` you pre-fill with `setQueryData` using the exact keys from the hooks; empty states render with empty data). `test/relative-time.test.ts` (now→"just now", 5 min→"5m ago", 3 h→"3h ago", 2 d→"2d ago").

**Acceptance:** the three new test files pass; full suite 0 failed; twin screenshot of `/` shows Needs you, 4 tiles with numbers (twin fixtures: 3 rigs, Active agents 9 = 6+2+1), Rigs table with acme-build / acme-comms / acme-core.

# Hermes dispatch prompt: C05: Nav model + chat-target helpers

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C05, Nav model + chat-target helpers
**Depends on (must already be merged into `ui-redesign`):** C01
**Your branch:** `ui-redesign/c05-nav-model-chat-target-helpers`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C05): Nav model + chat-target helpers`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C05): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C05: Nav model + chat-target helpers

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

### C05: Nav model + chat-target helpers

**Do:**
1. Create `src/lib/chat-targets.ts` and **move** (not copy) `readSettingString` and `resolveChatTo` from `AppShell.tsx` into it, exported unchanged. Update `AppShell.tsx` to import them. Behavior must be byte-for-byte the same.
2. Create `src/lib/nav.ts`:
   ```ts
   import type { ComponentType } from "react";
   import { LayoutDashboard, Inbox, Network, Users, Globe, FolderKanban, Workflow, FileText, Library, Settings, Brain, Wrench } from "lucide-react";

   export interface NavItem {
     id: string;                 // stable id
     label: string;              // sentence case, shown in sidebar + palette
     to: string;                 // URL (unchanged routes)
     icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
     testId: string;             // data-testid on the sidebar link
     activeWhen: (pathname: string) => boolean;
     keywords?: string[];        // extra palette search terms (old names!)
   }
   export interface NavSection { id: string; label: string | null; items: NavItem[] }

   export const NAV_SECTIONS: NavSection[] = [
     { id: "top", label: null, items: [
       { id: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, testId: "rail-dashboard", activeWhen: (p) => p === "/", keywords: ["home"] },
       { id: "inbox", label: "Inbox", to: "/for-you", icon: Inbox, testId: "rail-for-you", activeWhen: (p) => p.startsWith("/for-you"), keywords: ["for you", "attention", "approvals", "needs you"] },
     ]},
     { id: "fleet", label: "Fleet", items: [
       { id: "rigs", label: "Rigs", to: "/topology", icon: Network, testId: "rail-topology", activeWhen: (p) => p.startsWith("/topology") || p.startsWith("/rigs/"), keywords: ["topology", "graph"] },
       { id: "agents", label: "Agents", to: "/agents", icon: Users, testId: "rail-agents", activeWhen: (p) => p === "/agents", keywords: ["seats"] },
       { id: "fleet", label: "Hosts", to: "/fleet", icon: Globe, testId: "rail-fleet", activeWhen: (p) => p.startsWith("/fleet"), keywords: ["fleet", "machines"] },
     ]},
     { id: "work", label: "Work", items: [
       { id: "projects", label: "Projects", to: "/project", icon: FolderKanban, testId: "rail-project", activeWhen: (p) => p.startsWith("/project"), keywords: ["missions", "slices", "workspace"] },
       { id: "workflows", label: "Workflows", to: "/workflows", icon: Workflow, testId: "rail-workflows", activeWhen: (p) => p.startsWith("/workflow"), keywords: [] },
       { id: "files", label: "Files", to: "/files", icon: FileText, testId: "rail-files", activeWhen: (p) => p.startsWith("/files"), keywords: [] },
     ]},
     { id: "build", label: "Build", items: [
       { id: "library", label: "Library", to: "/specs", icon: Library, testId: "rail-specs", activeWhen: (p) => p.startsWith("/specs") || p.startsWith("/plugins"), keywords: ["specs", "skills", "plugins", "context packs"] },
     ]},
   ];

   export const NAV_FOOTER: NavItem[] = [
     { id: "settings", label: "Settings", to: "/settings", icon: Settings, testId: "rail-settings", activeWhen: (p) => p.startsWith("/settings"), keywords: ["preferences", "policies", "log", "status"] },
   ];

   /** Advisor/Operator: `to` is resolved at render time with resolveChatTo(). */
   export const NAV_CHAT: Array<Omit<NavItem, "to" | "activeWhen"> & { role: "advisor" | "operator" }> = [
     { id: "advisor", role: "advisor", label: "Advisor", icon: Brain, testId: "rail-advisor" },
     { id: "operator", role: "operator", label: "Operator", icon: Wrench, testId: "rail-operator" },
   ];

   export function allNavItems(): NavItem[] { return [...NAV_SECTIONS.flatMap((s) => s.items), ...NAV_FOOTER]; }
   ```
   Note: the `/fleet` item's label is **"Hosts"** (it is the cross-host view; "Fleet" is the section). Before using an icon name, confirm it exists: `grep -c "export.*\bFolderKanban\b" node_modules/lucide-react/dist/lucide-react.d.ts` (repeat per icon). If one is missing, pick the nearest that exists and log it.
3. `test/nav.test.ts`: every `testId` unique; every `to` matches a route path in `routes.tsx` (read the file as text and check `path: "<to>"` appears); `allNavItems().map(i=>i.testId)` contains all of `rail-dashboard, rail-topology, rail-for-you, rail-project, rail-specs, rail-settings`; `activeWhen` truth table: `/topology/rig/x` → rigs only; `/rigs/x` → rigs; `/plugins/x` → library; `/` → dashboard only.

**Acceptance:** `npx vitest run test/nav.test.ts` passes; `npx vitest run test/app-shell.test.tsx` still passes (nothing visible changed yet); full suite 0 failed.

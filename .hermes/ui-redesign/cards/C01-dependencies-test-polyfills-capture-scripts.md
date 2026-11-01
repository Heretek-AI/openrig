# Hermes dispatch prompt: C01: Dependencies, test polyfills, capture scripts

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C01, Dependencies, test polyfills, capture scripts
**Depends on (must already be merged into `ui-redesign`):** C00
**Your branch:** `ui-redesign/c01-dependencies-test-polyfills-capture-scripts`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C01): Dependencies, test polyfills, capture scripts`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

**Paths:** `src/…`, `test/…`, `twin/…` mean `packages/ui/src/…`, `packages/ui/test/…`, `packages/ui/twin/…`. Bare `components/…`, `hooks/…`, `lib/…` mean `packages/ui/src/components/…` etc. Run commands from `packages/ui` unless a step says "repo root" or shows a `cd`.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C01): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C01: Dependencies, test polyfills, capture scripts

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

### C01: Dependencies, test polyfills, capture scripts

**Do:**
1. Install exactly (from repo root):
   ```bash
   npm i -w packages/ui cmdk@1.1.1 sonner@2.0.8 @radix-ui/react-dropdown-menu@2.2.1 @radix-ui/react-popover@1.3.1 @radix-ui/react-collapsible@1.2.1
   npm i -w packages/ui -D playwright@1.63.0
   cd packages/ui && npx playwright install chromium
   ```
2. Append to `packages/ui/test/setup.ts` (at the end of the file):
   ```ts
   // ui-redesign C01: jsdom lacks these; cmdk calls scrollIntoView on the active
   // item, and Radix menus call the pointer-capture APIs.
   if (!Element.prototype.scrollIntoView) {
     Element.prototype.scrollIntoView = function scrollIntoView() {};
   }
   if (!Element.prototype.hasPointerCapture) {
     Element.prototype.hasPointerCapture = () => false;
   }
   if (!Element.prototype.releasePointerCapture) {
     Element.prototype.releasePointerCapture = () => {};
   }
   ```
3. Create `packages/ui/test/ui-primitives-deps.test.tsx`:
   ```tsx
   import { render, screen, fireEvent } from "@testing-library/react";
   import { describe, it, expect } from "vitest";
   import { act } from "react";
   import { Command } from "cmdk";
   import { Toaster, toast } from "sonner";
   import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

   describe("ui-redesign dependencies work under jsdom", () => {
     it("cmdk filters items as you type", () => {
       render(
         <Command label="Palette">
           <Command.Input placeholder="Search" />
           <Command.List>
             <Command.Empty>No results</Command.Empty>
             <Command.Item value="Rigs">Rigs</Command.Item>
             <Command.Item value="Inbox">Inbox</Command.Item>
           </Command.List>
         </Command>,
       );
       fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "inb" } });
       expect(screen.queryByText("Rigs")).toBeNull();
       expect(screen.getByText("Inbox")).toBeTruthy();
     });

     it("sonner renders a toast", async () => {
       render(<Toaster />);
       await act(async () => {
         toast.success("Saved");
         await new Promise((r) => setTimeout(r, 50));
       });
       expect(await screen.findByText("Saved")).toBeTruthy();
     });

     it("radix dropdown opens from the keyboard", () => {
       render(
         <DropdownMenu.Root>
           <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
           <DropdownMenu.Portal>
             <DropdownMenu.Content>
               <DropdownMenu.Item>Stop rig</DropdownMenu.Item>
             </DropdownMenu.Content>
           </DropdownMenu.Portal>
         </DropdownMenu.Root>,
       );
       fireEvent.keyDown(screen.getByText("Open"), { key: "Enter" });
       expect(screen.queryByText("Stop rig")).toBeTruthy();
     });
   });
   ```
4. Create `packages/ui/twin/capture/shot.cjs`:
   ```js
   // Usage: node twin/capture/shot.cjs <html-path> <png-path> [width=1440]
   const path = require("node:path");
   const { chromium } = require("playwright");
   (async () => {
     const [html, png, w] = process.argv.slice(2);
     const b = await chromium.launch();
     const p = await b.newPage({ viewport: { width: Number(w || 1440), height: 900 } });
     await p.goto("file://" + path.resolve(html));
     await p.waitForTimeout(3500);
     await p.screenshot({ path: png });
     await b.close();
     console.log("wrote " + png);
   })();
   ```
5. Create `packages/ui/twin/capture/layout-check.cjs`:
   ```js
   // Usage: node twin/capture/layout-check.cjs <html-path> [width=1440]
   // Prints JSON boxes for sidebar/explorer/content; exits 1 on overlap or gap.
   const path = require("node:path");
   const { chromium } = require("playwright");
   (async () => {
     const html = process.argv[2];
     const width = Number(process.argv[3] || 1440);
     const b = await chromium.launch();
     const p = await b.newPage({ viewport: { width, height: 900 } });
     await p.goto("file://" + path.resolve(html));
     await p.waitForTimeout(3000);
     const box = async (sel) => {
       const el = await p.$(sel);
       if (!el) return null;
       const bb = await el.boundingBox();
       return bb && bb.width > 0 ? { left: Math.round(bb.x), right: Math.round(bb.x + bb.width), width: Math.round(bb.width) } : null;
     };
     const rail = await box("[data-testid='app-rail']");
     const explorer = await box("[data-testid='explorer']");
     const content = await box("[data-testid='content-area'] > div");
     const mode = await p.getAttribute("[data-testid='content-area']", "data-explorer-mode").catch(() => null);
     const out = { width, mode, rail, explorer, content, errors: [] };
     if (!rail) out.errors.push("app-rail not visible");
     if (!content) out.errors.push("content-area not visible");
     if (rail && explorer && Math.abs(explorer.left - rail.right) > 1) out.errors.push(`explorer.left ${explorer.left} != rail.right ${rail.right}`);
     if (mode === "opaque" && explorer && content && content.left < explorer.right) out.errors.push(`content.left ${content.left} < explorer.right ${explorer.right}`);
     if (rail && content && content.left < rail.right) out.errors.push(`content.left ${content.left} < rail.right ${rail.right}`);
     console.log(JSON.stringify(out));
     await b.close();
     process.exit(out.errors.length ? 1 : 0);
   })();
   ```
6. Take the before-screenshots: for each file in `.scratch/twin-before/*.html`, run `node twin/capture/shot.cjs <file> ../../docs/ui-redesign/screenshots/before/<same-name>.png 1440`.

**Acceptance:**
- `npx vitest run test/ui-primitives-deps.test.tsx` → `Tests  3 passed (3)`.
- Full suite: 203 files passed, 0 failed.
- `node twin/capture/layout-check.cjs ../../.scratch/twin-before/_specs.html` prints JSON containing `"rail":{"left":0,"right":48,"width":48}` and `"errors":[]`, exit code 0.
- `docs/ui-redesign/screenshots/before/` has 6 PNGs (untracked, do not commit).
- Commit: `packages/ui/package.json`, `package-lock.json`, `packages/ui/test/setup.ts`, `packages/ui/test/ui-primitives-deps.test.tsx`, `packages/ui/twin/capture/shot.cjs`, `packages/ui/twin/capture/layout-check.cjs`.

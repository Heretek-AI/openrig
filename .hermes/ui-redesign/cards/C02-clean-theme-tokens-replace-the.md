# Hermes dispatch prompt: C02: Clean theme tokens + replace the 3 radius/token tests

Copy everything below the line into the coding agent's task.

---

You are implementing **one card** of the OpenRig web UI redesign in the repo `Heretek-AI/openrig`.

**Card:** C02, Clean theme tokens + replace the 3 radius/token tests
**Depends on (must already be merged into `ui-redesign`):** C01
**Your branch:** `ui-redesign/c02-clean-theme-tokens-replace-the`, cut from the latest `origin/ui-redesign`
**Your PR:** into `ui-redesign`, titled `ui(C02): Clean theme tokens + replace the 3 radius/token tests`

Before writing any code:

1. Read `.hermes/ui-redesign/IMPLEMENTATION_PROMPT.md` sections 1 to 5 and section 7 (Gotchas) in full. Your training data is out of date for this repo; trust that file and the source over memory.
2. Read the card below twice.
3. If `docs/ui-redesign/NOTES.md` exists in your clone, read it (earlier cards' discoveries). It is git-ignored on purpose; never commit it.

Rules that matter most for this card:

- Do only this card. If you find work that belongs to another card, write it in NOTES.md and leave it.
- Never skip, delete or weaken a test. Follow rule 4 of section 2 exactly if an assertion encodes old copy or layout, and list every changed assertion in your PR body.
- Stage files explicitly (`git add <paths>`), commit as `ui(C02): <what>`.
- Stop after 3 failed attempts at the same error: write what you tried in NOTES.md and in the PR body, and mark the card blocked.

When every **Acceptance** line passes, push and open the PR with this body:

```markdown
## Card
C02: Clean theme tokens + replace the 3 radius/token tests

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

### C02: Clean theme tokens + replace the 3 radius/token tests

**Do:**
1. Append this block **at the very end** of `packages/ui/src/globals.css` (after the last `.dark .react-flow__node-podGroup` rule). It keeps every token *name* and only changes *values*, so every existing Tailwind class keeps working:
   ```css

   /* =====================================================================
      CLEAN THEME (ui-redesign C02). Overrides the Vellum token VALUES while
      keeping every token NAME, so all existing Tailwind classes keep working.
      This block must stay LAST in globals.css so it wins the cascade.
      --secondary stays a NEUTRAL slate on purpose: many components use
      text-secondary for small labels. Links/focus use the new --brand.
      ===================================================================== */
   :root {
     --background: 0 0% 100%;
     --surface-container-lowest: 0 0% 100%;
     --surface-container-low: 240 5% 97%;
     --surface-container: 240 5% 95%;
     --surface-container-high: 240 5% 92%;
     --surface-container-highest: 240 4% 89%;
     --on-surface: 240 10% 10%;
     --on-surface-variant: 240 4% 42%;
     --secondary: 240 4% 46%;
     --secondary-container: 240 5% 94%;
     --brand: 221 83% 53%;
     --brand-foreground: 0 0% 100%;
     --tertiary: 0 72% 51%;
     --error: 0 72% 51%;
     --primary: 240 6% 10%;
     --inverse-surface: 240 6% 10%;
     --outline: 240 5% 65%;
     --outline-variant: 240 6% 88%;
     --success: 142 71% 36%;
     --warning: 38 92% 50%;
     --ring: var(--brand);
     --radius: 0.5rem;
     --shadow-card: 0 1px 2px 0 rgb(0 0 0 / 0.05);
     --sidebar-width: 15rem;
     --sidebar-width-collapsed: 3.5rem;
   }
   .dark {
     --background: 240 6% 6%;
     --surface-container-lowest: 240 6% 8%;
     --surface-container-low: 240 5% 10%;
     --surface-container: 240 5% 13%;
     --surface-container-high: 240 4% 16%;
     --surface-container-highest: 240 4% 20%;
     --on-surface: 0 0% 95%;
     --on-surface-variant: 240 5% 65%;
     --secondary: 240 5% 65%;
     --secondary-container: 240 4% 16%;
     --brand: 217 91% 60%;
     --brand-foreground: 0 0% 100%;
     --tertiary: 0 84% 60%;
     --error: 0 84% 60%;
     --primary: 0 0% 95%;
     --inverse-surface: 0 0% 95%;
     --outline: 240 4% 46%;
     --outline-variant: 240 4% 20%;
     --success: 142 69% 45%;
     --warning: 38 92% 55%;
     --shadow-card: 0 1px 2px 0 rgb(0 0 0 / 0.4);
   }
   * { border-color: hsl(var(--outline-variant)); }
   body, .dark body { background-image: none; }
   .vellum, .vellum-heavy, .dark .vellum, .dark .vellum-heavy {
     background: hsl(var(--surface-container-lowest));
     backdrop-filter: none;
     -webkit-backdrop-filter: none;
   }
   .hard-shadow, .hard-shadow-light, .dark .hard-shadow { box-shadow: var(--shadow-card); }
   .hard-shadow-hover:hover, .dark .hard-shadow-hover:hover { box-shadow: var(--shadow-card); translate: none; }
   .reg-tl, .reg-tr, .reg-bl, .reg-br, .reg-mark::before, .reg-mark::after { display: none; }
   ```
2. In `packages/ui/tailwind.config.ts`, replace the whole `borderRadius: { ... },` object (the one under `theme`, currently all `"0px"` except `full`) with exactly:
   ```ts
   borderRadius: {
     none: "0px",
     sm: "calc(var(--radius) - 4px)",
     DEFAULT: "calc(var(--radius) - 2px)",
     md: "calc(var(--radius) - 2px)",
     lg: "var(--radius)",
     xl: "calc(var(--radius) + 4px)",
     "2xl": "calc(var(--radius) + 8px)",
     "3xl": "calc(var(--radius) + 12px)",
     full: "9999px",
   },
   ```
   and add to `theme.extend.colors`:
   ```ts
   brand: { DEFAULT: "hsl(var(--brand))", foreground: "hsl(var(--brand-foreground))" },
   ring: "hsl(var(--ring))",
   ```
   (Verified: there is no `ring` key in `theme.extend.colors` today. Put both lines right after the existing `accent: "hsl(var(--secondary))",` line.)
3. Replace the 3 failing tests. In `test/tailwind-foundation.test.tsx`:
   - Replace the body of `it("design tokens are present on :root via globals.css", …)` with:
     ```tsx
     render(<div>probe</div>);
     const styles = getComputedStyle(document.documentElement);
     // Clean theme (ui-redesign C02) values; the CLEAN THEME block is last in globals.css.
     expect(styles.getPropertyValue("--background").trim()).toContain("0 0% 100%");
     expect(styles.getPropertyValue("--on-surface").trim()).toContain("240 10% 10%");
     expect(styles.getPropertyValue("--primary").trim()).toContain("240 6% 10%");
     expect(styles.getPropertyValue("--tertiary").trim()).toContain("0 72% 51%");
     expect(styles.getPropertyValue("--brand").trim()).toContain("221 83% 53%");
     ```
   - Rename `it("ALL borderRadius tokens are 0px", …)` to `it("borderRadius tokens derive from --radius (Clean theme)", …)` and make its body:
     ```tsx
     const config = readFileSync(resolve(__dirname, "../tailwind.config.ts"), "utf-8");
     const radiusMatch = config.match(/borderRadius:\s*\{([^}]+)\}/);
     expect(radiusMatch).not.toBeNull();
     const pairs = [...radiusMatch![1]!.matchAll(/(\w+):\s*"([^"]+)"/g)];
     expect(pairs.length).toBeGreaterThanOrEqual(6);
     for (const [, key, value] of pairs) {
       if (key === "full") expect(value).toBe("9999px");
       else if (key === "none") expect(value).toBe("0px");
       else expect(value).toContain("var(--radius)");
     }
     const css = readFileSync(resolve(__dirname, "../src/globals.css"), "utf-8");
     expect(css).toMatch(/--radius:\s*0\.5rem;/);
     ```
   - In `test/design-compliance.test.tsx`, in `it("no non-zero border-radius in any component", …)`: rename it to `it("border radius comes only from the --radius token scale", …)`. Replace the **config loop** (the `for (const [, key, value] of pairs)` block that expects `"0px"`) with the same three-branch loop as above. **Keep** the second half that scans component sources for inline `borderRadius: <number>` and expects 0. Do not touch the other tests in that file.
4. Do **not** delete the Vellum `:root` / `.dark` blocks or the `.reg-*` / `.vellum` rules above. Other tests read those CSS sources (`test/registration-marks.test.tsx` asserts the `.reg-*` rules exist). The override block neutralizes them.

**Acceptance:**
- `npx vitest run test/tailwind-foundation.test.tsx test/design-compliance.test.tsx test/registration-marks.test.tsx` → all pass.
- Full suite: 0 failed; test count unchanged from C01.
- `TWIN_ROUTE=/ npm run twin:build && node twin/capture/shot.cjs twin-out/intent.html /tmp/c02.png` → the top bar and rail are white and there is **no dot grid**. The dashboard's own beige, diagonally hatched panel stays: it comes from `components/dashboard/dashboard-fidelity.css` and goes away in C10. Pages still look "uppercase mono"; that is fixed card by card.
- `npx tsc --noEmit -p tsconfig.json` prints nothing (verified with this exact block applied: 203 test files passed, 1790 tests passed, tsc clean).
- In the same screenshot, small labels such as "HOSTS" are grey, **not blue**. (If they are blue, you set `--secondary` to the brand blue; see Gotcha 3.)

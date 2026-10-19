# Implementation brief: session continuity for community agent apps (discussion #43)

## 1. Mission

You are adding **format 2** to OpenRig's community agent-app presets. A format-2 preset can declare a `session` block that tells OpenRig how to resume the app's conversation by id, how to ask whether an id still exists, and how to list the app's sessions so OpenRig can record which session a seat started. With this, an app such as OpenCode (1.x or 2.0) can be stopped and brought back by `rig launch` with its conversation intact, with no OpenCode-specific code in OpenRig core. That is the first capability step of the "declarative preset table" path that the maintainer described for discussion #43 (`mvschwarz/openrig` discussions/43).

Read this whole file before you write any code. Your training data is out of date for this project: OpenRig changes daily and the agent-app code you need is from 17 October 2026. Every fact below was checked by running it on 18 October 2026. When this file and your memory disagree, this file wins. When this file and the code disagree, the code wins, and you write the difference down in your notes file (rule 6).

## 2. How to work

1. Do the milestones in order. Don't start a milestone until the previous one's **Acceptance** passes exactly as written.
2. Commit once per milestone, staging files by name (`git add path/one path/two`). Never `git add -A` or `git add .`. Commit message: `feat(daemon): <what the milestone did>` (or `test(daemon):` / `docs:` where that fits).
3. Never skip, delete, `.skip`, or weaken a test, and never loosen an assertion to make it pass. The only existing test you change is the one named in M2, in the exact way M2 says.
4. Never invent an API. When you need to know how something in OpenRig works, look it up in this order: (a) the TypeScript types in the file that defines it, (b) the source of the function, (c) a throwaway experiment you run. Never rely on memory of OpenRig, OpenCode, Node or vitest APIs.
5. The daemon package uses Node's ESM: every relative import ends in `.js` even though the file is `.ts` (for example `import { shellQuote } from "../adapters/shell-quote.js";`).
6. Keep a notes file at `$NOTES` (set in section 3). After every milestone, append what you found, every place the code differed from this brief, and the exact command plus output that showed it.
7. If the same error survives 3 honest attempts, stop. Write in `$NOTES` what you tried, the exact error, and your best guess, then stop and report. Don't thrash.
8. Hard rules found while preparing this brief:
   - Never run a command through a shell built from preset text or a session id. Commands from a preset run with `spawn(argv[0], argv.slice(1), { shell: false })`. The only string typed into a pane is built by `shellLineFor` (every element single-quoted).
   - Never put a session id in an error message, log line, or event. Session ids are credential-class in OpenRig (see the header comment of `packages/daemon/src/domain/resume-token-validation.ts`).
   - Never run real OpenCode, Claude Code, Codex or any real agent app in tests. Tests use the synthetic app in `packages/daemon/test/fixtures/agent-app/synth-session-app.mjs`.
   - Never touch the real `~/.openrig`, `~/.local/share/opencode`, or any real home. The integration test helper `prepareHermeticEnv` gives you a private home and tmux socket.
   - No version bump and no `CHANGELOG.md` edit (the repository's PR template forbids both).
   - Don't open a pull request against `mvschwarz/openrig`. Push your branch to the fork and stop (M12). A human opens the upstream PR.

## 3. Paths and setup

Run everything from a fresh clone. These commands are exact:

```bash
export WORK="$HOME/src"                     # any directory you own; create it if missing
export REPO="$WORK/openrig"
export NOTES="$WORK/openrig-notes/NOTES.md" # outside the repo on purpose: notes never go into the PR
export BRIEF="/absolute/path/to/IMPLEMENTATION_PROMPT.md"  # this file, wherever you saved it; M2-M10 extract patches from it
mkdir -p "$WORK/openrig-notes" && touch "$NOTES"
git clone https://github.com/Heretek-AI/openrig "$REPO"
cd "$REPO"
git remote add upstream https://github.com/mvschwarz/openrig
git fetch upstream main
git checkout -b feat/agent-app-session-continuity ca1ee698   # exactly this commit: every patch below applies cleanly to it
git log --oneline -1   # expect: ca1ee698 fix(daemon): keep a member's mechanic when re-serializing a rig spec (#1464)
```

Toolchain (must match `"engines": { "node": "^22 || ^24" }` in the root `package.json`):

```bash
node --version   # expect v22.x or v24.x (checked with v22.22.0)
tmux -V          # any tmux 3.x; the integration tests need it
npm ci           # expect "added 4xx packages", exit 0
npm run build    # expect exit 0; builds daemon, ui, cli, tui. The integration tests run the built CLI.
```

Files you will read before changing (all paths relative to `$REPO/packages/daemon`):

| File | What to take from it |
|---|---|
| `src/domain/agent-app-presets.ts` | The preset loader you extend in M2. Keep its error-message style. |
| `src/domain/built-in-runtimes.ts` | `agentAppOf(agentApp, runtime)`: the one test for "this seat was launched for an agent app". |
| `src/adapters/agent-app-runtime-adapter.ts` | `AgentAppRuntimeAdapter.launchHarness`, which refuses resume today. You change it in M5. |
| `src/adapters/pi-runtime-adapter.ts` lines 245-258 | The model for a missing conversation: `{ ok: false, error, recovery: "retry_fresh", missingConversation: true }`. |
| `src/domain/restore-orchestrator.ts` | Two launch-only gates you relax in M6: `snapshotLaunchOutcome` (around line 143) and the pre-launch check (around line 924). |
| `src/domain/resume-metadata-refresher.ts` | The `refresh()` loop that fills null tokens. You add an agent-app branch in M7. |
| `src/domain/session-registry.ts` | `getLatestLiveSessions`, `updateResumeToken`, `sessionAgentAppSelect`. |
| `test/agent-app-runtime.test.ts` | Unit-test style to copy. |
| `test/agent-app-runtime.integration.test.ts` | End-to-end harness to copy in M9 (real CLI, daemon, SQLite, private tmux). |

Nothing is ported from other repositories, so there are no new license obligations. The files this brief gives you verbatim are original to this work.

## 4. Verified facts

### 4.1 What main does today (ca1ee698)

- A preset is `$OPENRIG_HOME/agent-apps/<name>.yaml` with exactly the fields `format, name, command, maintainer, limits`, and `format` must be `1`. Any other field makes the preset unusable with `unknown field <x> (format 1 has format, name, command, maintainer, limits)`.
- `AgentAppRuntimeAdapter.launchHarness` refuses a resume token with `Resume is unsupported: agent app "<name>" is launch-only. No session was started.` and a fork with `Fork is unsupported: agent app "<name>" is launch-only. Remove session_source for this member.`
- `restore-orchestrator.ts` refuses to resume any agent-app seat in two places: `snapshotLaunchOutcome` returns `{ kind: "decision", why: "is an agent app whose preset is launch-only (resume unsupported)" }`, and the pre-launch check returns `Resume is unsupported for agent app "<name>": its preset is launch-only. ...`.
- A seat counts as an agent-app seat only when `agentAppOf(session.agentApp, runtime)` is true. `sessions.agent_app` is written only when the seat was launched through the preset path. A free-text seat whose runtime string happens to match a preset name is **not** an agent-app seat. Never test `isAgentAppRuntime(runtime)` alone.
- `sessions.created_at` is written by SQLite `datetime('now')`: the text `YYYY-MM-DD HH:MM:SS` in UTC, with no `T` and no `Z`. `sqliteUtcToMs("2026-10-18 17:00:00")` must return `Date.parse("2026-10-18T17:00:00Z")`.
- `ResumeMetadataRefresher.refresh(sessions, { fillNullOnly: true })` runs before every manual snapshot (`src/routes/snapshots.ts`), every periodic snapshot (`src/domain/periodic-snapshot-scheduler.ts`) and `rig up --existing` (`src/routes/startup.ts`). `rig down` calls `refresh(liveSessions)` without `fillNullOnly` (`src/domain/rig-teardown.ts`). All of them pass rows from `SessionRegistry.getLatestLiveSessions`, which on main does not select `agent_app` or `created_at`. M7 adds both.
- The startup orchestrator stores `launchResult.resumeToken` with `updateResumeToken(..., "scrape")` when `launchHarness` returns `{ ok: true, resumeToken, resumeType }`. So M5's resume path records the id again on the new session without extra code.
- The pod-aware restore sets `allowFreshFallback: !(isPodAware && resumeRequested)`. A failed resume therefore never silently starts a fresh session. `{ ok: false, recovery: "retry_fresh", missingConversation: true }` from `launchHarness` turns into `status: "awaiting-decision"` from `rig launch`. M9 checks this.

### 4.2 OpenCode, checked on 1.19.3 (`opencode-ai`) and 2.0 beta (`@opencode-ai/cli@0.0.0-beta-19271`, binary `opencode2`)

You won't run OpenCode. These facts are why the synthetic app behaves the way it does.

| Behaviour | 1.x | 2.0 |
|---|---|---|
| `session list --format json` | works, exit 0 | works, exit 0 |
| Fields per row | `id, title, updated, created, projectId, directory` | `id, updated, created, projectId, directory` (no `title`) |
| `created` | epoch milliseconds (number) | epoch milliseconds (number) |
| Which sessions are listed | top-level only. In a directory that isn't a git repository, every session in the "global" project, **including other directories' sessions** | top-level only, by project |
| Time for `session list` | about 19 s in a cold container | about 3-10 s; it starts a background server first, and stdout stays pure JSON |
| `export <id>` for an existing id | exit 0, prints the whole conversation (can be megabytes) | exit 0 |
| `export <id>` for an unknown id | exit 1 | exit 1 |
| `--session <unknown id>` in the TUI | errors | **opens a blank new session with no error** |
| When a session is created | on the first prompt, not at launch | on the first prompt, not at launch |
| `--model`, `--fork` flags | exist | don't exist (`Unrecognized flag: --fork in command opencode2`) |

Captured 2.0 output of `opencode2 session list --format json` (use it as a fixture shape):

```json
[
  {
    "id": "ses_eb000da70ffethG9u5cxPdc6F8",
    "updated": 1792343485845,
    "created": 1792343485038,
    "projectId": "122af653b277232b9e5ed06aa4bf03b8ed8254d8",
    "directory": "/tmp/w2"
  }
]
```

Captured 1.x output (this exact string is a test fixture in M3):

```json
[
  {
    "id": "ses_eb0008bd3ffefl70GhSQLjB7M2",
    "title": "New session - 2026-10-18T17:11:43.924Z",
    "updated": 1792343503926,
    "created": 1792343503925,
    "projectId": "global",
    "directory": "/tmp/w1"
  }
]
```

**The surprises, and what the design does about each:**

1. **2.0 opens a blank session for an id it doesn't know, with no error.** A resume that only types `opencode2 --session <id>` would look like it worked while losing the conversation. So the adapter asks the preset's `exists` command first, and exit 1 stops the launch with `missingConversation: true`.
2. **1.x lists other directories' sessions** outside a git repository. Capture keeps only rows whose `directory` is the seat's cwd (as recorded or as `realpath`), created at or after the seat's `sessions.created_at`, and not already held by another seat, and it records an id only when **exactly one** row survives.
3. **Sessions exist only after the first prompt.** You can't capture at launch. Capture happens in the refresher, at snapshot and `rig down` time, and only fills a null token.
4. **`export` output can be huge.** `exists` runs with stdout ignored (`stdio: "ignore"`), and only the exit code counts.

### 4.3 The synthetic app (`test/fixtures/agent-app/synth-session-app.mjs`, added in M3)

It behaves like OpenCode in the four ways above. Exact behaviour, checked:

```text
$ node synth-session-app.mjs                     # prints, then waits for lines on stdin
synth ready: new session
remember the word heron                          # (typed)
synth heard (ses_1ecf2918edb4bcaa19): remember the word heron
$ node synth-session-app.mjs --session ses_1ecf2918edb4bcaa19
synth ready: resumed ses_1ecf2918edb4bcaa19
$ node synth-session-app.mjs --session ses_nope0000000
Error: Session not found: ses_nope0000000        # exit 1
$ node synth-session-app.mjs export ses_1ecf2918edb4bcaa19 >/dev/null; echo $?
0
$ node synth-session-app.mjs export ses_nope0000000 >/dev/null; echo $?
1
$ node synth-session-app.mjs session list --format json
[ { "id": "ses_1ecf2918edb4bcaa19", "created": 1792345080123, "updated": 1792345080123, "directory": "/path/where/it/ran" } ]
```

State lives in `$SYNTH_APP_HOME`, or `$HOME/.synth-session-app` when that's unset, as one `sessions/<id>.json` file per session. Ids look like `ses_` plus 18 hex characters.

### 4.4 OpenRig output you will see

- `rig launch <rigId> work.worker --json` after a successful resume prints JSON matching `{ ok: true, launched: [{ logicalId: "work.worker", status: "resumed", ... }] }`. The status is in `launched[0].status`, **not** at the top level.
- When `exists` says the session is gone, the same command exits non-zero and prints JSON with `status: "awaiting-decision"` and an `error` containing `reports that the saved conversation no longer exists`. No tmux session exists afterwards.
- The pane line `synth ready: resumed <id>` may have scrolled off the visible screen by the time you look. Capture with scrollback: `tmux capture-pane -p -S -500`.
- In this container, the full daemon suite (`cd packages/daemon && npx vitest run`) took about 18 minutes and **24 test files already failed on unchanged main**, for environment reasons (no docker, timeouts, a missing CLI build, the fetch guard). `test/slow-op-recorder.test.ts` is one of them. When many integration files run in parallel, `test/agent-app-runtime.integration.test.ts` can fail with `did not respond in time` from the daemon; run alone, it passes 11/11. That's why M1 records your own baseline list and M11 compares against it.

### 4.5 Not verified, be careful

Check each of these where the milestone says, and write the answer in `$NOTES`.

1. **Environment for `list` and `exists`.** They run in the daemon's process environment (its `PATH` and `HOME`), not the seat's pane. In the hermetic test both are the same. On a real machine the daemon may have a different `PATH` from the user's shell, so an app found in the pane may be missing for the daemon. In that case `exists` returns null (resume goes ahead) and `list` returns null (nothing is captured). Nothing breaks silently in a dangerous way, but write the behaviour in the PR's "Anything you were unsure about".
2. **Is `node.cwd` always absolute?** The capture matches the app's `directory` against the recorded cwd and its `realpath`. In M1, run `sqlite3 "$OPENRIG_HOME/openrig.sqlite" "select cwd from nodes limit 5"` inside an integration scaffold, or read `src/domain/startup-orchestrator.ts` for how cwd is stored, and record the answer. If it can be relative, write that down and stop (rule 7); don't guess a fix.
3. **A slow `list` on 1.x** (about 19 s) runs inside snapshot and `rig down` for each agent-app seat that has no token yet. It's bounded by the 60 s timeout, but it makes those commands slower. Report it in the PR. Don't add caching.
4. **Fill-null-only means no refresh after the app switches sessions** (for example OpenCode's `/new`). The token stays on the first session. That's intended for now. Report it in the PR.
5. **Real OpenCode was never run through OpenRig.** Only the synthetic app was. Say so in the PR.

## 5. Target layout

Paths relative to `$REPO`. Nothing else changes.

```text
docs/reference/agent-app-presets.md                          # NEW (M10): formats 1 and 2, with an OpenCode example
packages/cli/src/commands/agent-app.ts                       # M4: `rig agent-app list` says when a preset declares resume
packages/cli/src/commands/ps.ts                              # M4: the seat line gains "; resume declared|not declared"
packages/cli/test/agent-app-line.test.ts                     # NEW (M4): formatAgentAppLine with and without resume
packages/daemon/src/adapters/agent-app-runtime-adapter.ts    # M5: resume via the preset, exists-check first
packages/daemon/src/domain/agent-app-presets.ts              # M2: format 2 + session block; M4: label field
packages/daemon/src/domain/agent-app-sessions.ts             # NEW (M3): id checks, argv render, run, list, pick
packages/daemon/src/domain/restore-orchestrator.ts           # M6: two gates let a format-2 seat with an agent_app_session token resume
packages/daemon/src/domain/resume-metadata-refresher.ts      # M7: capture the seat's app session into a null token
packages/daemon/src/domain/session-registry.ts               # M7: agent_app + created_at on live sessions; held ids
packages/daemon/src/routes/agent-apps.ts                     # M4: `resumes` on GET /api/agent-apps
packages/daemon/test/agent-app-runtime.test.ts               # M2: ONE row changes (format 3 is now the unknown one)
packages/daemon/test/agent-app-session-resume.test.ts        # NEW (M8): adapter, label and refresher units
packages/daemon/test/agent-app-session.integration.test.ts   # NEW (M9): real CLI + daemon + tmux, resume and missing
packages/daemon/test/agent-app-sessions.test.ts              # NEW (M3): format 2 parsing, ids, list, pick, real exec
packages/daemon/test/fixtures/agent-app/synth-session-app.mjs # NEW (M3): the synthetic session app
```

No new dependency, no `package.json` change, no tsconfig change, no migration. vitest is already configured per package (`npx vitest run <file>` from the package directory).

## 6. Milestones

How to apply a patch: don't retype or copy it by hand. Each patch is fenced with four backticks instead of three, because the M10 patch itself contains three-backtick fences. Extract it from this file with the function below, then apply it from `$REPO`:

```bash
extract() { awk -v want="Patch $1 (save" 'index($0,want)==1{f=1;next} f&&/^````diff$/{p=1;next} p&&/^````$/{exit} p{print}' "$BRIEF"; }
mkdir -p "$WORK/patches"
extract M2 > "$WORK/patches/M2.patch"          # same for M3 ... M10
cd "$REPO" && git apply --check "$WORK/patches/M2.patch" && git apply "$WORK/patches/M2.patch"
```

`--check` must print nothing. If it prints anything, you aren't on `ca1ee698` plus the earlier milestones: stop and fix that (rule 7), don't edit the patch. Read every patch you apply, line by line, before you commit it: you are responsible for it, and M12 asks you to justify each hunk.

### M1. Learn the system and record the baseline

**Do:**

1. Finish section 3 (clone, `npm ci`, `npm run build`).
2. Run the existing agent-app tests so you see the launch-only behaviour you're about to change:
   ```bash
   cd "$REPO/packages/daemon"
   npx vitest run test/agent-app-runtime.test.ts
   npx vitest run test/agent-app-runtime.integration.test.ts   # about 4 minutes; needs tmux
   ```
3. Record the full-suite baseline (about 18 minutes). Save the list of failing files:
   ```bash
   cd "$REPO/packages/daemon"
   npx vitest run > "$WORK/openrig-notes/baseline-daemon.txt" 2>&1; echo "RC=$?" >> "$WORK/openrig-notes/baseline-daemon.txt"
   grep -E "^ (❯|×) test/|FAIL  test/" "$WORK/openrig-notes/baseline-daemon.txt" | sed -E 's/ > .*//; s/^ *(❯|×|FAIL) +//; s/ \(.*//' | sort -u > "$WORK/openrig-notes/baseline-failing-files.txt"
   wc -l < "$WORK/openrig-notes/baseline-failing-files.txt"
   ```
4. Answer "Not verified" item 2 (is `node.cwd` always absolute?) by reading where the startup orchestrator writes `nodes.cwd`, and record the answer and the `file:line` in `$NOTES`.

**Acceptance:**
- `test/agent-app-runtime.test.ts` passes (it has 42 tests at ca1ee698).
- `test/agent-app-runtime.integration.test.ts` passes 11/11.
- `baseline-failing-files.txt` exists. Its count is in `$NOTES`. Expect roughly 24 entries; any number is fine, as long as it's recorded.
- `$NOTES` has the commit id, `node --version`, the baseline count and the cwd answer.
- No commit in this milestone.

### M2. Preset format 2

**Do:** apply this patch. It:
- raises `AGENT_APP_PRESET_FORMAT` to 2 and reads formats 1 and 2. Format 1 keeps exactly its old fields, so `session` in a format-1 file is still an unknown field.
- adds `AgentAppSessionSpec` and the optional `session` block, parsed by `parseSession` and `parseArgv`. Every command is a YAML list (an argv), never a string. `{session_id}` must be a whole element, required in `resume` and `exists`, forbidden in `list`, and never the program. No element may hold a newline or NUL. `id_pattern` must start with `^`, end with `$` and compile.
- exports `SESSION_ID_PLACEHOLDER` and `agentAppResumes(name, dir?)`.
- changes the one existing test row whose expectation names "format 1" as the only readable format.

Patch M2 (save as `M2.patch`):

````diff
diff --git a/packages/daemon/src/domain/agent-app-presets.ts b/packages/daemon/src/domain/agent-app-presets.ts
index f568ba39..bf38f29a 100644
--- a/packages/daemon/src/domain/agent-app-presets.ts
+++ b/packages/daemon/src/domain/agent-app-presets.ts
@@ -11,16 +11,38 @@ import { BUILT_IN_RUNTIMES, isAgentAppRuntime } from "./built-in-runtimes.js";
 
 export { BUILT_IN_RUNTIMES, isAgentAppRuntime };
 
-export const AGENT_APP_PRESET_FORMAT = 1;
-const FIELDS = ["format", "name", "command", "maintainer", "limits"] as const;
+/** The newest preset format this OpenRig reads. Format 1 is launch-only; format 2 adds the optional `session` block. */
+export const AGENT_APP_PRESET_FORMAT = 2;
+const READABLE_FORMATS: readonly number[] = [1, 2];
+const FIELDS_BY_FORMAT: Record<number, readonly string[]> = {
+  1: ["format", "name", "command", "maintainer", "limits"],
+  2: ["format", "name", "command", "maintainer", "limits", "session"],
+};
+const SESSION_FIELDS = ["id_pattern", "resume", "exists", "list"] as const;
+/** The one placeholder a session argv may hold, as a whole element. */
+export const SESSION_ID_PLACEHOLDER = "{session_id}";
 const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
 
+/** How OpenRig continues an app's conversation. Each command is an argv run or typed without shell syntax. */
+export interface AgentAppSessionSpec {
+  /** Anchored regular expression every session id must match before it reaches a command line. */
+  idPattern: string;
+  /** Typed into the seat's pane to resume; holds `{session_id}` as a whole element. */
+  resume: string[];
+  /** Run in the seat's cwd: exit 0 when the session exists, 1 when it doesn't. Holds `{session_id}`. */
+  exists?: string[];
+  /** Run in the seat's cwd: prints a JSON array of {id, created, directory?}. No placeholder. */
+  list?: string[];
+}
+
 export interface AgentAppPreset {
   name: string;
   command: string;
   maintainer: string;
   limits: string[];
   path: string;
+  /** Present only on a format-2 preset that declares session continuity; absent means launch-only. */
+  session?: AgentAppSessionSpec;
 }
 
 export type AgentAppPresetLookup =
@@ -38,11 +60,13 @@ function parsePreset(name: string, path: string, text: string): AgentAppPresetLo
   try { doc = parseYaml(text); } catch { return bad("it isn't valid YAML"); }
   if (!doc || typeof doc !== "object" || Array.isArray(doc)) return bad("it isn't a YAML mapping");
   const raw = doc as Record<string, unknown>;
-  if (raw.format !== AGENT_APP_PRESET_FORMAT) {
-    return bad(`it declares format ${JSON.stringify(raw.format ?? null)}; this OpenRig reads format ${AGENT_APP_PRESET_FORMAT}`);
+  if (typeof raw.format !== "number" || !READABLE_FORMATS.includes(raw.format)) {
+    return bad(`it declares format ${JSON.stringify(raw.format ?? null)}; this OpenRig reads formats ${READABLE_FORMATS.join(" and ")}`);
   }
-  const unknown = Object.keys(raw).filter(key => !(FIELDS as readonly string[]).includes(key));
-  if (unknown.length) return bad(`unknown field${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")} (format ${AGENT_APP_PRESET_FORMAT} has ${FIELDS.join(", ")})`);
+  const format = raw.format;
+  const fields = FIELDS_BY_FORMAT[format]!;
+  const unknown = Object.keys(raw).filter(key => !fields.includes(key));
+  if (unknown.length) return bad(`unknown field${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")} (format ${format} has ${fields.join(", ")})`);
   if (raw.name !== name) return bad(`its name is ${JSON.stringify(raw.name ?? null)}, not "${name}" (the file name)`);
   for (const key of ["command", "maintainer"] as const) {
     if (typeof raw[key] !== "string" || !(raw[key] as string).trim()) return bad(`${key} must be a non-empty string`);
@@ -55,7 +79,55 @@ function parsePreset(name: string, path: string, text: string): AgentAppPresetLo
   if (!Array.isArray(limits) || limits.some(limit => typeof limit !== "string" || !limit.trim())) {
     return bad("limits must be a list of non-empty strings");
   }
-  return { ok: true, preset: { name, command: raw.command as string, maintainer: raw.maintainer as string, limits: limits as string[], path } };
+  let session: AgentAppSessionSpec | undefined;
+  if (raw.session !== undefined) {
+    const parsed = parseSession(raw.session);
+    if (typeof parsed === "string") return bad(`session: ${parsed}`);
+    session = parsed;
+  }
+  return { ok: true, preset: { name, command: raw.command as string, maintainer: raw.maintainer as string, limits: limits as string[], path,
+    ...(session ? { session } : {}) } };
+}
+
+/** An argv from YAML, or why it can't be one. `placeholder` says whether `{session_id}` must, or must not, appear. */
+function parseArgv(value: unknown, key: string, placeholder: "required" | "forbidden"): string[] | string {
+  if (!Array.isArray(value) || value.length === 0) return `${key} must be a non-empty list of strings (an argv, not a shell line)`;
+  for (const arg of value) {
+    if (typeof arg !== "string" || arg.length === 0) return `${key} must be a non-empty list of non-empty strings`;
+    if (/[\n\r\0]/.test(arg)) return `${key} can't hold a newline or NUL`;
+    if (arg !== SESSION_ID_PLACEHOLDER && arg.includes("{session_id}")) return `${key}: {session_id} must be a whole element, not part of "${arg}"`;
+  }
+  const args = value as string[];
+  if (args[0] === SESSION_ID_PLACEHOLDER) return `${key}: the first element is the program and can't be {session_id}`;
+  const has = args.includes(SESSION_ID_PLACEHOLDER);
+  if (placeholder === "required" && !has) return `${key} must hold {session_id} as one element`;
+  if (placeholder === "forbidden" && has) return `${key} can't hold {session_id}`;
+  return args;
+}
+
+function parseSession(value: unknown): AgentAppSessionSpec | string {
+  if (!value || typeof value !== "object" || Array.isArray(value)) return "must be a mapping";
+  const raw = value as Record<string, unknown>;
+  const unknown = Object.keys(raw).filter(key => !(SESSION_FIELDS as readonly string[]).includes(key));
+  if (unknown.length) return `unknown field${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")} (session has ${SESSION_FIELDS.join(", ")})`;
+  if (typeof raw.id_pattern !== "string" || !raw.id_pattern.startsWith("^") || !raw.id_pattern.endsWith("$")) {
+    return "id_pattern must be a regular expression anchored with ^ and $";
+  }
+  try { new RegExp(raw.id_pattern); } catch { return "id_pattern isn't a valid regular expression"; }
+  const resume = parseArgv(raw.resume, "resume", "required");
+  if (typeof resume === "string") return resume;
+  const spec: AgentAppSessionSpec = { idPattern: raw.id_pattern, resume };
+  if (raw.exists !== undefined) {
+    const exists = parseArgv(raw.exists, "exists", "required");
+    if (typeof exists === "string") return exists;
+    spec.exists = exists;
+  }
+  if (raw.list !== undefined) {
+    const list = parseArgv(raw.list, "list", "forbidden");
+    if (typeof list === "string") return list;
+    spec.list = list;
+  }
+  return spec;
 }
 
 /** The first shell construct in a preset command, or null when it's one program with its arguments. The command is
@@ -113,6 +185,13 @@ export function loadAgentAppPreset(name: string, dir: string = agentAppsDir()):
   return parsePreset(name, path, text);
 }
 
+/** Whether the installed preset for this app declares session continuity (format 2 with a `session` block). A
+ *  missing or unusable preset, or one without the block, is launch-only. */
+export function agentAppResumes(name: string, dir: string = agentAppsDir()): boolean {
+  const found = loadAgentAppPreset(name, dir);
+  return found.ok && found.preset.session !== undefined;
+}
+
 /** Every preset file in the directory, usable or not, sorted by name. */
 export function listAgentAppPresets(dir: string = agentAppsDir()): AgentAppPresetLookup[] {
   if (!existsSync(dir)) return [];
diff --git a/packages/daemon/test/agent-app-runtime.test.ts b/packages/daemon/test/agent-app-runtime.test.ts
index 938b876c..9bfbb73d 100644
--- a/packages/daemon/test/agent-app-runtime.test.ts
+++ b/packages/daemon/test/agent-app-runtime.test.ts
@@ -47,7 +47,7 @@ describe("agent app presets", () => {
 
   it.each([
     ["a missing file", {}, "missing", `no agent app preset named "synth" is installed`],
-    ["another format", { "synth.yaml": GOOD.replace("format: 1", "format: 2") }, "incompatible", "it declares format 2; this OpenRig reads format 1"],
+    ["another format", { "synth.yaml": GOOD.replace("format: 1", "format: 3") }, "incompatible", "it declares format 3; this OpenRig reads formats 1 and 2"],
     ["a field this format doesn't read", { "synth.yaml": `${GOOD}resume: --resume {token}\n` }, "incompatible", "unknown field resume"],
     ["a name that isn't the file's", { "synth.yaml": GOOD.replace("name: synth", "name: other") }, "incompatible", `its name is "other", not "synth"`],
     ["no command", { "synth.yaml": GOOD.replace("command: synth-app --serve\n", "") }, "incompatible", "command must be a non-empty string"],
````

**Acceptance:**
```bash
cd "$REPO/packages/daemon"
npx tsc --noEmit -p .                       # exit 0, no output
npx vitest run test/agent-app-runtime.test.ts   # 42 passed
```
Commit: `feat(daemon): read agent-app preset format 2 with an optional session block`.

### M3. The session helpers, the synthetic app and their tests

**Do:** apply this patch. It adds:
- `src/domain/agent-app-sessions.ts`. Read every function's comment. The rules it enforces:
  - `checkAgentAppSessionId`: trims, then requires `/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/` (the shell-inert floor: no leading `-` or `.`, so an id never reads as an option or a path), then the preset's `id_pattern`. Its error text **never** includes the id.
  - `runArgv`: `spawn(argv[0], argv.slice(1), { shell: false })`, stderr ignored, stdout kept only when asked and capped at 1 MiB, killed after the timeout. It never throws.
  - `agentAppSessionExists`: `true` on exit 0, `false` on exit 1, `null` for everything else, including "no `exists` declared".
  - `parseSessionList` keeps rows with string `id` and finite number `created`. It returns `null` for anything that isn't a JSON array.
  - `pickSeatSession` returns an id only when exactly one row is new enough, in the seat's directory (or reports none), not held by another seat, and passes the id checks.
- `test/fixtures/agent-app/synth-session-app.mjs`, the synthetic app from section 4.3. The patch creates it with mode 755. The tests run it with `node`, so the mode doesn't matter to them.
- `test/agent-app-sessions.test.ts`, 24 tests, including real runs of the synthetic app.

Patch M3 (save as `M3.patch`):

````diff
diff --git a/packages/daemon/src/domain/agent-app-sessions.ts b/packages/daemon/src/domain/agent-app-sessions.ts
new file mode 100644
index 00000000..b9d6afab
--- /dev/null
+++ b/packages/daemon/src/domain/agent-app-sessions.ts
@@ -0,0 +1,124 @@
+// Session continuity for community agent apps whose preset declares a `session` block (format 2): rendering the
+// resume command, asking the app whether a session exists, listing the app's sessions, and picking the one a seat
+// started. Every command runs as an argv without a shell; the only value OpenRig fills in is the session id, and only
+// after it has matched the preset's id_pattern and the shell-inert floor below.
+import { spawn } from "node:child_process";
+import { shellQuote } from "../adapters/shell-quote.js";
+import { SESSION_ID_PLACEHOLDER, type AgentAppSessionSpec } from "./agent-app-presets.js";
+
+export { SESSION_ID_PLACEHOLDER };
+/** The resume type recorded for an agent app's session id. The id means something only to the app named by the
+ *  session's recorded agent app (`sessions.agent_app`), so it never resumes under another runtime. */
+export const AGENT_APP_RESUME_TYPE = "agent_app_session";
+
+// Starts with a letter or digit, so an id can never read as an option ("-c", "--help") or a path ("..").
+const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
+const LIST_TIMEOUT_MS = 60_000;
+const EXISTS_TIMEOUT_MS = 60_000;
+const MAX_LIST_BYTES = 1024 * 1024;
+
+export type SessionIdCheck = { ok: true; id: string } | { ok: false; error: string };
+
+/** A session id OpenRig will put on a command line: the shell-inert floor first, then the preset's own pattern.
+ *  The error never contains the id. */
+export function checkAgentAppSessionId(spec: AgentAppSessionSpec, raw: unknown): SessionIdCheck {
+  if (typeof raw !== "string" || raw.trim().length === 0) return { ok: false, error: "the session id is empty" };
+  const id = raw.trim();
+  if (!SAFE_ID.test(id)) return { ok: false, error: "the session id must start with a letter or digit, hold only letters, digits, '.', '_' and '-', and be at most 200 characters" };
+  if (!new RegExp(spec.idPattern).test(id)) return { ok: false, error: "the session id doesn't match the preset's id_pattern" };
+  return { ok: true, id };
+}
+
+/** argv with every `{session_id}` element replaced by the id. The id must already have passed checkAgentAppSessionId. */
+export function renderSessionArgv(argv: readonly string[], id: string): string[] {
+  return argv.map(arg => arg === SESSION_ID_PLACEHOLDER ? id : arg);
+}
+
+/** The line typed into the seat's shell for an argv: every element single-quoted, so nothing in it is shell syntax. */
+export function shellLineFor(argv: readonly string[]): string {
+  return argv.map(shellQuote).join(" ");
+}
+
+export interface RunResult { code: number | null; stdout: string; timedOut: boolean; tooLarge: boolean; spawnError?: string }
+
+/** Run an argv without a shell in `cwd`. stdout is kept only when `keepStdout`, up to MAX_LIST_BYTES; stderr is
+ *  discarded. Never throws. */
+export function runArgv(argv: readonly string[], cwd: string, opts: { keepStdout: boolean; timeoutMs: number; env?: NodeJS.ProcessEnv }): Promise<RunResult> {
+  return new Promise(resolve => {
+    let stdout = "";
+    let bytes = 0;
+    let tooLarge = false;
+    let timedOut = false;
+    let settled = false;
+    const done = (r: RunResult) => { if (!settled) { settled = true; resolve(r); } };
+    let child: ReturnType<typeof spawn>;
+    try {
+      child = spawn(argv[0]!, argv.slice(1), { cwd, env: opts.env ?? process.env, shell: false,
+        stdio: ["ignore", opts.keepStdout ? "pipe" : "ignore", "ignore"] });
+    } catch (err) {
+      done({ code: null, stdout: "", timedOut: false, tooLarge: false, spawnError: (err as Error).message });
+      return;
+    }
+    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, opts.timeoutMs);
+    child.stdout?.on("data", (chunk: Buffer) => {
+      bytes += chunk.length;
+      if (bytes > MAX_LIST_BYTES) { tooLarge = true; child.kill("SIGKILL"); return; }
+      stdout += chunk.toString("utf-8");
+    });
+    child.on("error", err => { clearTimeout(timer); done({ code: null, stdout: "", timedOut, tooLarge, spawnError: err.message }); });
+    child.on("close", code => { clearTimeout(timer); done({ code, stdout, timedOut, tooLarge }); });
+  });
+}
+
+/** Whether the app has this session: true on exit 0, false on exit 1, null for anything else (not declared,
+ *  timeout, spawn failure, another exit code). */
+export async function agentAppSessionExists(spec: AgentAppSessionSpec, id: string, cwd: string, env?: NodeJS.ProcessEnv): Promise<boolean | null> {
+  if (!spec.exists) return null;
+  const r = await runArgv(renderSessionArgv(spec.exists, id), cwd, { keepStdout: false, timeoutMs: EXISTS_TIMEOUT_MS, env });
+  if (r.timedOut || r.spawnError) return null;
+  return r.code === 0 ? true : r.code === 1 ? false : null;
+}
+
+export interface AgentAppSessionRow { id: string; created: number; directory: string | null }
+
+/** Parse the list command's stdout: a JSON array of objects with string `id`, number `created` (epoch ms) and an
+ *  optional string `directory`. Rows of any other shape are dropped; anything that isn't such an array is null. */
+export function parseSessionList(stdout: string): AgentAppSessionRow[] | null {
+  let doc: unknown;
+  try { doc = JSON.parse(stdout); } catch { return null; }
+  if (!Array.isArray(doc)) return null;
+  const rows: AgentAppSessionRow[] = [];
+  for (const item of doc) {
+    if (!item || typeof item !== "object") continue;
+    const { id, created, directory } = item as Record<string, unknown>;
+    if (typeof id !== "string" || typeof created !== "number" || !Number.isFinite(created)) continue;
+    rows.push({ id, created, directory: typeof directory === "string" ? directory : null });
+  }
+  return rows;
+}
+
+/** The app's sessions, or null when the list isn't declared or couldn't be read. Runs in the seat's cwd. */
+export async function listAgentAppSessions(spec: AgentAppSessionSpec, cwd: string, env?: NodeJS.ProcessEnv): Promise<AgentAppSessionRow[] | null> {
+  if (!spec.list) return null;
+  const r = await runArgv(spec.list, cwd, { keepStdout: true, timeoutMs: LIST_TIMEOUT_MS, env });
+  if (r.timedOut || r.tooLarge || r.spawnError || r.code !== 0) return null;
+  return parseSessionList(r.stdout);
+}
+
+/** The session a seat started: created at or after the seat's launch, in the seat's directory when the app reports
+ *  one, not held by another seat, and passing the id checks. Exactly one such row, or null (none, or ambiguous).
+ *  `cwds` holds the seat's cwd as recorded and as resolved by realpath, since an app may report either. */
+export function pickSeatSession(spec: AgentAppSessionSpec, rows: readonly AgentAppSessionRow[], seat: { cwds: ReadonlySet<string>; launchedAtMs: number; heldIds: ReadonlySet<string> }): string | null {
+  const candidates = rows.filter(row => row.created >= seat.launchedAtMs
+    && (row.directory === null || seat.cwds.has(row.directory))
+    && !seat.heldIds.has(row.id)
+    && checkAgentAppSessionId(spec, row.id).ok);
+  return candidates.length === 1 ? candidates[0]!.id : null;
+}
+
+/** A sessions.created_at value ("YYYY-MM-DD HH:MM:SS", UTC, from SQLite datetime('now')) as epoch ms, or null. */
+export function sqliteUtcToMs(value: string | null | undefined): number | null {
+  if (!value) return null;
+  const ms = Date.parse(`${value.replace(" ", "T")}Z`);
+  return Number.isFinite(ms) ? ms : null;
+}
diff --git a/packages/daemon/test/agent-app-sessions.test.ts b/packages/daemon/test/agent-app-sessions.test.ts
new file mode 100644
index 00000000..eb7f0020
--- /dev/null
+++ b/packages/daemon/test/agent-app-sessions.test.ts
@@ -0,0 +1,115 @@
+import { afterEach, describe, expect, it } from "vitest";
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { dirname, join, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+import { loadAgentAppPreset, type AgentAppSessionSpec } from "../src/domain/agent-app-presets.js";
+import {
+  agentAppSessionExists, checkAgentAppSessionId, listAgentAppSessions, parseSessionList, pickSeatSession,
+  renderSessionArgv, shellLineFor, sqliteUtcToMs,
+} from "../src/domain/agent-app-sessions.js";
+
+const here = dirname(fileURLToPath(import.meta.url));
+const appScript = resolve(here, "fixtures/agent-app/synth-session-app.mjs");
+const dirs: string[] = [];
+afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
+const scratch = () => { const dir = mkdtempSync(join(tmpdir(), "agent-app-sessions-")); dirs.push(dir); return dir; };
+
+const BASE = "format: 2\nname: synth\ncommand: synth-app\nmaintainer: Example Maintainer\nlimits: [fork unsupported]\n";
+const SESSION = "session:\n  id_pattern: '^ses_[A-Za-z0-9]{8,40}$'\n  resume: [synth-app, --session, '{session_id}']\n  exists: [synth-app, export, '{session_id}']\n  list: [synth-app, session, list, --format, json]\n";
+const load = (body: string) => { const dir = scratch(); writeFileSync(join(dir, "synth.yaml"), body); return loadAgentAppPreset("synth", dir); };
+const SPEC: AgentAppSessionSpec = { idPattern: "^ses_[A-Za-z0-9]{8,40}$", resume: ["synth-app", "--session", "{session_id}"],
+  exists: ["node", appScript, "export", "{session_id}"], list: ["node", appScript, "session", "list", "--format", "json"] };
+
+describe("format 2 presets", () => {
+  it("reads a session block", () => {
+    expect(load(BASE + SESSION)).toMatchObject({ ok: true, preset: { session: {
+      idPattern: "^ses_[A-Za-z0-9]{8,40}$", resume: ["synth-app", "--session", "{session_id}"],
+      exists: ["synth-app", "export", "{session_id}"], list: ["synth-app", "session", "list", "--format", "json"] } } });
+  });
+  it("still reads format 1, which has no session block", () => {
+    const found = load(BASE.replace("format: 2", "format: 1"));
+    expect(found.ok && found.preset.session).toBeUndefined();
+    expect(load(BASE.replace("format: 2", "format: 1") + SESSION)).toMatchObject({ ok: false, message: expect.stringContaining("unknown field session (format 1 has") });
+  });
+  it.each([
+    ["format 3", BASE.replace("format: 2", "format: 3"), "it declares format 3; this OpenRig reads formats 1 and 2"],
+    ["an unanchored pattern", BASE + SESSION.replace("'^ses_[A-Za-z0-9]{8,40}$'", "'ses_.*'"), "session: id_pattern must be a regular expression anchored with ^ and $"],
+    ["a resume line instead of an argv", BASE + SESSION.replace("[synth-app, --session, '{session_id}']", "'synth-app --session {session_id}'"), "session: resume must be a non-empty list of strings"],
+    ["resume without the placeholder", BASE + SESSION.replace("[synth-app, --session, '{session_id}']", "[synth-app, --continue]"), "session: resume must hold {session_id} as one element"],
+    ["a placeholder inside an element", BASE + SESSION.replace("[synth-app, --session, '{session_id}']", "[synth-app, '--session={session_id}']"), "session: resume: {session_id} must be a whole element"],
+    ["the placeholder as the program", BASE + SESSION.replace("[synth-app, --session, '{session_id}']", "['{session_id}']"), "session: resume: the first element is the program"],
+    ["a list that takes the id", BASE + SESSION.replace("[synth-app, session, list, --format, json]", "[synth-app, '{session_id}']"), "session: list can't hold {session_id}"],
+    ["an unknown session field", BASE + SESSION + "  fork: [synth-app, --fork]\n", "session: unknown field fork"],
+  ])("refuses %s", (_label, body, text) => {
+    const found = load(body);
+    expect(found).toMatchObject({ ok: false, kind: "incompatible" });
+    expect(!found.ok && found.message).toContain(text);
+  });
+});
+
+describe("session ids on a command line", () => {
+  it("accepts an id that passes the floor and the preset's pattern", () => {
+    expect(checkAgentAppSessionId(SPEC, " ses_abc12345 ")).toEqual({ ok: true, id: "ses_abc12345" });
+  });
+  it.each([["", "empty"], ["ses_abc12345; rm -rf ~", "hold only letters"], ["ses_'x'aaaaaa", "hold only letters"], ["--help", "start with a letter or digit"], ["..", "start with a letter or digit"], ["a".repeat(201), "at most 200"], ["abc12345678", "doesn't match the preset's id_pattern"], [42, "empty"]])(
+    "refuses %j without echoing it", (raw, text) => {
+      const r = checkAgentAppSessionId(SPEC, raw);
+      expect(r).toMatchObject({ ok: false, error: expect.stringContaining(text) });
+      if (typeof raw === "string" && raw) expect(!r.ok && r.error).not.toContain(raw);
+    });
+  it("fills only whole placeholder elements and quotes every element", () => {
+    expect(renderSessionArgv(SPEC.resume, "ses_abc12345")).toEqual(["synth-app", "--session", "ses_abc12345"]);
+    expect(shellLineFor(["opencode", "--session", "ses_abc12345"])).toBe("'opencode' '--session' 'ses_abc12345'");
+    expect(shellLineFor(["a b", "it's"])).toBe(`'a b' 'it'"'"'s'`);
+  });
+});
+
+describe("listing and picking a seat's session", () => {
+  it("parses the list shape OpenCode 1.x and 2.0 print, dropping rows of another shape", () => {
+    const v1 = `[\n  {\n    "id": "ses_eb0008bd3ffefl70GhSQLjB7M2",\n    "title": "New session - 2026-10-18T17:11:43.924Z",\n    "updated": 1792343503926,\n    "created": 1792343503925,\n    "projectId": "global",\n    "directory": "/tmp/w1"\n  }\n]\n`;
+    expect(parseSessionList(v1)).toEqual([{ id: "ses_eb0008bd3ffefl70GhSQLjB7M2", created: 1792343503925, directory: "/tmp/w1" }]);
+    expect(parseSessionList(`[{"id":"a","created":"x"},{"id":"ses_x","created":1}]`)).toEqual([{ id: "ses_x", created: 1, directory: null }]);
+    expect(parseSessionList("Starting background server...\n[]")).toBeNull();
+    expect(parseSessionList(`{"id":"x"}`)).toBeNull();
+  });
+  it("picks exactly one new session in the seat's directory, and nothing when it's ambiguous", () => {
+    const seat = { cwds: new Set(["/w", "/private/w"]), launchedAtMs: 1000, heldIds: new Set<string>() };
+    const rows = [
+      { id: "ses_old00000", created: 999, directory: "/w" },
+      { id: "ses_other000", created: 2000, directory: "/elsewhere" },
+      { id: "ses_mine0000", created: 1500, directory: "/w" },
+    ];
+    expect(pickSeatSession(SPEC, rows, seat)).toBe("ses_mine0000");
+    expect(pickSeatSession(SPEC, [...rows, { id: "ses_mate0000", created: 1600, directory: "/w" }], seat)).toBeNull();
+    expect(pickSeatSession(SPEC, [...rows, { id: "ses_mate0000", created: 1600, directory: "/w" }], { ...seat, heldIds: new Set(["ses_mate0000"]) })).toBe("ses_mine0000");
+    expect(pickSeatSession(SPEC, [{ id: "bad id!", created: 1500, directory: "/w" }], seat)).toBeNull();
+    expect(pickSeatSession(SPEC, [{ id: "ses_real0000", created: 1500, directory: "/private/w" }], seat)).toBe("ses_real0000");
+  });
+  it("reads sessions.created_at as UTC", () => {
+    expect(sqliteUtcToMs("2026-10-18 17:11:43")).toBe(Date.UTC(2026, 9, 18, 17, 11, 43));
+    expect(sqliteUtcToMs(null)).toBeNull();
+    expect(sqliteUtcToMs("not a date")).toBeNull();
+  });
+});
+
+describe("asking the real synthetic app", () => {
+  it("lists, checks and picks against a running process, without a shell", async () => {
+    const home = scratch();
+    const cwd = join(home, "work");
+    mkdirSync(cwd);
+    const env = { ...process.env, SYNTH_APP_HOME: home };
+    expect(await listAgentAppSessions(SPEC, cwd, env)).toEqual([]);
+    const launchedAtMs = Date.now();
+    mkdirSync(join(home, "sessions"), { recursive: true });
+    writeFileSync(join(home, "sessions", "ses_seeded0001.json"), JSON.stringify({ id: "ses_seeded0001", created: launchedAtMs + 5, updated: launchedAtMs + 5, directory: cwd, lines: ["hi"] }));
+    const rows = await listAgentAppSessions(SPEC, cwd, env);
+    expect(rows).toEqual([{ id: "ses_seeded0001", created: launchedAtMs + 5, directory: cwd }]);
+    expect(pickSeatSession(SPEC, rows!, { cwds: new Set([cwd]), launchedAtMs, heldIds: new Set() })).toBe("ses_seeded0001");
+    expect(await agentAppSessionExists(SPEC, "ses_seeded0001", cwd, env)).toBe(true);
+    expect(await agentAppSessionExists(SPEC, "ses_missing0001", cwd, env)).toBe(false);
+    expect(await agentAppSessionExists({ ...SPEC, exists: ["/definitely/not/a/program", "{session_id}"] }, "ses_x0000000", cwd, env)).toBeNull();
+    expect(await listAgentAppSessions({ ...SPEC, list: ["node", "-e", "process.exit(3)"] }, cwd, env)).toBeNull();
+    expect(await agentAppSessionExists({ ...SPEC, exists: undefined }, "ses_seeded0001", cwd, env)).toBeNull();
+  });
+});
diff --git a/packages/daemon/test/fixtures/agent-app/synth-session-app.mjs b/packages/daemon/test/fixtures/agent-app/synth-session-app.mjs
new file mode 100755
index 00000000..913bec74
--- /dev/null
+++ b/packages/daemon/test/fixtures/agent-app/synth-session-app.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+// A synthetic agent app for the agent-app session tests. It behaves like OpenCode 1.x and 2.0 where OpenRig depends on it:
+//   synth-session-app [--session <id>]            interactive seat; a session is saved only after the first input line
+//   synth-session-app session list --format json  JSON array of {id, created, updated, directory}, newest first
+//   synth-session-app export <id>                 exit 0 when the session exists, 1 when it doesn't
+// State lives in $SYNTH_APP_HOME, or $HOME/.synth-session-app when that isn't set: one JSON file per session.
+import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
+import { join } from "node:path";
+import { homedir } from "node:os";
+import { createInterface } from "node:readline";
+import { randomBytes } from "node:crypto";
+
+const home = process.env.SYNTH_APP_HOME || join(homedir(), ".synth-session-app");
+const dir = join(home, "sessions");
+mkdirSync(dir, { recursive: true });
+const file = (id) => join(dir, `${id}.json`);
+const args = process.argv.slice(2);
+
+if (args[0] === "session" && args[1] === "list") {
+  if (args[2] !== "--format" || args[3] !== "json") { console.error("usage: session list --format json"); process.exit(2); }
+  const rows = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")));
+  rows.sort((a, b) => b.updated - a.updated);
+  process.stdout.write(JSON.stringify(rows.map(({ id, created, updated, directory }) => ({ id, created, updated, directory })), null, 2) + "\n");
+  process.exit(0);
+}
+if (args[0] === "export") {
+  const id = args[1] ?? "";
+  if (!/^ses_[A-Za-z0-9]{8,40}$/.test(id) || !existsSync(file(id))) { console.log(`Session not found: ${id}`); process.exit(1); }
+  process.stdout.write(readFileSync(file(id), "utf-8") + "\n");
+  process.exit(0);
+}
+
+let id = null;
+if (args[0] === "--session") {
+  id = args[1] ?? "";
+  if (!existsSync(file(id))) { console.log(`Error: Session not found: ${id}`); process.exit(1); }
+} else if (args.length > 0) {
+  console.error(`synth-session-app: unrecognized arguments: ${args.join(" ")}`); process.exit(2);
+}
+const save = (line) => {
+  const now = Date.now();
+  if (!id) id = `ses_${randomBytes(9).toString("hex")}`;
+  const prev = existsSync(file(id)) ? JSON.parse(readFileSync(file(id), "utf-8")) : { id, created: now, directory: process.cwd(), lines: [] };
+  prev.updated = now; prev.lines.push(line);
+  writeFileSync(file(id), JSON.stringify(prev));
+};
+console.log(id ? `synth ready: resumed ${id}` : "synth ready: new session");
+const rl = createInterface({ input: process.stdin });
+rl.on("line", (line) => { save(line); console.log(`synth heard (${id}): ${line}`); });
````

**Acceptance:**
```bash
cd "$REPO/packages/daemon"
npx tsc --noEmit -p .                              # exit 0
npx vitest run test/agent-app-sessions.test.ts     # Tests  24 passed (24)
```
Also re-run the spike by hand (section 4.3) in a scratch directory with `SYNTH_APP_HOME` set to a scratch path, and paste the output into `$NOTES`:
```bash
export SYNTH_APP_HOME="$(mktemp -d)"; cd "$(mktemp -d)"
F="$REPO/packages/daemon/test/fixtures/agent-app/synth-session-app.mjs"
printf 'hello\n' | node "$F"
node "$F" session list --format json
ID=$(node "$F" session list --format json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0].id))')
node "$F" export "$ID" >/dev/null; echo "exists=$?"          # exists=0
node "$F" export ses_nope0000000 >/dev/null; echo "missing=$?"  # missing=1
```
Commit: `feat(daemon): add agent-app session helpers and a synthetic session app`.

### M4. Show whether a preset declares resume

**Do:** apply this patch. It adds:
- `resume: "declared" | "not declared"` to `AgentAppLabel` (the `rig ps --nodes` seat label),
- `resumes: boolean` to each usable app in `GET /api/agent-apps`,
- the sentence ` Its preset declares resume, so a restore continues the conversation.` to `rig agent-app list` when `resumes` is true,
- `; resume <value>` to the `rig ps` seat line when the daemon sent `resume`. An older daemon doesn't send it, and the line is then unchanged.

Patch M4 (save as `M4.patch`):

````diff
diff --git a/packages/cli/src/commands/agent-app.ts b/packages/cli/src/commands/agent-app.ts
index 5517a3bf..d6660059 100644
--- a/packages/cli/src/commands/agent-app.ts
+++ b/packages/cli/src/commands/agent-app.ts
@@ -11,6 +11,8 @@ interface AgentAppWire {
   usable: boolean;
   maintainer?: string;
   limits?: string[];
+  /** Absent from a daemon older than preset format 2. */
+  resumes?: boolean;
   path: string;
   problem?: string;
 }
@@ -39,7 +41,8 @@ export function agentAppCommand(depsOverride?: StatusDeps): Command {
         for (const app of res.data.apps) {
           if (!app.usable) { console.log(`${app.name}: can't be used. ${app.problem}`); continue; }
           const limits = app.limits?.length ? ` Declared limits: ${app.limits.join("; ")}.` : "";
-          console.log(`${app.name}: community app, maintained by ${app.maintainer}, not tested by OpenRig.${limits}`);
+          const resume = app.resumes ? " Its preset declares resume, so a restore continues the conversation." : "";
+          console.log(`${app.name}: community app, maintained by ${app.maintainer}, not tested by OpenRig.${limits}${resume}`);
         }
       } catch (err) {
         console.error((err as Error).message);
diff --git a/packages/cli/src/commands/ps.ts b/packages/cli/src/commands/ps.ts
index eada2220..c1381c22 100644
--- a/packages/cli/src/commands/ps.ts
+++ b/packages/cli/src/commands/ps.ts
@@ -78,7 +78,7 @@ interface NodeEntry {
   } | null;
   identityVerdict?: { reason?: string | null } | null;
   /** A community agent app's seat: its label, maintainer and declared limits. */
-  agentApp?: { app: string; maintainer: string | null; limits: string[]; identity: string; needsInput: string; presetError?: string };
+  agentApp?: { app: string; maintainer: string | null; limits: string[]; identity: string; needsInput: string; resume?: string; presetError?: string };
   /** Slice 15 — `has-work-to-do` primitive. Derived from queue_items;
    *  NEVER derived from terminalActive. */
   hasAssignedWork?: boolean;
@@ -624,7 +624,8 @@ function hasCurrentUsageLimit(node: NodeEntry): boolean {
 export function formatAgentAppLine(seat: string, app: NonNullable<NodeEntry["agentApp"]>): string {
   if (app.presetError) return `Community app (${seat}): ${app.app}: ${app.presetError}.`;
   const limits = app.limits.length ? `; declared limits: ${app.limits.join("; ")}` : "";
-  return `Community app (${seat}): ${app.app}, maintained by ${app.maintainer}, not tested by OpenRig. Identity ${app.identity}; needs-input ${app.needsInput}${limits}.`;
+  const resume = app.resume ? `; resume ${app.resume}` : "";
+  return `Community app (${seat}): ${app.app}, maintained by ${app.maintainer}, not tested by OpenRig. Identity ${app.identity}; needs-input ${app.needsInput}${resume}${limits}.`;
 }
 
 function missingSessionGuidance(node: NodeEntry): string | null {
diff --git a/packages/cli/test/agent-app-line.test.ts b/packages/cli/test/agent-app-line.test.ts
new file mode 100644
index 00000000..a969bd76
--- /dev/null
+++ b/packages/cli/test/agent-app-line.test.ts
@@ -0,0 +1,15 @@
+import { describe, expect, it } from "vitest";
+import { formatAgentAppLine } from "../src/commands/ps.js";
+
+const app = { app: "synth", maintainer: "Example Maintainer", limits: ["one turn per line"], identity: "not confirmed", needsInput: "from the screen only: no app prompt pattern" };
+
+describe("rig ps line for a community agent app seat", () => {
+  it("says whether the preset declares resume", () => {
+    expect(formatAgentAppLine("w@r", { ...app, resume: "declared" })).toBe(
+      "Community app (w@r): synth, maintained by Example Maintainer, not tested by OpenRig. Identity not confirmed; needs-input from the screen only: no app prompt pattern; resume declared; declared limits: one turn per line.");
+  });
+  it("keeps the old line when the daemon doesn't send resume", () => {
+    expect(formatAgentAppLine("w@r", app)).toBe(
+      "Community app (w@r): synth, maintained by Example Maintainer, not tested by OpenRig. Identity not confirmed; needs-input from the screen only: no app prompt pattern; declared limits: one turn per line.");
+  });
+});
diff --git a/packages/daemon/src/domain/agent-app-presets.ts b/packages/daemon/src/domain/agent-app-presets.ts
index bf38f29a..f7f9dbc3 100644
--- a/packages/daemon/src/domain/agent-app-presets.ts
+++ b/packages/daemon/src/domain/agent-app-presets.ts
@@ -209,6 +209,8 @@ export interface AgentAppLabel {
   limits: string[];
   identity: "not confirmed";
   needsInput: "from the screen only: no app prompt pattern";
+  /** "declared" when the preset has a `session` block (format 2), so a restore can continue the conversation. */
+  resume: "declared" | "not declared";
   /** Set when the preset is missing or can't be used. */
   presetError?: string;
 }
@@ -220,6 +222,7 @@ export function agentAppLabel(runtime: string, dir: string = agentAppsDir()): Ag
     maintainer: found.ok ? found.preset.maintainer : null,
     limits: found.ok ? found.preset.limits : [],
     identity: "not confirmed", needsInput: "from the screen only: no app prompt pattern",
+    resume: found.ok && found.preset.session ? "declared" : "not declared",
     ...(found.ok ? {} : { presetError: found.message }),
   };
 }
diff --git a/packages/daemon/src/routes/agent-apps.ts b/packages/daemon/src/routes/agent-apps.ts
index 92272dd4..d4ed424a 100644
--- a/packages/daemon/src/routes/agent-apps.ts
+++ b/packages/daemon/src/routes/agent-apps.ts
@@ -11,7 +11,8 @@ export function agentAppsRoutes(): Hono {
     dir: agentAppsDir(),
     apps: listAgentAppPresets().map(found => found.ok
       ? { name: found.preset.name, usable: true, community: true, testedByOpenRig: false, maintainer: found.preset.maintainer,
-        limits: found.preset.limits, command: found.preset.command, path: found.preset.path }
+        limits: found.preset.limits, command: found.preset.command, path: found.preset.path,
+        resumes: found.preset.session !== undefined }
       : { name: basename(found.path, ".yaml"), usable: false, path: found.path, problem: found.message }),
   }));
   return app;
````

**Acceptance:**
```bash
cd "$REPO/packages/daemon" && npx tsc --noEmit -p . && npx vitest run test/agent-app-runtime.test.ts
cd "$REPO/packages/cli" && npx tsc --noEmit -p . && npx vitest run test/agent-app-line.test.ts   # 2 passed
```
Commit: `feat: show whether an agent app's preset declares resume`.

### M5. Resume in the agent-app adapter

**Do:** apply this patch to `src/adapters/agent-app-runtime-adapter.ts`. `launchHarness` now works in this order:
1. Load the preset. `spec` is its `session` block, or undefined.
2. A fork is refused. The message says `declares resume but not fork` when `spec` exists, and keeps the old launch-only text otherwise.
3. A resume token with no `spec` keeps the old launch-only refusal, word for word.
4. An unusable preset returns its message, as before.
5. With a token and a `spec`:
   - check the id; on failure return `Resume refused for agent app "<name>": <reason>. No session was started.` without the id;
   - ask `exists`. On `false`, return `{ ok: false, error: 'agent app "<name>" reports that the saved conversation no longer exists', recovery: "retry_fresh", missingConversation: true }` and type nothing. On `null`, go ahead;
   - build the line with `shellLineFor(renderSessionArgv(spec.resume, id))`, so every element is single-quoted.
6. Pass the line through `seatLaunchEnvironment.command(...)` and `sendShellCommand(..., { stageIfLong: true, execInScript: true })`, exactly like a fresh launch.
7. Return `{ ok: true, resumeToken: id, resumeType: "agent_app_session" }` after a resume, and `{ ok: true }` after a fresh launch.

Patch M5 (save as `M5.patch`):

````diff
diff --git a/packages/daemon/src/adapters/agent-app-runtime-adapter.ts b/packages/daemon/src/adapters/agent-app-runtime-adapter.ts
index 520bf8e0..097828bb 100644
--- a/packages/daemon/src/adapters/agent-app-runtime-adapter.ts
+++ b/packages/daemon/src/adapters/agent-app-runtime-adapter.ts
@@ -15,11 +15,14 @@ import type { SeatLaunchEnvironment } from "../domain/seat-launch-environment.js
 import { isShellForeground } from "../domain/shell-classifier.js";
 import { isAgentAppRuntime, loadAgentAppPreset, agentAppsDir } from "../domain/agent-app-presets.js";
 import { agentAppOf } from "../domain/built-in-runtimes.js";
+import { AGENT_APP_RESUME_TYPE, agentAppSessionExists, checkAgentAppSessionId, renderSessionArgv, shellLineFor } from "../domain/agent-app-sessions.js";
 
 interface AgentAppAdapterDeps {
   tmux: Pick<TmuxAdapter, "hasSession" | "getPaneCommand" | "sendShellCommand">;
   seatLaunchEnvironment?: Pick<SeatLaunchEnvironment, "command">;
   presetsDir?: () => string;
+  /** Asks the app whether a session exists (tests inject); defaults to running the preset's `exists` argv. */
+  sessionExists?: typeof agentAppSessionExists;
 }
 
 /**
@@ -51,21 +54,38 @@ export class AgentAppRuntimeAdapter implements RuntimeAdapter {
   }
 
   async launchHarness(binding: NodeBinding, opts: { name: string; resumeToken?: string; forkSource?: ForkSource }): Promise<HarnessLaunchResult> {
+    const found = loadAgentAppPreset(this.runtime, this.deps.presetsDir?.() ?? agentAppsDir());
+    const spec = found.ok ? found.preset.session : undefined;
     if (opts.forkSource) {
-      return { ok: false, error: `Fork is unsupported: agent app "${this.runtime}" is launch-only. Remove session_source for this member.` };
+      return { ok: false, error: spec
+        ? `Fork is unsupported: agent app "${this.runtime}" declares resume but not fork. Remove session_source for this member.`
+        : `Fork is unsupported: agent app "${this.runtime}" is launch-only. Remove session_source for this member.` };
     }
-    if (opts.resumeToken) {
+    if (opts.resumeToken && !spec) {
       return { ok: false, error: `Resume is unsupported: agent app "${this.runtime}" is launch-only. No session was started.` };
     }
-    const found = loadAgentAppPreset(this.runtime, this.deps.presetsDir?.() ?? agentAppsDir());
     if (!found.ok) return { ok: false, error: found.message };
     const session = binding.tmuxSession ?? opts.name;
+    let line = found.preset.command;
+    let resumed: string | null = null;
+    if (opts.resumeToken && spec) {
+      const checked = checkAgentAppSessionId(spec, opts.resumeToken);
+      if (!checked.ok) return { ok: false, error: `Resume refused for agent app "${this.runtime}": ${checked.error}. No session was started.` };
+      // Asked before anything is typed: an app that opens a blank conversation for an unknown id (OpenCode 2.0 does)
+      // would otherwise look resumed. Unknown (null) goes ahead, as no answer isn't evidence the conversation is gone.
+      if (await (this.deps.sessionExists ?? agentAppSessionExists)(spec, checked.id, binding.cwd) === false) {
+        return { ok: false, error: `agent app "${this.runtime}" reports that the saved conversation no longer exists`,
+          recovery: "retry_fresh", missingConversation: true };
+      }
+      line = shellLineFor(renderSessionArgv(spec.resume, checked.id));
+      resumed = checked.id;
+    }
     const command = this.deps.seatLaunchEnvironment
-      ? await this.deps.seatLaunchEnvironment.command(session, found.preset.command, { runtime: this.runtime })
-      : found.preset.command;
+      ? await this.deps.seatLaunchEnvironment.command(session, line, { runtime: this.runtime })
+      : line;
     const sent = await this.deps.tmux.sendShellCommand(session, command, undefined, { stageIfLong: true, execInScript: true });
     if (!sent.ok) return { ok: false, error: `Couldn't start agent app "${this.runtime}": ${sent.message}` };
-    return { ok: true };
+    return resumed ? { ok: true, resumeToken: resumed, resumeType: AGENT_APP_RESUME_TYPE } : { ok: true };
   }
 
   async checkReady(binding: NodeBinding): Promise<ReadinessResult> {
````

**Acceptance:** `npx tsc --noEmit -p .` exits 0, and `npx vitest run test/agent-app-runtime.test.ts` passes 42/42. The launch-only refusal texts are unchanged, which these tests check.
Commit: `feat(daemon): resume an agent app whose preset declares session continuity`.

### M6. Let restore resume a format-2 seat

**Do:** apply this patch. It adds `agentAppSeatResumes(runtime, resumeType)`, which is true only when `resumeType === "agent_app_session"` **and** the installed preset for `runtime` declares `session`. Both launch-only gates gain `&& !agentAppSeatResumes(...)`. Everything else stays launch-only: a format-1 preset, a removed or broken preset, and a token from a former runtime (say, a Claude token saved before the member's runtime changed).

Patch M6 (save as `M6.patch`):

````diff
diff --git a/packages/daemon/src/domain/restore-orchestrator.ts b/packages/daemon/src/domain/restore-orchestrator.ts
index 976ae0af..28ff34b3 100644
--- a/packages/daemon/src/domain/restore-orchestrator.ts
+++ b/packages/daemon/src/domain/restore-orchestrator.ts
@@ -80,6 +80,8 @@ const LAUNCH_DEPENDENCY_KINDS = new Set(["delegates_to", "spawned_by"]);
 import { resolveActiveSnapshotSession, activeOccupantAmbiguityError, absentSeatResumeHistory, absentSeatResumeHistoryError } from "./active-occupant.js";
 import { effectiveRestorePolicy, type RestoreSeatFacts } from "./restore-policy.js";
 import { agentAppOf } from "./built-in-runtimes.js";
+import { agentAppResumes } from "./agent-app-presets.js";
+import { AGENT_APP_RESUME_TYPE } from "./agent-app-sessions.js";
 import { seatAdapter } from "../adapters/agent-app-runtime-adapter.js";
 import { pluginPathsOf } from "./claude-core-plugin-env.js";
 export { resolveActiveSnapshotSession } from "./active-occupant.js";
@@ -115,6 +117,13 @@ export function launchStatusIsRunning(status: string): boolean {
   return !NON_RUNNING_LAUNCH_STATUSES.has(status);
 }
 
+/** An agent app's saved seat resumes only when its installed preset declares session continuity and the saved token
+ *  is an agent-app session id. Anything else (a launch-only preset, a removed preset, a token from a former runtime)
+ *  stays launch-only. */
+function agentAppSeatResumes(runtime: string | null, resumeType: string | null | undefined): boolean {
+  return !!runtime && resumeType === AGENT_APP_RESUME_TYPE && agentAppResumes(runtime);
+}
+
 /** The facts effectiveRestorePolicy reads for one saved seat: its saved runtime, the runtime it has now, and its recorded sessions. */
 function seatFacts(data: SnapshotData, nodeId: string, savedRuntime: string | null, currentRuntime: string | null): RestoreSeatFacts {
   return { savedRuntime, currentRuntime, recordedSessions: data.sessions.filter((session) => session.nodeId === nodeId) };
@@ -140,7 +149,7 @@ function snapshotLaunchOutcome(data: SnapshotData, nodeId: string, runtime: stri
   }
   const policy = effectiveRestorePolicy(seatFacts(data, nodeId, savedRuntime, runtime), session.restorePolicy);
   if (policy !== "resume_if_possible") return { kind: "fresh", why: `saves this seat with restore policy '${policy}'` };
-  if (agentAppOf(session.agentApp, runtime)) return { kind: "decision", why: "is an agent app whose preset is launch-only (resume unsupported)" };
+  if (agentAppOf(session.agentApp, runtime) && !agentAppSeatResumes(runtime, session.resumeType)) return { kind: "decision", why: "is an agent app whose preset is launch-only (resume unsupported)" };
   if (!session.resumeToken) return { kind: "decision", why: "has no resume token for this seat" };
   if (!session.resumeType || session.resumeType === "none") return { kind: "fresh", why: "records no resume source for this seat" };
   return { kind: "resume" };
@@ -921,7 +930,8 @@ export class RestoreOrchestrator {
       const policy = effectiveRestorePolicy(seatFacts(data, nodeId, node.runtime, liveNode ? liveNode.runtime : node.runtime), snapSession?.restorePolicy);
       const resumeSourceRecorded = !!snapSession?.resumeType && snapSession.resumeType !== "none";
       // An agent app is launch-only: nothing resumes it, so even a saved token (say, from a former runtime) stops here.
-      if (policy === "resume_if_possible" && snapSession && !freshRequested && agentAppOf(snapSession.agentApp, node.runtime)) {
+      if (policy === "resume_if_possible" && snapSession && !freshRequested && agentAppOf(snapSession.agentApp, node.runtime)
+        && !agentAppSeatResumes(node.runtime, snapSession.resumeType)) {
         return {
           nodeId,
           logicalId: node.logicalId,
````

**Acceptance:**
```bash
cd "$REPO/packages/daemon"
npx tsc --noEmit -p .
npx vitest run test/restore-orchestrator.test.ts test/agent-app-runtime.test.ts   # both pass
```
Commit: `feat(daemon): let restore resume an agent-app seat whose preset declares it`.

### M7. Capture the seat's app session at snapshot time

**Do:** apply this patch. It:
- adds `agentApp` and `createdAt` to `LatestLiveSession` and selects them in `getLatestLiveSessions`. It uses `sessionAgentAppSelect(this.db)`, never `s.agent_app` directly, because older databases may lack the column.
- adds `SessionRegistry.agentAppSessionIdsHeldByOthers(sessionId)`.
- adds a branch at the top of the `refresh()` loop: for an agent-app seat (`agentAppOf(session.agentApp, session.runtime)`) with **no** token, call `captureAgentAppSession` and, when it returns an id, `updateResumeToken(sessionId, "agent_app_session", id, "scrape")`. A present token is never replaced. An agent-app seat never falls through to the Claude, Codex or Pi branches below it.
- adds the exported `captureAgentAppSessionId(session, heldIds, presetsDir?)`, which loads the preset, runs `list` in the seat's cwd, and calls `pickSeatSession` with the seat's cwd and its `realpath`, `sqliteUtcToMs(createdAt)` and the held ids.

Patch M7 (save as `M7.patch`):

````diff
diff --git a/packages/daemon/src/domain/resume-metadata-refresher.ts b/packages/daemon/src/domain/resume-metadata-refresher.ts
index 0bb0c926..31b86c76 100644
--- a/packages/daemon/src/domain/resume-metadata-refresher.ts
+++ b/packages/daemon/src/domain/resume-metadata-refresher.ts
@@ -21,6 +21,9 @@ import { runAsyncSite } from "./sync-site-wrap.js";
 import { isClaudeSidecarFromEarlierProcess, type ResumeTokenCaptureDeps } from "./resume-token-capture.js";
 import { observeClaudePaneRuntime, type NativeProcessLister } from "./native-process-lineage.js";
 import { validateResumeToken } from "./resume-token-validation.js";
+import { agentAppOf } from "./built-in-runtimes.js";
+import { agentAppsDir, loadAgentAppPreset } from "./agent-app-presets.js";
+import { AGENT_APP_RESUME_TYPE, listAgentAppSessions, pickSeatSession, sqliteUtcToMs } from "./agent-app-sessions.js";
 
 const execFileAsync = promisify(execFile);
 
@@ -31,6 +34,8 @@ export interface ResumeRefreshSession {
   resumeType: string | null;
   resumeToken: string | null;
   cwd?: string | null;
+  agentApp?: string | null;
+  createdAt?: string | null;
 }
 
 interface ResumeMetadataRefresherDeps {
@@ -56,6 +61,8 @@ interface ResumeMetadataRefresherDeps {
   /** Provider root used by the daemon's Claude launches; no scan of other homes. */
   claudeConfigDir?: string;
   listClaudeProcesses?: NativeProcessLister;
+  /** Finds the app session an agent-app seat started (tests inject). Defaults to captureAgentAppSessionId. */
+  captureAgentAppSession?: (session: ResumeRefreshSession, heldIds: ReadonlySet<string>) => Promise<string | null>;
 }
 
 export class ResumeMetadataRefresher {
@@ -74,6 +81,7 @@ export class ResumeMetadataRefresher {
   private claudeProcessStartedAt: ResumeMetadataRefresherDeps["claudeProcessStartedAt"] | null;
   private claudeConfigDir: string;
   private listClaudeProcesses: NativeProcessLister | undefined;
+  private captureAgentAppSession: (session: ResumeRefreshSession, heldIds: ReadonlySet<string>) => Promise<string | null>;
 
   constructor(deps: ResumeMetadataRefresherDeps) {
     this.sessionRegistry = deps.sessionRegistry;
@@ -101,6 +109,7 @@ export class ResumeMetadataRefresher {
     this.claudeProcessStartedAt = deps.claudeProcessStartedAt ?? null;
     this.claudeConfigDir = deps.claudeConfigDir ?? process.env.CLAUDE_CONFIG_DIR ?? nodePath.join(this.homeDir, ".claude");
     this.listClaudeProcesses = deps.listClaudeProcesses;
+    this.captureAgentAppSession = deps.captureAgentAppSession ?? ((session, heldIds) => captureAgentAppSessionId(session, heldIds));
   }
 
   /**
@@ -143,6 +152,14 @@ export class ResumeMetadataRefresher {
     const captureOpts = { attempts: fillNullOnly ? 1 : undefined, listProcesses: opts?.listProcesses };
     for (const session of sessions) {
       if (this.stopped.signal.aborted) return;
+      if (agentAppOf(session.agentApp, session.runtime)) {
+        // A community agent app: fill a null token from the app's own session list. Never replace a present one.
+        if (!session.resumeToken) {
+          const id = await this.captureAgentAppSession(session, this.sessionRegistry.agentAppSessionIdsHeldByOthers(session.sessionId)).catch(() => null);
+          if (id) this.sessionRegistry.updateResumeToken(session.sessionId, AGENT_APP_RESUME_TYPE, id, "scrape");
+        }
+        continue;
+      }
       if (session.runtime === "codex") {
         const sessionCaptureOpts = { ...captureOpts, sessionId: session.sessionId };
         if (session.resumeToken) {
@@ -528,3 +545,18 @@ function resolveProbeCwd(cwd: string | null | undefined, homeDir: string): strin
   }
   return cwd;
 }
+
+/** The app session an agent-app seat started, from the app's own list (its preset's `session.list`), or null when the
+ *  preset declares none, the list can't be read, or more than one session could be this seat's. */
+export async function captureAgentAppSessionId(session: ResumeRefreshSession, heldIds: ReadonlySet<string>, presetsDir: string = agentAppsDir()): Promise<string | null> {
+  if (!session.runtime || !session.cwd) return null;
+  const found = loadAgentAppPreset(session.runtime, presetsDir);
+  const spec = found.ok ? found.preset.session : undefined;
+  const launchedAtMs = sqliteUtcToMs(session.createdAt);
+  if (!spec?.list || launchedAtMs === null) return null;
+  const rows = await listAgentAppSessions(spec, session.cwd);
+  if (!rows) return null;
+  const cwds = new Set([session.cwd]);
+  try { cwds.add(fs.realpathSync(session.cwd)); } catch { /* the recorded cwd alone */ }
+  return pickSeatSession(spec, rows, { cwds, launchedAtMs, heldIds });
+}
diff --git a/packages/daemon/src/domain/session-registry.ts b/packages/daemon/src/domain/session-registry.ts
index e4d8fd49..afafb3e2 100644
--- a/packages/daemon/src/domain/session-registry.ts
+++ b/packages/daemon/src/domain/session-registry.ts
@@ -104,6 +104,10 @@ export interface LatestLiveSession {
   resumeType: string | null;
   resumeToken: string | null;
   cwd: string | null;
+  /** The session's recorded agent app (`sessions.agent_app`), or null. */
+  agentApp: string | null;
+  /** `sessions.created_at` as SQLite wrote it: "YYYY-MM-DD HH:MM:SS", UTC. */
+  createdAt: string | null;
 }
 
 export interface WatchdogRegistrationObserver {
@@ -602,13 +606,14 @@ export class SessionRegistry {
    *  FR-4 periodic/manual snapshot refresh call ONE query (no duplication). */
   getLatestLiveSessions(rigId: string): LatestLiveSession[] {
     const rows = this.db.prepare(`
-      SELECT n.id as node_id, s.id as session_id, s.session_name, s.status, n.runtime, n.cwd, s.resume_type, s.resume_token
+      SELECT n.id as node_id, s.id as session_id, s.session_name, s.status, n.runtime, n.cwd, s.resume_type, s.resume_token,
+        ${sessionAgentAppSelect(this.db)} as agent_app, s.created_at
       FROM nodes n
       JOIN sessions s ON s.node_id = n.id
       WHERE n.rig_id = ?
         AND s.id = (SELECT s2.id FROM sessions s2 WHERE s2.node_id = n.id ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1)
         AND s.status IN ('running', 'idle', 'unknown')
-    `).all(rigId) as Array<{ node_id: string; session_id: string; session_name: string; status: string; runtime: string | null; cwd: string | null; resume_type: string | null; resume_token: string | null }>;
+    `).all(rigId) as Array<{ node_id: string; session_id: string; session_name: string; status: string; runtime: string | null; cwd: string | null; resume_type: string | null; resume_token: string | null; agent_app: string | null; created_at: string | null }>;
 
     return rows.map((r) => ({
       nodeId: r.node_id,
@@ -619,9 +624,19 @@ export class SessionRegistry {
       resumeType: r.resume_type,
       resumeToken: r.resume_token,
       cwd: r.cwd,
+      agentApp: r.agent_app ?? null,
+      createdAt: r.created_at ?? null,
     }));
   }
 
+  /** Agent-app session ids recorded on any session other than this one: a seat never takes another seat's id. */
+  agentAppSessionIdsHeldByOthers(sessionId: string): Set<string> {
+    const rows = this.db.prepare(
+      "SELECT resume_token FROM sessions WHERE resume_type = 'agent_app_session' AND resume_token IS NOT NULL AND id != ?",
+    ).all(sessionId) as Array<{ resume_token: string }>;
+    return new Set(rows.map(row => row.resume_token));
+  }
+
   getBindingForNode(nodeId: string): Binding | null {
     const row = this.db
       .prepare("SELECT * FROM bindings WHERE node_id = ?")
````

**Acceptance:**
```bash
cd "$REPO/packages/daemon"
npx tsc --noEmit -p .
npx vitest run test/resume-metadata-refresher.test.ts test/resume-capture-retry.test.ts test/periodic-snapshot-scheduler.test.ts test/snapshots-routes.test.ts test/rig-teardown.test.ts   # all pass
```
Commit: `feat(daemon): record the app session an agent-app seat started`.

### M8. Unit tests for the wiring

**Do:** apply this patch. It adds `test/agent-app-session-resume.test.ts` (12 tests): the adapter's resume, fresh, missing, unknown, bad-id, fork and launch-only cases, `agentAppResumes`, the label, and the refresher's fill, no-replace and free-text cases. The bad-id case checks that `rm -rf` never appears in the error.

Patch M8 (save as `M8.patch`):

````diff
diff --git a/packages/daemon/test/agent-app-session-resume.test.ts b/packages/daemon/test/agent-app-session-resume.test.ts
new file mode 100644
index 00000000..c179592f
--- /dev/null
+++ b/packages/daemon/test/agent-app-session-resume.test.ts
@@ -0,0 +1,116 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { AgentAppRuntimeAdapter } from "../src/adapters/agent-app-runtime-adapter.js";
+import { agentAppLabel, agentAppResumes } from "../src/domain/agent-app-presets.js";
+import { ResumeMetadataRefresher, type ResumeRefreshSession } from "../src/domain/resume-metadata-refresher.js";
+import type { NodeBinding } from "../src/domain/runtime-adapter.js";
+import type { SessionRegistry } from "../src/domain/session-registry.js";
+import type { TmuxAdapter } from "../src/adapters/tmux.js";
+
+const dirs: string[] = [];
+afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
+function presets(files: Record<string, string>): string {
+  const dir = mkdtempSync(join(tmpdir(), "agent-apps-"));
+  dirs.push(dir);
+  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
+  return dir;
+}
+const LAUNCH_ONLY = "format: 1\nname: synth\ncommand: synth-app --serve\nmaintainer: Example Maintainer\n";
+const RESUMES = "format: 2\nname: synth\ncommand: synth-app\nmaintainer: Example Maintainer\nsession:\n  id_pattern: '^ses_[A-Za-z0-9]{8,40}$'\n  resume: [synth-app, --session, '{session_id}']\n  exists: [synth-app, export, '{session_id}']\n  list: [synth-app, session, list, --format, json]\n";
+const ID = "ses_abc12345";
+
+function adapter(dir: string, sessionExists: (...args: unknown[]) => Promise<boolean | null> = async () => true) {
+  const tmux = { hasSession: vi.fn(async () => true), getPaneCommand: vi.fn(async () => "node"), sendShellCommand: vi.fn(async () => ({ ok: true as const })) };
+  const exists = vi.fn(sessionExists);
+  return { tmux, exists, app: new AgentAppRuntimeAdapter("synth", { tmux, presetsDir: () => dir, sessionExists: exists as never }) };
+}
+const binding = { tmuxSession: "w@r", cwd: "/work" } as NodeBinding;
+
+describe("resuming an agent app that declares session continuity", () => {
+  it("asks the app first, then types the resume argv, every element quoted, and reports the id it resumed", async () => {
+    const { tmux, exists, app } = adapter(presets({ "synth.yaml": RESUMES }));
+    expect(await app.launchHarness(binding, { name: "w@r", resumeToken: ID })).toEqual({ ok: true, resumeToken: ID, resumeType: "agent_app_session" });
+    expect(exists).toHaveBeenCalledWith(expect.objectContaining({ exists: ["synth-app", "export", "{session_id}"] }), ID, "/work");
+    expect(tmux.sendShellCommand).toHaveBeenCalledWith("w@r", `'synth-app' '--session' '${ID}'`, undefined, { stageIfLong: true, execInScript: true });
+  });
+  it("still launches fresh with the preset's command when there's no token", async () => {
+    const { tmux, exists, app } = adapter(presets({ "synth.yaml": RESUMES }));
+    expect(await app.launchHarness(binding, { name: "w@r" })).toEqual({ ok: true });
+    expect(tmux.sendShellCommand).toHaveBeenCalledWith("w@r", "synth-app", undefined, { stageIfLong: true, execInScript: true });
+    expect(exists).not.toHaveBeenCalled();
+  });
+  it("stops with a missing conversation, typing nothing, when the app says the id is gone", async () => {
+    const { tmux, app } = adapter(presets({ "synth.yaml": RESUMES }), async () => false);
+    expect(await app.launchHarness(binding, { name: "w@r", resumeToken: ID })).toEqual({ ok: false,
+      error: `agent app "synth" reports that the saved conversation no longer exists`, recovery: "retry_fresh", missingConversation: true });
+    expect(tmux.sendShellCommand).not.toHaveBeenCalled();
+  });
+  it("goes ahead when the app can't say (no exists command, timeout, odd exit code)", async () => {
+    const { tmux, app } = adapter(presets({ "synth.yaml": RESUMES }), async () => null);
+    expect(await app.launchHarness(binding, { name: "w@r", resumeToken: ID })).toMatchObject({ ok: true, resumeToken: ID });
+    expect(tmux.sendShellCommand).toHaveBeenCalledOnce();
+  });
+  it("refuses an id that fails the checks without echoing it or typing anything", async () => {
+    const { tmux, exists, app } = adapter(presets({ "synth.yaml": RESUMES }));
+    const result = await app.launchHarness(binding, { name: "w@r", resumeToken: "ses_x'; rm -rf ~" });
+    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(`Resume refused for agent app "synth"`) });
+    expect(!result.ok && result.error).not.toContain("rm -rf");
+    expect(tmux.sendShellCommand).not.toHaveBeenCalled();
+    expect(exists).not.toHaveBeenCalled();
+  });
+  it("refuses fork, saying the app declares resume but not fork", async () => {
+    const { tmux, app } = adapter(presets({ "synth.yaml": RESUMES }));
+    expect(await app.launchHarness(binding, { name: "w@r", forkSource: { kind: "native_id", value: ID } }))
+      .toEqual({ ok: false, error: `Fork is unsupported: agent app "synth" declares resume but not fork. Remove session_source for this member.` });
+    expect(tmux.sendShellCommand).not.toHaveBeenCalled();
+  });
+  it("keeps a launch-only preset launch-only", async () => {
+    const { tmux, app } = adapter(presets({ "synth.yaml": LAUNCH_ONLY }));
+    expect(await app.launchHarness(binding, { name: "w@r", resumeToken: ID }))
+      .toEqual({ ok: false, error: `Resume is unsupported: agent app "synth" is launch-only. No session was started.` });
+    expect(tmux.sendShellCommand).not.toHaveBeenCalled();
+  });
+  it("says which presets resume", () => {
+    expect(agentAppResumes("synth", presets({ "synth.yaml": RESUMES }))).toBe(true);
+    expect(agentAppResumes("synth", presets({ "synth.yaml": LAUNCH_ONLY }))).toBe(false);
+    expect(agentAppResumes("synth", presets({}))).toBe(false);
+  });
+  it("labels the seat with whether its preset declares resume", () => {
+    expect(agentAppLabel("synth", presets({ "synth.yaml": RESUMES })).resume).toBe("declared");
+    expect(agentAppLabel("synth", presets({ "synth.yaml": LAUNCH_ONLY })).resume).toBe("not declared");
+    expect(agentAppLabel("synth", presets({})).resume).toBe("not declared");
+  });
+});
+
+describe("filling an agent-app seat's token at snapshot time", () => {
+  function refresher(capture: (s: ResumeRefreshSession, held: ReadonlySet<string>) => Promise<string | null>) {
+    const registry = { updateResumeToken: vi.fn(() => true), agentAppSessionIdsHeldByOthers: vi.fn(() => new Set(["ses_held0000"])) };
+    const r = new ResumeMetadataRefresher({ sessionRegistry: registry as unknown as SessionRegistry, tmuxAdapter: {} as TmuxAdapter, captureAgentAppSession: vi.fn(capture) });
+    return { registry, r };
+  }
+  const seat: ResumeRefreshSession = { sessionId: "s1", sessionName: "w@r", runtime: "synth", agentApp: "synth", resumeType: null, resumeToken: null, cwd: "/work", createdAt: "2026-10-18 17:00:00" };
+
+  it("records the one session the app reports for the seat, with ids other seats hold passed in", async () => {
+    const capture = vi.fn(async () => ID);
+    const { registry, r } = refresher(capture);
+    await r.refresh([seat], { fillNullOnly: true });
+    expect(capture).toHaveBeenCalledWith(seat, new Set(["ses_held0000"]));
+    expect(registry.updateResumeToken).toHaveBeenCalledWith("s1", "agent_app_session", ID, "scrape");
+  });
+  it("never replaces a present token, and records nothing when the app gives no single answer", async () => {
+    const capture = vi.fn(async () => null);
+    const { registry, r } = refresher(capture);
+    await r.refresh([{ ...seat, resumeToken: "ses_present00", resumeType: "agent_app_session" }, seat]);
+    expect(capture).toHaveBeenCalledTimes(1);
+    expect(registry.updateResumeToken).not.toHaveBeenCalled();
+  });
+  it("leaves a free-text seat whose runtime merely names an app alone", async () => {
+    const capture = vi.fn(async () => ID);
+    const { registry, r } = refresher(capture);
+    await r.refresh([{ ...seat, agentApp: null }], { fillNullOnly: true });
+    expect(capture).not.toHaveBeenCalled();
+    expect(registry.updateResumeToken).not.toHaveBeenCalled();
+  });
+});
````

**Acceptance:** `npx vitest run test/agent-app-session-resume.test.ts` reports `Tests  12 passed (12)`.
Commit: `test(daemon): cover agent-app resume, labels and capture`.

### M9. End to end through the real CLI, daemon and tmux

**Do:** apply this patch. It adds `test/agent-app-session.integration.test.ts`, which uses `prepareHermeticEnv` and `spawnScenarioDaemon` like `agent-app-runtime.integration.test.ts`. It:
1. installs a format-2 preset `synth-session` that runs the synthetic app,
2. runs `rig up`, then `rig send` with one line, so the app creates its session,
3. runs `rig snapshot`, which captures the id, then kills the tmux session, then runs `rig launch`, and expects `status: "resumed"` and the pane line `synth ready: resumed <id>`,
4. snapshots again, kills the session, deletes the app's sessions directory, runs `rig launch`, and expects `awaiting-decision` with the missing-conversation text and no tmux session.

Integration tests run the **built** CLI (`packages/cli/dist`), so build first.

Patch M9 (save as `M9.patch`):

````diff
diff --git a/packages/daemon/test/agent-app-session.integration.test.ts b/packages/daemon/test/agent-app-session.integration.test.ts
new file mode 100644
index 00000000..0006f77c
--- /dev/null
+++ b/packages/daemon/test/agent-app-session.integration.test.ts
@@ -0,0 +1,95 @@
+import { afterAll, beforeAll, describe, expect, it } from "vitest";
+import { execFileSync } from "node:child_process";
+import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
+import { dirname, join, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+import { prepareHermeticEnv, type HermeticScaffold } from "./helpers/hermetic-env.js";
+import { runRig, spawnScenarioDaemon, type ScenarioDaemon } from "./helpers/scenario-daemon.js";
+
+// A format-2 agent app end to end, through the real CLI, daemon, SQLite and a private tmux server: the synthetic
+// session app records a conversation, a snapshot captures its id, and `rig launch` brings that conversation back, or
+// stops and asks when the app says it's gone. Nothing here runs a real agent app or touches a real home.
+const here = dirname(fileURLToPath(import.meta.url));
+const rigBin = resolve(here, "../../cli/dist/bin-wrapper.js");
+const appScript = resolve(here, "fixtures/agent-app/synth-session-app.mjs");
+const agents = resolve(here, "../../test-system/scenarios/agents");
+const session = "work-worker@session-app-rig";
+const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
+
+describe("an agent app that declares session continuity", () => {
+  let scaffold: HermeticScaffold;
+  let daemon: ScenarioDaemon;
+  let rigRoot: string;
+  let rigId: string;
+
+  const rig = (args: string[], timeout?: number) => runRig(args, daemon.readEnv, rigBin, timeout);
+  async function json(args: string[]) {
+    const result = await rig(args);
+    expect(result.code, JSON.stringify({ args, ...result })).toBe(0);
+    return JSON.parse(result.stdout);
+  }
+  async function node() { return (await json(["ps", "--nodes", "--rig", "session-app-rig", "--full", "--json"]))[0]; }
+  const capture = () => execFileSync("tmux", ["-S", scaffold.tmuxSocketPath, "capture-pane", "-p", "-S", "-500", "-t", `=${session}:`], { env: scaffold.env as NodeJS.ProcessEnv }).toString();
+  const kill = () => execFileSync("tmux", ["-S", scaffold.tmuxSocketPath, "kill-session", "-t", `=${session}`], { env: scaffold.env as NodeJS.ProcessEnv });
+  async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean, ms = 30_000): Promise<T> {
+    const end = Date.now() + ms;
+    let value = await read();
+    while (!ok(value) && Date.now() < end) { await sleep(500); value = await read(); }
+    return value;
+  }
+  const appSessions = () => join(scaffold.env.HOME!, ".synth-session-app", "sessions");
+
+  beforeAll(async () => {
+    scaffold = prepareHermeticEnv({ baseEnv: { PATH: process.env.PATH, TERM: "xterm-256color" } });
+    rigRoot = join(scaffold.root, "rig");
+    mkdirSync(rigRoot);
+    cpSync(agents, join(rigRoot, "agents"), { recursive: true });
+    const presetDir = join(scaffold.env.OPENRIG_HOME!, "agent-apps");
+    mkdirSync(presetDir, { recursive: true });
+    writeFileSync(join(presetDir, "synth-session.yaml"), [
+      "format: 2", "name: synth-session", `command: node ${appScript}`, "maintainer: Example Maintainer",
+      "limits:", "  - fork unsupported",
+      "session:", "  id_pattern: '^ses_[A-Za-z0-9]{8,40}$'",
+      `  resume: [node, '${appScript}', --session, '{session_id}']`,
+      `  exists: [node, '${appScript}', export, '{session_id}']`,
+      `  list: [node, '${appScript}', session, list, --format, json]`, "",
+    ].join("\n"));
+    writeFileSync(join(rigRoot, "session-app-rig.yaml"), `version: "0.2"\nname: session-app-rig\npods:\n  - id: work\n    label: Work\n    members:\n      - {id: worker, agent_ref: "local:agents/worker", profile: default, runtime: synth-session, cwd: .}\n    edges: []\n`);
+    daemon = await spawnScenarioDaemon(scaffold, { rigBin });
+  }, 120_000);
+
+  afterAll(async () => {
+    try { if (daemon) await rig(["down", "session-app-rig", "--json", "--force"]); }
+    finally { await daemon?.stop(); }
+  }, 60_000);
+
+  it("captures the conversation a seat started and resumes it after the seat stops", async () => {
+    const up = await rig(["up", join(rigRoot, "session-app-rig.yaml"), "--cwd", rigRoot, "--json", "--yes"], 120_000);
+    expect(up.code, JSON.stringify(up)).toBe(0);
+    rigId = JSON.parse(up.stdout).rigId;
+    expect(await until(async () => capture(), text => text.includes("synth ready: new session"))).toContain("synth ready");
+    await rig(["send", session, "remember the word heron", "--json"]);
+    await until(async () => capture(), text => text.includes("synth heard"));
+    const [file] = readdirSync(appSessions());
+    const id = file!.replace(/\.json$/, "");
+    expect((await rig(["snapshot", rigId])).code).toBe(0);
+    kill();
+    await until(node, n => n.sessionStatus !== "running", 20_000);
+    const launched = await rig(["launch", rigId, "work.worker", "--json"], 90_000);
+    expect(launched.code, JSON.stringify(launched)).toBe(0);
+    expect(JSON.parse(launched.stdout), launched.stdout).toMatchObject({ ok: true, launched: [expect.objectContaining({ logicalId: "work.worker", status: "resumed" })] });
+    expect(await until(async () => capture(), text => text.includes(`synth ready: resumed ${id}`))).toContain(id);
+  }, 300_000);
+
+  it("stops and asks when the app reports the saved conversation is gone, and starts nothing", async () => {
+    expect((await rig(["snapshot", rigId])).code).toBe(0);
+    kill();
+    await until(node, n => n.sessionStatus !== "running", 20_000);
+    rmSync(appSessions(), { recursive: true, force: true });
+    const launched = await rig(["launch", rigId, "work.worker", "--json"], 90_000);
+    expect(launched.code).not.toBe(0);
+    expect(JSON.parse(launched.stdout), launched.stdout).toMatchObject({ status: "awaiting-decision",
+      error: expect.stringContaining(`reports that the saved conversation no longer exists`) });
+    expect(() => capture()).toThrow();
+  }, 300_000);
+});
````

**Acceptance:**
```bash
cd "$REPO" && npm run build                       # exit 0
cd packages/daemon && npx vitest run test/agent-app-session.integration.test.ts   # Tests  2 passed (2), about 80 s
npx vitest run test/agent-app-runtime.integration.test.ts                         # still 11 passed (11)
```
Run the two files one after the other, not in one command: in parallel the daemon can time out (section 4.4).
Commit: `test(daemon): resume an agent app end to end, and stop when its conversation is gone`.

### M10. Reference page

**Do:** apply this patch. It adds `docs/reference/agent-app-presets.md`. `docs/reference/` ships to every operator. The repository's docs guard allows only `docs/reference/`, `docs/as-built/`, `docs/releases/` and `docs/DESIGN.md`.

Patch M10 (save as `M10.patch`):

````diff
diff --git a/docs/reference/agent-app-presets.md b/docs/reference/agent-app-presets.md
new file mode 100644
index 00000000..8bfeb777
--- /dev/null
+++ b/docs/reference/agent-app-presets.md
@@ -0,0 +1,59 @@
+# Agent app presets
+
+A community agent app runs in a seat from one YAML file, `$OPENRIG_HOME/agent-apps/<name>.yaml`, named by a rig
+member's `runtime`. OpenRig hasn't tested these apps. `rig agent-app list` shows the installed presets, and
+`rig ps --nodes` labels each seat with its maintainer, its declared limits and whether its preset declares resume.
+
+## Format 1: launch only
+
+```yaml
+format: 1
+name: my-app                # must equal the file name without .yaml
+command: my-app --flag      # one program and its arguments; shell syntax makes the preset unusable
+maintainer: Your Name
+limits:                     # optional: what the app can't do, shown to people and agents
+  - one turn per input line
+```
+
+A format-1 seat can't be resumed or forked. A restore without `--fresh` starts nothing for it and asks.
+
+## Format 2: resume by session id
+
+Format 2 adds an optional `session` block. With it, a snapshot records which of the app's sessions the seat
+started, and `rig launch` (or a restore) continues that session instead of asking.
+
+```yaml
+format: 2
+name: opencode
+command: opencode
+maintainer: Your Name
+limits:
+  - fork unsupported
+session:
+  id_pattern: '^ses_[A-Za-z0-9]{8,40}$'
+  resume: [opencode, --session, '{session_id}']
+  exists: [opencode, export, '{session_id}']
+  list: [opencode, session, list, --format, json]
+```
+
+For OpenCode 2.0, use `opencode2` in place of `opencode` on every line.
+
+- `id_pattern` (required): a regular expression anchored with `^` and `$`. OpenRig also requires an id to start with a
+  letter or digit and hold at most 200 letters, digits, `.`, `_` or `-`, so it can never read as an option or a path.
+  An id that fails either check is never put on a command line.
+- `resume` (required): the command that opens the seat on a saved session. It's a list of arguments, not a shell
+  line, and holds `{session_id}` as one whole element.
+- `exists` (optional, recommended): run in the seat's directory before resuming. Exit 0 means the session exists, exit 1
+  means it doesn't, and anything else means the app couldn't say. On exit 1 OpenRig starts nothing and asks, which
+  matters for apps such as OpenCode 2.0 that open a blank session for an unknown id instead of failing. Its output is
+  ignored.
+- `list` (optional, needed for capture): run in the seat's directory; prints a JSON array of objects with a string
+  `id`, a number `created` (milliseconds since the epoch) and, optionally, a string `directory`. OpenRig records a
+  session only when exactly one listed session was created after the seat started, in the seat's directory, and isn't
+  already recorded for another seat. When it can't tell, it records nothing and the seat stays as it was.
+
+Commands run without a shell, with the daemon's environment, and time out after 60 seconds. Fork stays unsupported.
+A session id is treated like a credential: OpenRig never prints it in an error.
+
+Many apps create a session only when it receives its first message. A seat that never received one has nothing to
+resume, and a restore asks as it does for format 1.
````

**Acceptance:**
```bash
cd "$REPO" && git add docs/reference/agent-app-presets.md && node scripts/check-docs-guard.mjs; echo "rc=$?"   # rc=0
```
Commit: `docs: describe agent-app preset formats 1 and 2`.

### M11. Full checks

**Do:** run each command and paste its last lines into `$NOTES`.

```bash
cd "$REPO"
npm run build                                   # exit 0
npm run lint 2>&1 | tail -5                     # exit 0 (if lint is red on ca1ee698 too, record that and compare by file)
cd packages/cli && npx vitest run test/agent-app-line.test.ts
cd ../daemon
npx vitest run test/agent-app-sessions.test.ts test/agent-app-session-resume.test.ts test/agent-app-runtime.test.ts
npx vitest run test/agent-app-session.integration.test.ts
npx vitest run test/agent-app-runtime.integration.test.ts
npx vitest run > "$WORK/openrig-notes/after-daemon.txt" 2>&1; echo "RC=$?" >> "$WORK/openrig-notes/after-daemon.txt"
grep -E "^ (❯|×) test/|FAIL  test/" "$WORK/openrig-notes/after-daemon.txt" | sed -E 's/ > .*//; s/^ *(❯|×|FAIL) +//; s/ \(.*//' | sort -u > "$WORK/openrig-notes/after-failing-files.txt"
comm -13 "$WORK/openrig-notes/baseline-failing-files.txt" "$WORK/openrig-notes/after-failing-files.txt"   # NEW failures
```

**Acceptance:**
- build and lint exit 0, or lint fails identically on ca1ee698 (record it).
- The targeted runs pass: 2, 24, 12, 42, 2 and 11 tests.
- `comm -13` prints nothing. If it prints a file, run that file alone, both on your branch and with `git stash` on ca1ee698. A file that fails only on your branch is your bug: fix it (rule 3 applies). A file that fails alone on both is environmental: record it.

No commit unless you fixed something.

### M12. Check the spec against the code, push, and write the PR body

**Do:**
1. For each statement in section 4.1, the surprises in 4.2, every rule in section 2 item 8, and each step in M5-M7, find the line of code or the test that makes it true, and write `statement → file:line` in `$NOTES`. Anything without a line is a gap: fix it in a new commit with a test, or list it under "Anything you were unsure about".
2. `git log --oneline ca1ee698..HEAD` shows 9 commits (M2-M10), plus any fixes.
3. Run `grep -rn "resumeToken\|session id" packages/daemon/src/domain/agent-app-sessions.ts packages/daemon/src/adapters/agent-app-runtime-adapter.ts | grep -i "error\|log\|console"` and confirm by reading that no error string interpolates an id.
4. Try `git fetch upstream main && git rebase upstream/main`. If it stops on a conflict, run `git rebase --abort`, stay on ca1ee698, and note "rebase needed" for the human.
5. Push: `git push -u origin feat/agent-app-session-continuity`.
6. Write the PR body to `$WORK/openrig-notes/PR_BODY.md`, using the repository's template `.github/pull_request_template.md` (its sections are "What a user gets", "How you verified it", "Anything you were unsure about", "If this is security-related"). Fill:
   - **What a user gets:** a preset can declare `session`, and an app such as OpenCode then resumes its conversation through `rig launch` or a restore. When the app says the conversation is gone, OpenRig stops and asks instead of opening a blank one. `rig ps` and `rig agent-app list` say whether a preset declares resume. Format 1 presets behave exactly as before.
   - **How you verified it:** the exact test commands and counts from M11, and the `comm -13` result.
   - **Anything you were unsure about:** items 1, 3, 4 and 5 of section 4.5, plus anything from step 1.
   - **If this is security-related:** argv-only execution with no shell, the id floor plus the anchored pattern, ids never in errors, and `export` output never read.
   - Under the template, a line `Refs mvschwarz/openrig discussion #43.`
   - Don't open the PR.

**Acceptance:** the branch is on `origin`, `PR_BODY.md` exists with all four template headings, and `$NOTES` has the step 1 table with no unexplained gaps.

## 7. Gotchas (re-read before every milestone)

1. Base is `ca1ee698`, not the moving `upstream/main`. Patches are made for it.
2. Never test `isAgentAppRuntime(runtime)` alone to decide that a seat is an agent app. Use `agentAppOf(session.agentApp, runtime)`.
3. Never build a shell string from preset text or an id. `spawn(..., { shell: false })` to run, and `shellLineFor` to type.
4. Never put a session id in an error, a log line or an event.
5. `exists` returning `null` means "couldn't tell", and the resume goes ahead. Only `false` (exit 1) stops it.
6. OpenCode 2.0 opens a blank session for an unknown id. That's why `exists` runs before anything is typed.
7. OpenCode 1.x lists other directories' sessions. Never drop the directory filter or the "exactly one" rule.
8. Sessions appear only after the first prompt, so capture can't happen at launch.
9. Ignore `export`'s stdout. It can be megabytes.
10. `sessions.created_at` is `YYYY-MM-DD HH:MM:SS` UTC with no zone. Use `sqliteUtcToMs`, never `new Date(value)`.
11. Use `sessionAgentAppSelect(this.db)` in SQL, never `s.agent_app` directly.
12. The capture fills a **null** token only. Never replace a present one.
13. `rig launch --json` reports the status in `launched[0].status`.
14. Use `tmux capture-pane -S -500` in tests. The ready line scrolls away.
15. Integration tests run the built CLI. Run `npm run build` after changing `packages/cli` or daemon code they exercise.
16. Run integration files one at a time. In parallel the daemon times out.
17. ESM: relative imports end in `.js`.
18. No version bump, no CHANGELOG edit, no upstream PR.
19. The full suite already fails on about 24 files in a plain container. Compare against **your** M1 baseline, never against zero.

## 8. Definition of done

- [ ] Branch `feat/agent-app-session-continuity` starts at `ca1ee698` (or a clean rebase onto `upstream/main`) and has the M2-M10 commits.
- [ ] `npx tsc --noEmit -p .` exits 0 in `packages/daemon` and `packages/cli`.
- [ ] `test/agent-app-sessions.test.ts` 24/24, `test/agent-app-session-resume.test.ts` 12/12, `test/agent-app-runtime.test.ts` 42/42, `packages/cli/test/agent-app-line.test.ts` 2/2.
- [ ] `test/agent-app-session.integration.test.ts` 2/2 and `test/agent-app-runtime.integration.test.ts` 11/11, each run alone after `npm run build`.
- [ ] Full daemon suite: no failing file that isn't in the M1 baseline.
- [ ] `node scripts/check-docs-guard.mjs` exits 0.
- [ ] No test skipped, deleted or loosened. The only edit to an existing test is the M2 row.
- [ ] No error string contains a session id.
- [ ] `$NOTES` has the baseline, the cwd answer, the M12 table and every discrepancy you found.
- [ ] The branch is pushed to `origin`, `PR_BODY.md` is written, and no upstream PR or comment was made.

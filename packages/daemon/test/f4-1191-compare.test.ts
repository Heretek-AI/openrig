// Desk-only comparison (never merged): one pod-aware Claude resume through the real adapter ->
// startup -> restore mapping, with mocked terminal effects, at v0.6.10 and at the 0.6.11 candidate.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFullTestDb } from "./helpers/test-app.js";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { EventBus } from "../src/domain/event-bus.js";
import { SnapshotRepository } from "../src/domain/snapshot-repository.js";
import { CheckpointStore } from "../src/domain/checkpoint-store.js";
import { SnapshotCapture } from "../src/domain/snapshot-capture.js";
import { RigTeardownOrchestrator } from "../src/domain/rig-teardown.js";
import { NodeLauncher } from "../src/domain/node-launcher.js";
import { RestoreOrchestrator } from "../src/domain/restore-orchestrator.js";
import { ClaudeCodeAdapter } from "../src/adapters/claude-code-adapter.js";
import { ClaudeResumeAdapter } from "../src/adapters/claude-resume.js";
import { CodexResumeAdapter } from "../src/adapters/codex-resume.js";
import { NativePermissionStore } from "../src/domain/native-permission-store.js";
import type { ClaudeManagedLaunch } from "../src/domain/claude-managed-launch.js";
import type { TmuxAdapter } from "../src/adapters/tmux.js";

const token = "00000000-0000-4000-8000-000000000006";
const autoScreen = "Restored conversation\n────────────────\n❯ \n────────────────\n  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents\n  ● high · /effort\n";
const SCREENS: Record<string, string> = {
  missing: `$ claude --resume ${token}\nNo conversation found with session ID: ${token}\nuser@host:~/project$ `,
  "generic-exit": "$ claude --resume <token>\nError: simulated Claude exit (not a missing conversation)\nuser@host:~/project$ ",
  "attention-control": autoScreen,
};

describe("F4 #1191 comparison", () => {
  const dbs: ReturnType<typeof createFullTestDb>[] = [];
  afterEach(() => { for (const db of dbs.splice(0)) db.close(); });

  it.each(["missing", "generic-exit", "attention-control"])("%s", async (mode) => {
    const db = createFullTestDb(); dbs.push(db);
    const rigRepo = new RigRepository(db);
    const sessionRegistry = new SessionRegistry(db);
    const eventBus = new EventBus(db);
    const snapshotRepo = new SnapshotRepository(db);
    const checkpointStore = new CheckpointStore(db);
    const snapshotCapture = new SnapshotCapture({ db, rigRepo, sessionRegistry, eventBus, snapshotRepo, checkpointStore });
    const rig = rigRepo.createRig("restore-test");
    db.prepare("INSERT INTO pods (id, rig_id, label) VALUES (?, ?, ?)").run("restore-pod", rig.id, "Test");
    const node = rigRepo.addNode(rig.id, "test.c", { runtime: "claude-code", podId: "restore-pod" });
    new NativePermissionStore(db).write(node.id, { runtime: "claude-code", mode: "auto" }, "fixture", "retained posture");
    const name = "test-c@restore-test";
    const old = sessionRegistry.registerSession(node.id, name);
    sessionRegistry.updateStatus(old.id, "running");
    sessionRegistry.updateResumeToken(old.id, "claude_id", token, "scrape");
    sessionRegistry.updateBinding(node.id, { tmuxSession: name, tmuxPane: "%old" });
    db.prepare("INSERT INTO node_startup_context (node_id, projection_entries_json, resolved_files_json, startup_actions_json, runtime) VALUES (?, ?, ?, ?, ?)").run(node.id, "[]", "[]", "[]", "claude-code");
    let live = true;
    const tmux = {
      hasSession: vi.fn(async () => live),
      probeSession: vi.fn(async () => ({ state: live ? "present" : "absent" })),
      killSession: vi.fn(async () => { live = false; return { ok: true }; }),
      createSession: vi.fn(async () => { live = true; return { ok: true }; }),
      listSessions: vi.fn(async () => live ? [{ name }] : []),
      listWindows: vi.fn(async () => []),
      listPanes: vi.fn(async () => [{ id: "%new", index: 0, cwd: "/", width: 80, height: 24, active: true }]),
      getPanePid: vi.fn(async () => 100),
      getPaneCommand: vi.fn(async () => "bash"),
      capturePaneContent: vi.fn(async () => SCREENS[mode]),
      sendText: vi.fn(async () => ({ ok: true })),
      sendShellCommand: vi.fn(async () => ({ ok: true })),
      sendKeys: vi.fn(async () => ({ ok: true })),
    } as unknown as TmuxAdapter;
    const startedAt = "Thu Oct  1 05:53:16 2026";
    const listProcesses = async () => [{ pid: 100, ppid: 1, pgid: 100, tpgid: 100, executableName: "bash", command: "-bash", startedAt }];
    const down = await new RigTeardownOrchestrator({ db, rigRepo, sessionRegistry, eventBus, snapshotCapture, tmuxAdapter: tmux }).teardown(rig.id);
    expect(down.errors).toEqual([]);
    const adapter = new ClaudeCodeAdapter({ tmux, listProcesses, sleep: async () => {},
      claudeManagedLaunch: { prepare: async () => ({ command: (args: readonly string[]) => `claude ${args.join(" ")}`, assertCurrent: () => {}, configDir: "/fixture", executable: "/opt/claude.exe" }) } as unknown as ClaudeManagedLaunch,
      fsOps: { exists: () => false, readFile: () => "", writeFile: () => {}, mkdirp: () => {}, copyFile: () => {} } });
    const nodeLauncher = new NodeLauncher({ db, rigRepo, sessionRegistry, eventBus, tmuxAdapter: tmux });
    const restore = new RestoreOrchestrator({ db, rigRepo, sessionRegistry, eventBus, snapshotRepo, snapshotCapture,
      checkpointStore, nodeLauncher, tmuxAdapter: tmux, claudeResume: new ClaudeResumeAdapter(tmux),
      codexResume: new CodexResumeAdapter(tmux), listProcesses });
    vi.mocked(tmux.killSession).mockClear(); vi.mocked(tmux.createSession).mockClear();
    const up = await restore.restore(down.snapshotId!, { adapters: { "claude-code": adapter } });
    const rows = db.prepare("SELECT id, status, startup_status, resume_type, resume_token FROM sessions WHERE node_id = ? ORDER BY id").all(node.id);
    const report = {
      mode,
      ok: up.ok,
      rigResult: up.ok ? (up.result as { rigResult?: unknown }).rigResult ?? null : (up as { message?: string }).message,
      node: up.ok ? up.result.nodes[0] : null,
      createSessionCalls: vi.mocked(tmux.createSession).mock.calls.length,
      killSessionCalls: vi.mocked(tmux.killSession).mock.calls.map((c) => c[0]),
      sessionLiveAfter: live,
      oldRow: db.prepare("SELECT status, resume_type, resume_token FROM sessions WHERE id = ?").get(old.id),
      rows,
      binding: sessionRegistry.getBindingForNode(node.id),
    };
    console.log("F4_REPORT " + JSON.stringify(report));
    expect(up.ok).toBe(true);
  });
});

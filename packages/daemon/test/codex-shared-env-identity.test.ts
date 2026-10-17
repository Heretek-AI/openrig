// Diagnosis: two Codex seats in one rig. When Codex shares one app-server between panes, a hook for conversation B can
// run in the environment of seat A (the process that started the shared server). This carries the relay's own
// identity payload for that hook through the real activity route, the session registry and a normal send's Codex
// identity check, and records what happens today. Process rows and the pane are controlled; the relay function, the
// route, the database and the transport are real.
import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { createFullTestDb, createTestApp } from "./helpers/test-app.js";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { SessionTransport } from "../src/domain/session-transport.js";
import type { TmuxAdapter } from "../src/adapters/tmux.js";
import type { NativeProcessRow } from "../src/domain/native-process-lineage.js";

const require = createRequire(import.meta.url);
const relay = require("../assets/plugins/openrig-core/hooks/scripts/activity-relay.cjs") as {
  buildSessionIdentityPayload: (provider: Record<string, unknown>, env: Record<string, string | undefined>) => Record<string, unknown> | null;
};

const CONV_A = "019a0001-0000-7000-8000-00000000000a";
const CONV_B = "019a0001-0000-7000-8000-00000000000b";
const startedAt = "Fri Oct 17 06:00:00 2026";

function fixture() {
  const db = createFullTestDb();
  const rigRepo = new RigRepository(db);
  const sessionRegistry = new SessionRegistry(db);
  const rig = rigRepo.createRig("shared");
  const seat = (member: string, pane: string) => {
    const node = rigRepo.addNode(rig.id, `dev.${member}`, { role: "worker", runtime: "codex" });
    const name = `dev-${member}@shared`;
    const session = sessionRegistry.registerSession(node.id, name);
    sessionRegistry.updateStatus(session.id, "running");
    sessionRegistry.updateBinding(node.id, { tmuxSession: name, tmuxPane: pane });
    // The environment OpenRig gives the process it launches in this seat.
    const env = { OPENRIG_SESSION_NAME: name, OPENRIG_NODE_ID: node.id, OPENRIG_RUNTIME: "codex" };
    return { node, session, name, env };
  };
  const a = seat("alpha", "%1");
  const b = seat("beta", "%2");
  const { app } = createTestApp(db, { activityHookToken: "tok" });

  // Codex's SessionStart hook for `conversation`, run by a process holding `env`, through the shipped relay builder.
  const postHook = async (conversation: string, env: Record<string, string>, source = "startup") => {
    const payload = relay.buildSessionIdentityPayload({ hook_event_name: "SessionStart", session_id: conversation, source }, env);
    const res = await app.request("/api/activity/hooks", {
      method: "POST",
      headers: { "content-type": "application/json", "x-openrig-activity-token": "tok" },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() as Record<string, unknown>, payload: payload! };
  };
  const stored = (sessionId: string) => db.prepare("SELECT resume_type, resume_token, resume_provenance FROM sessions WHERE id = ?").get(sessionId);
  const identityEvents = (nodeId: string) => (db.prepare("SELECT payload FROM events WHERE node_id = ? AND type = 'agent.session_identity' ORDER BY seq")
    .all(nodeId) as Array<{ payload: string }>).map((row) => (JSON.parse(row.payload) as { sessionId: string }).sessionId);

  // An ordinary verified send to seat A. Its pane shows the launch wrapper (bash) with Codex under it, so the
  // transport's Codex identity check runs against seat A's stored token.
  const sendToA = async (codexArgs: string) => {
    const sendText = vi.fn(async () => ({ ok: true as const }));
    const sendKeys = vi.fn(async () => ({ ok: true as const }));
    const tmux = {
      hasSession: async () => true, probeSession: async () => ({ state: "present" as const }), sendText, sendKeys,
      capturePaneContent: async () => "idle prompt\n❯ ", getPanePid: async () => 1135, listPanes: async () => [{ id: "%1" }],
      getPaneCommand: async () => "bash",
    } as unknown as TmuxAdapter;
    const listProcesses = async (): Promise<NativeProcessRow[]> => [
      { pid: 1135, ppid: 1, pgid: 1135, tpgid: 1196, executableName: "zsh", command: "-zsh", startedAt },
      { pid: 1196, ppid: 1135, pgid: 1196, tpgid: 1196, executableName: "bash", command: "/bin/sh /tmp/launch.txt", startedAt },
      { pid: 1205, ppid: 1196, pgid: 1196, tpgid: 1196, executableName: "codex", command: `/opt/native/codex ${codexArgs}`, startedAt },
    ];
    const transport = new SessionTransport({ db, rigRepo, sessionRegistry, tmuxAdapter: tmux, listProcesses, sleep: async () => {} });
    const result = await transport.send(a.name, "ordinary message", { verify: true });
    return { result, typed: sendText.mock.calls.length };
  };
  return { db, a, b, postHook, stored, identityEvents, sendToA, sessionRegistry };
}

describe("Codex session identity from a hook run in another seat's environment (current behaviour)", () => {
  it("control: each seat's own SessionStart registers its own conversation, and seat A receives a send", async () => {
    const f = fixture();
    expect((await f.postHook(CONV_A, f.a.env)).body).toMatchObject({ ok: true, tokenPersisted: true });
    expect((await f.postHook(CONV_B, f.b.env)).body).toMatchObject({ ok: true, tokenPersisted: true });
    expect(f.stored(f.a.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_A, resume_provenance: "hook" });
    expect(f.stored(f.b.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_B, resume_provenance: "hook" });
    expect(await f.sendToA(`resume ${CONV_A}`)).toMatchObject({ result: { ok: true }, typed: 1 });
    f.db.close();
  });

  it("conversation B's hook in seat A's environment replaces seat A's hook-registered conversation, and A's sends are refused", async () => {
    const f = fixture();
    await f.postHook(CONV_A, f.a.env);
    await f.postHook(CONV_B, f.b.env);
    const misattributed = await f.postHook(CONV_B, f.a.env, "resume");
    // The relay names seat A from its environment and conversation B from the hook.
    expect(misattributed.payload).toMatchObject({ eventFamily: "session_identity", nodeId: f.a.node.id, sessionName: f.a.name, sessionId: CONV_B });
    expect(misattributed.body).toMatchObject({ ok: true, tokenPersisted: true });
    expect(f.stored(f.a.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_B, resume_provenance: "hook" });
    expect(f.identityEvents(f.a.node.id)).toEqual([CONV_A, CONV_B]);
    expect(f.stored(f.b.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_B, resume_provenance: "hook" });
    // Seat A's Codex, resumed on its own conversation, no longer matches what OpenRig stored for it.
    const send = await f.sendToA(`resume ${CONV_A}`);
    expect(send.result).toMatchObject({ ok: false, sent: false, reason: "target_runtime_unverified" });
    expect(send.typed).toBe(0);
    f.db.close();
  });

  it("a seat with no identity yet takes the other conversation as its first one", async () => {
    const f = fixture();
    expect((await f.postHook(CONV_B, f.a.env)).body).toMatchObject({ ok: true, tokenPersisted: true });
    expect(f.stored(f.a.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_B, resume_provenance: "hook" });
    f.db.close();
  });

  it("a scrape-provenance conversation is replaced the same way", async () => {
    const f = fixture();
    f.sessionRegistry.updateResumeToken(f.a.session.id, "codex_id", CONV_A, "scrape");
    expect((await f.postHook(CONV_B, f.a.env)).body).toMatchObject({ ok: true, tokenPersisted: true });
    expect(f.stored(f.a.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_B, resume_provenance: "hook" });
    expect((await f.sendToA(`resume ${CONV_A}`)).result).toMatchObject({ ok: false, reason: "target_runtime_unverified" });
    f.db.close();
  });

  it("an operator-provenance conversation holds: the hook is refused and seat A still receives", async () => {
    const f = fixture();
    f.sessionRegistry.updateResumeToken(f.a.session.id, "codex_id", CONV_A, "operator");
    expect((await f.postHook(CONV_B, f.a.env)).body).toMatchObject({ ok: true, tokenPersisted: false });
    expect(f.stored(f.a.session.id)).toEqual({ resume_type: "codex_id", resume_token: CONV_A, resume_provenance: "operator" });
    expect(await f.sendToA(`resume ${CONV_A}`)).toMatchObject({ result: { ok: true }, typed: 1 });
    f.db.close();
  });

  it("a fresh Codex in seat A still receives with the wrong conversation stored: only a resumed process can contradict it", async () => {
    const f = fixture();
    await f.postHook(CONV_A, f.a.env);
    await f.postHook(CONV_B, f.a.env);
    expect(f.stored(f.a.session.id)).toMatchObject({ resume_token: CONV_B });
    expect(await f.sendToA("-m gpt-test")).toMatchObject({ result: { ok: true }, typed: 1 });
    f.db.close();
  });
});

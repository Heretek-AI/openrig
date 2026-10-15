// SYNTHETIC, not a replay: no incident pane capture was retained. Composer shape follows the
// checked-in Claude 2.1.296 idle fixtures and #814 warning-footer tests. The prose is constructed.
import { afterEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import type { TmuxAdapter } from "../src/adapters/tmux.js";
import { createFullTestDb } from "./helpers/test-app.js";
import { RigRepository } from "../src/domain/rig-repository.js";
import { SessionRegistry } from "../src/domain/session-registry.js";
import { AgentActivityStore } from "../src/domain/agent-activity-store.js";
import { EventBus } from "../src/domain/event-bus.js";
import { classifyPaneActivity, probeSessionActivity, SessionTransport } from "../src/domain/session-transport.js";
import { SeatStructuralActivityService } from "../src/domain/seat-structural-activity-service.js";

const SEAT = "dev-impl@quoted-fixture";
const BAR = "─".repeat(70);
const QUESTION_FOOTER = "Enter to select · ↑/↓ to navigate · Esc to cancel";
const MODE = "  ⏵⏵ accept edits on (shift+tab to cycle)";
const QUOTE = "● Earlier report: the peer saw a permission prompt (Do you want to proceed?).";
const DONE = "✻ Crunched for 2s";
const NOW = new Date("2026-10-15T11:30:00.000Z");
const frame = (history: string[], head = DONE, prompt = "❯\u00a0", footer = MODE, warnings: string[] = []) =>
  [...history, "", head, "", `${"─".repeat(40)} dev-impl@quoted-fixture ─`, prompt, BAR, footer, ...warnings].join("\n");
const historyPane = (withFooter: boolean) => frame(withFooter ? [QUOTE, QUESTION_FOOTER] : [QUOTE]);
const DBS: Database.Database[] = [];
afterEach(() => { for (const db of DBS.splice(0)) db.close(); vi.restoreAllMocks(); });

function fixture(pane: string | null) {
  const db = createFullTestDb(); DBS.push(db);
  const rigRepo = new RigRepository(db);
  const sessionRegistry = new SessionRegistry(db);
  const rig = rigRepo.createRig("quoted-fixture");
  const node = rigRepo.addNode(rig.id, "dev.impl", { role: "worker", runtime: "claude-code" });
  const session = sessionRegistry.registerSession(node.id, SEAT);
  sessionRegistry.updateStatus(session.id, "running");
  sessionRegistry.updateBinding(node.id, { tmuxSession: SEAT });
  const sendText = vi.fn(async () => ({ ok: true as const }));
  const sendKeys = vi.fn(async () => ({ ok: true as const }));
  const capturePaneContent = vi.fn(async () => pane);
  const tmux = {
    hasSession: async () => true, probeSession: async () => ({ state: "present" as const }),
    sendText, sendKeys, capturePaneContent, listPanes: async () => [],
    getPanePid: async () => null, getPaneCommand: async () => null,
    isPaneInMode: async () => false, cancelPaneMode: async () => ({ ok: true as const }),
  } as unknown as TmuxAdapter;
  const eventBus = new EventBus(db);
  const hooks = new AgentActivityStore({ db, eventBus });
  const transport = new SessionTransport({ db, rigRepo, sessionRegistry, tmuxAdapter: tmux,
    agentActivityStore: hooks, eventBus, now: () => NOW, sleep: async () => {}, waitForIdlePollMs: 1 });
  return { db, tmux, hooks, transport, sendText, sendKeys, capturePaneContent };
}

describe("quoted permission history regression", () => {
  it("keeps the complete later boundary under supported mode and warning layouts", () => {
    const warnings = ["  ✘ Auto-update failed: no write permission to npm prefix · Run claude doctor",
      "  tmux focus-events off · add 'set -g focus-events on' to ~/.tmux.conf and re…",
      "  You've used 96% of your weekly limit · resets 12pm (UTC)"];
    for (const footer of [MODE, "  -- INSERT -- ⏵⏵ bypass permissions on (shift+tab to cycle)",
      "  ⏵⏵ auto mode on (shift+tab to cycle)", "  ⏸ plan mode on (shift+tab to cycle)", "  ? for shortcuts"]) {
      for (const trailers of [[], warnings]) {
        expect(classifyPaneActivity(frame([QUOTE], DONE, "❯ ", footer, trailers))).toMatchObject({ state: "agent_idle" });
      }
    }
  });
  for (const withFooter of [false, true]) {
    const label = withFooter ? "with historical question footer" : "without historical question footer";
    it(`classifier: ${label}`, () => {
      expect(classifyPaneActivity(historyPane(withFooter))).toMatchObject({ state: "agent_idle" });
    });
    it(`ordinary probe: ${label}`, async () => {
      const f = fixture(historyPane(withFooter));
      expect(await probeSessionActivity({ sessionName: SEAT, runtime: "claude-code", attachmentType: "tmux", tmuxAdapter: f.tmux, now: NOW }))
        .toMatchObject({ state: "idle", evidenceSource: "pane_heuristic" });
    });
    it(`ordinary send: ${label}`, async () => {
      const f = fixture(historyPane(withFooter));
      expect(await f.transport.send(SEAT, "ordinary synthetic status message")).toMatchObject({ ok: true });
      expect(f.sendText).toHaveBeenCalledTimes(1); expect(f.sendKeys).toHaveBeenCalledTimes(1);
    });
    it(`structural cache: ${label}`, async () => {
      const f = fixture(historyPane(withFooter));
      const service = new SeatStructuralActivityService(f.tmux, () => NOW);
      expect(await service.pollSeat(SEAT)).toMatchObject({ state: "agent_idle" });
      expect(service.getStructuralActivity(SEAT)?.state).toBe("agent_idle");
    });
    it(`idle-wait consumer: ${label}`, async () => {
      const f = fixture(historyPane(withFooter));
      expect(await f.transport.waitUntilIdle(SEAT, 100)).toMatchObject({ ok: true, activity: { state: "idle" } });
      expect(f.sendText).not.toHaveBeenCalled(); expect(f.sendKeys).not.toHaveBeenCalled();
      expect(await f.transport.send(SEAT, "ordinary pane-only wait message", { waitForIdleMs: 100, readinessFromPaneOnly: true }))
        .toMatchObject({ ok: true });
      expect(f.sendText).toHaveBeenCalledTimes(1); expect(f.sendKeys).toHaveBeenCalledTimes(1);
    });
  }
});

describe("quoted permission history preservation", () => {
  const permission = frame([], "Do you want to proceed?");
  const selection = ["Choose an option", "❯ 1. Continue", "  2. Cancel", QUESTION_FOOTER].join("\n");
  const tallPrompt = ["Do you want to proceed?", "❯ 1. Yes", "  2. No", "  3. Explain", "  Use ↑↓ to choose, enter to confirm", BAR, "❯ ", BAR, MODE].join("\n");
  it.each([permission, selection, tallPrompt])("still refuses a current permission or selection prompt", async (pane) => {
    expect(classifyPaneActivity(pane).state).toBe("attention");
    const f = fixture(pane);
    expect(await f.transport.send(SEAT, "ordinary message")).toMatchObject({ ok: false, reason: "target_needs_input" });
    expect(f.sendText).not.toHaveBeenCalled(); expect(f.sendKeys).not.toHaveBeenCalled();
  });
  it("does not use a bare glyph or footer as a permission-history boundary", () => {
    for (const pane of [QUOTE + "\n❯ ", QUOTE + "\n❯ \n" + MODE,
      frame([QUOTE]).replace(`${"─".repeat(40)} dev-impl@quoted-fixture ─\n`, ""),
      frame([QUOTE], DONE, "❯ ", "unrecognized footer"),
      [QUOTE, ...Array.from({ length: 20 }, () => "  indented unfinished block"), BAR, "❯ ", BAR, MODE].join("\n")]) {
      expect(classifyPaneActivity(pane).state).not.toBe("agent_idle");
    }
  });
  it("keeps permission evidence in the current status head or its indented task block", () => {
    for (const head of ["Do you want to proceed?", "Do you want to proceed?\n  waiting for your answer", "Ready\n  Do you want to proceed?"]) {
      expect(classifyPaneActivity(frame([], head))).toMatchObject({ state: "attention", reason: "permission_prompt" });
    }
  });
  it("does not erase a draft or live work, including a running hook", async () => {
    expect(classifyPaneActivity(frame([QUOTE], DONE, "❯ typed draft")).state).toBe("attention");
    expect(classifyPaneActivity(frame([], "✻ Thinking… (15s)"))).toMatchObject({ state: "agent_active" });
    expect(classifyPaneActivity(frame([QUOTE], "✻ Thinking… (15s)")).state).not.toBe("agent_idle");
    const f = fixture(historyPane(false));
    f.hooks.recordHookEvent({ runtime: "claude-code", sessionName: SEAT, hookEvent: "UserPromptSubmit", occurredAt: NOW.toISOString() });
    const result = await f.transport.send(SEAT, "ordinary message");
    expect(result).toMatchObject({ ok: true }); expect(result.warning).toContain("busy is advisory");
  });
  it("fresh permission hook remains authoritative over the complete empty composer", async () => {
    const f = fixture(historyPane(false));
    f.hooks.recordHookEvent({ runtime: "claude-code", sessionName: SEAT, hookEvent: "Notification", subtype: "permission_prompt", occurredAt: NOW.toISOString() });
    expect(await f.transport.send(SEAT, "ordinary message")).toMatchObject({ ok: false, reason: "target_needs_input", activity: { evidenceSource: "runtime_hook" } });
    expect(f.sendText).not.toHaveBeenCalled(); expect(f.sendKeys).not.toHaveBeenCalled();
  });
  it("old permission hook and unknown pane retain the old fallback, without treating unknown as idle", async () => {
    const f = fixture("unrecognized synthetic pane");
    f.hooks.recordHookEvent({ runtime: "claude-code", sessionName: SEAT, hookEvent: "Notification", subtype: "permission_prompt", occurredAt: new Date(NOW.getTime() - 36_000).toISOString() });
    expect(await f.transport.send(SEAT, "ordinary message")).toMatchObject({ ok: false, reason: "target_needs_input" });
    expect(f.sendText).not.toHaveBeenCalled();
    expect(await probeSessionActivity({ sessionName: SEAT, runtime: "claude-code", attachmentType: "tmux", tmuxAdapter: f.tmux, now: NOW })).toMatchObject({ state: "unknown" });
  });
  it("current permission stays authoritative with supported warnings and every mode footer", () => {
    for (const mode of [MODE, "  -- INSERT -- ⏵⏵ bypass permissions on (shift+tab to cycle)", "  ⏵⏵ auto mode on (shift+tab to cycle)", "  ⏸ plan mode on (shift+tab to cycle)", "  ? for shortcuts"]) {
      expect(classifyPaneActivity(frame([], "Do you want to proceed?", "❯ ", mode))).toMatchObject({ state: "attention", reason: "permission_prompt" });
      expect(classifyPaneActivity(frame([], "Do you want to proceed?", "❯ ", mode, ["  ✘ Auto-update failed: no write permission to npm prefix · Run claude doctor"])))
        .toMatchObject({ state: "attention", reason: "permission_prompt" });
    }
  });
});

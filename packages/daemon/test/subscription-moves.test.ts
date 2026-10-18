// OPR.0.7.0.18: the subscription move record, through the daemon's real provider routes and event log.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createFullTestDb, createTestApp } from "./helpers/test-app.js";

const AGENT = "fleet@ops-rig";

function move(overrides: Record<string, unknown> = {}) {
  return {
    home: "/home/dev/.codex-team-a", host: "box-2", from: "codex-sub-A", to: "codex-sub-B",
    reason: "A is at 92% of its weekly window, resetting in two days; B is at 30%.",
    readings: [
      { subject: "codex-sub-A weekly", observedAt: "2026-10-18T09:56:00Z", summary: "92% used, resets 2026-10-20T00:00Z" },
      { subject: "codex-sub-B weekly", observedAt: "2026-10-18T09:58:00Z", summary: "30% used" },
    ],
    seats: [
      { seat: "dev-impl@team", result: "moved", evidence: "verify: moved; Account line names B" },
      { seat: "dev-qa@team", result: "unconfirmed", missing: "no completed tool turn yet" },
    ],
    peers: [
      { seat: "dev-svc@team", note: "not restarted; account unverified (runs a service)" },
    ],
    ...overrides,
  };
}

describe("subscription move record", () => {
  let db: Database.Database;
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    db = createFullTestDb();
    ({ app } = createTestApp(db));
  });
  afterEach(() => { db.close(); });

  const post = (body: unknown, seat: string | null = AGENT) => app.request("/api/provider/moves", {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "127.0.0.1:7433", ...(seat ? { "X-OpenRig-Session": seat } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const get = (path: string) => app.request(path, { headers: { Host: "127.0.0.1:7433" } });
  const stored = () => db.prepare("SELECT rig_id, node_id, payload FROM events WHERE type = 'subscription.move_recorded'").all() as Array<{ rig_id: string | null; node_id: string | null; payload: string }>;

  it("records a move under the caller's seat and reads it back whole", async () => {
    const res = await post(move());
    expect(res.status).toBe(201);
    const { move: recorded } = await res.json() as { move: Record<string, unknown> };
    expect(recorded).toMatchObject({ ...move(), recordedBy: AGENT });
    expect(recorded["id"]).toMatch(/^move-\d{14}-[0-9a-f]{8}$/);

    const shown = await get(`/api/provider/moves/${recorded["id"]}`);
    expect(shown.status).toBe(200);
    expect((await shown.json() as { move: unknown }).move).toEqual(recorded);
    // Fleet-wide history: no rig or node, in the append-only event log.
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ rig_id: null, node_id: null });
  });

  it("lists newest first and filters by home and by seat, peers included", async () => {
    const first = await (await post(move())).json() as { move: { id: string } };
    const second = await (await post(move({ home: "/home/dev/.codex-team-b", seats: [{ seat: "ops@team", result: "moved" }], peers: undefined }))).json() as { move: { id: string } };

    const all = await (await get("/api/provider/moves")).json() as { moves: Array<{ id: string }> };
    expect(all.moves.map((m) => m.id)).toEqual([second.move.id, first.move.id]);
    const byHome = await (await get("/api/provider/moves?home=%2Fhome%2Fdev%2F.codex-team-a")).json() as { moves: Array<{ id: string }> };
    expect(byHome.moves.map((m) => m.id)).toEqual([first.move.id]);
    const byPeer = await (await get("/api/provider/moves?seat=dev-svc%40team")).json() as { moves: Array<{ id: string }> };
    expect(byPeer.moves.map((m) => m.id)).toEqual([first.move.id]);
    const limited = await (await get("/api/provider/moves?limit=1")).json() as { moves: unknown[] };
    expect(limited.moves).toHaveLength(1);
  });

  it("keeps a follow-up that supersedes an unconfirmed move beside the original", async () => {
    const first = await (await post(move())).json() as { move: { id: string } };
    const followUp = await post(move({ seats: [{ seat: "dev-qa@team", result: "moved", evidence: "verify: moved" }], peers: undefined, supersedes: first.move.id }));
    expect(followUp.status).toBe(201);
    const list = await (await get("/api/provider/moves?seat=dev-qa%40team")).json() as { moves: Array<{ supersedes?: string; seats: Array<{ result: string }> }> };
    expect(list.moves).toHaveLength(2);
    expect(list.moves[0]).toMatchObject({ supersedes: first.move.id, seats: [{ result: "moved" }] });
    expect(list.moves[1]!.seats.map((s) => s.result)).toEqual(["moved", "unconfirmed"]);
  });

  it.each([
    ["no seats", move({ seats: [] })],
    ["an unknown result", move({ seats: [{ seat: "x@team", result: "done" }] })],
    ["a reading without a time", move({ readings: [{ subject: "A", observedAt: "yesterday", summary: "92%" }] })],
    ["a lenient non-ISO time", move({ readings: [{ subject: "A", observedAt: "Oct 18 2026", summary: "92%" }] })],
    ["a time with no timezone", move({ readings: [{ subject: "A", observedAt: "2026-10-18T09:56:00", summary: "92%" }] })],
    ["an impossible date", move({ readings: [{ subject: "A", observedAt: "2026-02-30T00:00:00Z", summary: "92%" }] })],
    ["no reason", move({ reason: " " })],
    ["a list as the body", [move()]],
    ["invalid JSON", "{"],
  ])("refuses a malformed move (%s) and writes nothing", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(stored()).toHaveLength(0);
  });

  it("asks for an actor when no seat identity is present, and writes nothing", async () => {
    const res = await post(move(), null);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "actor_required" });
    expect(stored()).toHaveLength(0);
  });

  it("answers 404 for an unknown move and 400 for a bad limit", async () => {
    expect((await get("/api/provider/moves/move-nope")).status).toBe(404);
    expect((await get("/api/provider/moves?limit=0")).status).toBe(400);
  });
});

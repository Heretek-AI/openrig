// The record of each subscription move a fleet-management agent makes or attempts: which Codex home and seats moved,
// from which subscription to which, why, on which readings, and how each seat came out. The agent decides and moves
// (with `rig auth switch` and `rig seat restart --keep-conversation --verify`); this only keeps what it reports, in the
// daemon's append-only event log, for the agent and the observatory to read. It holds labels and references, never
// credentials, and decides nothing.

import { randomBytes } from "node:crypto";
import type { EventBus } from "../event-bus.js";

export const SUBSCRIPTION_MOVE_EVENT = "subscription.move_recorded" as const;

/** How one seat came out of a move. `moved` needs the restart's uptake evidence (a real turn and the account in use). */
export type SeatMoveResult = "moved" | "unconfirmed" | "unknown";
const SEAT_RESULTS: ReadonlySet<string> = new Set(["moved", "unconfirmed", "unknown"]);

export interface SubscriptionMoveSeat {
  seat: string;
  result: SeatMoveResult;
  /** For `unconfirmed` or `unknown`: what is missing, e.g. "no completed tool turn". */
  missing?: string;
  /** What showed the result, e.g. the restart's verify outcome and Account line. */
  evidence?: string;
}

/** A reading the agent acted on, with when it was observed. */
export interface SubscriptionMoveReading {
  /** The allowance or subscription it describes. */
  subject: string;
  /** When the reading was observed (ISO 8601), not when the agent read it. */
  observedAt: string;
  /** What it said, e.g. "weekly 92% used, resets 2026-10-20T00:00Z". */
  summary: string;
}

/** What the agent reports. */
export interface SubscriptionMoveInput {
  /** The Codex home moved, as the agent names it (path or label). */
  home: string;
  /** The machine it is on. */
  host?: string;
  /** Subscription or account references, as labels: never credentials. */
  from: string;
  to: string;
  /** The agent's reason, in its own words. */
  reason: string;
  readings: SubscriptionMoveReading[];
  /** Seats restarted (or attempted), each with its result. */
  seats: SubscriptionMoveSeat[];
  /** Seats on the home that were not restarted ("not restarted; account unverified"), or skipped with a reason. */
  peers?: Array<{ seat: string; note: string }>;
  /** An earlier move id this record follows up, e.g. confirming an unconfirmed seat. */
  supersedes?: string;
}

/** What the event log holds for one move. */
export type SubscriptionMoveEventPayload = SubscriptionMoveInput & { id: string; recordedBy: string };

export interface SubscriptionMoveRecord extends SubscriptionMoveInput {
  id: string;
  /** The seat that recorded it (the caller's transport identity). */
  recordedBy: string;
  recordedAt: string;
  seq: number;
}

export class SubscriptionMoveInputError extends Error {}

const text = (value: unknown, field: string, optional = false): string | undefined => {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new SubscriptionMoveInputError(`${field} must be a non-empty string`);
  return value;
};
const list = (value: unknown, field: string, optional = false): unknown[] => {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw new SubscriptionMoveInputError(`${field} must be a list`);
  return value;
};
const object = (value: unknown, field: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new SubscriptionMoveInputError(`${field} must be an object`);
  return value as Record<string, unknown>;
};

/** The shape check for a reported move. It refuses only malformed input; it never judges the move. */
export function parseSubscriptionMove(raw: unknown): SubscriptionMoveInput {
  const body = object(raw, "the move");
  const seats = list(body["seats"], "seats").map((entry, i) => {
    const seat = object(entry, `seats[${i}]`);
    const result = seat["result"];
    if (typeof result !== "string" || !SEAT_RESULTS.has(result)) {
      throw new SubscriptionMoveInputError(`seats[${i}].result must be moved, unconfirmed or unknown`);
    }
    return {
      seat: text(seat["seat"], `seats[${i}].seat`)!,
      result: result as SeatMoveResult,
      ...(seat["missing"] !== undefined ? { missing: text(seat["missing"], `seats[${i}].missing`)! } : {}),
      ...(seat["evidence"] !== undefined ? { evidence: text(seat["evidence"], `seats[${i}].evidence`)! } : {}),
    };
  });
  if (seats.length === 0) throw new SubscriptionMoveInputError("seats must name at least one seat");
  const readings = list(body["readings"], "readings").map((entry, i) => {
    const reading = object(entry, `readings[${i}]`);
    const observedAt = text(reading["observedAt"], `readings[${i}].observedAt`)!;
    if (Number.isNaN(Date.parse(observedAt))) throw new SubscriptionMoveInputError(`readings[${i}].observedAt must be a timestamp`);
    return { subject: text(reading["subject"], `readings[${i}].subject`)!, observedAt, summary: text(reading["summary"], `readings[${i}].summary`)! };
  });
  const peers = list(body["peers"], "peers", true).map((entry, i) => {
    const peer = object(entry, `peers[${i}]`);
    return { seat: text(peer["seat"], `peers[${i}].seat`)!, note: text(peer["note"], `peers[${i}].note`)! };
  });
  const host = text(body["host"], "host", true);
  const supersedes = text(body["supersedes"], "supersedes", true);
  return {
    home: text(body["home"], "home")!,
    ...(host ? { host } : {}),
    from: text(body["from"], "from")!,
    to: text(body["to"], "to")!,
    reason: text(body["reason"], "reason")!,
    readings,
    seats,
    ...(peers.length ? { peers } : {}),
    ...(supersedes ? { supersedes } : {}),
  };
}

export class SubscriptionMoves {
  constructor(private readonly eventBus: EventBus) {}

  record(input: SubscriptionMoveInput, recordedBy: string): SubscriptionMoveRecord {
    const id = `move-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(4).toString("hex")}`;
    const persisted = this.eventBus.emit({ type: SUBSCRIPTION_MOVE_EVENT, move: { id, recordedBy, ...input } });
    return { id, recordedBy, ...input, recordedAt: persisted.createdAt, seq: persisted.seq };
  }

  /** Newest first. A seat filter matches a moved seat or a peer. */
  list(filter: { home?: string; seat?: string; limit?: number } = {}): SubscriptionMoveRecord[] {
    const rows = this.eventBus.db.prepare(
      "SELECT seq, payload, created_at FROM events WHERE type = ? ORDER BY seq DESC",
    ).all(SUBSCRIPTION_MOVE_EVENT) as Array<{ seq: number; payload: string; created_at: string }>;
    const records: SubscriptionMoveRecord[] = [];
    for (const row of rows) {
      const record = toRecord(row);
      if (!record) continue;
      if (filter.home && record.home !== filter.home) continue;
      if (filter.seat && !record.seats.some((s) => s.seat === filter.seat) && !(record.peers ?? []).some((p) => p.seat === filter.seat)) continue;
      records.push(record);
      if (records.length >= (filter.limit ?? 50)) break;
    }
    return records;
  }

  show(id: string): SubscriptionMoveRecord | null {
    return this.list({ limit: Number.MAX_SAFE_INTEGER }).find((record) => record.id === id) ?? null;
  }
}

function toRecord(row: { seq: number; payload: string; created_at: string }): SubscriptionMoveRecord | null {
  try {
    const move = (JSON.parse(row.payload) as { move?: SubscriptionMoveEventPayload }).move;
    return move ? { ...move, recordedAt: row.created_at, seq: row.seq } : null;
  } catch {
    return null;
  }
}

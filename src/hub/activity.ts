import { db } from "../db/client.js";
import { scoutKey } from "./session.js";

export type ActivityKind =
  | "signed_in"
  | "signed_out"
  | "online"
  | "offline"
  | "assigned"
  | "unassigned"
  | "opened"
  | "submitted"
  | "corrected"
  | "voided"
  | "break_on"
  | "break_off";

// The record behind the scout manager's timeline: who did what, and when.
export function recordActivity(input: {
  eventKey?: string | null;
  scout: string;
  kind: ActivityKind;
  matchKey?: string | null;
  teamNumber?: number | null;
  at?: string;
}): void {
  db.prepare(
    `INSERT INTO scout_activity (event_key, scout, scout_key, match_key, team_number, kind, at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.eventKey ?? null,
    input.scout,
    scoutKey(input.scout),
    input.matchKey ?? null,
    input.teamNumber ?? null,
    input.kind,
    input.at ?? new Date().toISOString()
  );
}

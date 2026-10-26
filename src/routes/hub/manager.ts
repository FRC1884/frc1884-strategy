import type { FastifyInstance } from "fastify";

import { db } from "../../db/client.js";
import { recordActivity } from "../../hub/activity.js";
import { GRACE_MS, HORIZON, loadAssignments, reassign, setManualAssignment } from "../../hub/assign.js";
import { publish } from "../../hub/changeFeed.js";
import { getEntry, saveEntry, toEntry, voidEntry } from "../../hub/entries.js";
import { loadSchedule } from "../../hub/schedule.js";
import { requirePermission } from "../../hub/session.js";
import { getEvent } from "../../hub/settings.js";
import { getGame } from "../../shared/games/index.js";
import { matchClock, matchLabel, teamsIn } from "../../shared/schedule.js";

interface EntryRow {
  id: string;
  event_key: string;
  match_key: string;
  team_number: number;
  scout: string;
  scout_key: string;
  game_id: string;
  data_json: string;
  status: "draft" | "submitted" | "void";
  revision: number;
  started_at: string;
  updated_at: string;
  submitted_at: string | null;
  edited_by: string | null;
}

function roster(eventKey: string, now: number) {
  const sessions = db
    .prepare(
      `SELECT name, scout_key, role, connected, on_break, scouting, signed_in_at, last_seen_at
       FROM scout_sessions
       WHERE signed_out_at IS NULL AND signed_in_at > ?
       ORDER BY signed_in_at ASC`
    )
    .all(new Date(now - 36 * 3_600_000).toISOString()) as Array<{
    name: string;
    scout_key: string;
    role: string;
    connected: number;
    on_break: number;
    scouting: number;
    signed_in_at: string;
    last_seen_at: string;
  }>;
  const counts = db
    .prepare(
      `SELECT scout_key,
              SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted,
              SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts
       FROM match_scout_entries WHERE event_key = ? GROUP BY scout_key`
    )
    .all(eventKey) as Array<{ scout_key: string; submitted: number; drafts: number }>;
  const countByKey = new Map(counts.map((c) => [c.scout_key, c]));

  const people = new Map<
    string,
    { key: string; name: string; role: string; online: boolean; onBreak: boolean; scouting: boolean; signedInAt: string; lastSeenAt: string; devices: number; submitted: number; drafts: number }
  >();
  for (const s of sessions) {
    const current = people.get(s.scout_key);
    if (!current) {
      people.set(s.scout_key, {
        key: s.scout_key,
        name: s.name,
        role: s.role,
        online: s.connected === 1,
        onBreak: s.on_break === 1,
        scouting: s.scouting === 1,
        signedInAt: s.signed_in_at,
        lastSeenAt: s.last_seen_at,
        devices: 1,
        submitted: countByKey.get(s.scout_key)?.submitted ?? 0,
        drafts: countByKey.get(s.scout_key)?.drafts ?? 0,
      });
    } else {
      current.online ||= s.connected === 1;
      current.onBreak ||= s.on_break === 1;
      current.scouting ||= s.scouting === 1;
      current.devices += 1;
      if (s.last_seen_at > current.lastSeenAt) current.lastSeenAt = s.last_seen_at;
      // The most senior role the person has signed in with.
      if (["lead", "manager", "strategist", "scout"].indexOf(s.role) < ["lead", "manager", "strategist", "scout"].indexOf(current.role)) current.role = s.role;
    }
  }
  return [...people.values()].map((p) => ({
    ...p,
    // Recently dropped scouts keep their robots for a short while.
    holding: !p.online && now - Date.parse(p.lastSeenAt) < GRACE_MS,
  }));
}

export async function hubManagerRoutes(app: FastifyInstance) {
  const guard = { preHandler: requirePermission("manage") };

  // The live picture: who is here, and for the matches around now, who is
  // watching which robot and how far along their entry is.
  app.get<{ Params: { eventKey: string } }>("/events/:eventKey/manager/board", guard, async (request, reply) => {
    const { eventKey } = request.params;
    const event = getEvent(eventKey);
    if (!event) return reply.code(404).send({ error: "event_not_found" });
    const now = Date.now();
    reassign(eventKey, now);

    const schedule = loadSchedule(eventKey);
    const clock = matchClock(schedule, now, getGame(event.gameId).matchSeconds);
    const upcoming = clock.upcoming.slice(0, HORIZON);
    const firstUpcoming = upcoming[0] ? schedule.findIndex((m) => m.matchKey === upcoming[0].matchKey) : schedule.length;
    const recent = schedule.slice(Math.max(0, firstUpcoming - 2), firstUpcoming);
    const shown = [...recent, ...upcoming];
    const keys = shown.map((m) => m.matchKey);

    const assignments = loadAssignments(eventKey, keys);
    const entries = keys.length
      ? (db
          .prepare(`SELECT * FROM match_scout_entries WHERE event_key = ? AND status != 'void' AND match_key IN (${keys.map(() => "?").join(",")})`)
          .all(eventKey, ...keys) as EntryRow[])
      : [];

    const matches = shown.map((match) => {
      const start = clock.startsAt[match.matchKey] ?? null;
      const done = clock.done[match.matchKey];
      return {
        matchKey: match.matchKey,
        label: match.label,
        startsAt: start,
        started: start !== null && start <= now,
        done,
        slots: teamsIn(match).map((team) => {
          const slot = assignments.find((a) => a.matchKey === match.matchKey && a.alliance === team.alliance && a.station === team.station);
          const mine = entries.filter((e) => e.match_key === match.matchKey && e.team_number === team.teamNumber);
          const submitted = mine.some((e) => e.status === "submitted");
          const status = submitted ? "submitted" : mine.length > 0 ? "writing" : done ? "missing" : slot?.scoutKey ? "not_opened" : "unassigned";
          return {
            alliance: team.alliance,
            station: team.station,
            teamNumber: team.teamNumber,
            teamName: team.name,
            scout: slot?.scout ?? null,
            scoutKey: slot?.scoutKey ?? null,
            source: slot?.source ?? "auto",
            locked: slot?.locked ?? false,
            status,
            entries: mine.map((e) => ({ id: e.id, scout: e.scout, status: e.status, startedAt: e.started_at, updatedAt: e.updated_at, submittedAt: e.submitted_at })),
          };
        }),
      };
    });

    const played = schedule.filter((m) => clock.done[m.matchKey]);
    const covered = db
      .prepare(`SELECT COUNT(DISTINCT match_key || ':' || team_number) AS n FROM match_scout_entries WHERE event_key = ? AND status = 'submitted'`)
      .get(eventKey) as { n: number };

    return {
      serverTime: new Date(now).toISOString(),
      lateMinutes: Math.round(clock.latenessMs / 60_000),
      scouts: roster(eventKey, now),
      matches,
      coverage: { robotsCovered: covered.n, robotsPlayed: played.length * 6 },
    };
  });

  app.get<{ Params: { eventKey: string }; Querystring: { scout?: string; limit?: string } }>(
    "/events/:eventKey/manager/activity",
    guard,
    async (request) => {
      const { eventKey } = request.params;
      const limit = Math.min(500, Math.max(1, Number(request.query.limit) || 150));
      const scout = request.query.scout;
      const rows = db
        .prepare(
          `SELECT a.id, a.scout, a.scout_key, a.match_key, a.team_number, a.kind, a.at,
                  m.comp_level, m.set_number, m.match_number
           FROM scout_activity a
           LEFT JOIN matches m ON m.match_key = a.match_key
           WHERE (a.event_key = ? OR a.event_key IS NULL) ${scout ? "AND a.scout_key = ?" : ""}
           ORDER BY a.id DESC LIMIT ?`
        )
        .all(...(scout ? [eventKey, scout, limit] : [eventKey, limit])) as Array<{
        id: number;
        scout: string;
        scout_key: string;
        match_key: string | null;
        team_number: number | null;
        kind: string;
        at: string;
        comp_level: string | null;
        set_number: number | null;
        match_number: number | null;
      }>;
      return {
        activity: rows.map((r) => ({
          id: r.id,
          scout: r.scout,
          scoutKey: r.scout_key,
          kind: r.kind,
          at: r.at,
          teamNumber: r.team_number,
          matchLabel: r.comp_level && r.match_number !== null ? matchLabel(r.comp_level, r.set_number, r.match_number) : null,
        })),
      };
    }
  );

  app.get<{ Params: { eventKey: string }; Querystring: { match?: string; team?: string; scout?: string; status?: string } }>(
    "/events/:eventKey/manager/entries",
    guard,
    async (request) => {
      const { eventKey } = request.params;
      const where = ["e.event_key = ?"];
      const args: Array<string | number> = [eventKey];
      if (request.query.match) {
        where.push("e.match_key = ?");
        args.push(request.query.match);
      }
      if (request.query.team && Number.isInteger(Number(request.query.team))) {
        where.push("e.team_number = ?");
        args.push(Number(request.query.team));
      }
      if (request.query.scout) {
        where.push("e.scout_key = ?");
        args.push(request.query.scout);
      }
      if (request.query.status && ["draft", "submitted", "void"].includes(request.query.status)) {
        where.push("e.status = ?");
        args.push(request.query.status);
      }
      const rows = db
        .prepare(
          `SELECT e.*, m.comp_level, m.set_number, m.match_number, t.name AS team_name
           FROM match_scout_entries e
           LEFT JOIN matches m ON m.match_key = e.match_key
           LEFT JOIN teams t ON t.team_number = e.team_number
           WHERE ${where.join(" AND ")}
           ORDER BY COALESCE(m.planned_at, e.started_at) DESC, e.team_number ASC
           LIMIT 400`
        )
        .all(...args) as Array<EntryRow & { comp_level: string | null; set_number: number | null; match_number: number | null; team_name: string | null }>;
      return {
        entries: rows.map((row) => ({
          ...toEntry(row),
          teamName: row.team_name,
          matchLabel: row.comp_level && row.match_number !== null ? matchLabel(row.comp_level, row.set_number, row.match_number) : row.match_key,
        })),
      };
    }
  );

  // Correct an entry. The entry stays the original scout's; the correction is recorded.
  app.put<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/manager/entries/:id", guard, async (request, reply) => {
    const user = request.hubUser!;
    const entry = getEntry(request.params.id);
    if (!entry || entry.eventKey !== request.params.eventKey) return reply.code(404).send({ error: "entry_not_found" });
    const body = (request.body ?? {}) as { data?: unknown; status?: unknown };
    const result = saveEntry({
      id: entry.id,
      eventKey: entry.eventKey,
      matchKey: entry.matchKey,
      teamNumber: entry.teamNumber,
      scout: entry.scout,
      data: body.data,
      status: body.status === "draft" ? "draft" : entry.status === "draft" && body.status !== "submitted" ? "draft" : "submitted",
      editedBy: user.name,
    });
    if (!result.ok) return reply.code(result.status).send({ error: result.error, details: result.details });
    return { entry: result.entry };
  });

  app.post<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/manager/entries/:id/void", guard, async (request, reply) => {
    const user = request.hubUser!;
    const existing = getEntry(request.params.id);
    if (!existing || existing.eventKey !== request.params.eventKey) return reply.code(404).send({ error: "entry_not_found" });
    const restore = (request.body as { restore?: unknown } | null)?.restore === true;
    return { entry: voidEntry(existing.id, user.name, restore) };
  });

  // Put a named scout on a robot, or clear the slot so it is filled automatically.
  app.put<{ Params: { eventKey: string } }>("/events/:eventKey/manager/assignments", guard, async (request, reply) => {
    const { eventKey } = request.params;
    const body = (request.body ?? {}) as { matchKey?: unknown; alliance?: unknown; station?: unknown; scoutKey?: unknown };
    if (typeof body.matchKey !== "string" || (body.alliance !== "red" && body.alliance !== "blue") || !Number.isInteger(body.station)) {
      return reply.code(400).send({ error: "invalid_slot" });
    }
    const match = loadSchedule(eventKey).find((m) => m.matchKey === body.matchKey);
    const team = match ? teamsIn(match).find((t) => t.alliance === body.alliance && t.station === body.station) : undefined;
    if (!match || !team) return reply.code(404).send({ error: "slot_not_found" });

    let scout: { key: string; name: string } | null = null;
    if (typeof body.scoutKey === "string" && body.scoutKey) {
      const row = db
        .prepare(`SELECT name, scout_key FROM scout_sessions WHERE scout_key = ? AND signed_out_at IS NULL ORDER BY signed_in_at DESC LIMIT 1`)
        .get(body.scoutKey) as { name: string; scout_key: string } | undefined;
      if (!row) return reply.code(404).send({ error: "scout_not_found" });
      scout = { key: row.scout_key, name: row.name };
    }
    setManualAssignment(eventKey, { matchKey: match.matchKey, alliance: team.alliance, station: team.station, teamNumber: team.teamNumber }, scout);
    reassign(eventKey);
    return { ok: true };
  });

  // Throw away the automatic plan for matches that have not started and make it again.
  app.post<{ Params: { eventKey: string } }>("/events/:eventKey/manager/reassign", guard, async (request, reply) => {
    const { eventKey } = request.params;
    if (!getEvent(eventKey)) return reply.code(404).send({ error: "event_not_found" });
    db.prepare(`DELETE FROM scout_assignments WHERE event_key = ? AND source = 'auto' AND locked = 0`).run(eventKey);
    reassign(eventKey);
    publish({ eventKey, entity: "assignment", key: eventKey, audience: ["scout"] });
    return { ok: true };
  });

  app.put<{ Params: { scoutKey: string } }>("/manager/scouts/:scoutKey", guard, async (request, reply) => {
    const { scoutKey } = request.params;
    const body = (request.body ?? {}) as { onBreak?: unknown; scouting?: unknown; signOut?: unknown; eventKey?: unknown };
    const row = db
      .prepare(`SELECT name FROM scout_sessions WHERE scout_key = ? AND signed_out_at IS NULL ORDER BY signed_in_at DESC LIMIT 1`)
      .get(scoutKey) as { name: string } | undefined;
    if (!row) return reply.code(404).send({ error: "scout_not_found" });
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : null;
    if (typeof body.onBreak === "boolean") {
      db.prepare(`UPDATE scout_sessions SET on_break = ? WHERE scout_key = ? AND signed_out_at IS NULL`).run(body.onBreak ? 1 : 0, scoutKey);
      recordActivity({ eventKey, scout: row.name, kind: body.onBreak ? "break_on" : "break_off" });
    }
    if (typeof body.scouting === "boolean") {
      db.prepare(`UPDATE scout_sessions SET scouting = ? WHERE scout_key = ? AND signed_out_at IS NULL`).run(body.scouting ? 1 : 0, scoutKey);
    }
    if (body.signOut === true) {
      db.prepare(`UPDATE scout_sessions SET signed_out_at = ?, connected = 0 WHERE scout_key = ? AND signed_out_at IS NULL`).run(new Date().toISOString(), scoutKey);
      recordActivity({ eventKey, scout: row.name, kind: "signed_out" });
    }
    publish({ eventKey: null, entity: "presence", key: scoutKey, audience: ["manage"] });
    // Tells the scout's own phone to refresh what it shows.
    publish({ eventKey: null, entity: "my", key: scoutKey, audience: ["scout"] });
    if (eventKey && getEvent(eventKey)) reassign(eventKey);
    return { ok: true };
  });
}

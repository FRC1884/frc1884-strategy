import type { FastifyPluginAsync } from "fastify";

import { databasePath, db } from "../db/client.js";
import { hydrateMatchesForEvent } from "./helpers.js";

export const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    databasePath,
    timestamp: new Date().toISOString()
  }));

  app.get("/events", async () => {
    const rows = db
      .prepare(`
        SELECT event_key, name, season, location, start_date, end_date, source
        FROM events
        ORDER BY season DESC, start_date DESC
      `)
      .all();

    return { events: rows };
  });

  app.get<{
    Params: { eventKey: string };
  }>("/events/:eventKey", async (request, reply) => {
    const event = db
      .prepare(`
        SELECT event_key, name, season, location, start_date, end_date, source
        FROM events
        WHERE event_key = ?
      `)
      .get(request.params.eventKey);

    if (!event) {
      return reply.code(404).send({ error: "event_not_found" });
    }

    const counts = db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM event_teams WHERE event_key = ?) AS teamCount,
          (SELECT COUNT(*) FROM matches WHERE event_key = ?) AS matchCount,
          (SELECT COUNT(*) FROM pit_observations WHERE event_key = ?) AS pitObservationCount,
          (SELECT COUNT(*) FROM strategy_plans WHERE event_key = ?) AS strategyPlanCount
      `)
      .get(
        request.params.eventKey,
        request.params.eventKey,
        request.params.eventKey,
        request.params.eventKey
      );

    return {
      event,
      counts,
      recentMatches: hydrateMatchesForEvent(request.params.eventKey).slice(0, 3)
    };
  });

  app.get<{
    Params: { eventKey: string; teamNumber: string };
  }>("/events/:eventKey/teams/:teamNumber/full", async (request, reply) => {
    const teamNumber = Number(request.params.teamNumber);
    if (!Number.isInteger(teamNumber)) {
      return reply.code(400).send({ error: "invalid_team_number" });
    }

    const { eventKey } = request.params;

    const team = db
      .prepare(`
        SELECT team_number, name, location, country, source, created_at, updated_at
        FROM teams
        WHERE team_number = ?
      `)
      .get(teamNumber);

    if (!team) {
      return reply.code(404).send({ error: "team_not_found" });
    }

    const capabilities = db
      .prepare(`
        SELECT capability_name, capability_value, source, observed_at
        FROM team_capabilities
        WHERE event_key = ? AND team_number = ?
        ORDER BY source ASC, capability_name ASC
      `)
      .all(eventKey, teamNumber);

    const metrics = db
      .prepare(`
        SELECT event_key, metric_name, metric_value, source_run, computed_at
        FROM analytics_metrics
        WHERE team_number = ? AND (event_key = ? OR event_key IS NULL)
        ORDER BY metric_name ASC, computed_at DESC
      `)
      .all(teamNumber, eventKey);

    const matchObservations = db
      .prepare(`
        SELECT
          m.match_key,
          m.match_number,
          m.comp_level,
          mo.phase,
          mo.scouter,
          mo.fuel_scored,
          mo.climb_points,
          mo.notes,
          mo.source,
          mo.observed_at
        FROM match_observations mo
        JOIN matches m ON m.id = mo.match_id
        WHERE m.event_key = ? AND mo.team_number = ?
        ORDER BY m.match_number ASC, mo.observed_at ASC
      `)
      .all(eventKey, teamNumber);

    const pitObservations = db
      .prepare(`
        SELECT scouter, stars, avg_fuel, climb_capability, warning_flag, notes, source, observed_at
        FROM pit_observations
        WHERE event_key = ? AND team_number = ?
        ORDER BY observed_at DESC
      `)
      .all(eventKey, teamNumber);

    return {
      eventKey,
      team,
      capabilities,
      metrics,
      matchObservations,
      pitObservations
    };
  });

  app.get<{
    Params: { eventKey: string };
  }>("/events/:eventKey/teams/live-summary", async (request) => {
    const { eventKey } = request.params;

    const obsRows = db
      .prepare(`
        SELECT mo.team_number AS team_number,
               COUNT(*) AS obs_count,
               MAX(mo.observed_at) AS last_observed_at
        FROM match_observations mo
        JOIN matches m ON m.id = mo.match_id
        WHERE m.event_key = ? AND mo.source = 'scout-sheet'
        GROUP BY mo.team_number
      `)
      .all(eventKey) as Array<{
      team_number: number;
      obs_count: number;
      last_observed_at: string | null;
    }>;

    const noteRows = db
      .prepare(`
        SELECT mo.team_number, mo.notes
        FROM match_observations mo
        JOIN matches m ON m.id = mo.match_id
        WHERE m.event_key = ? AND mo.source = 'scout-sheet'
        ORDER BY mo.team_number ASC, mo.observed_at DESC
      `)
      .all(eventKey) as Array<{ team_number: number; notes: string | null }>;

    const pitRows = db
      .prepare(`
        SELECT team_number, capability_name, capability_value
        FROM team_capabilities
        WHERE event_key = ?
          AND source = 'pit-scouting'
          AND capability_name IN (
            'pit_climb_capability',
            'pit_cycles_per_period',
            'pit_avg_fuel_per_cycle',
            'pit_changes_since_regionals',
            'pit_struggling_with'
          )
      `)
      .all(eventKey) as Array<{
      team_number: number;
      capability_name: string;
      capability_value: string | null;
    }>;

    const metricRows = db
      .prepare(`
        SELECT team_number, metric_name, metric_value
        FROM analytics_metrics
        WHERE event_key = ?
          AND metric_name IN ('tba.opr','tba.dpr','scout.avg_scoring_cycles')
      `)
      .all(eventKey) as Array<{
      team_number: number;
      metric_name: string;
      metric_value: number | null;
    }>;

    interface TeamLiveSummary {
      obsCount: number;
      lastObservedAt: string | null;
      liveObsCount: number;
      liveLatestNotes: string[];
      liveAvgCycles: number | null;
      pitClaimedClimb: string | null;
      pitClaimedBPS: string | null;
      pitChangesSinceRegionals: string | null;
      pitStrugglingWith: string | null;
      tbaOpr: number | null;
      tbaDpr: number | null;
    }

    function emptyEntry(): TeamLiveSummary {
      return {
        obsCount: 0,
        lastObservedAt: null,
        liveObsCount: 0,
        liveLatestNotes: [],
        liveAvgCycles: null,
        pitClaimedClimb: null,
        pitClaimedBPS: null,
        pitChangesSinceRegionals: null,
        pitStrugglingWith: null,
        tbaOpr: null,
        tbaDpr: null
      };
    }

    const summary: Record<string, TeamLiveSummary> = {};
    function entry(team: number): TeamLiveSummary {
      const k = String(team);
      if (!summary[k]) {
        summary[k] = emptyEntry();
      }
      return summary[k];
    }

    for (const row of obsRows) {
      const e = entry(row.team_number);
      e.obsCount = row.obs_count;
      e.liveObsCount = row.obs_count;
      e.lastObservedAt = row.last_observed_at;
    }

    function extractFreeText(rawNotes: string | null): string | null {
      if (!rawNotes) {
        return null;
      }
      try {
        const parsed = JSON.parse(rawNotes) as Record<string, unknown>;
        const other = typeof parsed.other_notes === "string" ? parsed.other_notes.trim() : "";
        const diff = typeof parsed.difficulties === "string" ? parsed.difficulties.trim() : "";
        if (other && diff) {
          return `${other} · ${diff}`;
        }
        return other || diff || null;
      } catch {
        return null;
      }
    }

    for (const row of noteRows) {
      const e = entry(row.team_number);
      if (e.liveLatestNotes.length >= 2) {
        continue;
      }
      const text = extractFreeText(row.notes);
      if (text) {
        e.liveLatestNotes.push(text);
      }
    }

    for (const row of pitRows) {
      const e = entry(row.team_number);
      const v = row.capability_value;
      switch (row.capability_name) {
        case "pit_climb_capability":
          e.pitClaimedClimb = v;
          break;
        case "pit_changes_since_regionals":
          e.pitChangesSinceRegionals = v;
          break;
        case "pit_struggling_with":
          e.pitStrugglingWith = v;
          break;
        case "pit_cycles_per_period":
        case "pit_avg_fuel_per_cycle":
          if (v) {
            e.pitClaimedBPS = e.pitClaimedBPS ? `${e.pitClaimedBPS} · ${v}` : v;
          }
          break;
      }
    }

    for (const row of metricRows) {
      const e = entry(row.team_number);
      const v = row.metric_value;
      if (v === null || !Number.isFinite(v)) {
        continue;
      }
      switch (row.metric_name) {
        case "tba.opr":
          e.tbaOpr = v;
          break;
        case "tba.dpr":
          e.tbaDpr = v;
          break;
        case "scout.avg_scoring_cycles":
          e.liveAvgCycles = v;
          break;
      }
    }

    return { eventKey, summary };
  });
};

import { db } from "../db/client.js";
import { getGame, RATING_SCORE, type EntryData, type GameDefinition, type MetricDef, type RatingValue } from "../shared/games/index.js";
import { publish } from "./changeFeed.js";
import { getEvent } from "./settings.js";

// Turns every submitted entry for a team into one line of numbers.
// Two scouts watching the same robot in the same match are averaged first, so
// a double-covered match does not count twice.

export interface TeamEntry {
  matchKey: string;
  scoutKey: string;
  data: EntryData;
}

function entryValue(metric: MetricDef, data: EntryData): number | null {
  const agg = metric.agg;
  const raw = data[agg.field];
  switch (agg.kind) {
    case "avg":
    case "max":
      return typeof raw === "number" ? raw : null;
    case "rate":
      if (raw === undefined || raw === null) return agg.equals === true ? 0 : null;
      return raw === (agg.equals ?? true) ? 1 : 0;
    case "ratingAvg":
      return typeof raw === "string" ? (RATING_SCORE[raw as RatingValue] ?? null) : null;
    case "selectRate":
      return typeof raw === "string" ? (agg.values.includes(raw) ? 1 : 0) : null;
    case "avgPoints":
      return typeof raw === "string" ? (agg.points[raw] ?? 0) : null;
  }
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export interface MetricSummary {
  value: number | null;
  // One value per match, in the order the matches were given.
  perMatch: Array<{ matchKey: string; value: number | null; spread: number }>;
}

export function summariseMetric(metric: MetricDef, entries: TeamEntry[]): MetricSummary {
  const byMatch = new Map<string, number[]>();
  for (const entry of entries) {
    const value = entryValue(metric, entry.data);
    if (!byMatch.has(entry.matchKey)) byMatch.set(entry.matchKey, []);
    if (value !== null) byMatch.get(entry.matchKey)!.push(value);
  }
  const perMatch = [...byMatch.entries()].map(([matchKey, values]) => ({
    matchKey,
    value: mean(values),
    spread: values.length > 1 ? Math.max(...values) - Math.min(...values) : 0,
  }));
  const usable = perMatch.map((m) => m.value).filter((v): v is number => v !== null);
  const value = metric.agg.kind === "max" ? (usable.length ? Math.max(...usable) : null) : mean(usable);
  return { value, perMatch };
}

export function compileTeam(game: GameDefinition, entries: TeamEntry[]): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const metric of game.metrics) {
    const { value } = summariseMetric(metric, entries);
    if (value !== null) metrics[metric.key] = value;
  }
  metrics.matches_observed = new Set(entries.map((e) => e.matchKey)).size;
  metrics.entries = entries.length;
  return metrics;
}

export function loadTeamEntries(eventKey: string, teamNumber: number): TeamEntry[] {
  const rows = db
    .prepare(
      `SELECT e.match_key, e.scout_key, e.data_json
       FROM match_scout_entries e
       LEFT JOIN matches m ON m.match_key = e.match_key
       WHERE e.event_key = ? AND e.team_number = ? AND e.status = 'submitted'
       ORDER BY COALESCE(m.actual_at, m.planned_at, e.submitted_at) ASC, e.submitted_at ASC`
    )
    .all(eventKey, teamNumber) as Array<{ match_key: string; scout_key: string; data_json: string }>;
  return rows.map((row) => ({ matchKey: row.match_key, scoutKey: row.scout_key, data: JSON.parse(row.data_json) as EntryData }));
}

// Recomputes and stores one team's figures. Called whenever an entry for that
// team is submitted, corrected or voided.
export function recompileTeam(eventKey: string, teamNumber: number): Record<string, number> {
  const event = getEvent(eventKey);
  const game = getGame(event?.gameId);
  const metrics = compileTeam(game, loadTeamEntries(eventKey, teamNumber));
  db.transaction(() => {
    db.prepare(`DELETE FROM analytics_metrics WHERE event_key = ? AND team_number = ? AND metric_name LIKE 'hub.%'`).run(eventKey, teamNumber);
    if (metrics.entries > 0) {
      const insert = db.prepare(
        `INSERT INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run) VALUES (?, ?, ?, ?, 'hub')`
      );
      for (const [key, value] of Object.entries(metrics)) insert.run(eventKey, teamNumber, `hub.${key}`, value);
    }
  })();
  publish({ eventKey, entity: "compiled", key: teamNumber, audience: ["strategy", "manage"] });
  return metrics;
}

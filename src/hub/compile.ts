import { db } from "../db/client.js";
import { allFields, getGame, type EntryData, type GameDefinition, type MetricDef } from "../shared/games/index.js";
import { teamsIn, type ScheduleMatch } from "../shared/schedule.js";
import { summariseMetric, type TeamEntry } from "./aggregate.js";
import { listPit, mergedPit, type PitRecord } from "./pit.js";
import { loadSchedule, loadTeams } from "./schedule.js";
import { getEvent } from "./settings.js";

// Everything known about every team at an event, worked out fresh from the
// entries each time it is asked for. This is what the strategy page reads.

export interface CompiledMetric {
  value: number | null;
  best: number | null;
  worst: number | null;
  // Average of the three most recent matches, and how that compares overall.
  last3: number | null;
  trend: number | null;
  // How much it varies match to match (standard deviation).
  spread: number | null;
  matches: number;
  disagreements: number;
}

export interface TeamFlag {
  kind: "few" | "disagreement" | "official" | "pit";
  text: string;
}

export interface PublicStats {
  rank: number | null;
  rankingScore: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  played: number | null;
  opr: number | null;
  dpr: number | null;
  epa: number | null;
}

export interface CompiledTeam {
  teamNumber: number;
  name: string;
  location: string | null;
  matchesObserved: number;
  entryCount: number;
  metrics: Record<string, CompiledMetric>;
  // Rough points per match from what scouts recorded.
  estPoints: number | null;
  flags: TeamFlag[];
  pit: EntryData | null;
  pitScouts: string[];
  stats: PublicStats;
  problems: Record<string, number>;
}

interface EntryRow {
  id: string;
  match_key: string;
  team_number: number;
  scout: string;
  scout_key: string;
  data_json: string;
  submitted_at: string | null;
}

export interface LoadedEntry extends TeamEntry {
  id: string;
  teamNumber: number;
  scout: string;
  submittedAt: string | null;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function deviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export function compileMetric(metric: MetricDef, entries: TeamEntry[]): CompiledMetric {
  const { value, perMatch } = summariseMetric(metric, entries);
  const values = perMatch.map((m) => m.value).filter((v): v is number => v !== null);
  const last3 = values.length >= 3 ? mean(values.slice(-3)) : null;
  const numeric = metric.agg.kind === "avg" || metric.agg.kind === "max";
  return {
    value,
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
    last3,
    trend: values.length >= 4 && last3 !== null && value !== null ? last3 - value : null,
    spread: deviation(values),
    matches: values.length,
    // Two scouts watching the same robot and coming away with clearly different counts.
    disagreements: numeric ? perMatch.filter((m) => m.value !== null && m.spread > Math.max(2, m.value * 0.4)).length : 0,
  };
}

function loadEntries(eventKey: string, schedule: ScheduleMatch[]): LoadedEntry[] {
  const order = new Map(schedule.map((m, i) => [m.matchKey, i]));
  const rows = db
    .prepare(
      `SELECT id, match_key, team_number, scout, scout_key, data_json, submitted_at
       FROM match_scout_entries WHERE event_key = ? AND status = 'submitted'`
    )
    .all(eventKey) as EntryRow[];
  return rows
    .map((row) => ({
      id: row.id,
      matchKey: row.match_key,
      teamNumber: row.team_number,
      scout: row.scout,
      scoutKey: row.scout_key,
      data: JSON.parse(row.data_json) as EntryData,
      submittedAt: row.submitted_at,
    }))
    .sort((a, b) => (order.get(a.matchKey) ?? 9999) - (order.get(b.matchKey) ?? 9999));
}

function loadStats(eventKey: string): Map<number, PublicStats> {
  const stats = new Map<number, PublicStats>();
  const blank = (): PublicStats => ({ rank: null, rankingScore: null, wins: null, losses: null, ties: null, played: null, opr: null, dpr: null, epa: null });
  const get = (team: number) => {
    if (!stats.has(team)) stats.set(team, blank());
    return stats.get(team)!;
  };
  const rankings = db
    .prepare(`SELECT team_number, rank, ranking_score, wins, losses, ties, matches_played FROM event_rankings WHERE event_key = ?`)
    .all(eventKey) as Array<{ team_number: number; rank: number; ranking_score: number | null; wins: number | null; losses: number | null; ties: number | null; matches_played: number | null }>;
  for (const r of rankings) {
    Object.assign(get(r.team_number), { rank: r.rank, rankingScore: r.ranking_score, wins: r.wins, losses: r.losses, ties: r.ties, played: r.matches_played });
  }
  const metrics = db
    .prepare(
      `SELECT team_number, metric_name, metric_value FROM analytics_metrics
       WHERE event_key = ? AND metric_name IN ('tba.opr', 'tba.dpr', 'statbotics.event_epa.total_points_mean')
       ORDER BY computed_at ASC, id ASC`
    )
    .all(eventKey) as Array<{ team_number: number; metric_name: string; metric_value: number }>;
  for (const m of metrics) {
    const target = get(m.team_number);
    if (m.metric_name === "tba.opr") target.opr = m.metric_value;
    else if (m.metric_name === "tba.dpr") target.dpr = m.metric_value;
    else target.epa = m.metric_value;
  }
  return stats;
}

export interface OfficialCheck {
  matchKey: string;
  alliance: "red" | "blue";
  scouted: number;
  official: number;
}

// Where all three robots of an alliance were scouted and the match has an
// official score, compare the two. A big gap means the counts are unreliable.
export function officialChecks(game: GameDefinition, schedule: ScheduleMatch[], entries: LoadedEntry[]): OfficialCheck[] {
  if (!game.entryPoints) return [];
  const checks: OfficialCheck[] = [];
  for (const match of schedule) {
    for (const alliance of ["red", "blue"] as const) {
      const official = alliance === "red" ? match.redScore : match.blueScore;
      if (official === null) continue;
      let scouted = 0;
      let complete = match[alliance].length === 3;
      for (const team of match[alliance]) {
        const mine = entries.filter((e) => e.matchKey === match.matchKey && e.teamNumber === team.teamNumber);
        if (mine.length === 0) {
          complete = false;
          break;
        }
        scouted += mean(mine.map((e) => game.entryPoints!(e.data)))!;
      }
      if (complete) checks.push({ matchKey: match.matchKey, alliance, scouted, official });
    }
  }
  return checks;
}

function isFarOff(check: OfficialCheck): boolean {
  return Math.abs(check.scouted - check.official) > Math.max(15, check.official * 0.3);
}

export interface CompiledEvent {
  eventKey: string;
  gameId: string;
  teams: CompiledTeam[];
  coverage: { entries: number; matchesWithEntries: number; teamsObserved: number; teamsPitScouted: number; teamCount: number };
}

function compileOne(
  game: GameDefinition,
  team: { teamNumber: number; name: string; location: string | null },
  entries: LoadedEntry[],
  pit: PitRecord[],
  stats: PublicStats | undefined,
  schedule: ScheduleMatch[],
  farOff: OfficialCheck[]
): CompiledTeam {
  const metrics: Record<string, CompiledMetric> = {};
  for (const metric of game.metrics) metrics[metric.key] = compileMetric(metric, entries);
  const matchesObserved = new Set(entries.map((e) => e.matchKey)).size;
  const labels = new Map(schedule.map((m) => [m.matchKey, m.label]));

  const flags: TeamFlag[] = [];
  if (matchesObserved === 1) flags.push({ kind: "few", text: "Seen in only one match." });
  for (const metric of game.metrics) {
    const n = metrics[metric.key].disagreements;
    if (n > 0) flags.push({ kind: "disagreement", text: `Scouts disagreed on ${metric.label.toLowerCase()} in ${n} match${n === 1 ? "" : "es"}.` });
  }
  for (const check of farOff) {
    const match = schedule.find((m) => m.matchKey === check.matchKey);
    if (!match || !match[check.alliance].some((t) => t.teamNumber === team.teamNumber)) continue;
    flags.push({
      kind: "official",
      text: `${labels.get(check.matchKey)}: scouts counted about ${Math.round(check.scouted)} points for this alliance, the official score was ${check.official}.`,
    });
  }
  const pitData = mergedPit(pit);
  if (pitData && game.pitMismatches) {
    const observed = Object.fromEntries(Object.entries(metrics).flatMap(([key, m]) => (m.value === null ? [] : [[key, m.value]])));
    for (const text of game.pitMismatches(pitData, observed, matchesObserved)) flags.push({ kind: "pit", text });
  }

  const problems: Record<string, number> = {};
  const seenProblem = new Set<string>();
  for (const entry of entries) {
    const list = entry.data.difficulties;
    if (!Array.isArray(list)) continue;
    for (const problem of list) {
      // Count a problem once per match even if two scouts both noted it.
      const once = `${entry.matchKey}:${problem}`;
      if (seenProblem.has(once)) continue;
      seenProblem.add(once);
      problems[problem] = (problems[problem] ?? 0) + 1;
    }
  }

  let estPoints: number | null = null;
  if (game.entryPoints && entries.length) {
    const byMatch = new Map<string, number[]>();
    for (const entry of entries) {
      if (!byMatch.has(entry.matchKey)) byMatch.set(entry.matchKey, []);
      byMatch.get(entry.matchKey)!.push(game.entryPoints(entry.data));
    }
    estPoints = mean([...byMatch.values()].map((v) => mean(v)!));
  }

  return {
    teamNumber: team.teamNumber,
    name: team.name,
    location: team.location,
    matchesObserved,
    entryCount: entries.length,
    metrics,
    estPoints,
    flags,
    pit: pitData,
    pitScouts: [...new Set(pit.filter((p) => p.status === "submitted").map((p) => p.scout))],
    stats: stats ?? { rank: null, rankingScore: null, wins: null, losses: null, ties: null, played: null, opr: null, dpr: null, epa: null },
    problems,
  };
}

export interface EventData {
  game: GameDefinition;
  schedule: ScheduleMatch[];
  entries: LoadedEntry[];
  pit: PitRecord[];
  compiled: CompiledEvent;
}

export function loadEventData(eventKey: string): EventData | null {
  const event = getEvent(eventKey);
  if (!event) return null;
  const game = getGame(event.gameId);
  const schedule = loadSchedule(eventKey);
  const entries = loadEntries(eventKey, schedule);
  const pit = listPit(eventKey);
  const stats = loadStats(eventKey);
  const farOff = officialChecks(game, schedule, entries).filter(isFarOff);

  const teams = loadTeams(eventKey).map((team) =>
    compileOne(
      game,
      team,
      entries.filter((e) => e.teamNumber === team.teamNumber),
      pit.filter((p) => p.teamNumber === team.teamNumber),
      stats.get(team.teamNumber),
      schedule,
      farOff
    )
  );

  return {
    game,
    schedule,
    entries,
    pit,
    compiled: {
      eventKey,
      gameId: game.id,
      teams,
      coverage: {
        entries: entries.length,
        matchesWithEntries: new Set(entries.map((e) => e.matchKey)).size,
        teamsObserved: teams.filter((t) => t.matchesObserved > 0).length,
        teamsPitScouted: teams.filter((t) => t.pit !== null).length,
        teamCount: teams.length,
      },
    },
  };
}

export function compileEvent(eventKey: string): CompiledEvent | null {
  return loadEventData(eventKey)?.compiled ?? null;
}

// CSV, for anyone who wants the data in a spreadsheet.
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Stop a spreadsheet from treating scout-typed text as a formula.
  const safe = /^[=+\-@]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

function round(value: number | null, places = 2): number | string {
  return value === null ? "" : Number(value.toFixed(places));
}

export function teamsCsv(data: EventData): string {
  const { game, compiled } = data;
  const header = ["Team", "Name", "Matches observed", ...game.metrics.map((m) => m.label), "Estimated points per match", "Rank", "OPR", "EPA", "Notes"];
  const rows = compiled.teams.map((team) => [
    team.teamNumber,
    team.name,
    team.matchesObserved,
    ...game.metrics.map((m) => round(team.metrics[m.key].value)),
    round(team.estPoints, 1),
    team.stats.rank ?? "",
    round(team.stats.opr, 1),
    round(team.stats.epa, 1),
    team.flags.map((f) => f.text).join(" "),
  ]);
  return toCsv(header, rows);
}

export function entriesCsv(data: EventData): string {
  const fields = allFields(data.game.matchForm);
  const labels = new Map(data.schedule.map((m) => [m.matchKey, m]));
  const header = ["Match", "Team", "Alliance", "Scout", "Submitted", ...fields.map((f) => f.label)];
  const rows = data.entries.map((entry) => {
    const match = labels.get(entry.matchKey);
    const alliance = match ? teamsIn(match).find((t) => t.teamNumber === entry.teamNumber)?.alliance : "";
    return [match?.label ?? entry.matchKey, entry.teamNumber, alliance ?? "", entry.scout, entry.submittedAt ?? "", ...fields.map((f) => entry.data[f.key] ?? "")];
  });
  return toCsv(header, rows);
}

export function pitCsv(data: EventData): string {
  const fields = allFields(data.game.pitForm);
  const header = ["Team", "Scout", "Submitted", ...fields.map((f) => f.label)];
  const rows = data.pit
    .filter((p) => p.status === "submitted")
    .sort((a, b) => a.teamNumber - b.teamNumber)
    .map((p) => [p.teamNumber, p.scout, p.submittedAt ?? "", ...fields.map((f) => p.data[f.key] ?? "")]);
  return toCsv(header, rows);
}

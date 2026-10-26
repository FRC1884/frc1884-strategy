import { db } from "../db/client.js";
import { ingestStatboticsEvent } from "../integrations/statbotics.js";
import { fetchTba, ingestTbaEvent, ingestTbaOprs, isTbaConfigured, parseTeamKey } from "../integrations/tba.js";
import { reassign } from "./assign.js";
import { publish } from "./changeFeed.js";
import { getSetting, setSetting } from "./settings.js";

// Pulls everything public about an event: details, teams, schedule and
// results, rankings and OPR from The Blue Alliance, and EPA from Statbotics.
// Each step is independent so one failing source does not block the rest.

export interface SyncStep {
  step: string;
  ok: boolean;
  detail: string;
}

export interface SyncResult {
  eventKey: string;
  at: string;
  steps: SyncStep[];
}

interface TbaEventInfo {
  key: string;
  name: string;
  year: number;
  city?: string | null;
  state_prov?: string | null;
  country?: string | null;
  location_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  timezone?: string | null;
}

interface TbaTeamSimple {
  team_number: number;
  nickname?: string | null;
  city?: string | null;
  state_prov?: string | null;
  country?: string | null;
}

interface TbaRankings {
  rankings?: Array<{
    rank: number;
    team_key: string;
    matches_played?: number;
    record?: { wins: number; losses: number; ties: number } | null;
    sort_orders?: number[] | null;
  }> | null;
}

async function syncEventInfo(eventKey: string): Promise<string> {
  const info = await fetchTba<TbaEventInfo>(`/event/${encodeURIComponent(eventKey)}`);
  const location = [info.location_name, info.city, info.state_prov, info.country].filter(Boolean).join(", ") || null;
  db.prepare(
    `INSERT INTO events (event_key, name, season, location, start_date, end_date, timezone, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'tba')
     ON CONFLICT(event_key) DO UPDATE SET
       name = excluded.name, season = excluded.season, location = excluded.location,
       start_date = excluded.start_date, end_date = excluded.end_date, timezone = excluded.timezone,
       updated_at = CURRENT_TIMESTAMP`
  ).run(eventKey, info.name, info.year, location, info.start_date ?? null, info.end_date ?? null, info.timezone ?? null);
  return info.name;
}

async function syncTeams(eventKey: string): Promise<string> {
  const teams = await fetchTba<TbaTeamSimple[]>(`/event/${encodeURIComponent(eventKey)}/teams/simple`);
  db.transaction(() => {
    const upsert = db.prepare(
      `INSERT INTO teams (team_number, name, location, country, source)
       VALUES (?, ?, ?, ?, 'tba')
       ON CONFLICT(team_number) DO UPDATE SET
         name = excluded.name, location = excluded.location, country = excluded.country, updated_at = CURRENT_TIMESTAMP`
    );
    const link = db.prepare(`INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)`);
    for (const team of teams) {
      const location = [team.city, team.state_prov].filter(Boolean).join(", ") || null;
      upsert.run(team.team_number, team.nickname || `Team ${team.team_number}`, location, team.country ?? null);
      link.run(eventKey, team.team_number);
    }
  })();
  return `${teams.length} teams`;
}

async function syncRankings(eventKey: string): Promise<string> {
  const payload = await fetchTba<TbaRankings | null>(`/event/${encodeURIComponent(eventKey)}/rankings`);
  const rankings = payload?.rankings ?? [];
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`DELETE FROM event_rankings WHERE event_key = ?`).run(eventKey);
    const insert = db.prepare(
      `INSERT OR REPLACE INTO event_rankings (event_key, team_number, rank, ranking_score, wins, losses, ties, matches_played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rankings) {
      const teamNumber = parseTeamKey(row.team_key);
      if (teamNumber === null) continue;
      insert.run(eventKey, teamNumber, row.rank, row.sort_orders?.[0] ?? null, row.record?.wins ?? null, row.record?.losses ?? null, row.record?.ties ?? null, row.matches_played ?? null, now);
    }
  })();
  return rankings.length ? `${rankings.length} teams ranked` : "no rankings published yet";
}

async function runStep(steps: SyncStep[], step: string, work: () => Promise<string>): Promise<void> {
  try {
    steps.push({ step, ok: true, detail: await work() });
  } catch (error) {
    steps.push({ step, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const running = new Set<string>();

export async function syncEvent(eventKey: string, options: { statbotics?: boolean } = {}): Promise<SyncResult> {
  const steps: SyncStep[] = [];
  if (running.has(eventKey)) {
    return { eventKey, at: new Date().toISOString(), steps: [{ step: "Import", ok: false, detail: "An import for this event is already running." }] };
  }
  running.add(eventKey);
  try {
    if (isTbaConfigured()) {
      await runStep(steps, "Event details", () => syncEventInfo(eventKey));
      await runStep(steps, "Teams", () => syncTeams(eventKey));
      await runStep(steps, "Schedule and results", async () => {
        const result = await ingestTbaEvent(eventKey, { allLevels: true });
        return `${result.qmMatchCount} matches`;
      });
      await runStep(steps, "Rankings", () => syncRankings(eventKey));
      await runStep(steps, "OPR", async () => {
        const result = await ingestTbaOprs(eventKey);
        return `${result.oprMetricCount} teams`;
      });
    } else {
      steps.push({ step: "The Blue Alliance", ok: false, detail: "The Blue Alliance key is not set on the server." });
    }
    if (options.statbotics ?? true) {
      await runStep(steps, "Statbotics", async () => {
        const result = await ingestStatboticsEvent(eventKey);
        return `${result.teamEventCount} teams`;
      });
    }
  } finally {
    running.delete(eventKey);
  }

  const result: SyncResult = { eventKey, at: new Date().toISOString(), steps };
  setSetting(`last_sync:${eventKey}`, JSON.stringify(result));
  publish({ eventKey, entity: "schedule", key: eventKey, audience: ["scout"] });
  try {
    reassign(eventKey);
  } catch {
    // Assignment is retried on the next tick.
  }
  publish({ eventKey, entity: "teams", key: eventKey, audience: ["scout"] });
  publish({ eventKey, entity: "stats", key: eventKey, audience: ["strategy", "manage"] });
  return result;
}

export function lastSync(eventKey: string): SyncResult | null {
  const raw = getSetting(`last_sync:${eventKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncResult;
  } catch {
    return null;
  }
}

function isAround(startDate: string | null, endDate: string | null, now: Date): boolean {
  if (!startDate || !endDate) return false;
  const start = Date.parse(`${startDate}T00:00:00Z`) - 36 * 3_600_000;
  const end = Date.parse(`${endDate}T23:59:59Z`) + 36 * 3_600_000;
  return now.getTime() >= start && now.getTime() <= end;
}

// While the active event is on, keep the schedule and results fresh without
// anyone pressing a button. Statbotics is slower-moving, so it runs less often.
export function startAutoSync(getActive: () => { eventKey: string; startDate: string | null; endDate: string | null } | null, log: (message: string) => void): () => void {
  const EVERY_MS = 2 * 60_000;
  let tick = 0;
  const timer = setInterval(() => {
    if (!isTbaConfigured()) return;
    if (getSetting("auto_sync") === "off") return;
    const event = getActive();
    if (!event || !isAround(event.startDate, event.endDate, new Date())) return;
    tick += 1;
    syncEvent(event.eventKey, { statbotics: tick % 10 === 1 })
      .then((result) => {
        const failed = result.steps.filter((s) => !s.ok);
        if (failed.length) log(`auto import for ${event.eventKey}: ${failed.map((s) => `${s.step}: ${s.detail}`).join("; ")}`);
      })
      .catch((error) => log(`auto import failed: ${String(error)}`));
  }, EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}

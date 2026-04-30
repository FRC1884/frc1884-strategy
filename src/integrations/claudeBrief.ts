import { createHash } from "node:crypto";

import { db } from "../db/client.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export class ClaudeCredentialsMissingError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY environment variable is not set");
    this.name = "ClaudeCredentialsMissingError";
  }
}

export class MatchBriefMatchNotFoundError extends Error {
  constructor(matchKey: string) {
    super(`Match not found: ${matchKey}`);
    this.name = "MatchBriefMatchNotFoundError";
  }
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ClaudeCredentialsMissingError();
  }
  return key;
}

const SYSTEM_PROMPT = `You are a tactical match analyst for FRC Team 1884 Griffins at Newton Division, FIRST Championship 2026 (Houston). The robot is a HYBRID DEFENDER + FERRY: long rectangle, fast and agile, premium pin/box-out drivers within G418's 5-second limit. The robot CANNOT shoot, store fuel, or climb.

ROLE FLIPS BY HUB STATE:
- When OUR HUB is ACTIVE: 1884 ferries fuel from the neutral zone back under our truss to feed partners' shooters. Stay on our side of the field.
- When OUR HUB is INACTIVE: 1884 disrupts opponents — either blocks their truss path (if they can't go over the bump/ramp) OR denies their corner fuel pile. Engage on their side of the field aggressively.
- LAST 30 SECONDS (END GAME): NEVER on opponent side. Both HUBs become active again. 1884 must ferry only and stay on our side. Critical reason: any contact with an opponent climbing on TOWER triggers G420 — they get free Level 3 points (30+ pts), which can flip a match outcome. We've been burned by this before.

So 1884's value is rhythmic: ferry-disrupt-ferry-disrupt-ferry-final-ferry, dictated by HUB state. Plus surgical pin work on their best scorer when on the disrupt phase.

You will receive game context, then a specific match with full data on all 6 teams. Output exactly two markdown sections:

## Strategist
Five bullets, in this exact order:
- **Threat:** [primary opposing scorer to neutralize during disrupt phases, with team #, EPA, key capability]
- **Partners:** [strengths of our 2 partners, what they offer offensively + climb potential for TRAVERSAL]
- **Phase plan:** [what 1884 does in each HUB state — ferry pattern when our HUB active, disrupt target when our HUB inactive, where to position last 30s]
- **RP opportunity:** [Win/ENERGIZED/SUPERCHARGED/TRAVERSAL realistic targets, with math. Note: 1884 doesn't climb so TRAVERSAL depends entirely on partners.]
- **Key risk:** [the one thing that loses the match]

## Driver
Five short imperatives, max 12 words each, action verbs first. No numbered list, just dashes. The fifth bullet must always relate to End Game positioning and reinforce: never on opponent side last 30s.

Example shape:
- [HUB-active behaviour with specific team/lane]
- [HUB-inactive disrupt target, specific tactic]
- [Pin timing or release rule]
- [Mid-match adjustment trigger]
- Endgame 0:30 — return to our side, ferry only, stay clear of climbers.

Be specific with team numbers. Be honest about likely outcomes. If the data is thin or contradictory, say so in Key risk.`;

const GAME_CONTEXT = `REBUILT 2026 game basics:
- Match: 2:40 total - AUTO 20s, Transition 10s, 4 Shifts x 25s, End Game 30s
- AUTO winner controls HUB activation order in Shift 1; HUBs alternate active/inactive after
- Scoring in INACTIVE HUB = 0 points
- FUEL in active HUB: 1pt. TOWER L1: 10-15, L2: 20, L3: 30
- Ranking Points: Win 3, Tie 1, ENERGIZED (100+ FUEL) 1, SUPERCHARGED (360+ FUEL) 1, TRAVERSAL (50+ climb pts) 1
- Key rules: G418 (5s pin limit, 3s back off), G420 (no TOWER contact last 30s), G403 (no center-line cross + opponent contact in AUTO)

G420 CRITICAL: From the moment End Game starts (last 30s), any contact with an opposing robot on the TOWER awards them Level 3 climb points (30+) regardless of where they actually finish. This is a match-deciding penalty. 1884 has lost matches to this exact foul before — never suggest defensive engagement in the last 30 seconds.

End Game state: both HUBs become active again. 1884's only job in End Game is ferrying fuel for our alliance's last shots. Stay entirely on our side of the field.

Tier system used in scout data:
- S = 200+ EPA (elite)
- A = 150-199 EPA (strong)
- B = 110-149 EPA (mid)
- U = <110 EPA (low or unknown)

Capability fields you may see per team: drivetrain, fuel_acquisition, fuel_passing, fuel_scoring_position, hopper_capacity, shooter_type, trench_bump (can it cross trench/bump), endgame_climb (None/L1/L2/L3), bps (balls per second), auto_climb. Plus free-text comments from scouts.

Pre-scouting data is from regional events earlier in 2026 and may be outdated. Houston live observations (where present) are more recent. Weight live data more heavily when both exist.`;

interface MatchAllianceTeam {
  alliance: string;
  station: number;
  team_number: number;
  name: string;
  capabilities: unknown[];
  metrics: unknown[];
  matchObservations: unknown[];
  pitObservations: unknown[];
}

interface MatchBundle {
  eventKey: string;
  match: {
    match_key: string;
    match_number: number;
    comp_level: string;
    scheduled_at: string | null;
    red_score: number | null;
    blue_score: number | null;
  };
  teams: MatchAllianceTeam[];
}

function loadMatchBundle(eventKey: string, matchKey: string): MatchBundle | null {
  const matchRow = db
    .prepare(`
      SELECT id, match_key, match_number, comp_level, scheduled_at, red_score, blue_score
      FROM matches
      WHERE match_key = ? AND event_key = ?
    `)
    .get(matchKey, eventKey) as
    | {
        id: number;
        match_key: string;
        match_number: number;
        comp_level: string;
        scheduled_at: string | null;
        red_score: number | null;
        blue_score: number | null;
      }
    | undefined;

  if (!matchRow) {
    return null;
  }

  const allianceTeams = db
    .prepare(`
      SELECT a.alliance_color AS alliance, mat.station, t.team_number, t.name
      FROM match_alliances a
      JOIN match_alliance_teams mat ON mat.alliance_id = a.id
      JOIN teams t ON t.team_number = mat.team_number
      WHERE a.match_id = ?
      ORDER BY a.alliance_color ASC, mat.station ASC
    `)
    .all(matchRow.id) as Array<{
    alliance: string;
    station: number;
    team_number: number;
    name: string;
  }>;

  const capabilitiesQ = db.prepare(`
    SELECT capability_name, capability_value, source, observed_at
    FROM team_capabilities
    WHERE event_key = ? AND team_number = ?
    ORDER BY source ASC, capability_name ASC
  `);
  const metricsQ = db.prepare(`
    SELECT event_key, metric_name, metric_value, source_run, computed_at
    FROM analytics_metrics
    WHERE team_number = ? AND (event_key = ? OR event_key IS NULL)
    ORDER BY metric_name ASC, computed_at DESC
  `);
  const matchObsQ = db.prepare(`
    SELECT m.match_key, m.match_number, m.comp_level, mo.phase, mo.scouter,
           mo.fuel_scored, mo.climb_points, mo.notes, mo.source, mo.observed_at
    FROM match_observations mo
    JOIN matches m ON m.id = mo.match_id
    WHERE m.event_key = ? AND mo.team_number = ?
    ORDER BY m.match_number ASC, mo.observed_at ASC
  `);
  const pitObsQ = db.prepare(`
    SELECT scouter, stars, avg_fuel, climb_capability, warning_flag, notes, source, observed_at
    FROM pit_observations
    WHERE event_key = ? AND team_number = ?
    ORDER BY observed_at DESC
  `);

  const teams: MatchAllianceTeam[] = allianceTeams.map((a) => ({
    alliance: a.alliance,
    station: a.station,
    team_number: a.team_number,
    name: a.name,
    capabilities: capabilitiesQ.all(eventKey, a.team_number),
    metrics: metricsQ.all(a.team_number, eventKey),
    matchObservations: matchObsQ.all(eventKey, a.team_number),
    pitObservations: pitObsQ.all(eventKey, a.team_number)
  }));

  return {
    eventKey,
    match: {
      match_key: matchRow.match_key,
      match_number: matchRow.match_number,
      comp_level: matchRow.comp_level,
      scheduled_at: matchRow.scheduled_at,
      red_score: matchRow.red_score,
      blue_score: matchRow.blue_score
    },
    teams
  };
}

function hashBundle(bundle: MatchBundle): string {
  return createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
}

function splitSections(md: string): { strategist: string; driver: string } {
  const STRAT = "## Strategist";
  const DRIVER = "## Driver";
  const sIdx = md.indexOf(STRAT);
  const dIdx = md.indexOf(DRIVER);
  if (sIdx === -1 || dIdx === -1 || dIdx < sIdx) {
    return { strategist: md.trim(), driver: "" };
  }
  const strategist = md.slice(sIdx + STRAT.length, dIdx).trim();
  const driver = md.slice(dIdx + DRIVER.length).trim();
  return { strategist, driver };
}

export type BriefStaleness = "fresh" | "stale" | "missing";

export interface MatchBriefStatus {
  matchKey: string;
  eventKey: string;
  staleness: BriefStaleness;
  strategist: string | null;
  driver: string | null;
  generatedAt: string | null;
  model: string | null;
}

export function getMatchBriefStatus(eventKey: string, matchKey: string): MatchBriefStatus {
  const bundle = loadMatchBundle(eventKey, matchKey);
  if (!bundle) {
    throw new MatchBriefMatchNotFoundError(matchKey);
  }
  const currentHash = hashBundle(bundle);
  const row = db
    .prepare(`
      SELECT strategist_md, driver_md, data_hash, model, generated_at
      FROM match_briefs
      WHERE match_key = ?
    `)
    .get(matchKey) as
    | {
        strategist_md: string;
        driver_md: string;
        data_hash: string;
        model: string;
        generated_at: string;
      }
    | undefined;

  if (!row) {
    return {
      matchKey,
      eventKey,
      staleness: "missing",
      strategist: null,
      driver: null,
      generatedAt: null,
      model: null
    };
  }

  return {
    matchKey,
    eventKey,
    staleness: row.data_hash === currentHash ? "fresh" : "stale",
    strategist: row.strategist_md,
    driver: row.driver_md,
    generatedAt: row.generated_at,
    model: row.model
  };
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: AnthropicUsage;
  model?: string;
}

export interface GenerateMatchBriefResult {
  matchKey: string;
  eventKey: string;
  strategist: string;
  driver: string;
  generatedAt: string;
  model: string;
  staleness: BriefStaleness;
  cacheStats: { creation: number; read: number };
}

interface BriefLogger {
  info: (data: object) => void;
}

export async function generateMatchBrief(
  eventKey: string,
  matchKey: string,
  log?: BriefLogger
): Promise<GenerateMatchBriefResult> {
  const apiKey = getApiKey();
  const bundle = loadMatchBundle(eventKey, matchKey);
  if (!bundle) {
    throw new MatchBriefMatchNotFoundError(matchKey);
  }

  const matchSpecificData = `Match data for ${bundle.match.match_key} (qual ${bundle.match.match_number}). Six teams below — alliances, capabilities, metrics, observations.\n\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n\nProduce the Strategist + Driver brief now.`;

  const requestBody = {
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      }
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: GAME_CONTEXT,
            cache_control: { type: "ephemeral" }
          },
          {
            type: "text",
            text: matchSpecificData
          }
        ]
      }
    ]
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} — ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n\n");

  const { strategist, driver } = splitSections(text);
  const cacheCreate = data.usage?.cache_creation_input_tokens ?? 0;
  const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
  const generatedAt = new Date().toISOString();
  const dataHash = hashBundle(bundle);
  const usedModel = data.model ?? MODEL;

  if (log) {
    log.info({ event: "claude_brief_generated", matchKey, eventKey, cacheCreate, cacheRead, model: usedModel });
  }

  db.prepare(`
    INSERT INTO match_briefs (match_key, event_key, strategist_md, driver_md, data_hash, model, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_key) DO UPDATE SET
      event_key = excluded.event_key,
      strategist_md = excluded.strategist_md,
      driver_md = excluded.driver_md,
      data_hash = excluded.data_hash,
      model = excluded.model,
      generated_at = excluded.generated_at
  `).run(matchKey, eventKey, strategist, driver, dataHash, usedModel, generatedAt);

  return {
    matchKey,
    eventKey,
    strategist,
    driver,
    generatedAt,
    model: usedModel,
    staleness: "fresh",
    cacheStats: { creation: cacheCreate, read: cacheRead }
  };
}

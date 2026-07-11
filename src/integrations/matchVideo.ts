import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { db } from "../db/client.js";
import { loadSeasonProfile, profileToContext } from "./seasonProfile.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Vision model for match analysis. Confirm against your current available
// models and bump as needed (your briefs pin an older Sonnet — worth aligning).
const MODEL = "claude-sonnet-4-6";

// How many frames to sample from the recording. More frames = better read but
// more tokens/cost. Evenly spaced across the clip.
const FRAME_COUNT = 12;

export class ClaudeCredentialsMissingError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY environment variable is not set");
    this.name = "ClaudeCredentialsMissingError";
  }
}
export class RecordingNotFoundError extends Error {
  constructor(id: number) {
    super(`Recording not found: ${id}`);
    this.name = "RecordingNotFoundError";
  }
}
export class VideoFileMissingError extends Error {
  constructor(p: string) {
    super(`Recording has no readable video at: ${p}`);
    this.name = "VideoFileMissingError";
  }
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeCredentialsMissingError();
  return key;
}

// --- REBUILT context, reused from the brief vocabulary so the model reasons in
// the same terms the rest of the app does. ----------------------------------
const GAME_CONTEXT = `REBUILT 2026: 2:40 match — AUTO 20s, Transition 10s, four 25s Shifts, End Game 30s.
HUBs alternate active/inactive each shift; scoring in an INACTIVE hub = 0. FUEL in active hub = 1pt. TOWER climb L1 10-15 / L2 20 / L3 30.
Ranking points: Win 3, ENERGIZED (100+ FUEL) 1, SUPERCHARGED (360+ FUEL) 1, TRAVERSAL (50+ climb pts) 1.
Team 1884 (Griffins) is a HYBRID DEFENDER + FERRY: fast, long; ferries fuel when our hub is active, disrupts when inactive; CANNOT shoot, store fuel, or climb. In the last 30s it must stay on our side and never contact a climbing opponent (G420).`;

function systemPrompt(roster: string): string {
  return `You are a vision-based match analyst for FRC Team 1884 at a REBUILT 2026 event. You are given evenly-spaced frames from a single recording of one qualification match, plus the known roster of the six robots on the field.

KNOWN ROSTER (use this to attribute observations — do NOT try to read bumper numbers if they're unclear, attribute by alliance side, station position, and consistent robot appearance instead):
${roster}

Bumper colour tells you alliance (red vs blue). Within an alliance, use position/appearance to separate the three robots. If you cannot confidently tell two robots apart, say so via id_confidence:"low" and keep the analysis general.

For EACH of the six teams, return your read. Be honest about uncertainty. Fuel counts from stands video are ESTIMATES — give your best estimate but never present it as exact.

Output ONLY a JSON object, no prose, no markdown fences, in exactly this shape:
{
  "teams": [
    {
      "team_number": <int>,
      "id_confidence": "high" | "medium" | "low",
      "fuel_estimate": <number>,            // best estimate of fuel this robot scored
      "did_well": "<short phrase>",
      "did_poorly": "<short phrase, most relevant for 1884; '' if N/A>",
      "vulnerabilities": "<how an opponent could exploit this robot; '' if none seen>",
      "summary": "<one sentence on this robot's match>"
    }
    // ... all six
  ],
  "our_robot_notes": "<2-3 sentences specifically on what 1884 did right and wrong this match, in defender/ferry terms>"
}`;
}

interface RosterTeam {
  alliance: "red" | "blue";
  station: number;
  team_number: number;
  name: string | null;
  seasonContext: string;
}

interface MatchRow {
  id: number;
  event_key: string;
  match_key: string;
  status: string;
  video_path: string | null;
}

function loadRecording(recordingId: number): MatchRow {
  const rec = db
    .prepare(`SELECT id, event_key, match_key, status, video_path FROM match_recordings WHERE id = ?`)
    .get(recordingId) as MatchRow | undefined;
  if (!rec) throw new RecordingNotFoundError(recordingId);
  return rec;
}

function loadRoster(eventKey: string, matchKey: string): RosterTeam[] {
  const matchRow = db.prepare(`SELECT id FROM matches WHERE match_key = ? AND event_key = ?`).get(matchKey, eventKey) as
    | { id: number }
    | undefined;
  if (!matchRow) return [];

  const teams = db
    .prepare(
      `SELECT a.alliance_color AS alliance, mat.station, t.team_number, t.name
       FROM match_alliances a
       JOIN match_alliance_teams mat ON mat.alliance_id = a.id
       JOIN teams t ON t.team_number = mat.team_number
       WHERE a.match_id = ?
       ORDER BY a.alliance_color ASC, mat.station ASC`
    )
    .all(matchRow.id) as Array<{ alliance: "red" | "blue"; station: number; team_number: number; name: string | null }>;

  // Ground each robot in its 2026-season performance (TBA OPR/DPR + Statbotics
  // EPA + scouted capabilities) so the model's attribution and estimates are
  // calibrated, not guessed.
  return teams.map((t) => ({
    alliance: t.alliance,
    station: t.station,
    team_number: t.team_number,
    name: t.name,
    seasonContext: profileToContext(loadSeasonProfile(eventKey, t.team_number)),
  }));
}

function rosterToText(roster: RosterTeam[]): string {
  return roster
    .map(
      (r) =>
        `- ${r.alliance.toUpperCase()} ${r.station}: team ${r.team_number}${r.name ? ` (${r.name})` : ""} — 2026: ${r.seasonContext}`
    )
    .join("\n");
}

// Sample evenly-spaced JPEG frames from the video using ffmpeg. Requires ffmpeg
// on the host (it's already a normal dependency for any video work; the systemd
// unit's box needs it installed). Returns base64 JPEGs.
function sampleFrames(videoPath: string, count: number): string[] {
  if (!fs.existsSync(videoPath)) throw new VideoFileMissingError(videoPath);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frc-frames-"));
  try {
    // fps filter: pick `count` frames spread across the clip. We approximate by
    // asking ffmpeg for `count` evenly-distributed frames via thumbnail+select.
    const out = path.join(dir, "f-%03d.jpg");
    const res = spawnSync(
      "ffmpeg",
      [
        "-i",
        videoPath,
        "-vf",
        `select='not(mod(n\\,trunc(t/${count})+1))',scale=960:-1`,
        "-frames:v",
        String(count),
        "-vsync",
        "vfr",
        "-q:v",
        "4",
        out,
      ],
      { encoding: "buffer" }
    );
    if (res.status !== 0) {
      // Fallback: simpler evenly-timed extraction at 1 frame / (duration/count).
      const res2 = spawnSync("ffmpeg", ["-i", videoPath, "-vf", "fps=1/12,scale=960:-1", "-q:v", "4", out], {
        encoding: "buffer",
      });
      if (res2.status !== 0) {
        throw new Error(`ffmpeg frame extraction failed: ${res2.stderr?.toString().slice(-300)}`);
      }
    }
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jpg"))
      .sort()
      .slice(0, count)
      .map((f) => fs.readFileSync(path.join(dir, f)).toString("base64"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model?: string;
}

interface TeamRead {
  team_number: number;
  id_confidence?: "high" | "medium" | "low";
  fuel_estimate?: number;
  did_well?: string;
  did_poorly?: string;
  vulnerabilities?: string;
  summary?: string;
}
interface AnalysisJson {
  teams: TeamRead[];
  our_robot_notes?: string;
}

export interface ProcessResult {
  recordingId: number;
  matchKey: string;
  eventKey: string;
  model: string;
  teamCount: number;
}

export async function processMatchVideo(recordingId: number, log?: { info: (o: object) => void }): Promise<ProcessResult> {
  const apiKey = getApiKey();
  const rec = loadRecording(recordingId);
  if (!rec.video_path) throw new VideoFileMissingError("(none set)");

  db.prepare(`UPDATE match_recordings SET status='processing', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(recordingId);

  try {
    const roster = loadRoster(rec.event_key, rec.match_key);
    const frames = sampleFrames(rec.video_path, FRAME_COUNT);

    const imageBlocks = frames.map((b64) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: b64 },
    }));

    const requestBody = {
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: systemPrompt(rosterToText(roster)), cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: GAME_CONTEXT, cache_control: { type: "ephemeral" } },
            { type: "text", text: `Frames from match ${rec.match_key}, in time order:` },
            ...imageBlocks,
            { type: "text", text: "Return the JSON now." },
          ],
        },
      ],
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} — ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const raw = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText) as AnalysisJson;
    const usedModel = data.model ?? MODEL;
    const generatedAt = new Date().toISOString();

    const rosterByTeam = new Map(roster.map((r) => [r.team_number, r]));

    const persist = db.transaction(() => {
      // raw model output for audit / reprocessing
      db.prepare(
        `INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
         VALUES ('ai-video', 'match_analysis', ?, ?, ?)`
      ).run(rec.match_key, JSON.stringify(parsed), generatedAt);

      const upsertAnalysis = db.prepare(
        `INSERT INTO ai_match_analysis
           (match_key, team_number, recording_id, alliance, station, fuel_estimate, id_confidence,
            did_well, did_poorly, vulnerabilities, summary, model, generated_at)
         VALUES (@match_key, @team_number, @recording_id, @alliance, @station, @fuel_estimate, @id_confidence,
            @did_well, @did_poorly, @vulnerabilities, @summary, @model, @generated_at)
         ON CONFLICT(match_key, team_number) DO UPDATE SET
            recording_id=excluded.recording_id, fuel_estimate=excluded.fuel_estimate,
            id_confidence=excluded.id_confidence, did_well=excluded.did_well, did_poorly=excluded.did_poorly,
            vulnerabilities=excluded.vulnerabilities, summary=excluded.summary, model=excluded.model,
            generated_at=excluded.generated_at`
      );

      // also drop into the app's normal tables so existing views pick it up
      const matchId = (
        db.prepare(`SELECT id FROM matches WHERE match_key = ?`).get(rec.match_key) as { id: number } | undefined
      )?.id;
      const insertObs = db.prepare(
        `INSERT INTO match_observations (match_id, team_number, phase, scouter, fuel_scored, notes, source)
         VALUES (?, ?, 'match', 'ai-video', ?, ?, 'ai-video')`
      );
      const insertMetric = db.prepare(
        `INSERT OR IGNORE INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
         VALUES (?, ?, 'ai.fuel_estimate', ?, ?)`
      );

      for (const t of parsed.teams ?? []) {
        const r = rosterByTeam.get(t.team_number);
        upsertAnalysis.run({
          match_key: rec.match_key,
          team_number: t.team_number,
          recording_id: recordingId,
          alliance: r?.alliance ?? null,
          station: r?.station ?? null,
          fuel_estimate: typeof t.fuel_estimate === "number" ? t.fuel_estimate : null,
          id_confidence: t.id_confidence ?? null,
          did_well: t.did_well ?? null,
          did_poorly: t.did_poorly ?? null,
          vulnerabilities: t.vulnerabilities ?? null,
          summary: t.summary ?? null,
          model: usedModel,
          generated_at: generatedAt,
        });

        if (matchId) {
          insertObs.run(
            matchId,
            t.team_number,
            typeof t.fuel_estimate === "number" ? Math.round(t.fuel_estimate) : null,
            JSON.stringify({
              source: "ai-video",
              id_confidence: t.id_confidence,
              did_well: t.did_well,
              vulnerabilities: t.vulnerabilities,
              summary: t.summary,
            })
          );
          if (typeof t.fuel_estimate === "number") {
            insertMetric.run(rec.event_key, t.team_number, t.fuel_estimate, generatedAt);
          }
        }
      }

      db.prepare(`UPDATE match_recordings SET status='done', error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
        recordingId
      );
    });
    persist();

    if (log) log.info({ event: "match_video_processed", recordingId, matchKey: rec.match_key, model: usedModel });

    return {
      recordingId,
      matchKey: rec.match_key,
      eventKey: rec.event_key,
      model: usedModel,
      teamCount: (parsed.teams ?? []).length,
    };
  } catch (err) {
    db.prepare(`UPDATE match_recordings SET status='failed', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      err instanceof Error ? err.message : String(err),
      recordingId
    );
    throw err;
  }
}

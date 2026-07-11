import type { FastifyPluginAsync } from "fastify";

import { db } from "../db/client.js";
import { getCurrentMatch, getMatchRoster } from "../integrations/currentMatch.js";
import {
  ClaudeCredentialsMissingError,
  processMatchVideo,
  RecordingNotFoundError,
  VideoFileMissingError,
} from "../integrations/matchVideo.js";
import { isRatingValue, RATING_SCORE, type RatingValue } from "../integrations/ratings.js";
import { buildVideoDataset } from "../integrations/matchVideoDataset.js";
import { ingestZebraForEvent, getMatchPaths, TbaKeyMissingError } from "../integrations/zebra.js";

export const scoutVideoRoutes: FastifyPluginAsync = async (app) => {
  // The scout opens the app -> the one in-progress match is shown automatically.
  app.get<{ Params: { eventKey: string } }>("/events/:eventKey/current-match", async (request, reply) => {
    const match = getCurrentMatch(request.params.eventKey);
    if (!match) return reply.code(404).send({ error_code: "no_current_match" });
    return { match };
  });

  // Start a recording row when the scout hits record.
  app.post<{ Params: { eventKey: string }; Body: { matchKey: string; scout?: string } }>(
    "/events/:eventKey/recordings",
    async (request, reply) => {
      const { matchKey, scout } = request.body ?? ({} as any);
      if (!matchKey) return reply.code(400).send({ error: "matchKey_required" });
      const row = db
        .prepare(
          `INSERT INTO match_recordings (event_key, match_key, scout, status)
           VALUES (?, ?, ?, 'recording')
           RETURNING id, status`
        )
        .get(request.params.eventKey, matchKey, scout ?? null);
      return reply.code(201).send(row);
    }
  );

  // Attach the uploaded video's server path, then kick processing.
  app.post<{ Params: { id: string }; Body: { videoPath: string } }>(
    "/recordings/:id/process",
    async (request, reply) => {
      const id = Number(request.params.id);
      const videoPath = request.body?.videoPath;
      if (!Number.isInteger(id)) return reply.code(400).send({ error: "invalid_id" });
      if (!videoPath) return reply.code(400).send({ error: "videoPath_required" });

      db.prepare(`UPDATE match_recordings SET video_path=?, status='uploaded', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
        videoPath,
        id
      );

      try {
        const result = await processMatchVideo(id, request.log);
        return reply.code(200).send({ ok: true, result });
      } catch (error) {
        if (error instanceof ClaudeCredentialsMissingError) {
          return reply.code(503).send({ ok: false, error_code: "anthropic_key_not_configured" });
        }
        if (error instanceof RecordingNotFoundError) {
          return reply.code(404).send({ ok: false, error_code: "recording_not_found" });
        }
        if (error instanceof VideoFileMissingError) {
          return reply.code(422).send({ ok: false, error_code: "video_missing" });
        }
        request.log.error(error);
        return reply.code(502).send({ ok: false, error: error instanceof Error ? error.message : "process_failed" });
      }
    }
  );

  // MANDATORY post-match categorisation: every robot in the match must get a
  // scoring AND a defence rating, each one of
  //   exceptional | good | average | bad | no_evidence
  // The server rejects the submission if any robot is missing either axis, so a
  // match can't be finalised half-rated.
  app.post<{
    Params: { eventKey: string; matchKey: string };
    Body: {
      recordingId?: number;
      scout?: string;
      ratings?: Array<{ teamNumber: number; scoring: string; defence: string }>;
    };
  }>("/events/:eventKey/matches/:matchKey/ratings", async (request, reply) => {
    const { eventKey, matchKey } = request.params;
    const roster = getMatchRoster(matchKey);
    if (roster.length === 0) return reply.code(404).send({ error_code: "match_not_found" });

    const submitted = new Map((request.body?.ratings ?? []).map((r) => [r.teamNumber, r]));

    // completeness + validity check across the whole roster
    const problems: Array<{ teamNumber: number; reason: string }> = [];
    for (const t of roster) {
      const r = submitted.get(t.teamNumber);
      if (!r) {
        problems.push({ teamNumber: t.teamNumber, reason: "missing" });
        continue;
      }
      if (!isRatingValue(r.scoring)) problems.push({ teamNumber: t.teamNumber, reason: "bad_scoring" });
      if (!isRatingValue(r.defence)) problems.push({ teamNumber: t.teamNumber, reason: "bad_defence" });
    }
    if (problems.length) {
      return reply.code(400).send({ error_code: "ratings_incomplete", problems });
    }

    const generatedAt = new Date().toISOString();
    const persist = db.transaction(() => {
      const upsert = db.prepare(
        `INSERT INTO scout_robot_ratings
           (match_key, team_number, event_key, recording_id, scout, scoring_rating, defence_rating, updated_at)
         VALUES (@match_key, @team_number, @event_key, @recording_id, @scout, @scoring, @defence, CURRENT_TIMESTAMP)
         ON CONFLICT(match_key, team_number) DO UPDATE SET
           scoring_rating=excluded.scoring_rating,
           defence_rating=excluded.defence_rating,
           recording_id=excluded.recording_id,
           scout=excluded.scout,
           updated_at=CURRENT_TIMESTAMP`
      );
      // Mirror to analytics_metrics for cross-match averaging. source_run=match_key
      // so re-rating a match overwrites instead of double-counting it. no_evidence
      // is excluded (null) so it never drags an average down.
      const metric = db.prepare(
        `INSERT INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(event_key, team_number, metric_name, source_run)
         DO UPDATE SET metric_value=excluded.metric_value`
      );

      for (const t of roster) {
        const r = submitted.get(t.teamNumber)!;
        upsert.run({
          match_key: matchKey,
          team_number: t.teamNumber,
          event_key: eventKey,
          recording_id: request.body?.recordingId ?? null,
          scout: request.body?.scout ?? null,
          scoring: r.scoring,
          defence: r.defence,
        });
        const sc = RATING_SCORE[r.scoring as RatingValue];
        const df = RATING_SCORE[r.defence as RatingValue];
        if (sc !== null) metric.run(eventKey, t.teamNumber, "scout.scoring_rating", sc, matchKey);
        if (df !== null) metric.run(eventKey, t.teamNumber, "scout.defence_rating", df, matchKey);
      }
    });
    persist();

    return reply.code(200).send({ ok: true, ratedTeams: roster.length });
  });

  // Optional post-match standout sentence (comes AFTER the mandatory ratings).
  app.post<{ Params: { id: string }; Body: { note: string } }>("/recordings/:id/note", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "invalid_id" });
    db.prepare(`UPDATE match_recordings SET scout_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      request.body?.note ?? null,
      id
    );
    return { ok: true };
  });

  // Analyst read: AI per-robot output + the scout's mandatory ratings + the note.
  app.get<{ Params: { eventKey: string; matchKey: string } }>(
    "/events/:eventKey/matches/:matchKey/video-analysis",
    async (request) => {
      const { matchKey } = request.params;

      const ai = db
        .prepare(
          `SELECT team_number, alliance, station, fuel_estimate, id_confidence,
                  did_well, did_poorly, vulnerabilities, summary, path_json, model, generated_at
           FROM ai_match_analysis WHERE match_key = ? ORDER BY alliance ASC, station ASC`
        )
        .all(matchKey) as Array<{ team_number: number; [k: string]: unknown }>;

      const ratings = db
        .prepare(
          `SELECT team_number, scoring_rating, defence_rating, scout
           FROM scout_robot_ratings WHERE match_key = ?`
        )
        .all(matchKey) as Array<{ team_number: number; scoring_rating: string; defence_rating: string; scout: string | null }>;
      const ratingByTeam = new Map(ratings.map((r) => [r.team_number, r]));

      const teams = ai.map((row) => ({
        ...row,
        scoring_rating: ratingByTeam.get(row.team_number)?.scoring_rating ?? null,
        defence_rating: ratingByTeam.get(row.team_number)?.defence_rating ?? null,
      }));

      const recording = db
        .prepare(
          `SELECT id, scout, status, scout_note FROM match_recordings WHERE match_key = ? ORDER BY id DESC LIMIT 1`
        )
        .get(matchKey);

      return { matchKey, recording, teams, ratingsComplete: ratings.length > 0 };
    }
  );

  // Every TBA-linked match video + breakdown coverage for the event, read from
  // the snapshot your TBA ingest already stored. ?summary=1 omits the per-match
  // list. The breakdownKeys array is how you find the official fuel field for
  // calibration.
  app.get<{ Params: { eventKey: string }; Querystring: { summary?: string } }>(
    "/events/:eventKey/video-dataset",
    async (request) => {
      const manifest = buildVideoDataset(request.params.eventKey);
      if (request.query?.summary) {
        const { entries, ...rest } = manifest;
        return rest;
      }
      return manifest;
    }
  );

  // Real per-robot tracking paths from TBA Zebra MotionWorks (where available).
  app.post<{ Params: { eventKey: string } }>("/events/:eventKey/ingest-zebra", async (request, reply) => {
    try {
      const result = await ingestZebraForEvent(request.params.eventKey);
      return result;
    } catch (error) {
      if (error instanceof TbaKeyMissingError) return reply.code(503).send({ error_code: "tba_key_not_configured" });
      request.log.error(error);
      return reply.code(502).send({ error: error instanceof Error ? error.message : "zebra_ingest_failed" });
    }
  });

  app.get<{ Params: { matchKey: string } }>("/matches/:matchKey/paths", async (request, reply) => {
    const paths = getMatchPaths(request.params.matchKey);
    if (!paths) return reply.code(404).send({ error_code: "no_zebra_data" });
    return { matchKey: request.params.matchKey, robots: paths };
  });
};

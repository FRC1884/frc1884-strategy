import type { FastifyPluginAsync } from "fastify";

import { db } from "../db/client.js";
import type { StrategyPlanUpsertBody } from "../types/domain.js";
import { loadStrategyPlanWithVersions } from "./helpers.js";

export const strategyPlanRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { eventKey: string };
    Querystring: { matchKey?: string; scope?: string };
  }>("/events/:eventKey/strategy-plans", async (request) => {
    const rows = db
      .prepare(`
        SELECT
          sp.id
        FROM strategy_plans sp
        LEFT JOIN matches m ON m.id = sp.match_id
        WHERE sp.event_key = ?
          AND (? IS NULL OR sp.scope = ?)
          AND (? IS NULL OR m.match_key = ?)
        ORDER BY sp.updated_at DESC
      `)
      .all(
        request.params.eventKey,
        request.query.scope ?? null,
        request.query.scope ?? null,
        request.query.matchKey ?? null,
        request.query.matchKey ?? null
      ) as Array<{ id: number }>;

    return {
      strategyPlans: rows
        .map((row) => loadStrategyPlanWithVersions(row.id))
        .filter(Boolean)
    };
  });

  app.put<{
    Params: { eventKey: string; scope: string };
    Body: StrategyPlanUpsertBody;
  }>("/events/:eventKey/strategy-plans/:scope", async (request, reply) => {
    const { eventKey, scope } = request.params;
    const body = request.body ?? {};

    if (!["scheduled_match", "free_play"].includes(scope)) {
      return reply.code(400).send({ error: "invalid_scope" });
    }

    if (scope === "scheduled_match" && !body.matchKey) {
      return reply.code(400).send({ error: "match_key_required_for_scheduled_match" });
    }

    const existingEvent = db
      .prepare(`SELECT event_key FROM events WHERE event_key = ?`)
      .get(eventKey);

    if (!existingEvent) {
      return reply.code(404).send({ error: "event_not_found" });
    }

    const matchId =
      scope === "scheduled_match"
        ? (
            db.prepare(`SELECT id FROM matches WHERE event_key = ? AND match_key = ?`).get(
              eventKey,
              body.matchKey
            ) as { id: number } | undefined
          )?.id ?? null
        : null;

    if (scope === "scheduled_match" && !matchId) {
      return reply.code(404).send({ error: "match_not_found" });
    }

    const transaction = db.transaction(() => {
      const existingPlan = db
        .prepare(`
          SELECT id
          FROM strategy_plans
          WHERE event_key = ?
            AND scope = ?
            AND (
              (? IS NULL AND match_id IS NULL) OR
              match_id = ?
            )
          ORDER BY updated_at DESC
          LIMIT 1
        `)
        .get(eventKey, scope, matchId, matchId) as { id: number } | undefined;

      let planId: number;

      if (existingPlan) {
        db.prepare(`
          UPDATE strategy_plans
          SET title = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(body.title ?? null, body.notes ?? null, existingPlan.id);
        planId = existingPlan.id;
      } else {
        const result = db.prepare(`
          INSERT INTO strategy_plans (event_key, match_id, scope, title, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(eventKey, matchId, scope, body.title ?? null, body.notes ?? null);
        planId = Number(result.lastInsertRowid);
      }

      for (const phase of ["auto", "teleop"] as const) {
        const phaseData = body.phases?.[phase];

        if (phaseData !== undefined) {
          db.prepare(`
            INSERT INTO strategy_plan_versions (plan_id, phase, data_json, created_by)
            VALUES (?, ?, ?, ?)
          `).run(planId, phase, JSON.stringify(phaseData), body.updatedBy ?? null);
        }
      }

      return planId;
    });

    const planId = transaction();
    const plan = loadStrategyPlanWithVersions(planId);

    return reply.code(200).send({ strategyPlan: plan });
  });
};

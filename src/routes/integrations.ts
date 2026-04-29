import type { FastifyPluginAsync } from "fastify";

import { ingestNewtonPreScoutingCsv } from "../integrations/preScouting.js";
import { ingestScoutSheet } from "../integrations/scoutSheet.js";
import { ingestStatboticsEvent } from "../integrations/statbotics.js";
import {
  ingestTbaEvent,
  ingestTbaOprs,
  isTbaConfigured,
  TbaCredentialsMissingError
} from "../integrations/tba.js";

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { eventKey: string };
  }>("/integrations/statbotics/events/:eventKey/ingest", async (request, reply) => {
    try {
      const result = await ingestStatboticsEvent(request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "statbotics_ingest_failed"
      });
    }
  });

  app.post<{
    Params: { eventKey: string };
    Body: { filePath?: string };
  }>("/integrations/pre-scouting/events/:eventKey/ingest", async (request, reply) => {
    const filePath = request.body?.filePath;
    if (!filePath || typeof filePath !== "string") {
      return reply.code(400).send({ ok: false, error: "filePath_required" });
    }

    try {
      const result = await ingestNewtonPreScoutingCsv(filePath, request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "pre_scouting_ingest_failed"
      });
    }
  });

  app.post<{
    Params: { eventKey: string };
  }>("/integrations/scout-sheet/events/:eventKey/ingest", async (request, reply) => {
    try {
      const result = await ingestScoutSheet(request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "scout_sheet_ingest_failed"
      });
    }
  });

  app.get("/integrations/tba/status", async () => ({
    ok: true,
    configured: isTbaConfigured()
  }));

  app.post<{
    Params: { eventKey: string };
  }>("/integrations/tba/events/:eventKey/ingest-matches", async (request, reply) => {
    try {
      const result = await ingestTbaEvent(request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      if (error instanceof TbaCredentialsMissingError) {
        return reply.code(503).send({
          ok: false,
          error_code: "tba_key_not_configured",
          error: error.message
        });
      }
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "tba_matches_ingest_failed"
      });
    }
  });

  app.post<{
    Params: { eventKey: string };
  }>("/integrations/tba/events/:eventKey/ingest-oprs", async (request, reply) => {
    try {
      const result = await ingestTbaOprs(request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      if (error instanceof TbaCredentialsMissingError) {
        return reply.code(503).send({
          ok: false,
          error_code: "tba_key_not_configured",
          error: error.message
        });
      }
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "tba_oprs_ingest_failed"
      });
    }
  });
};

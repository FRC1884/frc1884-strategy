#!/usr/bin/env node

import { createHmac, timingSafeEqual } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.PORT || "3013");
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const deployRequestFile =
  process.env.DEPLOY_REQUEST_FILE || "/var/lib/frc1884-strategy-request/pending";
const expectedRepo = process.env.GITHUB_REPOSITORY || "FRC1884/frc1884-strategy";
const expectedRef = process.env.GITHUB_DEPLOY_REF || "refs/heads/main";

if (!webhookSecret) {
  throw new Error("GITHUB_WEBHOOK_SECRET is required");
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const received = Buffer.from(signatureHeader, "utf8");
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", webhookSecret).update(rawBody).digest("hex")}`,
    "utf8"
  );

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

function queueDeploy() {
  // systemd consumes this fixed marker. Payload fields never become commands,
  // process arguments, executable paths, or filenames.
  try {
    writeFileSync(deployRequestFile, "deploy\n", { flag: "wx", mode: 0o660 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);

    if (!isValidSignature(rawBody, req.headers["x-hub-signature-256"])) {
      return json(res, 401, { ok: false, error: "invalid_signature" });
    }

    const event = req.headers["x-github-event"];
    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
      if (payload === null || typeof payload !== "object") throw new Error("object required");
    } catch {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }

    if (event === "ping") {
      return json(res, 200, { ok: true, event: "ping" });
    }

    if (event !== "push") {
      return json(res, 202, { ok: true, ignored: "unsupported_event" });
    }

    if (payload.repository?.full_name !== expectedRepo) {
      return json(res, 202, { ok: true, ignored: "unexpected_repository" });
    }

    if (payload.ref !== expectedRef) {
      return json(res, 202, { ok: true, ignored: "unexpected_ref" });
    }

    try {
      queueDeploy();
    } catch (error) {
      console.error("Unable to queue deployment:", error.code);
      return json(res, 503, { ok: false, error: "deploy_unavailable" });
    }
    return json(res, 202, { ok: true, queued: true, after: payload.after });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GitHub webhook server listening on http://127.0.0.1:${server.address().port}`);
});

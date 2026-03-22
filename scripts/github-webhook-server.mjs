#!/usr/bin/env node

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.env.PORT || "3013");
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const deployLogDir = process.env.DEPLOY_LOG_DIR || "/srv/frc1884-strategy/log";
const deployLogFile =
  process.env.DEPLOY_LOG_FILE || `${deployLogDir}/github-webhook.log`;
const repoDir = process.env.REPO_DIR || "/srv/frc1884-strategy";
const expectedRepo = process.env.GITHUB_REPOSITORY || "FRC1884/frc1884-strategy";
const expectedRef = process.env.GITHUB_DEPLOY_REF || "refs/heads/main";
const lockFile = process.env.DEPLOY_LOCK_FILE || "/tmp/frc1884-strategy-deploy.lock";

if (!webhookSecret) {
  throw new Error("GITHUB_WEBHOOK_SECRET is required");
}

mkdirSync(deployLogDir, { recursive: true });

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

function queueDeploy(afterSha) {
  const logFd = openSync(deployLogFile, "a", 0o644);
  const deployCommand = [
    "flock",
    "-n",
    lockFile,
    "bash",
    "-lc",
    [
      `echo "[$(date -Is)] deploy requested for ${afterSha}"`,
      `cd ${repoDir}`,
      "git fetch origin",
      "git show origin/main:scripts/deploy-jpclawhq-main.sh >/dev/null",
      "git checkout main",
      "git pull --ff-only origin main",
      "./scripts/deploy-jpclawhq-main.sh",
    ].join(" && "),
  ];

  const child = spawn("sudo", deployCommand, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });

  child.unref();
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
    const payload = JSON.parse(rawBody.toString("utf8"));

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

    queueDeploy(payload.after);
    return json(res, 202, { ok: true, queued: true, after: payload.after });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GitHub webhook server listening on http://127.0.0.1:${port}`);
});

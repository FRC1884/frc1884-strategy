import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("signed webhook dispatch stays within its deployment marker boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "webhook-e2e-"));
  const marker = join(directory, "pending");
  const escaped = join(directory, "escaped");
  const secret = "disposable-e2e-secret";
  const child = spawn(process.execPath, ["scripts/github-webhook-server.mjs"], {
    env: { ...process.env, PORT: "0", GITHUB_WEBHOOK_SECRET: secret, DEPLOY_REQUEST_FILE: marker },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const exit = once(child, "exit");
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("webhook startup timed out: " + stderr)), 5000);
      child.stdout.on("data", chunk => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      child.once("exit", () => { clearTimeout(timer); reject(new Error("webhook exited: " + stderr)); });
    });
    const push = { repository: { full_name: "FRC1884/frc1884-strategy" }, ref: "refs/heads/main", after: "abc123" };
    const send = async (body, { event = "push", signed = true } = {}) => {
      const raw = typeof body === "string" ? body : JSON.stringify(body);
      return fetch(url, { method: "POST", headers: {
        "x-github-event": event,
        "x-hub-signature-256": signed ? "sha256=" + createHmac("sha256", secret).update(raw).digest("hex") : "sha256=invalid",
      }, body: raw });
    };
    assert.equal((await send("{")).status, 400);
    assert.equal((await send({}, { event: "ping" })).status, 200);
    assert.equal((await send(push, { signed: false })).status, 401);
    assert.equal((await send({ ...push, repository: { full_name: "other/repo" } })).status, 202);
    assert.equal((await send({ ...push, ref: "refs/heads/other" })).status, 202);
    assert.equal((await send(push, { event: "issues" })).status, 202);
    await assert.rejects(access(marker), { code: "ENOENT" });

    const hostile = { ...push, after: '$(touch "' + escaped + '"); echo injected' };
    const response = await send(hostile);
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true, queued: true, after: hostile.after });
    assert.equal(await readFile(marker, "utf8"), "deploy\n");
    assert.equal((await send(push)).status, 202);
    assert.equal(await readFile(marker, "utf8"), "deploy\n");
    await assert.rejects(access(escaped), { code: "ENOENT" });

    await rm(marker);
    await rm(directory, { recursive: true });
    assert.equal((await send(push)).status, 503);
    await mkdir(directory);
    assert.equal((await send({}, { event: "ping" })).status, 200);
  } finally {
    child.kill("SIGTERM");
    await exit;
    await rm(directory, { recursive: true, force: true });
  }
});


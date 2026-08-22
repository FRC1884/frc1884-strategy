"use strict";
// Login: tries the real server first (validates against the team's Google
// Sheet roster — see docs/AUTH_SHEET_SETUP.md), falls back to demo accounts
// only when running as a standalone file with no server (or the sheet isn't
// configured yet). Returns {name, role} on success, throws {code, message}
// on failure so the caller can show the right error.
(function (global) {
  const Lib = global.Lib || (global.Lib = {});

  async function apiLogin(username, password) {
    const u = (username || "").trim().toLowerCase();
    const p = password || "";
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      if (r.ok) {
        const d = await r.json();
        return { name: d.name, role: d.role };
      }
      if (r.status === 401) throw { code: "bad_credentials", message: "Wrong username or password — check the team roster sheet." };
      // 503 (sheet not configured) or anything else -> fall through to demo mode
    } catch (e) {
      if (e && e.code === "bad_credentials") throw e;
      // network error (standalone file, no server) -> fall through to demo mode
    }
    const c = Lib.CREDS[u];
    if (!c || c.pw !== p) throw { code: "bad_credentials", message: "Unrecognised credentials — see the demo accounts below." };
    return { name: c.name, role: c.role };
  }

  async function authStatus() {
    try {
      const r = await fetch("/api/auth/status");
      return await r.json();
    } catch (_) {
      return { configured: false };
    }
  }

  Object.assign(Lib, { apiLogin, authStatus });
})(window);

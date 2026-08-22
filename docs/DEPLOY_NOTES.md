# Deploy notes — making the app show up on griffins1884.org

## What happens on a push to main

GitHub webhook → `scripts/deploy-jpclawhq-main.sh` on the host:
`git pull` → `npm ci` → `npm run build` (tsc) → restart `frc1884-strategy.service`
→ `nginx -t` → reload nginx. Live in ~60s. **This is why we branch + PR: a
broken push takes the site down for everyone.**

## THE catch: /scouting is claimed by an old nginx snippet

The live server block (`deploy/nginx/griffins1884.org.conf`) includes TWO
snippets:

```
include /etc/nginx/snippets/frc1884-scouting.locations.conf;   ← lives ONLY on the server
include /etc/nginx/snippets/frc1884-strategy.locations.conf;   ← shipped by this repo
```

The scouting snippet claims `location /scouting` for the **old** scouting
service, and nginx's more-specific match beats the catch-all proxy to this app.
Consequences after a deploy:

- ✅ `griffins1884.org/scouting2/` → **the new app works immediately** (nothing
  claims that path, so it falls through to this Fastify app — which serves the
  page AND its css/js assets under `/scouting2/*`).
- ❌ `griffins1884.org/scouting` → still the old app, until the snippet is retired.

That's why the landing-page cards point to `/scouting2/`, and why the server
serves the app at both paths with no cross-path redirects.

## Reclaiming /scouting (one-time, on the host, needs sudo)

When the team is ready to retire the old scouting app:

```bash
# 1. stop routing /scouting to the old service
sudo sed -i 's|^\s*include /etc/nginx/snippets/frc1884-scouting.locations.conf;|# &|' \
  /etc/nginx/sites-available/griffins1884.org.conf   # (or wherever the server block lives)
sudo nginx -t && sudo systemctl reload nginx
# 2. flip the two landing cards in public/index.html from /scouting2/ to /scouting/ and push
```

Note: the repo's `deploy/nginx/*.conf` files are **reference copies** — the
deploy script does NOT install them. Any nginx change is a manual host edit.

## Host prerequisites (once, before relying on the features)

- `sudo apt-get install -y ffmpeg` (video frame sampling for /process)
- Env vars in the systemd unit (`deploy/systemd/frc1884-strategy.service`):
  `TBA_API_KEY`, `ANTHROPIC_API_KEY`, `AUTH_SHEET_ID`. All optional — routes
  return 503 with an error_code until set — but the corresponding features are
  dead without them.

## Post-deploy smoke test

```
https://griffins1884.org/                  → 3 cards (Strategy · Scouting · Analyst)
https://griffins1884.org/scouting2/        → login screen, styled (theme.css loaded)
view-source → theme.css/app.css/js paths return 200, not the old app's HTML
https://griffins1884.org/strategy          → unchanged, back button present
```

If `/scouting2/` shows an unstyled page, the assets are being swallowed —
check the browser network tab for which path the CSS/JS requests hit.

# CHANGES — Scouting 2 app + Analyst integration

All changes are additive; nothing in the existing Strategy / Scouting / Brazil
paths was modified. This is the `frc1884-strategy` repo with the new work applied.

## New files
- `public/scouting/index.html` — the Scouting + Analyst app (self-contained,
  no build step, like the strategy page). Served at `/scouting`; `/scouting2`
  301-redirects here for any old links.
- `src/integrations/currentMatch.ts` — current-match detection from the matches table.
- `src/integrations/matchVideo.ts` — AI match-video pipeline (frame sampling +
  Claude vision, grounded on season stats; writes to match_observations /
  analytics_metrics / external_snapshots). Requires ffmpeg + ANTHROPIC_API_KEY.
- `src/integrations/matchVideoDataset.ts` — pulls TBA-linked videos + score
  breakdowns from external_snapshots (calibration foundation).
- `src/integrations/seasonProfile.ts` — 2026 grounding from ingested TBA/Statbotics data.
- `src/integrations/ratings.ts` — mandatory scoring/defence rating vocabulary + scale.
- `src/integrations/zebra.ts` — TBA Zebra MotionWorks ingest (real per-robot paths).
- `src/routes/scout.ts` — endpoints for the scout flow, ratings, analysis, dataset, zebra.

## Edited files
- `src/db/bootstrap.ts` — added three tables (match_recordings, ai_match_analysis,
  scout_robot_ratings) to the existing idempotent schema block.
- `src/server.ts` — registered `scoutVideoRoutes` under `/api`, and added routes
  serving the app at `/scouting` and `/scouting/`; `/scouting2` (+ `/`) are
  301 redirects to `/scouting`. The app **is** the Scouting app.
- `public/index.html` — the Team Apps grid is now **Strategy · Scouting · Analyst**.
  The old (dead) Scouting entry was replaced by this app's content and the
  separate "Scouting 2" card was removed. Scouting and Analyst both link to
  `/scouting` (same app; role decides access).
- `public/strategy/index.html` — added a fixed **← griffins1884.org** back button
  (top-right) that returns to the landing page (`/`).
- `public/scouting/index.html` — added a **← Home** back button in the masthead
  (covers both the Scouting and Analyst sections, since Analyst is a mode within).

### Note on /scouting
`/scouting` now serves this app (there was no `/scouting` route or
`public/scouting/` folder before — the original Scouting app wasn't in this
repo). If a different Scouting app is served for `/scouting` elsewhere in your
production nginx, adjust that instead so the new app wins.

## New API endpoints (all under /api)
```
GET  /api/events/:eventKey/current-match
POST /api/events/:eventKey/recordings
POST /api/recordings/:id/process
POST /api/events/:eventKey/matches/:matchKey/ratings   (mandatory, all 6 robots)
POST /api/recordings/:id/note
GET  /api/events/:eventKey/matches/:matchKey/video-analysis
GET  /api/events/:eventKey/video-dataset
POST /api/events/:eventKey/ingest-zebra
GET  /api/matches/:matchKey/paths
```

## Before you rely on it — important caveats
1. **The app front-end is still a prototype.** `public/scouting/index.html` runs
   client-side with MOCK event data and DEMO, client-side-only logins (see the
   sign-in screen hint). It is a working UX + a preview, NOT secure auth or live
   data yet. To make it real, point its screens at the API endpoints above and
   replace the in-browser login with real server-side auth.
2. **ffmpeg** must be installed on the deploy host for `/process` to work.
3. **ANTHROPIC_API_KEY** and **TBA_API_KEY** must be set (the routes return 503
   when missing). Never commit them.
4. **main auto-deploys.** Merge to `main` only after testing on a branch — a push
   to main triggers the webhook → build → service restart → live.
5. Run `npm run check` (tsc --noEmit) after `npm ci` to confirm types once
   dependencies are installed (they couldn't be installed in the build sandbox).

## Google Sheet login roster (added)
- `src/integrations/authSheet.ts` — fetches the team's roster sheet (CSV export,
  same pattern as scoutSheet.ts), 60s cache, last-good fallback.
- `src/routes/auth.ts` — `POST /api/login`, `GET /api/auth/status`,
  `POST /api/auth/refresh`; registered in server.ts under /api.
- App login now tries `/api/login` first (sheet-backed, role from the sheet) and
  falls back to demo accounts only when no sheet is configured / standalone.
- Setup guide: `docs/AUTH_SHEET_SETUP.md` + template `docs/auth-roster-template.csv`.
- Env var: `AUTH_SHEET_ID` (sheet must be link-viewable). Login returns 503
  until it's set.

## Hashed passwords (added)
- `src/integrations/passwords.ts` — scrypt hashing (salted, embedded params,
  timing-safe verify). No new dependencies (node:crypto).
- `src/integrations/authSheet.ts` login now verifies against the hash; legacy
  plaintext cells still work during migration.
- `POST /api/auth/hash` endpoint, `public/scouting/hash.html` generator page,
  and `npm run hash-password` CLI — three ways to generate a hash to paste
  into the sheet.
- Template + docs updated: the sheet's password column holds `scrypt$...`
  hashes, so a leaked sheet URL no longer leaks passwords.

## Code review round (applied)
- Frontend split into modular files: public/scouting/{index.html, theme.css, app.css, js/*.js} — ten focused scripts loaded in order, no build step. theme.css is the design-token library (colours, fonts, border tokens --bw/--bw-ui/--bw-strong) so values aren't hardcoded per component; login/password inputs now use the shared themed styles.
- Scout onboarding: a four-step 'your job' explainer on the match screen (record -> AI drafts -> mandatory ratings -> optional note).
- PUSH_INSTRUCTIONS.md removed.
- Zebra MotionWorks reframed as opportunistic bonus data (rare at modern events); nothing depends on it.
- docs/ARCHITECTURE.md added: system overview, data flow, module map, honest prototype-vs-production table.
- Filming guide: full how-to-film page from the scout match screen + inline tips on the record screen (non-disruptive details element).
- Deployment fix: the live nginx includes a server-only frc1884-scouting snippet that claims /scouting for the OLD app. The new app now serves fully (page + assets) at /scouting2/ so it appears immediately on push; landing cards point there. docs/DEPLOY_NOTES.md documents the one-time host change to reclaim /scouting.

## Scout filming guide + deployment guarantees (added)
- Filming guide for scouts: a full 'How to film a match' page reachable from the match screen, plus collapsible tips on the record screen itself. Covers framing (whole field, both hubs), no zoom/pan, rolling from before AUTO through END GAME, and why footage quality drives AI-draft quality.
- Deployment made deterministic: the app serves fully at /scouting2/ (page + assets via wildcard) so the new UI appears on griffins1884.org immediately after any merge to main, even while the host's legacy nginx snippet still claims /scouting. docs/DEPLOY_NOTES.md documents the one-time host fix to reclaim /scouting and the post-deploy smoke test.

## Predicted match (added)
- src/integrations/zebraProfiles.ts — per-second AVERAGE LOCATION per team from
  ingested Zebra snapshots, normalised to a canonical red frame (180-degree
  rotation for blue-side matches) so both-colour teams average correctly.
- New endpoints: GET /api/teams/:teamNumber/zebra-profile and
  GET /api/matches/:matchKey/predicted (roster + expected pathways + explicit
  zebra coverage so the UI never passes synthesis off as tracking).
- New analyst tab "Predicted match": pick a match, hit play — each robot runs
  its expected pathway while the predicted score accrues live under the REBUILT
  hub-activation schedule (fuel counts only while the alliance hub is active;
  climbs land in END GAME). Final line shows predicted result + margin, framed
  as an average expectation. Verified: final score exactly conserves each
  alliance's expected fuel + climb; alliances get symmetric scoring seconds.
- Honesty: Zebra remains rare — profiles only exist where ingested; the sim's
  pathways are archetype-informed synthesis and are labelled as such.

## Re-themed to match griffins1884.org (dark navy / gold) — applied
Previously the app used its own light "paper" trackside-telemetry palette,
which looked disconnected from the actual griffins1884.org landing page (dark
navy, glass panels, warm gold, "Avenir Next"). Re-themed to match:

- `theme.css` — full token remap. Notably split `--ink`'s old dual role (it
  was both "body text colour" AND "solid dark badge/button fill", which only
  worked because the background was light) into a dedicated `--text` token
  for readable text, keeping `--ink` for solid dark fills. Page background
  now uses the site's exact navy gradient; cards/panels get a soft shadow.
- `app.css` — every literal `#fff` card background and pastel status tint
  (pills, conf badges, hub table, board editor) replaced with the new
  translucent-on-navy equivalents; same selectors, same structure.
- Fixed a real, pre-existing bug found during the audit: `.field` was reused
  for three unrelated things (the original alliance-grid layout, the
  playback/predicted SVG viewport, and login/RP-calc form-field wrappers),
  so later rules silently clobbered the original one. Split into `.field`
  (grid, original meaning restored), `.fieldsvg` (viewport box), and
  `.formfield` (label+input group) — and gave every `<input>` real styling
  for the first time (previously unstyled, likely the root cause of the
  earlier "login fields aren't themed" issue).
- `js/{content,predicted,strategy,charts,analyst,playback}.js` — every
  hardcoded hex baked into JS-generated SVG (robot squares, chart bars/dots,
  hub-table/board fallback backgrounds, drawing-pen swatches) remapped to the
  new palette, since raw SVG fill attributes can't reference CSS variables.
  Robot-square fills use a slightly richer/darker red+blue tier
  (`#d94433`/`#3857c8`, the latter = the site's own exact banner blue) so
  white team-number text stays legible; small chart/text accents use a
  brighter tier (`#ff6b5c`/`#6fa8ff`) tuned for legibility against navy.
- `hash.html` — separate standalone page, re-themed to match (it doesn't
  import theme.css/app.css).
- Verified: brace-balanced CSS, every JS file syntax-checks, and a full
  headless render pass across all seven analyst tabs (dashboard, playback,
  predicted match, strategy board, past seasons, highlights, team) confirmed
  nothing broke functionally.

## Critical fix — duplicate route caused the server to fail to start
Found a real bug while investigating a report that the app wasn't working:
src/server.ts had TWO separate GET route registrations for the exact same
path (`/scouting2/*`), left over from edits across different sessions.
Fastify throws a FATAL startup error on a duplicate route — meaning if this
made it to a real server, the WHOLE APP (landing page included, not just
/scouting) would fail to boot. Removed the duplicate, kept the single typed
version. Audited server.ts, scout.ts, and auth.ts for any other duplicate
route paths — none found.

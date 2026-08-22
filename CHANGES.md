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

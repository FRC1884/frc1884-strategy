# Architecture — Scouting + Analyst app

This doc explains what the app is, how data flows through it, what's real vs
prototype, and where each piece lives. Read this before changing anything.

## System overview

One Fastify + TypeScript + SQLite server (the existing frc1884-strategy app)
serving three static frontends and a JSON API:

```
  griffins1884.org
  ├── /              landing page            public/index.html
  ├── /strategy      strategy app (React)    public/strategy/
  ├── /scouting      Scouting + Analyst app  public/scouting/   ← this app
  └── /api/...       JSON API                src/routes/
```

`/scouting2` 301-redirects to `/scouting`. No build step anywhere: the strategy
app is Babel-in-browser, this app is plain classic scripts loaded in order.

## The scouting flow (what a scout actually does)

1. **Sign in.** Credentials come from the team's Google Sheet roster
   (`docs/AUTH_SHEET_SETUP.md`). Role `scout` unlocks scouting only; `analyst`
   unlocks scouting + analysis. Passwords in the sheet are scrypt hashes.
2. **The match finds you.** One match runs at a time at an event, so the app
   selects the earliest unscored qual from the `matches` table — no picker.
3. **Record.** The scout's only capture job is to video the match with all six
   robots in frame. (The in-app explainer states this.)
4. **AI drafts.** Server samples frames (ffmpeg) → Claude vision, grounded with
   each robot's season stats → per-robot fuel *estimate*, strengths,
   vulnerabilities, summary, and an ID-confidence flag. Drafts, never truth.
5. **Mandatory ratings.** The scout rates every robot on two axes — scoring and
   defence — from exceptional/good/average/bad/no-evidence. The server rejects
   partial submissions. This human signal is the data the team trusts most.
6. **Optional note** on any standout robot.

## Data flow

```
TBA / Statbotics ──ingest──► external_snapshots (raw) + matches/teams/
                             analytics_metrics (structured)

recording ──ffmpeg frames──► Claude vision ──► ai_match_analysis
                                             + match_observations (source='ai-video')
                                             + analytics_metrics (ai.fuel_estimate)

scout ratings ─────────────► scout_robot_ratings
                             + analytics_metrics (scout.scoring_rating / defence, 4..1,
                               no_evidence excluded, keyed per match so re-rating overwrites)

Google Sheet roster ──60s-cached CSV──► /api/login (scrypt verify) ──► role-gated UI
```

Provenance is a first-class idea: every number carries where it came from
(feed / scout / ai), and the analyst UI shows confidence accordingly. AI
estimates never silently become facts.

## The analyst surfaces

Dashboard (KPIs, RP ranking computed from match data, scoring×defence quadrant,
top scorers, coverage, intel notes) · Field playback (robots replay each match
over the real field image, driven by recorded shift activity) · Predicted match
(robots run their expected per-second average pathways while a predicted score
accrues under REBUILT hub activation; Zebra-derived where ingested, labelled
synthesis elsewhere) · Strategy (a
native reproduction of the strategy app's nine tabs incl. the per-phase board
editor and RP calculators) · Past seasons (team history since 2006) ·
Highlights · Team.

## Backend modules (src/)

```
routes/scout.ts               scouting + analysis + zebra + dataset endpoints
routes/auth.ts                /api/login, /api/auth/{status,refresh,hash}
integrations/currentMatch.ts  earliest-unscored-qual selection + match roster
integrations/matchVideo.ts    ffmpeg frame sampling + grounded Claude vision + persistence
integrations/seasonProfile.ts per-robot season grounding (EPA/OPR/DPR/capabilities)
integrations/ratings.ts       rating vocabulary + numeric scale (single source of truth)
integrations/matchVideoDataset.ts  TBA-linked videos + score breakdowns (calibration)
integrations/zebra.ts         OPPORTUNISTIC Zebra MotionWorks ingest — see note below
integrations/zebraProfiles.ts per-second average-location profiles from zebra data
                              (canonical red-frame normalisation) + predicted-match assembly
integrations/authSheet.ts     Google Sheet roster (cached, active flag)
integrations/passwords.ts     scrypt hash/verify (node:crypto, no deps)
```

### On Zebra MotionWorks — honest status
Zebra has been **rare at events in recent seasons**; most events don't run it.
The ingest is kept because it's cheap (404s harmlessly, fills data only where
present), but nothing depends on it: field playback falls back to scouted
shift-activity, and paths from video would require a fixed calibrated camera
(deliberately not built). Treat Zebra as bonus data, not a plan.

## Frontend structure (public/scouting/)

```
index.html        shell: markup + ordered <script src> tags (no build step)
theme.css         design tokens + shared primitives — change a token, every
                  screen follows (borders: --bw / --bw-ui / --bw-strong)
app.css           feature styles built on the tokens
js/field-image.js embedded field diagram (data URI)
js/data.js        demo data + seeded matches + simulated AI (prototype layer)
js/shell.js       auth, header, top-level render dispatch
js/scout.js       scout flow incl. camera + the mandatory rating grid
js/charts.js      dependency-free SVG charts + aggregation
js/playback.js    field playback engine
js/predicted.js   predicted match: expected pathways + evolving predicted score
js/content.js     past seasons / highlights / team tabs
js/strategy.js    the strategy sub-app (9 tabs)
js/analyst.js     analyst dashboard + team drill-in
js/main.js        boot
```

Classic scripts share the global lexical scope, so load order in index.html is
the dependency order — data before shell before features before main.

## Prototype vs production — read this honestly

| Piece | Status |
|---|---|
| Backend API + schema | Real, typed, idempotent migrations on boot |
| Google-Sheet auth with scrypt hashes | Real (server-side verify) |
| Frontend **login** | Calls `/api/login`; falls back to demo creds only when the sheet isn't configured |
| Frontend **event data** | Still MOCK (js/data.js) — screens are not yet wired to the API endpoints |
| AI video pipeline | Real code; needs ffmpeg + ANTHROPIC_API_KEY on the host |
| Field playback paths | Synthesized from scouted shift data (real Zebra used only if present) |
| Predicted match | Score model real (conserves per-team expectations under hub schedule); pathways synthetic in the sim, Zebra-averaged via /matches/:key/predicted where data exists |

The single biggest remaining task is wiring the frontend screens from
js/data.js mocks to the real /api endpoints.

## Environment

`TBA_API_KEY` · `ANTHROPIC_API_KEY` · `AUTH_SHEET_ID` — all optional; routes
return 503 with an `error_code` until set. Host needs `ffmpeg` for /process.
Merging to `main` auto-deploys to griffins1884.org (~60s), so branch + PR always.

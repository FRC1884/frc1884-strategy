# Scout Data Integration — Newton Spec

**Owner:** Jordi (FRC 1884 Griffins, coach/strategist)
**Target event:** FIRST Championship Newton Division, April 29 – May 2, 2026
**Branch:** `scout-sheet-ingest` (already created, do not merge to `main` without explicit approval from Jordi)
**Status:** spec ready, no code yet

---

## 1. Goal

Build a per-team scout data viewer for the Newton event. When the user taps a team card on the Newton Teams tab or Pit Map, a full-screen modal opens showing every available data point about that team, drawn from up to four data sources, organised across two tabs (Pre-scouting / Houston live). Includes a customizable 5-chip summary header tuned by default for 1884's defender-pick context.

The feature must ship end-to-end (data ingest, server endpoints, frontend UI) without requiring any work from Mariano (team tech lead) on prod infrastructure. TBA OPR integration is in scope as a stub — actual data flow there is gated on Mariano setting an env var post-ship.

---

## 2. Why this matters

1884 cannot climb and is positioning as a third-pick defender. Pick decisions and match strategy depend on knowing which opponents to deny and which alliance partners to suggest. The existing app shows pre-Champs scouting data and tier words but no live data, no EPA breakdown, and no aggregated view per team. This spec closes those gaps.

---

## 3. Repo and infrastructure context

### Critical do-not-break rules

- Repo is `FRC1884/frc1884-strategy` (team org, public). Do not push the TBA API key, Mackensie sheet ID is fine to commit (already public), no other secrets.
- Pushing to `main` auto-deploys to `griffins1884.org/strategy` in 60s via Mariano's webhook. Do not push to main from this branch until user explicitly approves a final commit.
- Production runs Fastify on port 3010 backed by SQLite at `/srv/frc1884-strategy/data/app.db`. Deploy script runs `npm ci && npm run build && systemctl restart`. No bundler step.
- Local dev: `npm run dev` runs Fastify on `http://localhost:3000`. Strategy app at `/strategy`. Edit `public/strategy/griffins-strategy.jsx`, save, hard-refresh browser. Babel-in-browser, no build needed for frontend.
- Existing Brazil event must remain fully functional throughout. The app uses an `EVENTS` registry (line ~888 in JSX) — touching `EVENTS.brazil` or any Brazil-only data structure is out of scope.

### Files of interest

| File | Purpose |
|---|---|
| `public/strategy/griffins-strategy.jsx` | The whole strategy app, ~2219 lines, Babel-compiled in browser |
| `src/server.ts` | Fastify entrypoint, port from `process.env.PORT ?? 3000` |
| `src/db/bootstrap.ts` | SQLite schema, called on server start, idempotent |
| `src/db/client.ts` | DB connection |
| `src/integrations/statbotics.ts` | The reference pattern. Mirror it for new integrations. |
| `src/routes/integrations.ts` | Where new ingest routes go. |
| `src/routes/matches.ts` | `/api/events/:eventKey/matches` already serves Brazil data. |
| `src/routes/helpers.ts` | `hydrateMatchesForEvent` returns matches with alliance team breakdown. |

### Pattern to follow

Statbotics pattern: integration file under `src/integrations/`, route under `src/routes/integrations.ts`, writes raw payload to `external_snapshots`, writes structured rows to existing tables (`teams`, `matches`, `match_alliances`, `match_alliance_teams`, `analytics_metrics`, `pit_observations`, `match_observations`). Always wrap multi-table writes in `db.transaction()`.

---

## 4. Data sources

| Source | What it gives us | Coverage at Newton | Refresh model | Blocked on |
|---|---|---|---|---|
| **Pre-Scouting CSV** | EPA breakdown (auto/teleop/endgame + 3 RP EPAs), capability data (drivetrain, intake, shooter, BPS, climb) | 100% for EPA, ~40% for capability fields, 75 teams | One-time ingest, frozen | Nothing |
| **Mackensie's Google Sheet** | Per-match-per-team observation rows (cycles, climb level, defence, qualitative notes) | Grows as scouts submit, currently empty | Manual refresh button | Nothing |
| **TBA OPR/COPR** | Live Newton OPR after ~30 matches, season COPR before that | All teams once stable | Auto-poll on server when env var is set | `TBA_API_KEY` env var on prod (Mariano sets later) |
| **NEWTON_SCOUT (already in JSX)** | Pre-Champs notes (Adam, Violet, Rish, Darcy), tier word, warn flag | Hand-curated subset | Frozen (in source) | Nothing |

### Source URLs and shapes

**Pre-Scouting CSV** — local file at `/Users/jordi/frc1884-strategy/data/2026_FRC_World_Championship_Public_Pre-Scouting_Database_-_Newton_Division.csv` (Jordi will save it there before running ingest). Multi-line headers — true header is row 4. Empty rows interspersed. 33 columns. Skip rows where col 0 (team number) is blank or non-numeric.

**Mackensie's Sheet** — CSV export, redirect-following:
`https://docs.google.com/spreadsheets/d/1HWL3TAa39k_uPIAFoDrSjsNUR554-9mNVzBdgTqsIBE/export?format=csv`
Headers (row 1, confirmed via `curl -sL`):
1. Timestamp
2. Email Address
3. Team Name (the scout's team)
4. Scout Name
5. Team Number (being scouted)
6. Match Number
7. Alliance
8. How leaves alliance zone (qualitative)
9. Inactive period behaviour (qualitative)
10. Active period behaviour (qualitative)
11. Ferry style (qualitative)
12. Re-entry method (qualitative)
13. Number of Scoring Cycles (numeric)
14. Goes into opposing zone (qualitative)
15. Defence quality (qualitative)
16. Can climb (qualitative)
17. Other notes
18. Difficulties
19. Climb level reached
20. Number of Ferrying Cycles (numeric)

**TBA**:
- Base: `https://www.thebluealliance.com/api/v3`
- Auth header: `X-TBA-Auth-Key: <TBA_API_KEY>`
- Newton event key: `2026new`
- Endpoints:
  - `/event/2026new/oprs`
  - `/event/2026new/coprs`
  - `/event/2026new/matches` (also covers schedule when published)

---

## 5. Locked design decisions (do not re-debate these)

These were resolved across a long design conversation. Do not re-open them.

1. **Modal style:** full-screen, both iPad orientations.
2. **Modal tabs:** two tabs — `[Pre-scouting]` and `[Houston live]`. Last-used tab persists per session via localStorage key `frc-newton-modal-tab` (values: `pre` | `live`).
3. **Summary header:** customizable 5-chip strip. Default chips for 1884's defender-pick context: Defence rating, EPA, Climb, BPS, Last seen. User can override via gear icon, choice persists per device in localStorage key `frc-newton-modal-chips` (array of chip IDs).
4. **Available chips** (18 total):
   - Pre-scouting CSV: EPA, Auto EPA, Teleop EPA, Endgame EPA, Energized RP EPA, Supercharged RP EPA, Traversal RP EPA, Climb level, Shooter type, Hopper capacity, Intake type, BPS, Drivetrain, Trench/Bump preference
   - Mackensie sheet (live): Defence rating, Avg scoring cycles, Avg ferrying cycles, Last scouted at Newton, Climb success rate
5. **Empty state for chips:** chips with no data display "—" plus a small "?" icon. Tapping the ? shows "Not yet scouted" or "Pre-Champs only" tooltip.
6. **Refresh placement:** ↻ button in modal header (refreshes this team's live data) AND ↻ button on Newton Teams tab (refreshes all teams).
7. **Newton Teams card change:** add a small subtle line under the existing tier word: `Live: 4 obs · 1h ago` if scouted, `Pre-Champs only` if not. Card stays compact.
8. **Open Scouting (nfoert's app) is skipped.** No public read API yet, his v2.2 plans it.
9. **Brazil event:** no changes. `EVENTS.brazil` and all Brazil-specific data structures untouched.
10. **The match_id problem:** Mackensie's scouts submit rows with match numbers that may not yet exist in the `matches` table (TBA hasn't published Newton schedule as of spec time). Solution: scout sheet ingest creates "stub" matches with `source = 'scout-pending'`. When TBA later ingests real matches, it upserts on `match_key` and overrides source. No data loss either way.

---

## 6. Build order

Phases ship one at a time. End each phase with a working build that does not break Brazil. Do not start phase N+1 until phase N is verified locally.

### Phase 1 — Pre-Scouting CSV ingest

1. New file `src/integrations/preScouting.ts` exporting `ingestNewtonPreScoutingCsv(filePath: string)` async function.
2. Reads the CSV from disk (skip the multi-line header garbage, real header is row 4, data starts row 5).
3. For each team row:
   - `INSERT OR IGNORE` into `teams` (team_number, name, source='pre-scouting')
   - `INSERT OR IGNORE` into `event_teams` (event_key='2026new', team_number)
   - For each non-empty capability column, write to a new table `team_capabilities` (see schema below)
   - For each EPA column, write to `analytics_metrics` with metric_name `prescouting.epa.<field>`, metric_value as REAL, source_run as ISO timestamp
   - Snapshot full row as JSON to `external_snapshots` provider='pre-scouting'
4. Wrap in transaction. Idempotent — re-running clears prior pre-scouting rows for this event first (`DELETE FROM team_capabilities WHERE event_key='2026new' AND source='pre-scouting'`).
5. New table needed (add to `bootstrap.ts`):
   ```sql
   CREATE TABLE IF NOT EXISTS team_capabilities (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     event_key TEXT NOT NULL,
     team_number INTEGER NOT NULL,
     capability_name TEXT NOT NULL,
     capability_value TEXT,
     source TEXT NOT NULL DEFAULT 'manual',
     observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE (event_key, team_number, capability_name, source),
     FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE,
     FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_team_capabilities_event_team
     ON team_capabilities(event_key, team_number);
   ```
6. New route in `src/routes/integrations.ts`:
   `POST /integrations/pre-scouting/events/:eventKey/ingest`
   Body: `{ filePath: string }`. Returns `{ ok, result: { teamCount, capabilityCount, metricCount } }`.
7. New read route in `src/routes/api.ts`:
   `GET /events/:eventKey/teams/:teamNumber/full` returns combined view: capabilities, all analytics_metrics rows for that team, all match_observations for that team. This is the primary read endpoint the modal will use.
8. **Verify locally** before phase 2: `npm run dev`, then save CSV to `data/`, then `curl -X POST http://localhost:3000/api/integrations/pre-scouting/events/2026new/ingest -H "Content-Type: application/json" -d '{"filePath":"data/2026_FRC_World_Championship_Public_Pre-Scouting_Database_-_Newton_Division.csv"}'`. Then `curl http://localhost:3000/api/events/2026new/teams/5414/full | jq` — expect EPA fields populated.

### Phase 2 — Mackensie sheet ingest

1. New file `src/integrations/scoutSheet.ts` exporting `ingestScoutSheet(eventKey: string)` async function.
2. Fetch CSV via `fetch(SCOUT_SHEET_URL, { redirect: "follow" })`. URL hardcoded constant — sheet is public, ID is fine to commit.
3. CSV parser must handle quoted fields with embedded newlines and commas (basic state machine, not regex).
4. For each row with valid team_number and match_number:
   - `INSERT OR IGNORE` into `teams`
   - `INSERT OR IGNORE` into `event_teams`
   - Ensure stub match exists: `INSERT OR IGNORE INTO matches (match_key, event_key, comp_level, match_number, source) VALUES ('2026new_qm<N>', '2026new', 'qm', <N>, 'scout-pending')`
   - Insert into `match_observations` with phase='teleop' (sheet doesn't separate auto/teleop), source='scout-sheet', notes field is a serialised key-value joined string of all qualitative columns.
5. Before insert, `DELETE FROM match_observations WHERE source='scout-sheet' AND match_id IN (SELECT id FROM matches WHERE event_key='2026new')` so re-running gives clean state.
6. Snapshot to `external_snapshots` provider='scout-sheet'.
7. Add aggregate computations as part of the ingest, written to `analytics_metrics`:
   - `scout.matches_observed` (count)
   - `scout.avg_scoring_cycles` (mean of column 13)
   - `scout.avg_ferrying_cycles` (mean of column 20)
   - `scout.climb_attempts` (count of non-empty col 16)
   - `scout.climb_success_rate` (count of non-empty col 19 / climb_attempts)
8. Route: `POST /integrations/scout-sheet/events/:eventKey/ingest` (no body needed, URL is hardcoded).
9. **Verify locally:** sheet is empty pre-event so test must be tolerant. After ingest, hit it for any 1884 quals once data exists. For now, just confirm the route returns `{ ok: true, result: { rowCount: 0, observationCount: 0 } }` without errors.

### Phase 3 — TBA stub (no code reaches prod yet)

1. New file `src/integrations/tba.ts` exporting `ingestTbaEvent(eventKey: string)` and `ingestTbaOprs(eventKey: string)`.
2. Reads `process.env.TBA_API_KEY`. If undefined, `ingestTbaEvent` and `ingestTbaOprs` throw a typed error `TbaCredentialsMissingError` with a clear message.
3. Fetches `/event/{key}/matches`, `/event/{key}/oprs`, `/event/{key}/coprs`.
4. Maps TBA matches to existing `matches` / `match_alliances` / `match_alliance_teams` tables, mirroring statbotics. `comp_level` filter: only `qm` for now (no playoffs).
5. Maps OPR/COPR fields to `analytics_metrics` with metric_name `tba.opr`, `tba.dpr`, `tba.copr.fuel_total`, `tba.copr.<gameSpecific>` (whatever TBA's COPR endpoint returns for 2026 — log the keys to console on first run, parse defensively).
6. Routes:
   - `POST /integrations/tba/events/:eventKey/ingest-matches`
   - `POST /integrations/tba/events/:eventKey/ingest-oprs`
   - `GET /integrations/tba/status` — returns whether env var is set
7. The route handlers catch `TbaCredentialsMissingError` and return 503 with a clear `error_code: "tba_key_not_configured"`.
8. **Verify locally:** with no env var set, expect 503. With `TBA_API_KEY=... npm run dev`, expect 200 and `external_snapshots` populated.
9. **Do not push the env var to prod.** That's Mariano's task post-ship. Frontend should display "TBA OPR integration: not yet configured" gracefully.

### Phase 4 — Frontend modal

This is the bulk of the work. New JSX in `public/strategy/griffins-strategy.jsx`. Modal must be a separate top-level component (not nested) to avoid the React hooks issue Mariano flagged in earlier debugging notes.

1. Add `apiEventKey: '2026new'` and `apiTimeZone: 'America/Chicago'` to `EVENTS.newton`. This activates the existing `/api/events/:eventKey/matches` integration the JSX already supports. **Important:** before adding this line, verify with curl that `/api/events/2026new/matches` returns sensible data (or empty array). If it errors, hold off on this change until phase 3 ingest has run.

2. New component `<TeamDetailModal teamNumber={...} eventKey={...} onClose={...} />`. Top-level function, not nested. Uses `useState` for active tab, customized chips, modal data fetched via `/api/events/2026new/teams/<n>/full`.

3. Modal structure:
   ```
   <Modal full-screen>
     <Header>
       ← back   ↻ refresh   × close
     </Header>
     <TeamIdentityRow>
       team#  team_name  pit ID  tier word
     </TeamIdentityRow>
     <ChipStrip>
       chip × 5 + ⚙ gear icon (opens chip chooser)
     </ChipStrip>
     <Tabs>
       [Pre-scouting]  [Houston live]
     </Tabs>
     <DetailBody>
       {activeTab === 'pre' ? <PreScoutingPanel/> : <HoustonLivePanel/>}
     </DetailBody>
   </Modal>
   ```

4. **Pre-scouting panel sections (in order):**
   - Capability section: drivetrain, weight, dimensions, intake, hopper capacity, indexer, shooter type, shooter hood, BPS, trench/bump, climb level. Pull from `team_capabilities`. For any blank, fall back to `NEWTON_SCOUT[teamNumber]` if a relevant field exists. If still blank, show "—".
   - EPA breakdown: 7 numeric values from `analytics_metrics` rows where `metric_name LIKE 'prescouting.epa.%'`. Render as labeled grid.
   - Comments: from CSV col 25 if present, otherwise hide section.
   - Pre-Champs scout notes: pulled from existing `NEWTON_SCOUT` object (already in JSX). Render Adam/Violet/Rish/Darcy fields if present.

5. **Houston live panel sections (in order):**
   - Aggregated summary card: "X matches scouted, last refresh Y ago" plus 5 numeric aggregates from `analytics_metrics` `scout.*` rows.
   - Per-observation list: collapsed cards showing match number + scout name + timestamp. Tap to expand, shows all 20 fields.
   - TBA OPR section: pulled from `analytics_metrics` `tba.*`. If empty, show "Live OPR not yet available (needs ~30 matches played and Newton-server config)". Do not show errors to user — this is a known empty state.

6. **Chip chooser modal:** secondary modal that opens over the team modal. List of 18 available chips, current 5 highlighted. User can drag-reorder OR tap to swap. Save to localStorage on close.

7. **Refresh button on Newton Teams tab:** simple button at top right of the tab. On tap, fires `POST /api/integrations/scout-sheet/events/2026new/ingest` then `POST /api/integrations/tba/events/2026new/ingest-oprs` (latter expected to 503 until Mariano configures, swallow that specific error). Then re-fetches the teams list. Show last-refresh timestamp next to button.

8. **Card-level summary line:** existing Newton Teams card and Pit Map cell get one new line: `Live: <n> obs · <relative time>` if `analytics_metrics` has a `scout.matches_observed` row for that team, else `Pre-Champs only`. Subtle, smaller text, doesn't disrupt the existing 3-line pit cell layout.

### Phase 5 — Sanity checks before commit

1. Open `localhost:3000/strategy`, switch to Newton, tap a team that you know has full pre-scouting data (e.g. 5414 Pearadox). Verify modal opens, both tabs render, chips populate, gear icon works.
2. Tap a team with no pre-scouting (one of the ~45 teams missing capability data, e.g. pick from CSV). Verify "Not pit-scouted" empty states render gracefully.
3. Switch to Brazil event. Confirm everything still works exactly as before. No console errors. Schedule tab still loads.
4. Hard-refresh 5 times. No flash of incorrect content. No race conditions where Houston live tab shows Brazil data.
5. iPad simulator (or real iPad) check: modal renders correctly portrait + landscape, chips don't overflow, tap targets are big enough.
6. `npm run check` passes (typecheck only, no compile).
7. `npm run build` passes (full compile). Important: this is what the prod deploy script runs.

### Phase 6 — Commit, then await Jordi's go-ahead

1. Commit on `scout-sheet-ingest` branch only.
2. Commit message convention: `Add Newton scout data viewer (pre-scouting CSV + Mackensie sheet + TBA stub)`.
3. Do NOT merge to main. Do NOT `git push origin main`.
4. Show Jordi the diff. Wait for explicit approval.
5. After approval: `git checkout main && git merge scout-sheet-ingest && git push origin main`. Webhook deploys, ~60s.
6. Verify on `griffins1884.org/strategy` post-deploy.

---

## 7. Out of scope

Explicitly NOT in this PR. Don't quietly add them.

- TBA env var setup on prod (Mariano's task)
- Open Scouting (nfoert's app) integration — skipped, no public API yet
- Per-match strategy panel changes (1884 row still uses Brazil's fuel-input UI, that's tech debt for a future PR)
- Brazil event behaviour — must remain identical
- Statbotics ingest for 2026new (current data is sufficient via pre-scouting CSV)
- Computer vision fuel counting (Project Vector etc.)
- Multi-user auth, account management, scout submission UI (Mackensie's sheet is the entry point, we're just consuming)
- Real-time websockets / push updates — manual refresh button is enough for Day 1

---

## 8. Test commands quick reference

```bash
# Local server
npm run dev   # http://localhost:3000

# Phase 1 verify
curl -X POST http://localhost:3000/api/integrations/pre-scouting/events/2026new/ingest \
  -H "Content-Type: application/json" \
  -d '{"filePath":"data/2026_FRC_World_Championship_Public_Pre-Scouting_Database_-_Newton_Division.csv"}'
curl http://localhost:3000/api/events/2026new/teams/5414/full | jq

# Phase 2 verify
curl -X POST http://localhost:3000/api/integrations/scout-sheet/events/2026new/ingest

# Phase 3 verify (without env var, expect 503)
curl -X POST http://localhost:3000/api/integrations/tba/events/2026new/ingest-oprs

# Phase 3 verify (with env var)
TBA_API_KEY=xxx npm run dev
# in another shell:
curl -X POST http://localhost:3000/api/integrations/tba/events/2026new/ingest-oprs

# Final sanity
npm run check   # typecheck
npm run build   # full compile (matches prod)
```

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Pushing to main breaks live site mid-event | Work on `scout-sheet-ingest` branch only. Explicit approval required to merge. |
| Brazil functionality breaks | Phase 5 sanity check #3 explicitly tests this. Do not modify Brazil-specific code paths. |
| Mackensie's sheet schema changes mid-event | Parser is column-position-based, not name-based. If she renames a column, code keeps working. If she reorders or inserts, parser needs updating but we'd notice immediately on next ingest. |
| TBA key leaks via committed code | Hardcoded constant for sheet URL is fine (public). TBA key is `process.env.TBA_API_KEY` only, never in source. `.env` not committed (already in `.gitignore` — verify). |
| Schedule not yet published when TBA ingest runs | TBA returns empty array. Code handles empty gracefully. No errors. |
| Modal hooks issue from previous debugging notes | Modal MUST be a top-level component. Do not nest it inside another component. |
| Newton apiEventKey activation breaks fallback to PLACEHOLDER_MATCHES | Add `apiEventKey: '2026new'` ONLY after phase 3 ingest succeeds and `/api/events/2026new/matches` returns valid data. |

---

## 10. Done criteria

- [ ] Pre-scouting CSV ingested, all 75 teams have EPA data accessible via `/api/events/2026new/teams/:n/full`
- [ ] Mackensie sheet ingestible (returns 0 results gracefully when empty)
- [ ] TBA route exists and returns 503 with clear error when env var missing
- [ ] TeamDetailModal opens from Newton Teams tab, both tabs render
- [ ] Customizable chip strip works, persists to localStorage
- [ ] Last-used tab persists per session
- [ ] Refresh buttons work
- [ ] Brazil event untouched and fully functional
- [ ] `npm run build` passes
- [ ] No console errors in browser
- [ ] Jordi has reviewed the diff and approved merge to main

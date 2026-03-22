# FRC 1884 Strategy

Fastify + TypeScript + SQLite scaffold for the FRC strategy app.

## Stack

- Fastify for HTTP and API serving
- TypeScript for backend code
- SQLite for low-friction local development
- Static frontend served from `public/`

## Getting started

```bash
npm install
npm run dev
```

The app serves:

- frontend: `http://localhost:3000/`
- health: `http://localhost:3000/api/health`
- events: `http://localhost:3000/api/events`
- teams: `http://localhost:3000/api/events/:eventKey/teams`
- matches: `http://localhost:3000/api/events/:eventKey/matches`
- strategy plans: `http://localhost:3000/api/events/:eventKey/strategy-plans`
- Statbotics ingest: `POST http://localhost:3000/api/integrations/statbotics/events/:eventKey/ingest`

## Current structure

- `public/`: current frontend assets
- `src/server.ts`: Fastify entrypoint
- `src/db/`: SQLite bootstrap and seed logic
- `src/routes/`: API routes
- `data/app.db`: local database file created at runtime

## Notes

- The frontend is still the existing prototype, now served by Fastify.
- The database schema is normalized so scouting, strategy plans, external snapshots, and analytics can move into the backend incrementally.
- `Statbotics` should be added as an upstream ingestion source, not queried directly from the browser.
- The migration path is incremental: keep the current UI working, add server-backed routes, then switch frontend tabs one at a time.

## Production

Deployment assets for `jpclawhq` live in:

- `deploy/systemd/frc1884-strategy.service`
- `deploy/nginx/griffins1884.org.conf`
- `scripts/deploy-jpclawhq.sh`
- `docs/deploy-jpclawhq.md`

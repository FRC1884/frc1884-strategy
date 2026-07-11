# How to push this to your fork

I can't push to GitHub from here (no network / no auth), so this folder is the
`frc1884-strategy` repo with all changes already applied. Push it to
`gateway0311-gif/frc1884-strategy` like this.

## If you already forked on GitHub (you have: gateway0311-gif/frc1884-strategy)

```bash
# 1. clone YOUR fork somewhere
git clone https://github.com/gateway0311-gif/frc1884-strategy.git
cd frc1884-strategy

# 2. create a branch (do NOT commit straight to main — main auto-deploys)
git checkout -b scouting2-app

# 3. copy the contents of THIS package over your clone, overwriting.
#    (from the unzipped folder — everything except .git)
#    e.g. on macOS/Linux, from inside the unzipped folder:
#    rsync -a --exclude '.git' ./ /path/to/your/frc1884-strategy/

# 4. review, then commit + push
git add -A
git status                     # confirm only the intended files changed
git commit -m "Add Scouting 2 app + Analyst, backend modules, and landing tiles"
git push -u origin scouting2-app
```

Then open a Pull Request on GitHub from `scouting2-app` → `main`, review the
diff, and merge **only after testing** (merging to main auto-deploys to
griffins1884.org in ~60s).

## Verify locally before merging
```bash
npm ci
npm run check        # tsc --noEmit — should pass
npm run dev          # start the server
# visit http://localhost:<PORT>/            → landing page shows Scouting 2 + Analyst cards
# visit http://localhost:<PORT>/scouting    → the app (login screen)
# visit http://localhost:<PORT>/scouting2   → 301 redirect to /scouting
# visit http://localhost:<PORT>/strategy    → confirm nothing existing broke
```

## Files changed (see CHANGES.md for detail)
- added: `public/scouting/index.html`, six `src/integrations/*.ts`, `src/routes/scout.ts`, `CHANGES.md`
- edited: `src/db/bootstrap.ts`, `src/server.ts`, `public/index.html`

## Reminder
The app front-end is a working prototype with mock data + demo client-side
logins. It's safe to ship as a preview, but wire it to the new /api endpoints and
add real server-side auth before treating its data or access control as real.

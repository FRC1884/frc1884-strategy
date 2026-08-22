# Auth roster Google Sheet — setup (≈2 minutes)

The app's logins are managed in a Google Sheet you own. You edit the sheet to
add/remove people, set their passwords, and choose their access (scout or
analyst). The server reads the sheet; no redeploy needed when you change it.

## 1. Create the sheet

While signed in as **shivansingh0311@gmail.com** (so you have edit access as the
owner), go to sheets.new and either:
- import the template file `docs/auth-roster-template.csv` (File → Import →
  Upload → Replace spreadsheet), or
- type the header row yourself.

The sheet's first tab must have these columns, in this order:

| name  | username | password  | role    | active |
|-------|----------|-----------|---------|--------|
| Shivan Singh | shivan | pick-a-password | analyst | yes |
| Maya Example | maya   | pick-a-password | scout   | yes |

Column rules:
- **username** — what they type to log in (case-insensitive). Required.
- **password** — an **scrypt hash**, not the password itself. Generate it one
  of three ways, then paste the `scrypt$...` string into this column and give
  the person their password privately:
  1. open `/scouting/hash.html` while the app is running (easiest),
  2. `npm run hash-password -- "the-password"` in the repo,
  3. `curl -X POST localhost:3000/api/auth/hash -H "content-type: application/json" -d "{\"password\":\"the-password\"}"`.
  (Legacy plaintext cells still work during migration, but defeat the point —
  convert them.)
- **role** — exactly `scout` or `analyst`. Anything else = the row grants no
  access. `analyst` unlocks scouting + analysis; `scout` unlocks scouting only.
- **active** — `yes`/`no`. Blank counts as yes. Set `no` to disable someone
  without deleting the row.

(If someone else creates the sheet instead: Share → add
shivansingh0311@gmail.com as **Editor**.)

## 2. Make it readable by the server

Share → General access → **Anyone with the link: Viewer**.
This is what lets the server fetch it via the CSV export URL — same mechanism
the scout/pit sheets already use.

## 3. Point the server at it

Copy the sheet ID from its URL — the long string between `/d/` and `/edit`:
`https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit#gid=0`

Set it as an environment variable where the server runs:
```
AUTH_SHEET_ID=THIS_PART
```
(locally: `AUTH_SHEET_ID=... npm run dev`; in production: add it to the systemd
unit's Environment= lines next to TBA_API_KEY / ANTHROPIC_API_KEY.)

## 4. That's it — how it behaves

- Login screen posts to `/api/login`; the server checks the sheet and returns
  the person's name + role. Analysts see the Analyst toggle; scouts don't.
- The roster is cached for 60s, so edits appear within a minute — or hit
  `POST /api/auth/refresh` to apply instantly.
- If `AUTH_SHEET_ID` isn't set (or the app is opened as a standalone file), the
  app falls back to the built-in demo accounts and says so on the login screen.

## Security — what hashing does and doesn't fix

The password column now holds **scrypt hashes** (salted, memory-hard, verified
in constant time). If the sheet URL leaks, the hashes can't practically be
turned back into passwords — a big upgrade over plaintext. Remaining honest
caveats:
- the sheet still controls **access**: anyone who can *edit* it can add
  themselves a login, so keep edit access tight (owner + trusted editors only);
- passwords travel to the server on login as usual — fine over HTTPS
  (griffins1884.org), don't run this on plain http in production;
- legacy plaintext cells are accepted for migration convenience; convert them,
  then treat any remaining plaintext row as the vulnerability it is.

// Creates a made-up event whose schedule straddles the current time, so the
// hub can be tried out end to end without a real competition:
//
//   npm run seed:demo
//
// It only touches the event "2026demo" and makes it the active event.
import { db } from "../src/db/client.js";
import { setSetting } from "../src/hub/settings.js";
import { saveManualMatch } from "../src/hub/schedule.js";

const EVENT = "2026demo";
const TEAMS: Array<[number, string]> = [
  [1884, "Griffins"], [148, "Robowranglers"], [254, "The Cheesy Poofs"], [341, "Miss Daisy"], [604, "Quixilver"], [868, "TechHOUNDS"],
  [930, "Mukwonago BEARs"], [973, "Greybots"], [1323, "MadTown Robotics"], [1678, "Citrus Circuits"], [1796, "RoboTigers"], [2056, "OP Robotics"],
  [2067, "Apple Pi"], [2910, "Jack in the Bot"], [3005, "RoboChargers"], [3310, "Black Hawk Robotics"], [4414, "HighTide"], [5414, "Pearadox"],
  [5736, "Kingsmen Robotics"], [6036, "Peninsula Robotics"], [6328, "Mechanical Advantage"], [8046, "LakerBots"], [9128, "ITKAN Robotics"], [10935, "Krono"],
];
const MATCHES = 40;
const SPACING_MIN = 8;
const PLAYED = 4;

// Small repeatable random number generator so the demo looks the same each time.
let seed = 1884;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

db.transaction(() => {
  db.prepare(`DELETE FROM events WHERE event_key = ?`).run(EVENT);
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO events (event_key, name, season, location, start_date, end_date, source, game_id)
     VALUES (?, 'Demo event', 2026, 'Made-up data for trying the hub', ?, ?, 'demo', 'rebuilt2026')`
  ).run(EVENT, today, today);
  for (const [number, name] of TEAMS) {
    db.prepare(
      `INSERT INTO teams (team_number, name, source) VALUES (?, ?, 'demo')
       ON CONFLICT(team_number) DO UPDATE SET name = CASE WHEN teams.name LIKE 'Team %' THEN excluded.name ELSE teams.name END`
    ).run(number, name);
    db.prepare(`INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)`).run(EVENT, number);
  }
})();

const start = Date.now() - (PLAYED * SPACING_MIN - 3) * 60_000;
const numbers = TEAMS.map(([n]) => n);
for (let i = 0; i < MATCHES; i++) {
  const pool = [...numbers].sort(() => random() - 0.5).slice(0, 6);
  const plannedAt = new Date(start + i * SPACING_MIN * 60_000).toISOString();
  const matchKey = saveManualMatch(EVENT, { compLevel: "qm", matchNumber: i + 1, plannedAt, red: pool.slice(0, 3), blue: pool.slice(3) });
  db.prepare(`UPDATE matches SET source = 'demo' WHERE match_key = ?`).run(matchKey);
  if (i < PLAYED) {
    const red = 60 + Math.round(random() * 120);
    const blue = 60 + Math.round(random() * 120);
    db.prepare(`UPDATE matches SET red_score = ?, blue_score = ?, actual_at = ? WHERE match_key = ?`).run(red, blue, plannedAt, matchKey);
  }
}

setSetting("active_event_key", EVENT);
console.log(`Demo event ready: ${TEAMS.length} teams, ${MATCHES} matches, ${PLAYED} already played. Open /hub.`);

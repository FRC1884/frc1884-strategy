import type Database from "better-sqlite3";

import { seedEvent, seedMatches, seedTeams } from "../data/seedData.js";

export function seedInitialData(db: Database.Database): void {
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, start_date, end_date, source)
      VALUES (@eventKey, @name, @season, @location, @startDate, @endDate, @source)
      ON CONFLICT(event_key) DO NOTHING
    `).run(seedEvent);

    for (const team of seedTeams) {
      db.prepare(`
        INSERT INTO teams (team_number, name, location, country, source)
        VALUES (?, ?, ?, ?, 'manual')
        ON CONFLICT(team_number) DO UPDATE SET
          name = excluded.name,
          location = excluded.location,
          country = excluded.country,
          updated_at = CURRENT_TIMESTAMP
      `).run(team.teamNumber, team.name, team.location, team.country);

      db.prepare(`
        INSERT OR IGNORE INTO event_teams (event_key, team_number)
        VALUES (?, ?)
      `).run(seedEvent.eventKey, team.teamNumber);
    }

    for (const match of seedMatches) {
      db.prepare(`
        INSERT INTO matches (match_key, event_key, comp_level, match_number, scheduled_at, source)
        VALUES (?, ?, ?, ?, ?, 'manual')
        ON CONFLICT(match_key) DO UPDATE SET
          event_key = excluded.event_key,
          comp_level = excluded.comp_level,
          match_number = excluded.match_number,
          scheduled_at = excluded.scheduled_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        match.matchKey,
        match.eventKey,
        match.compLevel,
        match.matchNumber,
        match.scheduledAt
      );

      const matchRow = db.prepare(`SELECT id FROM matches WHERE match_key = ?`).get(match.matchKey) as {
        id: number;
      };

      const allianceData = [
        { color: "red", teams: match.redTeams, ourStation: match.ourAlliance === "red" ? match.ourStation : null },
        { color: "blue", teams: match.blueTeams, ourStation: match.ourAlliance === "blue" ? match.ourStation : null }
      ] as const;

      for (const alliance of allianceData) {
        db.prepare(`
          INSERT INTO match_alliances (match_id, alliance_color, station)
          VALUES (?, ?, ?)
          ON CONFLICT(match_id, alliance_color) DO UPDATE SET
            station = excluded.station
        `).run(matchRow.id, alliance.color, alliance.ourStation);

        const allianceRow = db
          .prepare(`
            SELECT id
            FROM match_alliances
            WHERE match_id = ? AND alliance_color = ?
          `)
          .get(matchRow.id, alliance.color) as { id: number };

        db.prepare(`DELETE FROM match_alliance_teams WHERE alliance_id = ?`).run(allianceRow.id);

        alliance.teams.forEach((teamNumber, index) => {
          db.prepare(`
            INSERT INTO match_alliance_teams (alliance_id, team_number, station)
            VALUES (?, ?, ?)
          `).run(allianceRow.id, teamNumber, index + 1);
        });
      }
    }
  });

  transaction();
}

import type Database from "better-sqlite3";

export function bootstrapDatabase(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      season INTEGER NOT NULL,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      team_number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      country TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_teams (
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_key, team_number),
      FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE,
      FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_key TEXT NOT NULL UNIQUE,
      event_key TEXT NOT NULL,
      comp_level TEXT NOT NULL,
      match_number INTEGER NOT NULL,
      scheduled_at TEXT,
      red_score INTEGER,
      blue_score INTEGER,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS match_alliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      alliance_color TEXT NOT NULL CHECK (alliance_color IN ('red', 'blue')),
      station INTEGER,
      score INTEGER,
      ranking_points INTEGER,
      UNIQUE (match_id, alliance_color),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS match_alliance_teams (
      alliance_id INTEGER NOT NULL,
      team_number INTEGER NOT NULL,
      station INTEGER NOT NULL,
      PRIMARY KEY (alliance_id, station),
      UNIQUE (alliance_id, team_number),
      FOREIGN KEY (alliance_id) REFERENCES match_alliances(id) ON DELETE CASCADE,
      FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pit_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL,
      team_number INTEGER NOT NULL,
      scouter TEXT,
      stars INTEGER,
      avg_fuel INTEGER,
      climb_capability TEXT,
      warning_flag INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE,
      FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS match_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      team_number INTEGER NOT NULL,
      phase TEXT NOT NULL,
      scouter TEXT,
      fuel_scored INTEGER,
      climb_points INTEGER,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS strategy_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL,
      match_id INTEGER,
      scope TEXT NOT NULL CHECK (scope IN ('scheduled_match', 'free_play')),
      title TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS strategy_plan_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('auto', 'teleop')),
      data_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES strategy_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS external_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      UNIQUE (provider, entity_type, entity_key, fetched_at)
    );

    CREATE TABLE IF NOT EXISTS analytics_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT,
      team_number INTEGER,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      source_run TEXT NOT NULL,
      computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_key, team_number, metric_name, source_run),
      FOREIGN KEY (event_key) REFERENCES events(event_key) ON DELETE CASCADE,
      FOREIGN KEY (team_number) REFERENCES teams(team_number) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_matches_event_key ON matches(event_key);
    CREATE INDEX IF NOT EXISTS idx_match_alliances_match_id ON match_alliances(match_id);
    CREATE INDEX IF NOT EXISTS idx_pit_observations_event_team ON pit_observations(event_key, team_number);
    CREATE INDEX IF NOT EXISTS idx_match_observations_match_team ON match_observations(match_id, team_number);
    CREATE INDEX IF NOT EXISTS idx_strategy_plans_event_match ON strategy_plans(event_key, match_id);
    CREATE INDEX IF NOT EXISTS idx_external_snapshots_provider_entity ON external_snapshots(provider, entity_type, entity_key);
    CREATE INDEX IF NOT EXISTS idx_analytics_metrics_event_team ON analytics_metrics(event_key, team_number);
  `);
}

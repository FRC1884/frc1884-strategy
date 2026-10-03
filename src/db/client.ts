import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { bootstrapDatabase } from "./bootstrap.js";
import { runMigrations } from "./migrations.js";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

if (databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

export const db = new Database(databasePath);

bootstrapDatabase(db);
runMigrations(db);

export { databasePath };

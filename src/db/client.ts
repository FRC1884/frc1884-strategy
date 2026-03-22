import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { bootstrapDatabase } from "./bootstrap.js";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);

bootstrapDatabase(db);

export { databasePath };

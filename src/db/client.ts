import path from "node:path";
import Database from "better-sqlite3";

import { bootstrapDatabase } from "./bootstrap.js";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

export const db = new Database(databasePath);

bootstrapDatabase(db);

export { databasePath };

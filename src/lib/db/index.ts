import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const dbPath =
  process.env.DATABASE_PATH || join(process.cwd(), "data", "research-ai.db");

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>>;
};

if (!globalForDb.db) {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Auto-run migrations to create/update tables
  const migrationsFolder = join(process.cwd(), "drizzle", "migrations");
  if (existsSync(migrationsFolder)) {
    try {
      migrate(db, { migrationsFolder });
    } catch (e: unknown) {
      // If tables already exist (DB was created via drizzle-kit push), that's fine
      const msg = e instanceof Error
        ? (e.message + (e.cause instanceof Error ? " " + e.cause.message : ""))
        : String(e);
      if (!msg.includes("already exists")) {
        throw e;
      }
    }
  }

  globalForDb.db = db;
}

export const db = globalForDb.db;

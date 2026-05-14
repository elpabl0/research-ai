import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  db?: DrizzleDb;
};

function initDb(): DrizzleDb {
  if (globalForDb.db) return globalForDb.db;

  const dbPath =
    process.env.DATABASE_PATH || join(process.cwd(), "data", "research-ai.db");
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const drizzleDb = drizzle(sqlite, { schema });

  const migrationsFolder = join(process.cwd(), "drizzle", "migrations");
  if (existsSync(migrationsFolder)) {
    try {
      migrate(drizzleDb, { migrationsFolder });
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? (e.message + (e.cause instanceof Error ? " " + e.cause.message : ""))
        : String(e);
      if (!msg.includes("already exists")) {
        throw e;
      }
    }
  }

  globalForDb.db = drizzleDb;
  return drizzleDb;
}

// Lazy proxy: importing this module does NOT open SQLite. The DB handle is
// created on first property access. This avoids `next build`'s page-data
// collection workers racing to acquire the migration lock (SQLITE_BUSY).
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(initDb() as object, prop, receiver);
  },
}) as DrizzleDb;

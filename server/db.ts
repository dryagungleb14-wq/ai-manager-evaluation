// Integration: blueprint:javascript_database
import * as schema from "./shared/schema.js";

const isLocalDev = !process.env.DATABASE_URL;

export interface DatabaseClient {
  select: (...args: unknown[]) => any;
  insert: (...args: unknown[]) => any;
  update: (...args: unknown[]) => any;
  delete: (...args: unknown[]) => any;
}

async function createLocalDatabase(): Promise<DatabaseClient> {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  const sqlite = new Database("local.db");
  const client = drizzle(sqlite, { schema }) as unknown as DatabaseClient;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      team_lead TEXT,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0',
      items TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER,
      manager_id INTEGER,
      source TEXT NOT NULL CHECK (source IN ('call', 'correspondence')),
      language TEXT NOT NULL DEFAULT 'ru',
      transcript TEXT NOT NULL,
      checklist_report TEXT NOT NULL,
      objections_report TEXT NOT NULL,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id),
      FOREIGN KEY (manager_id) REFERENCES managers(id)
    );
  `);

  return client;
}

async function createRemoteDatabase(): Promise<DatabaseClient> {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const ws = await import("ws");

  neonConfig.webSocketConstructor = ws.default;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle({ client: pool, schema }) as unknown as DatabaseClient;
}

const databasePromise: Promise<DatabaseClient> = (isLocalDev ? createLocalDatabase() : createRemoteDatabase())
  .catch((error) => {
    console.error("Failed to initialize database", error);
    throw error;
  });

export const dbPromise = databasePromise;

export function getDatabase(): Promise<DatabaseClient> {
  return databasePromise;
}

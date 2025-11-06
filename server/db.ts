// Integration: blueprint:javascript_database
import * as schema from "./shared/schema.js";
import { logger } from "./utils/logger.js";

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

  // Don't pass schema to drizzle for SQLite - it uses PostgreSQL-specific functions
  const client = drizzle(sqlite) as unknown as DatabaseClient;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      source TEXT NOT NULL CHECK (source IN ('call', 'correspondence')),
      language TEXT NOT NULL DEFAULT 'ru',
      text TEXT NOT NULL,
      audio_file_name TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      checklist_id INTEGER,
      manager_id INTEGER,
      transcript_id INTEGER,
      source TEXT NOT NULL CHECK (source IN ('call', 'correspondence')),
      language TEXT NOT NULL DEFAULT 'ru',
      transcript TEXT NOT NULL,
      checklist_report TEXT NOT NULL,
      objections_report TEXT NOT NULL,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (checklist_id) REFERENCES checklists(id),
      FOREIGN KEY (manager_id) REFERENCES managers(id),
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
    );
    CREATE TABLE IF NOT EXISTS advanced_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS checklist_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id)
    );
    CREATE TABLE IF NOT EXISTS checklist_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL,
      number TEXT,
      title TEXT NOT NULL,
      description TEXT,
      weight INTEGER NOT NULL,
      is_binary BOOLEAN DEFAULT 0,
      levels TEXT,
      FOREIGN KEY (stage_id) REFERENCES checklist_stages(id)
    );
    CREATE TABLE IF NOT EXISTS checklist_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      changes TEXT,
      user_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id)
    );
    CREATE TABLE IF NOT EXISTS advanced_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      checklist_id INTEGER,
      manager_id INTEGER,
      transcript_id INTEGER,
      source TEXT NOT NULL CHECK (source IN ('call', 'correspondence')),
      language TEXT NOT NULL DEFAULT 'ru',
      transcript TEXT NOT NULL,
      report TEXT NOT NULL,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id),
      FOREIGN KEY (manager_id) REFERENCES managers(id),
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
    );
    CREATE TABLE IF NOT EXISTS session (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire DATETIME NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
  `);

  // Run migrations to add missing columns
  try {
    // Check if transcript_id column exists in advanced_analyses
    const tableInfo = sqlite.pragma("table_info(advanced_analyses)") as Array<{ name: string }>;
    const hasTranscriptId = tableInfo.some((col: { name: string }) => col.name === 'transcript_id');
    
    if (!hasTranscriptId) {
      sqlite.exec(`
        ALTER TABLE advanced_analyses ADD COLUMN transcript_id INTEGER REFERENCES transcripts(id);
      `);
      console.log("Added transcript_id column to advanced_analyses table");
    }
  } catch (migrationError) {
    console.log("Migration info:", migrationError instanceof Error ? migrationError.message : migrationError);
  }

  return client;
}

async function createRemoteDatabase(): Promise<DatabaseClient> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Create tables directly for PostgreSQL
    console.log("Creating database tables for PostgreSQL...");
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS managers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          email VARCHAR(255),
          team_lead VARCHAR(255),
          department VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS checklists (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL DEFAULT '1.0',
          items TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS transcripts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          source VARCHAR(50) NOT NULL CHECK (source IN ('call', 'correspondence')),
          language VARCHAR(10) NOT NULL DEFAULT 'ru',
          text TEXT NOT NULL,
          audio_file_name VARCHAR(255),
          duration INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS analyses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          checklist_id INTEGER,
          manager_id INTEGER,
          transcript_id INTEGER,
          source VARCHAR(50) NOT NULL CHECK (source IN ('call', 'correspondence')),
          language VARCHAR(10) NOT NULL DEFAULT 'ru',
          transcript TEXT NOT NULL,
          checklist_report TEXT NOT NULL,
          objections_report TEXT NOT NULL,
          analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (checklist_id) REFERENCES checklists(id),
          FOREIGN KEY (manager_id) REFERENCES managers(id),
          FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
        );
        CREATE TABLE IF NOT EXISTS advanced_checklists (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          total_score INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS checklist_stages (
          id SERIAL PRIMARY KEY,
          checklist_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          "order" INTEGER NOT NULL,
          FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id)
        );
        CREATE TABLE IF NOT EXISTS checklist_criteria (
          id SERIAL PRIMARY KEY,
          stage_id INTEGER NOT NULL,
          number VARCHAR(50),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          weight INTEGER NOT NULL,
          is_binary BOOLEAN DEFAULT false,
          levels JSONB,
          FOREIGN KEY (stage_id) REFERENCES checklist_stages(id)
        );
        CREATE TABLE IF NOT EXISTS checklist_history (
          id SERIAL PRIMARY KEY,
          checklist_id INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          changes JSONB,
          user_id VARCHAR(255),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id)
        );
        CREATE TABLE IF NOT EXISTS advanced_analyses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          checklist_id INTEGER,
          manager_id INTEGER,
          transcript_id INTEGER,
          source VARCHAR(50) NOT NULL CHECK (source IN ('call', 'correspondence')),
          language VARCHAR(10) NOT NULL DEFAULT 'ru',
          transcript TEXT NOT NULL,
          report JSONB NOT NULL,
          analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (checklist_id) REFERENCES advanced_checklists(id),
          FOREIGN KEY (manager_id) REFERENCES managers(id),
          FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
        );
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR(255) PRIMARY KEY,
          sess TEXT NOT NULL,
          expire TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
      `);
      console.log("Database tables created successfully");
    } catch (tableError) {
      console.log("Table creation info:", tableError instanceof Error ? tableError.message : tableError);
    }

    // Run migrations to add missing columns
    console.log("Running database migrations...");
    try {
      // Migration: Add transcript_id to advanced_analyses if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'advanced_analyses'
                AND column_name = 'transcript_id'
            ) THEN
                ALTER TABLE advanced_analyses
                ADD COLUMN transcript_id INTEGER REFERENCES transcripts(id);
                
                RAISE NOTICE 'Column transcript_id added to advanced_analyses table';
            END IF;
        END $$;
      `);
      console.log("Database migrations completed successfully");
    } catch (migrationError) {
      console.log("Migration info:", migrationError instanceof Error ? migrationError.message : migrationError);
    }

    const client = drizzle({
      client: pool,
      schema
    }) as unknown as DatabaseClient;

    return client;
  } catch (error) {
    logger.dbConnectionError(error, process.env.DATABASE_URL);
    throw error;
  }
}

const databasePromise: Promise<DatabaseClient> = (
  isLocalDev ? createLocalDatabase() : createRemoteDatabase()
).catch((error) => {
  logger.error("db", error, {
    operation: "database initialization",
    isLocalDev
  });
  throw error;
});

export const dbPromise = databasePromise;

export function getDatabase(): Promise<DatabaseClient> {
  return databasePromise;
}

/**
 * SQLite Database Connection
 * Creates and manages the database connection using better-sqlite3 and Kysely
 */

import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Database } from './schema';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { app } from 'electron';

let db: Kysely<Database> | null = null;

/**
 * Get the user data directory path
 */
export function getUserDataPath(): string {
  // Use Electron's app.getPath('userData') if available
  if (app && app.getPath) {
    return app.getPath('userData');
  }
  // Fallback for development
  return join(process.cwd(), 'data');
}

/**
 * Get or create the database connection
 */
export function getDatabase(): Kysely<Database> {
  if (db) return db;

  // Database file location (in user data directory)
  const dbPath = join(getUserDataPath(), 'artemis.db');

  // Ensure the directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new SQLite(dbPath);
  
  // Enable WAL mode for better concurrency
  sqlite.pragma('journal_mode = WAL');
  
  db = new Kysely<Database>({
    dialect: new SqliteDialect({
      database: sqlite,
    }),
  });

  return db;
}

/**
 * Initialize database tables
 */
export async function initializeDatabase(): Promise<void> {
  const database = getDatabase();

  // Create users table
  await database.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('discord_webhook_url', 'text')
    .addColumn('share_gps', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('gps_visibility', 'text', (col) => col.notNull().defaultTo('off'))
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Create sessions table
  await database.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('start_time', 'integer', (col) => col.notNull())
    .addColumn('end_time', 'integer')
    .addColumn('duration', 'integer', (col) => col.notNull())
    .addColumn('loadout_id', 'text')
    .addColumn('stats', 'text') // JSON - calculated session statistics
    .addColumn('tags', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('notes', 'text')
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Create events table
  await database.schema
    .createTable('events')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('session_id', 'text', (col) => col.notNull().references('sessions.id').onDelete('cascade'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'integer', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .execute();

  // Create loadouts table
  await database.schema
    .createTable('loadouts')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('weapon_id', 'text')
    .addColumn('armor_set', 'text')
    .addColumn('data', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  // Create indexes for better query performance
  await database.schema
    .createIndex('idx_users_username')
    .ifNotExists()
    .on('users')
    .column('username')
    .execute();

  await database.schema
    .createIndex('idx_sessions_user_id')
    .ifNotExists()
    .on('sessions')
    .column('user_id')
    .execute();

  await database.schema
    .createIndex('idx_sessions_start_time')
    .ifNotExists()
    .on('sessions')
    .column('start_time')
    .execute();

  await database.schema
    .createIndex('idx_events_session_id')
    .ifNotExists()
    .on('events')
    .column('session_id')
    .execute();

  await database.schema
    .createIndex('idx_events_timestamp')
    .ifNotExists()
    .on('events')
    .column('timestamp')
    .execute();

  // Run migrations to update existing databases
  await runMigrations(database);
}

/**
 * Run database migrations for existing databases
 */
async function runMigrations(database: Kysely<Database>): Promise<void> {
  // Migration: Add stats column to sessions table if it doesn't exist
  try {
    // Use sql tagged template to check table schema
    const result = await sql`PRAGMA table_info(sessions)`.execute(database);
    
    const hasStatsColumn = result.rows.some((col: any) => col.name === 'stats');
    
    if (!hasStatsColumn) {
      console.log('[DB Migration] Adding stats column to sessions table...');
      await database.schema
        .alterTable('sessions')
        .addColumn('stats', 'text')
        .execute();
      console.log('[DB Migration] ✅ Stats column added');
    }
  } catch (error) {
    console.error('[DB Migration] Failed to add stats column:', error);
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.destroy();
    db = null;
  }
}

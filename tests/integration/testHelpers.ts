import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Database as DBSchema } from '../../src/infra/db/schema';
import { SessionService } from '../../src/core/services/SessionService';
import { Session } from '../../src/core/types/Session';

/**
 * Creates an in-memory SQLite database for testing
 * Runs all migrations automatically
 */
export async function createTestDatabase(): Promise<Kysely<DBSchema>> {
  const sqlite = new Database(':memory:');
  
  const db = new Kysely<DBSchema>({
    dialect: new SqliteDialect({
      database: sqlite,
    }),
  });

  // Initialize schema (same as connection.ts but for in-memory DB)
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('start_time', 'integer', (col) => col.notNull())
    .addColumn('end_time', 'integer')
    .addColumn('duration', 'integer', (col) => col.notNull())
    .addColumn('loadout_id', 'text')
    .addColumn('tags', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('notes', 'text')
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('events')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('session_id', 'text', (col) => col.notNull().references('sessions.id').onDelete('cascade'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'integer', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
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

  return db;
}

/**
 * Clears all data from test database
 */
export async function clearDatabase(db: Kysely<DBSchema>): Promise<void> {
  await db.deleteFrom('events').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('loadouts').execute();
}

/**
 * Seeds test database with sample sessions
 */
export async function seedSessions(db: Kysely<DBSchema>, count: number = 5) {
  const sessions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const session = {
      id: `test-session-${i}`,
      name: `Test Session ${i}`,
      user_id: 'test-user',
      start_time: now - (count - i) * 3600000, // Spread over hours
      end_time: now - (count - i - 1) * 3600000,
      duration: 3600, // 1 hour
      loadout_id: null,
      tags: JSON.stringify(['test']),
      notes: `Test session ${i}`,
      version: '2.0',
    };

    await db.insertInto('sessions').values(session).execute();
    sessions.push(session);

    // Add some test events
    for (let j = 0; j < 10; j++) {
      await db
        .insertInto('events')
        .values({
          id: `event-${i}-${j}`,
          session_id: session.id,
          type: 'SHOT_FIRED',
          timestamp: session.start_time + j * 1000,
          payload: JSON.stringify({ weaponId: 'test-weapon', ammoCost: 0.1 }),
          created_at: session.start_time + j * 1000,
        })
        .execute();
    }
  }

  return sessions;
}

/**
 * Seeds test database with sample loadouts
 */
export async function seedLoadouts(db: Kysely<DBSchema>, count: number = 3) {
  const loadouts = [];

  for (let i = 0; i < count; i++) {
    const loadout = {
      id: `test-loadout-${i}`,
      name: `Test Loadout ${i}`,
      user_id: 'test-user',
      weapon_id: `weapon-${i}`,
      armor_set: `armor-${i}`,
      data: JSON.stringify({
        weapon: {
          id: `weapon-${i}`,
          name: `Test Weapon ${i}`,
          damage: 10 + i * 5,
        },
        armor: {
          id: `armor-${i}`,
          name: `Test Armor ${i}`,
          defense: 20 + i * 10,
        },
        costs: {
          totalPerShot: 0.1 + i * 0.05,
          ammoPerShot: 0.05,
          decayPerShot: 0.05,
        },
      }),
      created_at: Date.now() - (count - i) * 86400000,
      updated_at: Date.now() - (count - i) * 86400000,
    };

    await db.insertInto('loadouts').values(loadout).execute();
    loadouts.push(loadout);
  }

  return loadouts;
}

/**
 * Creates a test session with events
 */
export function createTestSession(): Session {
  // Create a basic session using SessionService
  const session = SessionService.create('test-user', 'Integration Test Session');
  
  // End it to finalize
  return SessionService.end(session);
}

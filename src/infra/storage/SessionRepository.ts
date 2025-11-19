/**
 * SessionRepository
 * Handles persistence of sessions to SQLite database
 */

import { getDatabase } from '../db/connection';
import { Session } from '../../core/types/Session';
import { SessionEvent } from '../../core/types/Events';
import { SessionService } from '../../core/services/SessionService';

export class SessionRepository {
  /**
   * Save a session to the database (insert or update)
   */
  static async save(session: Session): Promise<void> {
    const db = getDatabase();

    console.log(`[SessionRepository] 💾 Saving session: ${session.name}`);
    console.log(`[SessionRepository]   - Events: ${session.events.length}`);
    console.log(`[SessionRepository]   - Stats: ${session.stats.totalKills} kills, ${session.stats.profit.toFixed(2)} PED profit`);

    // Check if session exists
    const existing = await db
      .selectFrom('sessions')
      .select('id')
      .where('id', '=', session.id)
      .executeTakeFirst();

    if (existing) {
      // Update existing session
      await db
        .updateTable('sessions')
        .set({
          name: session.name,
          end_time: session.endTime ?? null,
          duration: session.duration,
          loadout_id: session.loadoutId ?? null,
          stats: JSON.stringify(session.stats),
          tags: JSON.stringify(session.tags),
          notes: session.notes ?? null,
          updated_at: Date.now(),
        })
        .where('id', '=', session.id)
        .execute();

      // Note: We don't delete events on update anymore
      // New events will be inserted below, existing ones will be skipped
    } else {
      // Insert new session
      await db
        .insertInto('sessions')
        .values({
          id: session.id,
          name: session.name,
          user_id: session.userId,
          start_time: session.startTime,
          end_time: session.endTime ?? null,
          duration: session.duration,
          loadout_id: session.loadoutId ?? null,
          stats: JSON.stringify(session.stats),
          tags: JSON.stringify(session.tags),
          notes: session.notes ?? null,
          version: session.version,
          created_at: session.createdAt,
          updated_at: session.updatedAt,
        })
        .execute();
    }

    // Insert events (skip if already exist to handle concurrent saves)
    if (session.events.length > 0) {
      // Get existing event IDs from database
      const existingEventIds = await db
        .selectFrom('events')
        .select('id')
        .where('session_id', '=', session.id)
        .execute()
        .then(rows => new Set(rows.map(r => r.id)));
      
      // Filter out events that already exist
      const newEvents = session.events.filter(event => !existingEventIds.has(event.id));
      
      if (newEvents.length > 0) {
        // Insert new events in batches to avoid SQLITE_MAX_VARIABLE_NUMBER limit
        const batchSize = 100;
        for (let i = 0; i < newEvents.length; i += batchSize) {
          const batch = newEvents.slice(i, i + batchSize);
          
          await db
            .insertInto('events')
            .values(
              batch.map((event) => ({
                id: event.id,
                session_id: session.id,
                type: event.type,
                timestamp: event.timestamp,
                payload: JSON.stringify(event.payload),
                created_at: Date.now(),
              }))
            )
            .execute();
        }
        
        console.log(`[SessionRepository] ✅ Inserted ${newEvents.length} new events (${existingEventIds.size} already existed)`);
      } else if (existingEventIds.size > 0) {
        console.log(`[SessionRepository] ✅ All ${session.events.length} events already in database`);
      }
    }
  }

  /**
   * Find a session by ID
   */
  static async findById(id: string): Promise<Session | null> {
    const db = getDatabase();

    const sessionRow = await db
      .selectFrom('sessions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!sessionRow) return null;

    const eventRows = await db
      .selectFrom('events')
      .selectAll()
      .where('session_id', '=', id)
      .orderBy('timestamp', 'asc')
      .execute();

    const events: SessionEvent[] = eventRows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      userId: sessionRow.user_id,
      timestamp: row.timestamp,
      type: row.type as any,
      payload: JSON.parse(row.payload),
    }));

    // Reconstruct session from stored data
    const session: Session = {
      id: sessionRow.id,
      name: sessionRow.name,
      userId: sessionRow.user_id,
      startTime: sessionRow.start_time,
      endTime: sessionRow.end_time ?? undefined,
      duration: sessionRow.duration,
      loadoutId: sessionRow.loadout_id ?? undefined,
      tags: JSON.parse(sessionRow.tags),
      notes: sessionRow.notes ?? undefined,
      version: sessionRow.version as '2.0',
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      events,
      // Use stored stats if available, otherwise recalculate
      stats: sessionRow.stats 
        ? JSON.parse(sessionRow.stats)
        : SessionService.calculateStats(events),
    };

    // Log session load for debugging
    console.log(`[SessionRepository] ✅ Loaded session: ${session.name} - ${events.length} events, ${session.stats.totalKills} kills, ${session.stats.profit.toFixed(2)} PED`);

    return session;
  }

  /**
   * Find all sessions for a user
   */
  static async findAll(userId?: string): Promise<Session[]> {
    const db = getDatabase();

    let query = db
      .selectFrom('sessions')
      .selectAll()
      .orderBy('start_time', 'desc');

    if (userId) {
      query = query.where('user_id', '=', userId);
    }

    const sessionRows = await query.execute();

    // Load each session with its events
    const sessions = await Promise.all(
      sessionRows.map((row) => this.findById(row.id))
    );

    return sessions.filter((s): s is Session => s !== null);
  }

  /**
   * Delete a session
   */
  static async delete(id: string): Promise<void> {
    const db = getDatabase();

    // Events will be cascade deleted due to foreign key constraint
    await db
      .deleteFrom('sessions')
      .where('id', '=', id)
      .execute();
  }

  /**
   * Delete all sessions and events
   */
  static async deleteAll(): Promise<void> {
    const db = getDatabase();

    console.log('[SessionRepository] 🗑️ Deleting ALL sessions...');

    // Delete all events first
    await db.deleteFrom('events').execute();

    // Delete all sessions
    await db.deleteFrom('sessions').execute();

    console.log('[SessionRepository] ✅ All sessions deleted');
  }

  /**
   * Find the currently active session (one without endTime)
   * More efficient than findAll() when you only need the active session
   */
  static async findActive(userId?: string): Promise<Session | null> {
    const db = getDatabase();

    let query = db
      .selectFrom('sessions')
      .selectAll()
      .where('end_time', 'is', null)
      .orderBy('start_time', 'desc');

    if (userId) {
      query = query.where('user_id', '=', userId);
    }

    const sessionRow = await query.executeTakeFirst();

    if (!sessionRow) return null;

    // Load the full session with events using findById
    return this.findById(sessionRow.id);
  }

  /**
   * Count total sessions
   */
  static async count(userId?: string): Promise<number> {
    const db = getDatabase();

    let query = db
      .selectFrom('sessions')
      .select((eb) => eb.fn.count<number>('id').as('count'));

    if (userId) {
      query = query.where('user_id', '=', userId);
    }

    const result = await query.executeTakeFirst();
    return result?.count ?? 0;
  }
}

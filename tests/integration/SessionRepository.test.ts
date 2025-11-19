import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Kysely } from 'kysely';
import { Database } from '../../src/infra/db/schema';
import { SessionRepository } from '../../src/infra/storage/SessionRepository';
import { createTestDatabase, clearDatabase, createTestSession } from './testHelpers';
import * as connection from '../../src/infra/db/connection';

describe('SessionRepository Integration Tests', () => {
  let db: Kysely<Database>;

  beforeEach(async () => {
    db = await createTestDatabase();
    // Mock getDatabase to return our test database
    vi.spyOn(connection, 'getDatabase').mockReturnValue(db);
  });

  afterEach(async () => {
    await clearDatabase(db);
    await db.destroy();
  });

  describe('save', () => {
    it('should save a new session', async () => {
      const session = createTestSession();
      
      await SessionRepository.save(session);

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(session.name);
      expect(retrieved?.userId).toBe(session.userId);
    });

    it('should store session with recalculated stats', async () => {
      const session = createTestSession();
      
      await SessionRepository.save(session);

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.stats).toBeDefined();
    });

    it('should be idempotent - saving twice should not throw', async () => {
      const session = createTestSession();
      
      await SessionRepository.save(session);
      await SessionRepository.save(session); // Should not throw

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved?.name).toBe(session.name);
    });
  });

  describe('update via save', () => {
    it('should update an existing session', async () => {
      const session = createTestSession();
      await SessionRepository.save(session);

      const updated = { ...session, name: 'Updated Name' };
      await SessionRepository.save(updated);

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should persist updated fields', async () => {
      const session = createTestSession();
      await SessionRepository.save(session);

      const updated = {
        ...session,
        notes: 'Test notes',
        tags: ['updated', 'test'],
      };
      await SessionRepository.save(updated);

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved?.notes).toBe('Test notes');
      expect(retrieved?.tags).toEqual(['updated', 'test']);
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      const session = createTestSession();
      await SessionRepository.save(session);

      await SessionRepository.delete(session.id);

      const retrieved = await SessionRepository.findById(session.id);
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent session', async () => {
      // Should not throw
      await SessionRepository.delete('non-existent-id');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent session', async () => {
      const retrieved = await SessionRepository.findById('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should retrieve session with all fields', async () => {
      const session = createTestSession();
      await SessionRepository.save(session);

      const retrieved = await SessionRepository.findById(session.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.stats).toBeDefined();
      expect(retrieved?.tags).toEqual(session.tags);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no sessions', async () => {
      const sessions = await SessionRepository.findAll();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions ordered by start time (desc)', async () => {
      const session1 = { ...createTestSession(), id: 'session-1', startTime: 1000, createdAt: 1000 };
      const session2 = { ...createTestSession(), id: 'session-2', startTime: 2000, createdAt: 2000 };
      const session3 = { ...createTestSession(), id: 'session-3', startTime: 1500, createdAt: 1500 };

      await SessionRepository.save(session1);
      await SessionRepository.save(session2);
      await SessionRepository.save(session3);

      const sessions = await SessionRepository.findAll();
      
      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe('session-2'); // Most recent first
      expect(sessions[1].id).toBe('session-3');
      expect(sessions[2].id).toBe('session-1');
    });
  });

  describe('findAll with userId filter', () => {
    it('should filter sessions by user ID', async () => {
      const session1 = { ...createTestSession(), id: 'session-1', userId: 'user-1' };
      const session2 = { ...createTestSession(), id: 'session-2', userId: 'user-2' };
      const session3 = { ...createTestSession(), id: 'session-3', userId: 'user-1' };

      await SessionRepository.save(session1);
      await SessionRepository.save(session2);
      await SessionRepository.save(session3);

      const user1Sessions = await SessionRepository.findAll('user-1');
      
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-3']);
    });
  });

  describe('count', () => {
    it('should count all sessions', async () => {
      const session1 = createTestSession();
      const session2 = createTestSession();
      const session3 = createTestSession();

      await SessionRepository.save(session1);
      await SessionRepository.save(session2);
      await SessionRepository.save(session3);

      const count = await SessionRepository.count();
      expect(count).toBe(3);
    });

    it('should count sessions by user ID', async () => {
      const session1 = { ...createTestSession(), userId: 'user-1' };
      const session2 = { ...createTestSession(), userId: 'user-2' };
      const session3 = { ...createTestSession(), userId: 'user-1' };

      await SessionRepository.save(session1);
      await SessionRepository.save(session2);
      await SessionRepository.save(session3);

      const count = await SessionRepository.count('user-1');
      expect(count).toBe(2);
    });
  });

  describe('deleteAll', () => {
    it('should delete all sessions', async () => {
      await SessionRepository.save(createTestSession());
      await SessionRepository.save(createTestSession());
      await SessionRepository.save(createTestSession());

      await SessionRepository.deleteAll();

      const count = await SessionRepository.count();
      expect(count).toBe(0);
    });
  });

  describe('performance with large datasets', () => {
    it('should handle 50 sessions efficiently', async () => {
      const sessions = Array.from({ length: 50 }, (_, i) => ({
        ...createTestSession(),
        id: `session-${i}`,
        name: `Session ${i}`,
        startTime: Date.now() - i * 1000,
        createdAt: Date.now() - i * 1000,
      }));

      const startTime = performance.now();
      
      for (const session of sessions) {
        await SessionRepository.save(session);
      }

      const endTime = performance.now();
      const timePerSession = (endTime - startTime) / 50;

      expect(timePerSession).toBeLessThan(20); // Should be < 20ms per session

      const retrieved = await SessionRepository.findAll();
      expect(retrieved).toHaveLength(50);
    });
  });

});

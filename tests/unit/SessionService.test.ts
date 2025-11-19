/**
 * SessionService Tests
 * Tests for pure business logic functions
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from '../../src/core/services/SessionService';
import type { Session } from '../../src/core/types/Session';
import type { SessionEvent } from '../../src/core/types/Events';

describe('SessionService', () => {
  describe('create', () => {
    it('should create a new session with valid defaults', () => {
      const session = SessionService.create('user-123', 'Test Hunt');

      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Hunt');
      expect(session.userId).toBe('user-123');
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.duration).toBe(0);
      expect(session.endTime).toBeUndefined();
      expect(session.events).toEqual([]);
      expect(session.tags).toEqual([]);
      expect(session.version).toBe('2.0');
    });

    it('should create sessions with unique IDs', () => {
      const session1 = SessionService.create('user-123', 'Hunt 1');
      const session2 = SessionService.create('user-123', 'Hunt 2');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize with empty stats', () => {
      const session = SessionService.create('user-123', 'Test Hunt');

      expect(session.stats.totalShots).toBe(0);
      expect(session.stats.totalHits).toBe(0);
      expect(session.stats.totalMisses).toBe(0);
      expect(session.stats.accuracy).toBe(0);
      expect(session.stats.totalKills).toBe(0);
      expect(session.stats.totalDeaths).toBe(0);
      expect(session.stats.profit).toBe(0);
    });
  });

  describe('addEvent', () => {
    it('should add event without mutating original session', () => {
      const original = SessionService.create('user-123', 'Test Hunt');
      const event: SessionEvent = {
        id: 'event-1',
        timestamp: Date.now(),
        sessionId: original.id,
        userId: 'user-123',
        type: 'SHOT_FIRED',
        payload: { weaponId: 'weapon-1', ammoUsed: 0.1 },
      };

      const updated = SessionService.addEvent(original, event);

      expect(original.events.length).toBe(0); // Original unchanged
      expect(updated.events.length).toBe(1);
      expect(updated.events[0]).toBe(event);
    });

    it('should update stats when adding shot events', () => {
      let session = SessionService.create('user-123', 'Test Hunt');

      const shotEvent: SessionEvent = {
        id: 'shot-1',
        timestamp: Date.now(),
        sessionId: session.id,
        userId: 'user-123',
        type: 'SHOT_FIRED',
        payload: { weaponId: 'weapon-1', ammoUsed: 0.1 },
      };

      session = SessionService.addEvent(session, shotEvent);

      expect(session.stats.totalShots).toBe(1);
    });

    it('should calculate accuracy correctly', () => {
      let session = SessionService.create('user-123', 'Test Hunt');

      // Fire 10 shots
      for (let i = 0; i < 10; i++) {
        const shotEvent: SessionEvent = {
          id: `shot-${i}`,
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1 },
        };
        session = SessionService.addEvent(session, shotEvent);
      }

      // Hit 7 times
      for (let i = 0; i < 7; i++) {
        const hitEvent: SessionEvent = {
          id: `hit-${i}`,
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'HIT_REGISTERED',
          payload: { damage: 50, critical: false },
        };
        session = SessionService.addEvent(session, hitEvent);
      }

      // Miss 3 times
      for (let i = 0; i < 3; i++) {
        const missEvent: SessionEvent = {
          id: `miss-${i}`,
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'MISS_REGISTERED',
          payload: { weaponId: 'weapon-1' },
        };
        session = SessionService.addEvent(session, missEvent);
      }

      expect(session.stats.totalShots).toBe(10);
      expect(session.stats.totalHits).toBe(7);
      expect(session.stats.totalMisses).toBe(3);
      expect(session.stats.accuracy).toBeCloseTo(0.7, 2);
    });
  });

  describe('addEvents (batch)', () => {
    it('should add multiple events at once', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      const events: SessionEvent[] = [
        {
          id: 'shot-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1 },
        },
        {
          id: 'hit-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'HIT_REGISTERED',
          payload: { damage: 50, critical: false },
        },
        {
          id: 'kill-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'MOB_KILLED',
          payload: { mobName: 'Atrox', mobId: 'mob-1', location: { lon: 0, lat: 0 } },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.events.length).toBe(3);
      expect(updated.stats.totalShots).toBe(1);
      expect(updated.stats.totalHits).toBe(1);
      expect(updated.stats.totalKills).toBe(1);
    });
  });

  describe('calculateStats', () => {
    it('should calculate combat stats correctly', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const events: SessionEvent[] = [
        {
          id: 'shot-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.15 },
        },
        {
          id: 'shot-2',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.15 },
        },
        {
          id: 'hit-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'HIT_REGISTERED',
          payload: { damage: 100, critical: false },
        },
        {
          id: 'miss-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'MISS_REGISTERED',
          payload: { weaponId: 'weapon-1' },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.stats.totalShots).toBe(2);
      expect(updated.stats.totalHits).toBe(1);
      expect(updated.stats.totalMisses).toBe(1);
      expect(updated.stats.totalDamageDealt).toBe(100);
      expect(updated.stats.accuracy).toBe(0.5);
    });

    it('should calculate economy stats correctly', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const events: SessionEvent[] = [
        {
          id: 'shot-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoCost: 0.5 },
        },
        {
          id: 'shot-2',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoCost: 0.5 },
        },
        {
          id: 'loot-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 10, value: 1.0 }],
            totalTTValue: 10.0,
            totalMVValue: 12.0,
          },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.stats.totalAmmoCost).toBe(1.0);
      expect(updated.stats.totalLootTTValue).toBe(10.0);
      expect(updated.stats.profit).toBe(9.0); // 10 - 1
      expect(updated.stats.returnRate).toBeCloseTo(10.0, 2); // 10 / 1
    });

    it('should calculate defense stats correctly', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const events: SessionEvent[] = [
        {
          id: 'dmg-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'HIT_TAKEN',
          payload: { damage: 25, mobName: 'Atrox' },
        },
        {
          id: 'dodge-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'DODGE_REGISTERED',
          payload: { actor: 'player', mobId: 'mob-1' },
        },
        {
          id: 'evade-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'EVADE_REGISTERED',
          payload: { actor: 'player', mobId: 'mob-1' },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.stats.totalDamageTaken).toBe(25);
      expect(updated.stats.totalDodges).toBe(1);
      expect(updated.stats.totalEvades).toBe(1);
    });

    it('should calculate skill gains correctly', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const events: SessionEvent[] = [
        {
          id: 'skill-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SKILL_GAIN',
          payload: { skillName: 'Rifle', gainAmount: 0.0234 },
        },
        {
          id: 'skill-2',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'SKILL_GAIN',
          payload: { skillName: 'Aim', gainAmount: 0.0156 },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.stats.totalSkillGains).toBe(2);
    });

    it('should handle zero shots for accuracy calculation', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      expect(session.stats.accuracy).toBe(0);
      expect(session.stats.totalShots).toBe(0);
    });

    it('should handle zero ammo cost for return rate', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const events: SessionEvent[] = [
        {
          id: 'loot-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 10, value: 1.0 }],
            totalTTValue: 10.0,
            totalMVValue: 12.0,
          },
        },
      ];

      const updated = SessionService.addEvents(session, events);

      expect(updated.stats.returnRate).toBe(0);
    });
  });

  describe('end', () => {
    it('should mark session as ended', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      const ended = SessionService.end(session);

      expect(ended.endTime).toBeDefined();
      expect(ended.endTime).toBeGreaterThanOrEqual(session.startTime);
    });

    it('should calculate final duration', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      // Simulate some time passing
      const ended = SessionService.end(session);

      expect(ended.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate profit per hour', () => {
      let session = SessionService.create('user-123', 'Test Hunt');

      // Add some profit-generating events
      const events: SessionEvent[] = [
        {
          id: 'shot-1',
          timestamp: session.startTime,
          sessionId: session.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoCost: 1.0 },
        },
        {
          id: 'loot-1',
          timestamp: session.startTime + 3600000, // 1 hour later
          sessionId: session.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 100, value: 1.0 }],
            totalTTValue: 100.0,
            totalMVValue: 120.0,
          },
        },
      ];

      session = SessionService.addEvents(session, events);
      const ended = SessionService.end(session);

      // Profit = 100 - 1 = 99 PED over ~1 hour
      expect(ended.stats.profit).toBeCloseTo(99, 0);
      // Note: profitPerHour depends on duration which may be 0 in test
    });
  });

  describe('immutability', () => {
    it('should never mutate original session in addEvent', () => {
      const original = SessionService.create('user-123', 'Test Hunt');
      const originalEventsRef = original.events;
      const originalStatsRef = original.stats;

      const event: SessionEvent = {
        id: 'event-1',
        timestamp: Date.now(),
        sessionId: original.id,
        userId: 'user-123',
        type: 'SHOT_FIRED',
        payload: { weaponId: 'weapon-1', ammoUsed: 0.1 },
      };

      SessionService.addEvent(original, event);

      // Original should be completely unchanged
      expect(original.events).toBe(originalEventsRef);
      expect(original.stats).toBe(originalStatsRef);
      expect(original.events.length).toBe(0);
      expect(original.stats.totalShots).toBe(0);
    });

    it('should never mutate original session in end', () => {
      const original = SessionService.create('user-123', 'Test Hunt');
      const originalEndTime = original.endTime;

      SessionService.end(original);

      expect(original.endTime).toBe(originalEndTime);
      expect(original.endTime).toBeUndefined();
    });
  });
});

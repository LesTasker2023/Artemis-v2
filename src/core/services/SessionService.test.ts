/**
 * SessionService Tests
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from './SessionService';
import type { SessionEvent } from '../types/Events';

describe('SessionService', () => {
  describe('create', () => {
    it('should create a new session with empty stats', () => {
      const session = SessionService.create('user123', 'Test Session');

      expect(session.name).toBe('Test Session');
      expect(session.userId).toBe('user123');
      expect(session.events).toHaveLength(0);
      expect(session.stats.totalShots).toBe(0);
      expect(session.stats.profit).toBe(0);
    });
  });

  describe('addEvent', () => {
    it('should add a shot fired event and update stats', () => {
      const session = SessionService.create('user123', 'Test Session');

      const event: SessionEvent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sessionId: session.id,
        userId: 'user123',
        type: 'SHOT_FIRED',
        payload: {
          weaponId: 'weapon1',
          ammoUsed: 0.05,
          ammoCost: 0.05,
        },
      };

      const updated = SessionService.addEvent(session, event);

      expect(updated.events).toHaveLength(1);
      expect(updated.stats.totalShots).toBe(1);
      expect(updated.stats.totalAmmoCost).toBe(0.05);
      expect(updated.stats.profit).toBe(-0.05); // No loot yet
    });

    it('should not mutate original session', () => {
      const session = SessionService.create('user123', 'Test Session');
      const event: SessionEvent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sessionId: session.id,
        userId: 'user123',
        type: 'SHOT_FIRED',
        payload: {
          weaponId: 'weapon1',
          ammoUsed: 0.05,
          ammoCost: 0.05,
        },
      };

      const updated = SessionService.addEvent(session, event);

      expect(session.events).toHaveLength(0); // Original unchanged
      expect(updated.events).toHaveLength(1); // New session has event
    });
  });

  describe('calculateStats', () => {
    it('should calculate accuracy correctly', () => {
      const events: SessionEvent[] = [
        {
          id: '1',
          timestamp: 1000,
          sessionId: 'session1',
          userId: 'user1',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'w1', ammoUsed: 0.05, ammoCost: 0.05 },
        },
        {
          id: '2',
          timestamp: 1100,
          sessionId: 'session1',
          userId: 'user1',
          type: 'HIT_REGISTERED',
          payload: { damage: 50, critical: false },
        },
        {
          id: '3',
          timestamp: 1200,
          sessionId: 'session1',
          userId: 'user1',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'w1', ammoUsed: 0.05, ammoCost: 0.05 },
        },
        {
          id: '4',
          timestamp: 1300,
          sessionId: 'session1',
          userId: 'user1',
          type: 'MISS_REGISTERED',
          payload: { weaponId: 'w1' },
        },
      ];

      const stats = SessionService.calculateStats(events);

      expect(stats.totalShots).toBe(2);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.accuracy).toBe(0.5); // 1 hit / 2 shots
    });

    it('should calculate profit correctly', () => {
      const events: SessionEvent[] = [
        {
          id: '1',
          timestamp: 1000,
          sessionId: 'session1',
          userId: 'user1',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'w1', ammoUsed: 0.1, ammoCost: 1.0 },
        },
        {
          id: '2',
          timestamp: 1100,
          sessionId: 'session1',
          userId: 'user1',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Shrapnel', quantity: 100, ttValue: 10, mvValue: 10 }],
            totalTTValue: 10,
            totalMVValue: 10,
            isGlobal: false,
          },
        },
      ];

      const stats = SessionService.calculateStats(events);

      expect(stats.totalAmmoCost).toBe(1.0);
      expect(stats.totalLootTTValue).toBe(10);
      expect(stats.profit).toBe(9.0); // 10 - 1
      expect(stats.returnRate).toBe(10); // 10 / 1
    });
  });

  describe('calculateProfitPerHour', () => {
    it('should calculate profit per hour', () => {
      const session = SessionService.create('user123', 'Test');
      session.stats.profit = 100;
      session.duration = 3600; // 1 hour

      const profitPerHour = SessionService.calculateProfitPerHour(session);

      expect(profitPerHour).toBe(100);
    });

    it('should handle 30 minute sessions', () => {
      const session = SessionService.create('user123', 'Test');
      session.stats.profit = 50;
      session.duration = 1800; // 30 minutes

      const profitPerHour = SessionService.calculateProfitPerHour(session);

      expect(profitPerHour).toBe(100); // 50 * 2
    });

    it('should return 0 for zero duration', () => {
      const session = SessionService.create('user123', 'Test');
      session.stats.profit = 100;
      session.duration = 0;

      const profitPerHour = SessionService.calculateProfitPerHour(session);

      expect(profitPerHour).toBe(0);
    });
  });
});

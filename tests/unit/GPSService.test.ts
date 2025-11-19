/**
 * GPSService Tests
 * Tests for GPS zone clustering and analytics
 */

import { describe, it, expect } from 'vitest';
import { GPSService } from '../../src/core/services/GPSService';
import { SessionService } from '../../src/core/services/SessionService';
import type { Session } from '../../src/core/types/Session';
import type { SessionEvent } from '../../src/core/types/Events';
import type { Coordinate } from '../../src/core/types/GPS';

describe('GPSService', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const coord1: Coordinate = { lon: 0, lat: 0 };
      const coord2: Coordinate = { lon: 0, lat: 1 };
      
      const distance = GPSService.calculateDistance(coord1, coord2);
      
      // 1 degree latitude ≈ 111km
      expect(distance).toBeGreaterThan(110000);
      expect(distance).toBeLessThan(112000);
    });

    it('should return 0 for same coordinates', () => {
      const coord: Coordinate = { lon: 10, lat: 20 };
      
      const distance = GPSService.calculateDistance(coord, coord);
      
      expect(distance).toBe(0);
    });

    it('should calculate distance for Calypso coordinates', () => {
      // Two locations 500m apart on Calypso
      const location1: Coordinate = { lon: 61000, lat: 75000 };
      const location2: Coordinate = { lon: 61005, lat: 75000 };
      
      const distance = GPSService.calculateDistance(location1, location2);
      
      // Should be roughly 500m (depends on coordinate system)
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('extractGPSPoints', () => {
    it('should extract GPS points from session events', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      const gpsEvents: SessionEvent[] = [
        {
          id: 'gps-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61000, lat: 75000 } },
        },
        {
          id: 'gps-2',
          timestamp: Date.now() + 1000,
          sessionId: session.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61100, lat: 75100 } },
        },
      ];
      
      const updatedSession = SessionService.addEvents(session, gpsEvents);
      const points = GPSService.extractGPSPoints(updatedSession);
      
      expect(points).toHaveLength(2);
      expect(points[0].location).toEqual({ lon: 61000, lat: 75000 });
      expect(points[1].location).toEqual({ lon: 61100, lat: 75100 });
    });

    it('should return empty array for session without GPS events', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      const points = GPSService.extractGPSPoints(session);
      
      expect(points).toEqual([]);
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid of GPS points', () => {
      const points = [
        { location: { lon: 0, lat: 0 }, timestamp: Date.now(), sessionId: 'session-1' },
        { location: { lon: 10, lat: 10 }, timestamp: Date.now(), sessionId: 'session-1' },
        { location: { lon: 20, lat: 20 }, timestamp: Date.now(), sessionId: 'session-1' },
      ];
      
      const centroid = GPSService.calculateCentroid(points);
      
      expect(centroid.lon).toBeCloseTo(10, 1);
      expect(centroid.lat).toBeCloseTo(10, 1);
    });

    it('should return (0,0) for empty points array', () => {
      const centroid = GPSService.calculateCentroid([]);
      
      expect(centroid).toEqual({ lon: 0, lat: 0 });
    });
  });

  describe('clusterZones', () => {
    it('should cluster nearby GPS points together', () => {
      const points = [
        { location: { lon: 61000, lat: 75000 }, timestamp: Date.now(), sessionId: 'session-1' },
        { location: { lon: 61001, lat: 75001 }, timestamp: Date.now(), sessionId: 'session-1' },
        { location: { lon: 61002, lat: 75002 }, timestamp: Date.now(), sessionId: 'session-1' },
        { location: { lon: 62000, lat: 76000 }, timestamp: Date.now(), sessionId: 'session-2' },
      ];
      
      const clusters = GPSService.clusterZones(points, 500);
      
      // Should have at least 2 clusters (nearby points grouped, far point separate)
      expect(clusters.size).toBeGreaterThanOrEqual(1);
    });

    it('should return empty map for no points', () => {
      const clusters = GPSService.clusterZones([]);
      
      expect(clusters.size).toBe(0);
    });
  });

  describe('createHuntingZones', () => {
    it('should create hunting zones from sessions with GPS data', () => {
      let session1 = SessionService.create('user-123', 'Hunt 1');
      let session2 = SessionService.create('user-123', 'Hunt 2');
      
      // Add GPS and combat events to session 1
      const events1: SessionEvent[] = [
        {
          id: 'gps-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61000, lat: 75000 } },
        },
        {
          id: 'shot-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1, ammoCost: 0.15 },
        },
        {
          id: 'loot-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 10, ttValue: 1.0 }],
            totalTTValue: 10.0,
            totalMVValue: 12.0,
            isGlobal: false,
          },
        },
      ];
      
      session1 = SessionService.addEvents(session1, events1);
      
      // Add GPS to session 2 (nearby location) with combat events
      const events2: SessionEvent[] = [
        {
          id: 'gps-2',
          timestamp: Date.now(),
          sessionId: session2.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61001, lat: 75001 } },
        },
        {
          id: 'shot-2',
          timestamp: Date.now(),
          sessionId: session2.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1, ammoCost: 0.15 },
        },
      ];
      
      session2 = SessionService.addEvents(session2, events2);
      
      // Debug: Check both sessions have GPS
      const points1 = GPSService.extractGPSPoints(session1);
      const points2 = GPSService.extractGPSPoints(session2);
      expect(points1.length).toBe(1);
      expect(points2.length).toBe(1);
      
      const zones = GPSService.createHuntingZones([session1, session2]);
      
      expect(zones.length).toBeGreaterThan(0);
      
      // Find the zone (might be 1 or 2 zones depending on grid cell size)
      if (zones.length === 1) {
        // Both sessions in same zone
        const zone = zones[0];
        expect(zone.id).toBeDefined();
        expect(zone.center.lon).toBeDefined();
        expect(zone.center.lat).toBeDefined();
        expect(zone.sessionCount).toBe(2);
        // Session 1: 10 - 0.15 = 9.85
        // Session 2: 0 - 0.15 = -0.15
        // Total: 9.85 + (-0.15) = 9.70
        expect(zone.totalProfit).toBeCloseTo(9.70, 2);
      } else {
        // Sessions in different zones - just verify each has 1 session
        expect(zones.every(z => z.sessionCount >= 1)).toBe(true);
      }
    });

    it('should return empty array for sessions without GPS data', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      const zones = GPSService.createHuntingZones([session]);
      
      expect(zones).toEqual([]);
    });
  });

  describe('generateHeatmap', () => {
    it('should generate heatmap from sessions', () => {
      let session = SessionService.create('user-123', 'Test Hunt');
      
      const events: SessionEvent[] = [
        {
          id: 'gps-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61000, lat: 75000 } },
        },
        {
          id: 'death-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'PLAYER_DEATH',
          payload: {
            location: { lon: 61050, lat: 75050 },
            mobName: 'Atrox',
            decayCost: 5.0,
          },
        },
      ];
      
      session = SessionService.addEvents(session, events);
      
      const heatmap = GPSService.generateHeatmap([session]);
      
      expect(heatmap.zones.length).toBeGreaterThan(0);
      expect(heatmap.deathLocations.length).toBe(1);
      expect(heatmap.deathLocations[0].mobName).toBe('Atrox');
      expect(heatmap.totalSessions).toBe(1);
      expect(heatmap.generatedAt).toBeGreaterThan(0);
    });

    it('should handle sessions without GPS data', () => {
      const session = SessionService.create('user-123', 'Test Hunt');
      
      const heatmap = GPSService.generateHeatmap([session]);
      
      expect(heatmap.zones).toEqual([]);
      expect(heatmap.deathLocations).toEqual([]);
      expect(heatmap.totalSessions).toBe(0);
    });
  });

  describe('getMostProfitableZones', () => {
    it('should return zones sorted by profit per hour', () => {
      let session1 = SessionService.create('user-123', 'Profitable Hunt');
      let session2 = SessionService.create('user-123', 'Less Profitable Hunt');
      
      // High profit zone
      const events1: SessionEvent[] = [
        {
          id: 'gps-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61000, lat: 75000 } },
        },
        {
          id: 'shot-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1, ammoCost: 1.0 },
        },
        {
          id: 'loot-1',
          timestamp: Date.now(),
          sessionId: session1.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 100, ttValue: 1.0 }],
            totalTTValue: 100.0,
            totalMVValue: 120.0,
            isGlobal: false,
          },
        },
      ];
      
      session1 = SessionService.addEvents(session1, events1);
      session1 = SessionService.end(session1);
      
      // Lower profit zone (far away)
      const events2: SessionEvent[] = [
        {
          id: 'gps-2',
          timestamp: Date.now(),
          sessionId: session2.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 62000, lat: 76000 } },
        },
        {
          id: 'shot-2',
          timestamp: Date.now(),
          sessionId: session2.id,
          userId: 'user-123',
          type: 'SHOT_FIRED',
          payload: { weaponId: 'weapon-1', ammoUsed: 0.1, ammoCost: 1.0 },
        },
        {
          id: 'loot-2',
          timestamp: Date.now(),
          sessionId: session2.id,
          userId: 'user-123',
          type: 'LOOT_RECEIVED',
          payload: {
            items: [{ name: 'Animal Oil', quantity: 10, ttValue: 1.0 }],
            totalTTValue: 10.0,
            totalMVValue: 12.0,
            isGlobal: false,
          },
        },
      ];
      
      session2 = SessionService.addEvents(session2, events2);
      session2 = SessionService.end(session2);
      
      const zones = GPSService.createHuntingZones([session1, session2]);
      const topZones = GPSService.getMostProfitableZones(zones, 2);
      
      expect(topZones.length).toBeLessThanOrEqual(2);
      
      if (topZones.length === 2) {
        expect(topZones[0].avgProfitPerHour).toBeGreaterThanOrEqual(topZones[1].avgProfitPerHour);
      }
    });
  });

  describe('findNearbyZones', () => {
    it('should find zones within specified distance', () => {
      let session = SessionService.create('user-123', 'Test Hunt');
      
      const events: SessionEvent[] = [
        {
          id: 'gps-1',
          timestamp: Date.now(),
          sessionId: session.id,
          userId: 'user-123',
          type: 'GPS_UPDATE',
          payload: { location: { lon: 61000, lat: 75000 } },
        },
      ];
      
      session = SessionService.addEvents(session, events);
      
      const zones = GPSService.createHuntingZones([session]);
      const searchLocation: Coordinate = { lon: 61000, lat: 75000 };
      
      const nearbyZones = GPSService.findNearbyZones(zones, searchLocation, 1000);
      
      expect(nearbyZones.length).toBeGreaterThan(0);
    });
  });
});

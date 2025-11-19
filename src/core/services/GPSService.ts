/**
 * GPSService
 * Zone clustering and GPS analytics
 * Pure functions for processing location data
 */

import type { Session } from '../types/Session';
import type { Coordinate, HuntingZone, GPSHeatmap, GPSPoint } from '../types/GPS';

// Cross-platform UUID generation
function generateUUID(): string {
  if (typeof window === 'undefined') {
    try {
      const { randomUUID } = require('crypto');
      return randomUUID();
    } catch {
      // Fall through
    }
  }
  
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class GPSService {
  // Default clustering radius in meters
  private static readonly DEFAULT_ZONE_RADIUS = 500;
  
  /**
   * Extract GPS points from session events
   */
  static extractGPSPoints(session: Session): GPSPoint[] {
    const gpsEvents = session.events.filter(e => e.type === 'GPS_UPDATE');
    
    return gpsEvents.map(event => {
      return {
        location: event.payload.location,
        timestamp: event.timestamp,
        sessionId: session.id,
      } as GPSPoint;
    });
  }
  
  /**
   * Extract GPS points from multiple sessions
   */
  static extractAllGPSPoints(sessions: Session[]): GPSPoint[] {
    return sessions.flatMap(session => this.extractGPSPoints(session));
  }
  
  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in meters
   */
  static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lon - coord1.lon) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
  
  /**
   * Cluster GPS points into zones using grid-based clustering
   * More efficient than DBSCAN for large datasets
   */
  static clusterZones(
    points: GPSPoint[],
    radiusMeters: number = this.DEFAULT_ZONE_RADIUS
  ): Map<string, GPSPoint[]> {
    if (points.length === 0) return new Map();
    
    // Group points into grid cells based on radius
    const cellSize = radiusMeters / 111320; // Convert meters to degrees (approximate)
    const grid = new Map<string, GPSPoint[]>();
    
    for (const point of points) {
      // Calculate grid cell coordinates
      const cellX = Math.floor(point.location.lon / cellSize);
      const cellY = Math.floor(point.location.lat / cellSize);
      const cellKey = `${cellX},${cellY}`;
      
      if (!grid.has(cellKey)) {
        grid.set(cellKey, []);
      }
      grid.get(cellKey)!.push(point);
    }
    
    return grid;
  }
  
  /**
   * Calculate center point (centroid) of a cluster
   */
  static calculateCentroid(points: GPSPoint[]): Coordinate {
    if (points.length === 0) {
      return { lon: 0, lat: 0 };
    }
    
    const sum = points.reduce(
      (acc, point) => ({
        lon: acc.lon + point.location.lon,
        lat: acc.lat + point.location.lat,
      }),
      { lon: 0, lat: 0 }
    );
    
    return {
      lon: sum.lon / points.length,
      lat: sum.lat / points.length,
    };
  }
  
  /**
   * Create hunting zones from sessions with aggregated stats
   */
  static createHuntingZones(
    sessions: Session[],
    radiusMeters: number = this.DEFAULT_ZONE_RADIUS
  ): HuntingZone[] {
    // Extract all GPS points
    const allPoints = this.extractAllGPSPoints(sessions);
    
    if (allPoints.length === 0) {
      return [];
    }
    
    // Cluster points into zones
    const clusters = this.clusterZones(allPoints, radiusMeters);
    
    // Build zones with stats
    const zones: HuntingZone[] = [];
    
    for (const [_cellKey, points] of clusters) {
      const center = this.calculateCentroid(points);
      const sessionIds = [...new Set(points.map(p => p.sessionId))];
      const zoneSessions = sessions.filter(s => sessionIds.includes(s.id));
      
      if (zoneSessions.length === 0) continue;
      
      // Aggregate stats from sessions
      const stats = this.aggregateZoneStats(zoneSessions);
      
      zones.push({
        id: generateUUID(),
        center,
        radius: radiusMeters,
        sessionIds,
        sessionCount: zoneSessions.length,
        firstVisited: Math.min(...zoneSessions.map(s => s.startTime)),
        lastVisited: Math.max(...zoneSessions.map(s => s.startTime)),
        ...stats,
      });
    }
    
    return zones;
  }
  
  /**
   * Aggregate statistics from sessions in a zone
   */
  private static aggregateZoneStats(sessions: Session[]) {
    let totalProfit = 0;
    let totalAmmoCost = 0;
    let totalLootValue = 0;
    let totalKills = 0;
    let totalShots = 0;
    let totalHits = 0;
    let deathCount = 0;
    let totalDuration = 0;
    let totalDamageTaken = 0;
    
    const mobEncounters: Record<string, { count: number; kills: number; profit: number }> = {};
    
    for (const session of sessions) {
      totalProfit += session.stats.profit;
      totalAmmoCost += session.stats.totalAmmoCost;
      totalLootValue += session.stats.totalLootTTValue;
      totalKills += session.stats.totalKills;
      totalShots += session.stats.totalShots;
      totalHits += session.stats.totalHits;
      deathCount += session.stats.totalDeaths;
      totalDuration += session.duration;
      totalDamageTaken += session.stats.totalDamageTaken;
      
      // Track mob encounters
      const mobKillEvents = session.events.filter(e => e.type === 'MOB_KILLED');
      for (const event of mobKillEvents) {
        if (event.type !== 'MOB_KILLED') continue;
        
        const mobName = event.payload.mobName;
        if (!mobEncounters[mobName]) {
          mobEncounters[mobName] = { count: 0, kills: 0, profit: 0 };
        }
        mobEncounters[mobName].count++;
        mobEncounters[mobName].kills++;
      }
    }
    
    // Calculate averages
    const avgAccuracy = totalShots > 0 ? totalHits / totalShots : 0;
    const avgProfitPerHour = totalDuration > 0 ? (totalProfit / totalDuration) * 3600 : 0;
    const returnRate = totalAmmoCost > 0 ? totalLootValue / totalAmmoCost : 0;
    const damagePerHour = totalDuration > 0 ? (totalDamageTaken / totalDuration) * 3600 : 0;
    
    // Calculate danger level (0-1 scale)
    // Based on: death frequency, damage taken, negative profit
    const deathRate = sessions.length > 0 ? deathCount / sessions.length : 0;
    const isProfitable = totalProfit > 0;
    const dangerLevel = Math.min(1, (deathRate * 0.5) + (isProfitable ? 0 : 0.3) + (damagePerHour > 1000 ? 0.2 : 0));
    
    return {
      totalProfit,
      totalAmmoCost,
      totalLootValue,
      avgProfitPerHour,
      returnRate,
      totalKills,
      totalShots,
      avgAccuracy,
      mobEncounters,
      deathCount,
      damagePerHour,
      dangerLevel,
    };
  }
  
  /**
   * Generate GPS heatmap from sessions
   */
  static generateHeatmap(sessions: Session[]): GPSHeatmap {
    if (sessions.length === 0) {
      return {
        zones: [],
        deathLocations: [],
        generatedAt: Date.now(),
        totalSessions: 0,
        dateRange: { start: 0, end: 0 },
      };
    }
    
    const zones = this.createHuntingZones(sessions);
    const deathLocations = this.extractDeathLocations(sessions);
    
    // Count only sessions with GPS data
    const sessionsWithGPS = sessions.filter(s => 
      s.events.some(e => e.type === 'GPS_UPDATE')
    );
    
    const startTimes = sessionsWithGPS.length > 0 
      ? sessionsWithGPS.map(s => s.startTime)
      : [0];
    
    return {
      zones,
      deathLocations,
      generatedAt: Date.now(),
      totalSessions: sessionsWithGPS.length,
      dateRange: {
        start: Math.min(...startTimes),
        end: Math.max(...startTimes),
      },
    };
  }
  
  /**
   * Extract death locations from sessions
   */
  static extractDeathLocations(sessions: Session[]): Array<{
    id: string;
    location: Coordinate;
    timestamp: number;
    sessionId: string;
    mobName?: string;
  }> {
    const deaths: Array<{
      id: string;
      location: Coordinate;
      timestamp: number;
      sessionId: string;
      mobName?: string;
    }> = [];
    
    for (const session of sessions) {
      const deathEvents = session.events.filter(e => e.type === 'PLAYER_DEATH');
      
      for (const event of deathEvents) {
        if (event.type !== 'PLAYER_DEATH') continue;
        
        deaths.push({
          id: generateUUID(),
          location: event.payload.location,
          timestamp: event.timestamp,
          sessionId: session.id,
          mobName: event.payload.mobName,
        });
      }
    }
    
    return deaths;
  }
  
  /**
   * Find zones near a coordinate
   */
  static findNearbyZones(
    zones: HuntingZone[],
    location: Coordinate,
    maxDistanceMeters: number = 1000
  ): HuntingZone[] {
    return zones
      .map(zone => ({
        zone,
        distance: this.calculateDistance(location, zone.center),
      }))
      .filter(({ distance }) => distance <= maxDistanceMeters)
      .sort((a, b) => a.distance - b.distance)
      .map(({ zone }) => zone);
  }
  
  /**
   * Find most profitable zones
   */
  static getMostProfitableZones(zones: HuntingZone[], limit: number = 10): HuntingZone[] {
    return [...zones]
      .sort((a, b) => b.avgProfitPerHour - a.avgProfitPerHour)
      .slice(0, limit);
  }
  
  /**
   * Find most dangerous zones
   */
  static getMostDangerousZones(zones: HuntingZone[], limit: number = 10): HuntingZone[] {
    return [...zones]
      .sort((a, b) => b.dangerLevel - a.dangerLevel)
      .slice(0, limit);
  }
  
  /**
   * Get zone by ID
   */
  static getZoneById(zones: HuntingZone[], zoneId: string): HuntingZone | null {
    return zones.find(z => z.id === zoneId) || null;
  }
}

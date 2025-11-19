/**
 * GPS Type Definitions
 * Location tracking and zone analytics
 */

import { z } from 'zod';

// ==================== Coordinate ====================

export const Coordinate = z.object({
  lon: z.number(),
  lat: z.number(),
});

export type Coordinate = z.infer<typeof Coordinate>;

// ==================== Hunting Zone ====================

export const HuntingZone = z.object({
  id: z.string().uuid(),
  center: Coordinate,
  radius: z.number().positive(),
  
  // Session tracking
  sessionIds: z.array(z.string().uuid()),
  sessionCount: z.number().nonnegative(),
  firstVisited: z.number(),
  lastVisited: z.number(),
  
  // Economic stats
  totalProfit: z.number(),
  totalAmmoCost: z.number().nonnegative(),
  totalLootValue: z.number().nonnegative(),
  avgProfitPerHour: z.number(),
  returnRate: z.number().nonnegative(),
  
  // Combat stats
  totalKills: z.number().nonnegative(),
  totalShots: z.number().nonnegative(),
  avgAccuracy: z.number().min(0).max(1),
  
  // Mob composition
  mobEncounters: z.record(z.string(), z.object({
    count: z.number().nonnegative(),
    kills: z.number().nonnegative(),
    profit: z.number(),
  })),
  
  // Danger metrics
  deathCount: z.number().nonnegative(),
  damagePerHour: z.number().nonnegative(),
  dangerLevel: z.number().min(0).max(1),
});

export type HuntingZone = z.infer<typeof HuntingZone>;

// ==================== GPS Point ====================

export const GPSPoint = z.object({
  location: Coordinate,
  timestamp: z.number(),
  sessionId: z.string().uuid(),
});

export type GPSPoint = z.infer<typeof GPSPoint>;

// ==================== GPS Heatmap ====================

export const GPSHeatmap = z.object({
  zones: z.array(HuntingZone),
  deathLocations: z.array(z.object({
    id: z.string().uuid(),
    location: Coordinate,
    timestamp: z.number(),
    sessionId: z.string().uuid(),
    mobName: z.string().optional(),
  })),
  generatedAt: z.number(),
  totalSessions: z.number().nonnegative(),
  dateRange: z.object({
    start: z.number(),
    end: z.number(),
  }),
});

export type GPSHeatmap = z.infer<typeof GPSHeatmap>;

/**
 * Session Type Definitions
 * Immutable session state derived from events
 */

import { z } from 'zod';
import { SessionEvent } from './Events';

// ==================== Session Stats ====================

export const SessionStats = z.object({
  // Combat stats
  totalShots: z.number().nonnegative(),
  totalHits: z.number().nonnegative(),
  totalMisses: z.number().nonnegative(),
  totalCriticals: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
  criticalRate: z.number().min(0).max(1),
  
  // Defensive stats
  totalDodges: z.number().nonnegative(),
  totalEvades: z.number().nonnegative(),
  totalDeflects: z.number().nonnegative(),
  totalHitsTaken: z.number().nonnegative(),
  totalCriticalHitsTaken: z.number().nonnegative(),
  totalDamageTaken: z.number().nonnegative(),
  dodgeRate: z.number().min(0).max(1),
  evadeRate: z.number().min(0).max(1),
  deflectRate: z.number().min(0).max(1),
  
  // Mob stats
  totalKills: z.number().nonnegative(),
  totalDeaths: z.number().nonnegative(),
  
  // Damage stats
  totalDamageDealt: z.number().nonnegative(),
  totalDamageResisted: z.number().nonnegative(), // Damage resisted by targets
  avgDamagePerHit: z.number().nonnegative(),
  maxDamageHit: z.number().nonnegative(),
  
  // Economic stats
  totalAmmoCost: z.number().nonnegative(),
  totalLootTTValue: z.number().nonnegative(),
  totalLootMVValue: z.number().nonnegative().optional(),
  totalDecayCost: z.number().nonnegative(),
  
  // Calculated metrics
  profit: z.number(),
  profitPerHour: z.number(),
  returnRate: z.number(),
  damagePerPED: z.number().nonnegative(),
  
  // Loot stats
  totalLoots: z.number().nonnegative(),
  totalGlobals: z.number().nonnegative(),
  avgLootValue: z.number().nonnegative(),
  
  // Skill progression
  totalSkillGains: z.number().nonnegative(),
  totalSkillRankGains: z.number().nonnegative(),
  totalAttributeGains: z.number().nonnegative(),
  totalNewSkills: z.number().nonnegative(),
  skillGainsByName: z.record(z.string(), z.number()).optional(),
  skillRanksByName: z.record(z.string(), z.number()).optional(),
  attributeGainsByName: z.record(z.string(), z.number()).optional(),
  newSkillsAcquired: z.array(z.string()).optional(),
  
  // Effects & Buffs
  totalEffectsReceived: z.number().nonnegative(),
  totalHealing: z.number().nonnegative(),
  effectsByName: z.record(z.string(), z.number()).optional(),
  
  // Other stats
  totalGlobalsObserved: z.number().nonnegative(),
});

export type SessionStats = z.infer<typeof SessionStats>;

// ==================== Session ====================

export const Session = z.object({
  // Identity
  id: z.string().uuid(),
  name: z.string(),
  userId: z.string(),
  
  // Timing
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number().nonnegative(), // seconds
  
  // State (derived from events)
  stats: SessionStats,
  events: z.array(SessionEvent),
  
  // Relationships
  loadoutId: z.string().uuid().optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  planet: z.string().optional(),
  area: z.string().optional(),
  
  // Version control
  version: z.literal('2.0'),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Session = z.infer<typeof Session>;

// ==================== Helper Types ====================

export interface SessionSummary {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration: number;
  profit: number;
  profitPerHour: number;
  totalKills: number;
  totalDeaths: number;
  accuracy: number;
}

export interface SessionFilter {
  userId?: string;
  startDate?: number;
  endDate?: number;
  minProfit?: number;
  maxProfit?: number;
  tags?: string[];
  planet?: string;
}

export type SessionSortKey = 
  | 'startTime'
  | 'duration'
  | 'profit'
  | 'profitPerHour'
  | 'totalKills'
  | 'accuracy';

export type SortDirection = 'asc' | 'desc';

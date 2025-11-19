/**
 * Analytics Type Definitions
 * Types for aggregated insights and trends across sessions
 */

import { z } from 'zod';
import { Coordinate } from './GPS';

// ==================== Time-Series Analytics ====================

export const TimeSeriesPoint = z.object({
  timestamp: z.number(),
  value: z.number(),
  label: z.string().optional(),
});

export const TimeSeriesData = z.object({
  metric: z.string(), // 'profit', 'accuracy', 'killRate', etc.
  points: z.array(TimeSeriesPoint),
  aggregation: z.enum(['session', 'hourly', 'daily', 'weekly']),
});

export type TimeSeriesPoint = z.infer<typeof TimeSeriesPoint>;
export type TimeSeriesData = z.infer<typeof TimeSeriesData>;

// ==================== Weapon/Loadout Analytics ====================

export const WeaponPerformance = z.object({
  weaponId: z.string(),
  weaponName: z.string(),
  
  // Usage stats
  sessionsUsed: z.number(),
  totalShots: z.number(),
  totalHits: z.number(),
  
  // Performance metrics
  avgAccuracy: z.number().min(0).max(1),
  avgCriticalRate: z.number().min(0).max(1),
  avgDamagePerHit: z.number(),
  
  // Economic stats
  avgProfitPerHour: z.number(),
  avgReturnRate: z.number(),
  totalProfit: z.number(),
  
  // Efficiency
  damagePerPED: z.number(),
  killsPerHour: z.number(),
  
  // Best session
  bestSessionId: z.string().optional(),
  bestSessionProfit: z.number().optional(),
});

export type WeaponPerformance = z.infer<typeof WeaponPerformance>;

// ==================== Mob Intelligence ====================

export const MobStats = z.object({
  mobName: z.string(),
  mobId: z.string().optional(),
  
  // Encounter stats
  totalEncounters: z.number(),
  totalKills: z.number(),
  deathsToMob: z.number(),
  
  // Combat metrics
  avgShotsToKill: z.number(),
  avgDamagePerKill: z.number(),
  avgTimeToKill: z.number(), // seconds
  
  // Economic
  avgLootPerKill: z.number(),
  totalLootValue: z.number(),
  profitPerKill: z.number(),
  
  // Danger assessment
  dangerLevel: z.number().min(0).max(1), // 0 = safe, 1 = deadly
  killSuccessRate: z.number().min(0).max(1),
  
  // Location data
  commonLocations: z.array(z.object({
    center: Coordinate,
    encounterCount: z.number(),
  })),
  
  // Optimal loadout
  recommendedWeapon: z.string().optional(),
  recommendedAmp: z.string().optional(),
});

export type MobStats = z.infer<typeof MobStats>;

// ==================== Location Analytics ====================

export const HuntingZoneAnalytics = z.object({
  zoneId: z.string(),
  center: Coordinate,
  radius: z.number(),
  zoneName: z.string().optional(),
  
  // Session stats
  totalSessions: z.number(),
  totalTimeHunted: z.number(), // seconds
  lastVisited: z.number(),
  
  // Economic performance
  totalProfit: z.number(),
  avgProfitPerHour: z.number(),
  avgReturnRate: z.number(),
  
  // Mob composition
  mobEncounters: z.record(z.string(), z.object({
    count: z.number(),
    avgLootValue: z.number(),
  })),
  
  // Safety metrics
  deathCount: z.number(),
  dangerLevel: z.number().min(0).max(1),
  
  // Recommendations
  recommendedLoadout: z.string().optional(),
  recommendedTimeOfDay: z.string().optional(),
  
  // Heatmap data
  profitHeatmap: z.array(z.object({
    location: Coordinate,
    profit: z.number(),
  })),
});

export type HuntingZoneAnalytics = z.infer<typeof HuntingZoneAnalytics>;

// ==================== Skill Progression ====================

export const SkillProgression = z.object({
  skillName: z.string(),
  
  // Timeline
  gains: z.array(z.object({
    timestamp: z.number(),
    gainAmount: z.number(),
    sessionId: z.string(),
  })),
  
  // Aggregates
  totalGain: z.number(),
  avgGainPerSession: z.number(),
  avgGainPerHour: z.number(),
  
  // Predictions
  estimatedLevel: z.number().optional(),
  projectedGainNextWeek: z.number().optional(),
});

export type SkillProgression = z.infer<typeof SkillProgression>;

// ==================== Comparative Analytics ====================

export const SessionComparison = z.object({
  sessionIds: z.array(z.string()),
  
  metrics: z.object({
    accuracy: z.array(z.number()),
    profitPerHour: z.array(z.number()),
    returnRate: z.array(z.number()),
    killsPerHour: z.array(z.number()),
  }),
  
  winner: z.object({
    bestAccuracy: z.string(),
    bestProfit: z.string(),
    bestReturnRate: z.string(),
    bestKillRate: z.string(),
  }),
});

export type SessionComparison = z.infer<typeof SessionComparison>;

// ==================== Trend Detection ====================

export const TrendAnalysis = z.object({
  metric: z.string(),
  period: z.enum(['7days', '30days', '90days', 'all']),
  
  // Trend data
  trend: z.enum(['improving', 'declining', 'stable']),
  percentChange: z.number(),
  
  // Statistical
  average: z.number(),
  median: z.number(),
  standardDeviation: z.number(),
  
  // Predictions
  predictedNextValue: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type TrendAnalysis = z.infer<typeof TrendAnalysis>;

// ==================== Economic Summary ====================

export const EconomicSummary = z.object({
  period: z.string(), // 'today', 'week', 'month', 'all'
  startTime: z.number(),
  endTime: z.number(),
  
  // Income
  totalLootValue: z.number(),
  totalGlobals: z.number(),
  globalValue: z.number(),
  
  // Expenses
  totalAmmoCost: z.number(),
  totalDecayCost: z.number(),
  totalRepairCost: z.number().optional(),
  
  // Net results
  grossProfit: z.number(),
  netProfit: z.number(),
  profitMargin: z.number(),
  
  // Efficiency metrics
  avgReturnRate: z.number(),
  costPerKill: z.number(),
  revenuePerHour: z.number(),
  
  // Breakdown by weapon/mob
  topProfitWeapon: z.string().optional(),
  topProfitMob: z.string().optional(),
  worstProfitWeapon: z.string().optional(),
});

export type EconomicSummary = z.infer<typeof EconomicSummary>;

// ==================== Achievement/Milestone Tracking ====================

export const Achievement = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  
  // Progress
  currentValue: z.number(),
  targetValue: z.number(),
  progress: z.number().min(0).max(1),
  
  // Metadata
  category: z.enum(['combat', 'economic', 'exploration', 'skill', 'special']),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  unlockedAt: z.number().optional(),
  
  // Rewards
  rewardDescription: z.string().optional(),
});

export type Achievement = z.infer<typeof Achievement>;

// ==================== Personal Bests ====================

export const PersonalBest = z.object({
  metric: z.string(),
  value: z.number(),
  sessionId: z.string(),
  sessionName: z.string(),
  achievedAt: z.number(),
  
  // Context
  weaponUsed: z.string().optional(),
  mobType: z.string().optional(),
  location: Coordinate.optional(),
});

export type PersonalBest = z.infer<typeof PersonalBest>;

// ==================== Recommendations ====================

export const HuntingRecommendation = z.object({
  type: z.enum(['loadout', 'location', 'mob', 'timing']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  
  title: z.string(),
  description: z.string(),
  
  // Supporting data
  expectedProfitIncrease: z.number().optional(),
  confidenceScore: z.number().min(0).max(1),
  
  // Actionable info
  suggestedWeapon: z.string().optional(),
  suggestedLocation: Coordinate.optional(),
  suggestedMob: z.string().optional(),
  
  // Reasoning
  basedOn: z.array(z.string()), // ['historical_data', 'trend_analysis', 'mob_intelligence']
});

export type HuntingRecommendation = z.infer<typeof HuntingRecommendation>;

// ==================== Dashboard Summary ====================

export const DashboardSummary = z.object({
  // Recent performance
  recentSessions: z.number(),
  recentProfit: z.number(),
  recentAccuracy: z.number(),
  
  // Trends
  profitTrend: z.enum(['up', 'down', 'stable']),
  accuracyTrend: z.enum(['up', 'down', 'stable']),
  
  // Highlights
  bestSession: z.object({
    id: z.string(),
    name: z.string(),
    profit: z.number(),
  }).optional(),
  
  // Personal bests recently broken
  recentAchievements: z.array(Achievement),
  
  // Recommendations
  topRecommendations: z.array(HuntingRecommendation),
});

export type DashboardSummary = z.infer<typeof DashboardSummary>;

// ==================== Combat Efficiency Metrics ====================

export const CombatEfficiency = z.object({
  // Offensive stats
  overallAccuracy: z.number().min(0).max(1),
  criticalRate: z.number().min(0).max(1),
  avgDamagePerHit: z.number().nonnegative(),
  maxDamageDealt: z.number().nonnegative(),
  damagePerPED: z.number().nonnegative(),
  
  // Kill efficiency
  avgShotsPerKill: z.number().nonnegative(),
  avgTimePerKill: z.number().nonnegative(), // seconds
  killsPerHour: z.number().nonnegative(),
  avgAmmoCostPerKill: z.number().nonnegative(),
  avgDecayCostPerKill: z.number().nonnegative(),
  
  // Defensive stats
  dodgeRate: z.number().min(0).max(1),
  evadeRate: z.number().min(0).max(1),
  deflectRate: z.number().min(0).max(1),
  avgDamageTaken: z.number().nonnegative(),
});

export type CombatEfficiency = z.infer<typeof CombatEfficiency>;

// ==================== Economy Trends ====================

export const EconomyTrends = z.object({
  timeframe: z.object({
    start: z.number(),
    end: z.number(),
  }),
  
  // Profit metrics
  totalProfit: z.number(),
  avgProfitPerSession: z.number(),
  profitTrend: TimeSeriesData,
  
  // Cost metrics
  totalAmmoCost: z.number().nonnegative(),
  totalDecayCost: z.number().nonnegative(),
  avgCostPerSession: z.number().nonnegative(),
  
  // Loot metrics
  totalLootValue: z.number().nonnegative(),
  avgLootPerSession: z.number().nonnegative(),
  globalRate: z.number().min(0).max(1),
  
  // Efficiency
  avgReturnRate: z.number().nonnegative(),
  
  // Best/worst
  bestSession: z.object({
    id: z.string().uuid(),
    name: z.string(),
    returnRate: z.number(),
  }).optional(),
  worstSession: z.object({
    id: z.string().uuid(),
    name: z.string(),
    returnRate: z.number(),
  }).optional(),
});

export type EconomyTrends = z.infer<typeof EconomyTrends>;

// ==================== Loot Distribution ====================

export const LootDistribution = z.object({
  totalLoots: z.number().nonnegative(),
  totalValue: z.number().nonnegative(),
  avgLootValue: z.number().nonnegative(),
  
  // Distribution buckets
  buckets: z.array(z.object({
    minValue: z.number().nonnegative(),
    maxValue: z.number().nonnegative(),
    count: z.number().nonnegative(),
    totalValue: z.number().nonnegative(),
    percentage: z.number().min(0).max(1),
  })),
  
  // Top globals
  globals: z.array(z.object({
    sessionId: z.string().uuid(),
    timestamp: z.number(),
    value: z.number().nonnegative(),
    items: z.array(z.string()),
  })),
  
  // Item frequencies
  commonItems: z.array(z.object({
    itemName: z.string(),
    count: z.number().positive(),
    totalValue: z.number().nonnegative(),
  })),
  
  // Statistical
  medianLootValue: z.number().nonnegative(),
  percentile95: z.number().nonnegative(),
});

export type LootDistribution = z.infer<typeof LootDistribution>;

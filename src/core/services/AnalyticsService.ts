/**
 * AnalyticsService
 * Pure business logic for calculating insights from session data
 */

import type { Session, SessionStats } from '../types/Session';
import type {
  WeaponPerformance,
  MobStats,
  TimeSeriesData,
  TimeSeriesPoint,
  CombatEfficiency,
  EconomyTrends,
  LootDistribution,
} from '../types/Analytics';

export class AnalyticsService {
  // ==================== Weapon Performance ====================
  
  /**
   * Calculate weapon performance metrics across sessions
   */
  static calculateWeaponPerformance(
    sessions: Session[],
    weaponId: string
  ): WeaponPerformance {
    const relevantSessions = sessions.filter(s =>
      s.events.some(e =>
        e.type === 'SHOT_FIRED' && e.payload.weaponId === weaponId
      )
    );
    
    if (relevantSessions.length === 0) {
      return this.emptyWeaponPerformance(weaponId);
    }
    
    const totalShots = relevantSessions.reduce(
      (sum, s) => sum + s.stats.totalShots,
      0
    );
    const totalHits = relevantSessions.reduce(
      (sum, s) => sum + s.stats.totalHits,
      0
    );
    const totalDamage = relevantSessions.reduce(
      (sum, s) => sum + s.stats.totalDamageDealt,
      0
    );
    const totalAmmoCost = relevantSessions.reduce(
      (sum, s) => sum + s.stats.totalAmmoCost,
      0
    );
    const totalKills = relevantSessions.reduce(
      (sum, s) => sum + s.stats.totalKills,
      0
    );
    const totalDuration = relevantSessions.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    const totalProfit = relevantSessions.reduce(
      (sum, s) => sum + s.stats.profit,
      0
    );
    
    const totalCriticals = this.countCriticals(relevantSessions);
    const accuracy = totalShots > 0 ? totalHits / totalShots : 0;
    const avgDamagePerHit = totalHits > 0 ? totalDamage / totalHits : 0;
    const damagePerPED = totalAmmoCost > 0 ? totalDamage / totalAmmoCost : 0;
    const avgProfitPerHour = totalDuration > 0 ? (totalProfit / totalDuration) * 3600 : 0;
    const returnRate = totalAmmoCost > 0 ? (totalProfit + totalAmmoCost) / totalAmmoCost : 0;
    
    return {
      weaponId,
      weaponName: weaponId, // TODO: Look up actual weapon name from loadout
      sessionsUsed: relevantSessions.length,
      totalShots,
      totalHits,
      avgAccuracy: accuracy,
      avgCriticalRate: totalHits > 0 ? totalCriticals / totalHits : 0,
      avgDamagePerHit,
      avgProfitPerHour,
      avgReturnRate: returnRate,
      totalProfit,
      damagePerPED,
      killsPerHour: totalDuration > 0 ? (totalKills / totalDuration) * 3600 : 0,
      bestSessionId: relevantSessions[0]?.id,
      bestSessionProfit: relevantSessions.length > 0 
        ? Math.max(...relevantSessions.map(s => s.stats.profit))
        : undefined,
    };
  }
  
  // Calculate critical count from hit events
  private static countCriticals(sessions: Session[]): number {
    return sessions.reduce((sum, s) => {
      return sum + s.events.filter(e => 
        e.type === 'HIT_REGISTERED' && e.payload.critical
      ).length;
    }, 0);
  }
  
  // ==================== Mob Statistics ====================
  
  /**
   * Calculate statistics for a specific mob type
   */
  static calculateMobStats(sessions: Session[], mobName: string): MobStats {
    // Extract all events related to this mob
    const mobKills = sessions.flatMap(s =>
      s.events.filter(
        e => e.type === 'MOB_KILLED' && e.payload.mobName === mobName
      )
    );
    
    const mobDeaths = sessions.flatMap(s =>
      s.events.filter(
        e => e.type === 'PLAYER_DEATH' && e.payload.mobName === mobName
      )
    );
    
    if (mobKills.length === 0) {
      return this.emptyMobStats(mobName);
    }
    
    // Calculate loot data
    const lootValues = mobKills.map(kill => {
      const session = sessions.find(s => s.id === kill.sessionId);
      if (!session) return 0;
      
      // Find loot event shortly after kill
      const lootEvent = session.events.find(
        e =>
          e.type === 'LOOT_RECEIVED' &&
          e.timestamp >= kill.timestamp &&
          e.timestamp <= kill.timestamp + 5000 // Within 5 seconds
      );
      
      return lootEvent && lootEvent.type === 'LOOT_RECEIVED' ? lootEvent.payload.totalTTValue : 0;
    });
    
    const totalLootValue = lootValues.reduce((sum, val) => sum + val, 0);
    const avgLootPerKill = mobKills.length > 0 ? totalLootValue / mobKills.length : 0;
    
    // Calculate danger level (deaths per encounter)
    const totalEncounters = mobKills.length + mobDeaths.length;
    const dangerLevel = totalEncounters > 0 ? mobDeaths.length / totalEncounters : 0;
    const killSuccessRate = totalEncounters > 0 ? mobKills.length / totalEncounters : 0;
    
    return {
      mobName,
      totalEncounters,
      totalKills: mobKills.length,
      deathsToMob: mobDeaths.length,
      avgShotsToKill: 0, // TODO: Calculate from shot events
      avgDamagePerKill: 0, // TODO: Calculate from damage events
      avgTimeToKill: 0, // TODO: Calculate from event timestamps
      avgLootPerKill,
      totalLootValue,
      profitPerKill: avgLootPerKill, // Simplified - should subtract costs
      dangerLevel,
      killSuccessRate,
      commonLocations: [], // TODO: Extract from GPS data
    };
  }
  
  // ==================== Time Series ====================
  
  /**
   * Generate time series data for a specific metric
   */
  static generateTimeSeries(
    sessions: Session[],
    metric: keyof SessionStats,
    timeUnit: 'minute' | 'hour' | 'day' | 'session' = 'session'
  ): TimeSeriesData {
    const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);
    
    const dataPoints: TimeSeriesPoint[] = sortedSessions.map(session => ({
      timestamp: session.startTime,
      value: this.extractMetricValue(session.stats, metric),
      label: session.name,
    }));
    
    return {
      metric: metric as string,
      points: dataPoints,
      aggregation: timeUnit === 'session' ? 'session' : timeUnit === 'hour' ? 'hourly' : timeUnit === 'day' ? 'daily' : 'session',
    };
  }
  
  // ==================== Combat Efficiency ====================
  
  /**
   * Calculate overall combat efficiency metrics
   */
  static calculateCombatEfficiency(sessions: Session[]): CombatEfficiency {
    if (sessions.length === 0) {
      return this.emptyCombatEfficiency();
    }
    
    const totalShots = sessions.reduce((sum, s) => sum + s.stats.totalShots, 0);
    const totalHits = sessions.reduce((sum, s) => sum + s.stats.totalHits, 0);
    const totalCriticals = sessions.reduce((sum, s) => sum + s.stats.totalCriticals, 0);
    const totalDamage = sessions.reduce((sum, s) => sum + s.stats.totalDamageDealt, 0);
    const totalKills = sessions.reduce((sum, s) => sum + s.stats.totalKills, 0);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalAmmoCost = sessions.reduce((sum, s) => sum + s.stats.totalAmmoCost, 0);
    const totalDecayCost = sessions.reduce((sum, s) => sum + s.stats.totalDecayCost, 0);
    const totalDodges = sessions.reduce((sum, s) => sum + s.stats.totalDodges, 0);
    const totalEvades = sessions.reduce((sum, s) => sum + s.stats.totalEvades, 0);
    const totalDeflects = sessions.reduce((sum, s) => sum + s.stats.totalDeflects, 0);
    const totalHitsTaken = sessions.reduce((sum, s) => sum + s.stats.totalHitsTaken, 0);
    const totalDamageTaken = sessions.reduce((sum, s) => sum + s.stats.totalDamageTaken, 0);
    
    const overallAccuracy = totalShots > 0 ? totalHits / totalShots : 0;
    const criticalRate = totalHits > 0 ? totalCriticals / totalHits : 0;
    const avgDamagePerHit = totalHits > 0 ? totalDamage / totalHits : 0;
    const damagePerPED = totalAmmoCost > 0 ? totalDamage / totalAmmoCost : 0;
    const avgShotsPerKill = totalKills > 0 ? totalShots / totalKills : 0;
    const avgTimePerKill = totalKills > 0 ? totalDuration / totalKills : 0;
    const killsPerHour = totalDuration > 0 ? (totalKills / totalDuration) * 3600 : 0;
    const avgAmmoCostPerKill = totalKills > 0 ? totalAmmoCost / totalKills : 0;
    const avgDecayCostPerKill = totalKills > 0 ? totalDecayCost / totalKills : 0;
    
    const totalDefenseAttempts = totalDodges + totalEvades + totalDeflects + totalHitsTaken;
    const dodgeRate = totalDefenseAttempts > 0 ? totalDodges / totalDefenseAttempts : 0;
    const evadeRate = totalDefenseAttempts > 0 ? totalEvades / totalDefenseAttempts : 0;
    const deflectRate = totalDefenseAttempts > 0 ? totalDeflects / totalDefenseAttempts : 0;
    const avgDamageTaken = totalHitsTaken > 0 ? totalDamageTaken / totalHitsTaken : 0;
    
    // Find max damage from all sessions
    const maxDamageDealt = Math.max(...sessions.map(s => s.stats.maxDamageHit));
    
    return {
      overallAccuracy,
      criticalRate,
      avgDamagePerHit,
      maxDamageDealt,
      damagePerPED,
      avgShotsPerKill,
      avgTimePerKill,
      killsPerHour,
      avgAmmoCostPerKill,
      avgDecayCostPerKill,
      dodgeRate,
      evadeRate,
      deflectRate,
      avgDamageTaken,
    };
  }
  
  // ==================== Economy Trends ====================
  
  /**
   * Analyze economic trends across sessions
   */
  static calculateEconomyTrends(sessions: Session[]): EconomyTrends {
    if (sessions.length === 0) {
      return this.emptyEconomyTrends();
    }
    
    const sortedSessions = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];
    
    const timeframe = {
      start: firstSession?.startTime || 0,
      end: lastSession?.endTime || Date.now(),
    };
    
    const totalProfit = sessions.reduce((sum, s) => sum + s.stats.profit, 0);
    const totalAmmoCost = sessions.reduce((sum, s) => sum + s.stats.totalAmmoCost, 0);
    const totalDecayCost = sessions.reduce((sum, s) => sum + s.stats.totalDecayCost, 0);
    const totalLootValue = sessions.reduce((sum, s) => sum + s.stats.totalLootTTValue, 0);
    const totalGlobals = sessions.reduce((sum, s) => sum + s.stats.totalGlobals, 0);
    const totalLoots = sessions.reduce((sum, s) => sum + s.stats.totalLoots, 0);
    
    const avgProfitPerSession = totalProfit / sessions.length;
    const avgCostPerSession = (totalAmmoCost + totalDecayCost) / sessions.length;
    const avgLootPerSession = totalLootValue / sessions.length;
    const globalRate = totalLoots > 0 ? totalGlobals / totalLoots : 0;
    const avgReturnRate = totalAmmoCost > 0 ? totalLootValue / totalAmmoCost : 0;
    
    // Find best and worst sessions by return rate
    const sessionsByReturnRate = [...sessions].sort(
      (a, b) => b.stats.returnRate - a.stats.returnRate
    );
    
    const bestSession = sessionsByReturnRate[0]
      ? {
          id: sessionsByReturnRate[0].id,
          name: sessionsByReturnRate[0].name,
          returnRate: sessionsByReturnRate[0].stats.returnRate,
        }
      : undefined;
    
    const worstSessionData = sessionsByReturnRate[sessions.length - 1];
    const worstSession = worstSessionData
      ? {
          id: worstSessionData.id,
          name: worstSessionData.name,
          returnRate: worstSessionData.stats.returnRate,
        }
      : undefined;
    
    const profitTrend = this.generateTimeSeries(sessions, 'profit', 'session');
    
    return {
      timeframe,
      totalProfit,
      avgProfitPerSession,
      profitTrend,
      totalAmmoCost,
      totalDecayCost,
      avgCostPerSession,
      totalLootValue,
      avgLootPerSession,
      globalRate,
      avgReturnRate,
      bestSession,
      worstSession,
    };
  }
  
  // ==================== Loot Distribution ====================
  
  /**
   * Analyze loot distribution patterns
   */
  static calculateLootDistribution(sessions: Session[]): LootDistribution {
    const allLootEvents = sessions.flatMap(s =>
      s.events.filter(e => e.type === 'LOOT_RECEIVED')
    );
    
    if (allLootEvents.length === 0) {
      return this.emptyLootDistribution();
    }
    
    const lootValues = allLootEvents
      .filter(e => e.type === 'LOOT_RECEIVED')
      .map(e => e.payload.totalTTValue);
    const totalValue = lootValues.reduce((sum, v) => sum + v, 0);
    const avgLootValue = totalValue / lootValues.length;
    
    // Create distribution buckets
    const bucketRanges = [
      { min: 0, max: 5 },
      { min: 5, max: 10 },
      { min: 10, max: 25 },
      { min: 25, max: 50 },
      { min: 50, max: 100 },
      { min: 100, max: 500 },
      { min: 500, max: Infinity },
    ];
    
    const buckets = bucketRanges.map(range => {
      const bucketLoots = lootValues.filter(
        v => v >= range.min && v < range.max
      );
      const bucketTotal = bucketLoots.reduce((sum, v) => sum + v, 0);
      
      return {
        minValue: range.min,
        maxValue: range.max === Infinity ? 999999 : range.max,
        count: bucketLoots.length,
        totalValue: bucketTotal,
        percentage: lootValues.length > 0 ? bucketLoots.length / lootValues.length : 0,
      };
    });
    
    // Extract globals
    const globals = allLootEvents
      .filter(e => e.type === 'LOOT_RECEIVED' && e.payload.isGlobal)
      .map(e => {
        if (e.type !== 'LOOT_RECEIVED') return null;
        return {
          sessionId: e.sessionId,
          timestamp: e.timestamp,
          value: e.payload.totalTTValue,
          items: e.payload.items.map(item => item.name),
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 globals
    
    // Calculate median and percentiles
    const sortedValues = [...lootValues].sort((a, b) => a - b);
    const medianLootValue = sortedValues[Math.floor(sortedValues.length / 2)] || 0;
    const percentile95Index = Math.floor(sortedValues.length * 0.95);
    const percentile95 = sortedValues[percentile95Index] || 0;
    
    return {
      totalLoots: allLootEvents.length,
      totalValue,
      avgLootValue,
      buckets,
      globals,
      commonItems: [], // TODO: Extract item frequencies
      medianLootValue,
      percentile95,
    };
  }
  
  // ==================== Helper Methods ====================
  
  private static extractMetricValue(
    stats: SessionStats,
    metric: keyof SessionStats
  ): number {
    const value = stats[metric];
    return typeof value === 'number' ? value : 0;
  }
  
  // ==================== Empty State Factories ====================
  
  private static emptyWeaponPerformance(weaponId: string): WeaponPerformance {
    return {
      weaponId,
      weaponName: weaponId,
      sessionsUsed: 0,
      totalShots: 0,
      totalHits: 0,
      avgAccuracy: 0,
      avgCriticalRate: 0,
      avgDamagePerHit: 0,
      avgProfitPerHour: 0,
      avgReturnRate: 0,
      totalProfit: 0,
      damagePerPED: 0,
      killsPerHour: 0,
    };
  }
  
  private static emptyMobStats(mobName: string): MobStats {
    return {
      mobName,
      totalEncounters: 0,
      totalKills: 0,
      deathsToMob: 0,
      avgShotsToKill: 0,
      avgDamagePerKill: 0,
      avgTimeToKill: 0,
      avgLootPerKill: 0,
      totalLootValue: 0,
      profitPerKill: 0,
      dangerLevel: 0,
      killSuccessRate: 0,
      commonLocations: [],
    };
  }
  
  private static emptyCombatEfficiency(): CombatEfficiency {
    return {
      overallAccuracy: 0,
      criticalRate: 0,
      avgDamagePerHit: 0,
      maxDamageDealt: 0,
      damagePerPED: 0,
      avgShotsPerKill: 0,
      avgTimePerKill: 0,
      killsPerHour: 0,
      avgAmmoCostPerKill: 0,
      avgDecayCostPerKill: 0,
      dodgeRate: 0,
      evadeRate: 0,
      deflectRate: 0,
      avgDamageTaken: 0,
    };
  }
  
  private static emptyEconomyTrends(): EconomyTrends {
    return {
      timeframe: { start: 0, end: 0 },
      totalProfit: 0,
      avgProfitPerSession: 0,
      profitTrend: {
        metric: 'profit',
        points: [],
        aggregation: 'session',
      },
      totalAmmoCost: 0,
      totalDecayCost: 0,
      avgCostPerSession: 0,
      totalLootValue: 0,
      avgLootPerSession: 0,
      globalRate: 0,
      avgReturnRate: 0,
    };
  }
  
  private static emptyLootDistribution(): LootDistribution {
    return {
      totalLoots: 0,
      totalValue: 0,
      avgLootValue: 0,
      buckets: [],
      globals: [],
      commonItems: [],
      medianLootValue: 0,
      percentile95: 0,
    };
  }
}

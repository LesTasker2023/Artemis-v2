/**
 * SessionService
 * Pure business logic for session management
 * All functions are pure - no side effects, no mutations
 */

import { produce } from 'immer';
import { Session, SessionStats } from '../types/Session';
import { SessionEvent } from '../types/Events';
import { LoadoutService } from './LoadoutService';
import type { Loadout } from '../types/Loadout';

// Cross-platform UUID generation
function generateUUID(): string {
  // Try Node.js crypto first (main process)
  if (typeof window === 'undefined') {
    try {
      const { randomUUID } = require('crypto');
      return randomUUID();
    } catch {
      // Fall through to browser implementation
    }
  }
  
  // Browser crypto (renderer process)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback (should never happen in modern environments)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export class SessionService {
  /**
   * Create a new empty session
   */
  static create(userId: string, name: string): Session {
    const now = Date.now();
    
    return {
      id: generateUUID(),
      name,
      userId,
      startTime: now,
      duration: 0,
      stats: this.emptyStats(),
      events: [],
      tags: [],
      version: '2.0',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Add an event to a session (returns NEW session, original unchanged)
   */
  static addEvent(session: Session, event: SessionEvent, loadout?: Loadout): Session {
    return produce(session, (draft) => {
      draft.events.push(event);
      draft.stats = this.calculateStats(draft.events, loadout);
      draft.duration = this.calculateDuration(draft);
      draft.updatedAt = Date.now();
    });
  }

  /**
   * Add multiple events at once (more efficient)
   */
  static addEvents(session: Session, events: SessionEvent[], loadout?: Loadout): Session {
    return produce(session, (draft) => {
      draft.events.push(...events);
      draft.updatedAt = Date.now();
      draft.stats = this.calculateStats(draft.events, loadout);
      draft.duration = this.calculateDuration(draft);
      draft.updatedAt = Date.now();
    });
  }

  /**
   * End a session (marks endTime, recalculates stats)
   */
  /**
   * End a session (returns new session with endTime set)
   * Pass loadout to preserve accurate cost calculations
   */
  static end(session: Session, loadout?: Loadout): Session {
    return produce(session, (draft) => {
      draft.endTime = Date.now();
      draft.duration = this.calculateDuration(draft);
      // Recalculate stats with loadout to preserve cost info
      draft.stats = this.calculateStats(draft.events, loadout);
      draft.stats.profitPerHour = this.calculateProfitPerHour(draft);
      draft.updatedAt = Date.now();
    });
  }

  /**
   * Calculate all stats from events (pure function)
   * Optionally pass loadout for accurate ammo cost calculation
   */
  static calculateStats(events: SessionEvent[], loadout?: Loadout): SessionStats {
    // Combat stats
    const shotsFired = events.filter((e) => e.type === 'SHOT_FIRED').length;
    const hitsRegistered = events.filter((e) => e.type === 'HIT_REGISTERED').length;
    const missesRegistered = events.filter((e) => e.type === 'MISS_REGISTERED').length;
    
    // Defensive stats - ONLY count player's defensive actions
    const playerDodges = events.filter((e) => e.type === 'DODGE_REGISTERED' && e.payload.actor === 'player').length;
    const playerEvades = events.filter((e) => e.type === 'EVADE_REGISTERED' && e.payload.actor === 'player').length;
    const deflects = events.filter((e) => e.type === 'DAMAGE_DEFLECTED').length;
    
    // Target defensive actions (mob dodges/evades YOUR attacks) - these affect YOUR accuracy
    const targetDodges = events.filter((e) => e.type === 'DODGE_REGISTERED' && e.payload.actor === 'target').length;
    const targetEvades = events.filter((e) => e.type === 'EVADE_REGISTERED' && e.payload.actor === 'target').length;
    
    // Calculate total shots from combat actions (EU doesn't log every SHOT_FIRED)
    // Total offensive actions: Hits + Misses + Target's dodges/evades
    const totalCombatActions = hitsRegistered + missesRegistered + targetDodges + targetEvades;
    const effectiveShotsFired = shotsFired > 0 ? shotsFired : totalCombatActions;
    
    // Damage taken stats
    const hitsTakenEvents = events.filter((e) => e.type === 'HIT_TAKEN');
    const criticalHitsTaken = events.filter((e) => e.type === 'CRITICAL_HIT_TAKEN').length;
    const totalDamageTaken = hitsTakenEvents.reduce((sum, e) => sum + e.payload.damage, 0)
      + events.filter((e) => e.type === 'CRITICAL_HIT_TAKEN').reduce((sum, e) => sum + e.payload.damage, 0);

    // Critical hits
    const criticals = events
      .filter((e) => e.type === 'HIT_REGISTERED' && e.payload.critical)
      .length;

    // Damage calculation
    const hitEvents = events.filter((e) => e.type === 'HIT_REGISTERED');
    const totalDamageDealt = hitEvents.reduce((sum, e) => sum + e.payload.damage, 0);
    const totalDamageResisted = hitEvents.reduce((sum, e) => sum + (e.payload.damageResisted || 0), 0);
    const avgDamagePerHit = hitsRegistered > 0 ? totalDamageDealt / hitsRegistered : 0;
    const maxDamageHit = hitEvents.length > 0
      ? Math.max(...hitEvents.map((e) => e.payload.damage))
      : 0;

    // Mob stats
    const kills = events.filter((e) => e.type === 'MOB_KILLED').length;
    const deaths = events.filter((e) => e.type === 'PLAYER_DEATH').length;

    // Economic stats - Calculate from loadout if available
    let totalAmmoCost = 0;
    
    if (loadout && loadout.costs) {
      // Use effective cost (respects manual override)
      const costPerShot = LoadoutService.getEffectiveCostPerShot(loadout);
      totalAmmoCost = effectiveShotsFired * costPerShot;
    } else {
      // Fallback: Sum from SHOT_FIRED events (if they have ammoCost)
      totalAmmoCost = events
        .filter((e) => e.type === 'SHOT_FIRED')
        .reduce((sum, e) => sum + (e.payload.ammoCost || 0), 0);
    }

    const lootEvents = events.filter((e) => e.type === 'LOOT_RECEIVED');
    const totalLootTTValue = lootEvents.reduce(
      (sum, e) => sum + e.payload.totalTTValue,
      0
    );
    const totalLootMVValue = lootEvents.reduce(
      (sum, e) => sum + (e.payload.totalMVValue || e.payload.totalTTValue),
      0
    );

    const decayEvents = events.filter((e) => e.type === 'PLAYER_DEATH');
    const totalDecayCost = decayEvents.reduce(
      (sum, e) => sum + (e.payload.decayCost || 0),
      0
    );

    // Calculated metrics
    const profit = totalLootTTValue - totalAmmoCost - totalDecayCost;
    const returnRate = totalAmmoCost > 0 ? totalLootTTValue / totalAmmoCost : 0;
    const damagePerPED = totalAmmoCost > 0 ? totalDamageDealt / totalAmmoCost : 0;

    // Rates
    const accuracy = effectiveShotsFired > 0 ? hitsRegistered / effectiveShotsFired : 0;
    const criticalRate = hitsRegistered > 0 ? criticals / hitsRegistered : 0;
    const totalDefensiveActions = playerDodges + playerEvades + deflects + hitsTakenEvents.length;
    const dodgeRate = totalDefensiveActions > 0 ? playerDodges / totalDefensiveActions : 0;
    const evadeRate = totalDefensiveActions > 0 ? playerEvades / totalDefensiveActions : 0;
    const deflectRate = totalDefensiveActions > 0 ? deflects / totalDefensiveActions : 0;

    // Loot stats
    const totalLoots = lootEvents.length;
    const totalGlobals = lootEvents.filter((e) => e.payload.isGlobal).length;
    const avgLootValue = totalLoots > 0 ? totalLootTTValue / totalLoots : 0;
    
    // Skill & Attribute progression
    const skillGainEvents = events.filter((e) => e.type === 'SKILL_GAIN');
    const skillRankEvents = events.filter((e) => e.type === 'SKILL_RANK_GAIN');
    const attributeGainEvents = events.filter((e) => e.type === 'ATTRIBUTE_GAIN');
    const newSkillEvents = events.filter((e) => e.type === 'NEW_SKILL_ACQUIRED');
    
    // Aggregate skill gains by name
    const skillGainsByName: Record<string, number> = {};
    for (const event of skillGainEvents) {
      if (event.type === 'SKILL_GAIN') {
        const { skillName, gainAmount } = event.payload;
        skillGainsByName[skillName] = (skillGainsByName[skillName] || 0) + gainAmount;
      }
    }
    
    // Track skill ranks by name
    const skillRanksByName: Record<string, number> = {};
    for (const event of skillRankEvents) {
      if (event.type === 'SKILL_RANK_GAIN') {
        const { skillName } = event.payload;
        skillRanksByName[skillName] = (skillRanksByName[skillName] || 0) + 1;
      }
    }
    
    // Aggregate attribute gains by name
    const attributeGainsByName: Record<string, number> = {};
    for (const event of attributeGainEvents) {
      if (event.type === 'ATTRIBUTE_GAIN') {
        const { attributeName, gainAmount } = event.payload;
        attributeGainsByName[attributeName] = (attributeGainsByName[attributeName] || 0) + gainAmount;
      }
    }
    
    // Track new skills acquired
    const newSkillsAcquired: string[] = [];
    for (const event of newSkillEvents) {
      if (event.type === 'NEW_SKILL_ACQUIRED') {
        newSkillsAcquired.push(event.payload.skillName);
      }
    }
    
    // Effects & Buffs
    const effectEvents = events.filter((e) => e.type === 'EFFECT_RECEIVED');
    const healingEvents = events.filter((e) => e.type === 'HEALING_RECEIVED');
    const totalHealing = healingEvents.reduce((sum, e) => {
      if (e.type === 'HEALING_RECEIVED') {
        return sum + e.payload.amount;
      }
      return sum;
    }, 0);
    
    const effectsByName: Record<string, number> = {};
    for (const event of effectEvents) {
      if (event.type === 'EFFECT_RECEIVED') {
        const { effectName } = event.payload;
        effectsByName[effectName] = (effectsByName[effectName] || 0) + 1;
      }
    }
    
    // Other stats
    const globalsObserved = events.filter((e) => e.type === 'GLOBAL_EVENT_OBSERVED').length;

    return {
      // Combat
      totalShots: effectiveShotsFired,
      totalHits: hitsRegistered,
      totalMisses: missesRegistered,
      totalCriticals: criticals,
      accuracy,
      criticalRate,

      // Defensive (ONLY player's defensive actions)
      totalDodges: playerDodges,
      totalEvades: playerEvades,
      totalDeflects: deflects,
      totalHitsTaken: hitsTakenEvents.length,
      totalCriticalHitsTaken: criticalHitsTaken,
      totalDamageTaken,
      dodgeRate,
      evadeRate,
      deflectRate,

      // Mobs
      totalKills: kills,
      totalDeaths: deaths,

      // Damage
      totalDamageDealt,
      totalDamageResisted,
      avgDamagePerHit,
      maxDamageHit,

      // Economic
      totalAmmoCost,
      totalLootTTValue,
      totalLootMVValue,
      totalDecayCost,

      // Metrics
      profit,
      profitPerHour: 0, // Calculated separately with duration
      returnRate,
      damagePerPED,

      // Loot
      totalLoots,
      totalGlobals,
      avgLootValue,
      
      // Skills & Attributes
      totalSkillGains: skillGainEvents.length,
      totalSkillRankGains: skillRankEvents.length,
      totalAttributeGains: attributeGainEvents.length,
      totalNewSkills: newSkillEvents.length,
      skillGainsByName,
      skillRanksByName,
      attributeGainsByName,
      newSkillsAcquired,
      
      // Effects & Buffs
      totalEffectsReceived: effectEvents.length,
      totalHealing,
      effectsByName,
      
      // Other stats
      totalGlobalsObserved: globalsObserved,
    };
  }

  /**
   * Calculate profit per hour for a session
   */
  static calculateProfitPerHour(session: Session): number {
    if (session.duration === 0) return 0;
    return (session.stats.profit / session.duration) * 3600;
  }

  /**
   * Calculate session duration in seconds
   */
  private static calculateDuration(session: Session): number {
    const end = session.endTime ?? Date.now();
    return Math.floor((end - session.startTime) / 1000);
  }

  /**
   * Create empty stats object
   */
  private static emptyStats(): SessionStats {
    return {
      totalShots: 0,
      totalHits: 0,
      totalMisses: 0,
      totalCriticals: 0,
      accuracy: 0,
      criticalRate: 0,
      totalDodges: 0,
      totalEvades: 0,
      totalDeflects: 0,
      totalHitsTaken: 0,
      totalCriticalHitsTaken: 0,
      totalDamageTaken: 0,
      dodgeRate: 0,
      evadeRate: 0,
      deflectRate: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalDamageDealt: 0,
      totalDamageResisted: 0,
      avgDamagePerHit: 0,
      maxDamageHit: 0,
      totalAmmoCost: 0,
      totalLootTTValue: 0,
      totalLootMVValue: 0,
      totalDecayCost: 0,
      profit: 0,
      profitPerHour: 0,
      returnRate: 0,
      damagePerPED: 0,
      totalLoots: 0,
      totalGlobals: 0,
      avgLootValue: 0,
      totalSkillGains: 0,
      totalSkillRankGains: 0,
      totalAttributeGains: 0,
      totalNewSkills: 0,
      skillGainsByName: {},
      skillRanksByName: {},
      attributeGainsByName: {},
      newSkillsAcquired: [],
      totalEffectsReceived: 0,
      totalHealing: 0,
      effectsByName: {},
      totalGlobalsObserved: 0,
    };
  }

  /**
   * Build a session from events (useful for migration/reconstruction)
   */
  static fromEvents(
    id: string,
    userId: string,
    name: string,
    events: SessionEvent[]
  ): Session {
    if (events.length === 0) {
      return this.create(userId, name);
    }

    const startTime = events[0]?.timestamp ?? Date.now();
    const endTime = events[events.length - 1]?.timestamp;
    const duration = endTime ? Math.floor((endTime - startTime) / 1000) : 0;

    const stats = this.calculateStats(events);
    stats.profitPerHour = duration > 0 ? (stats.profit / duration) * 3600 : 0;

    return {
      id,
      name,
      userId,
      startTime,
      endTime,
      duration,
      stats,
      events,
      tags: [],
      version: '2.0',
      createdAt: startTime,
      updatedAt: Date.now(),
    };
  }
}

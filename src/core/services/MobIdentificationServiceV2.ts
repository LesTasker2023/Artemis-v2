/**
 * Mob Identification Service V2
 * Uses entropia.db via IPC for full mob database access
 * Cross-references health + location + loot for accurate identification
 */

import { SessionEvent } from '../types/Events';
import type { Coordinate } from '../types/GPS';

export interface KillAnalysis {
  // Raw combat data
  totalDamage: number;
  totalShots: number;
  hits: number;
  misses: number;
  criticals: number;
  dodges: number;
  evades: number;
  timeToKill: number; // milliseconds
  
  // Derived metrics
  estimatedHealth: number;
  accuracy: number;
  criticalRate: number;
  
  // Location
  location?: Coordinate;
}

export interface MobIdentificationResult {
  confidence: number; // 0-1 (0.8+ = high confidence)
  identifiedMob: string; // e.g., "Atrox Young"
  mobName: string;
  species: string;
  maturity: string;
  hp: number;
  distance: number; // meters from spawn location
  reasoning: string[]; // Why we think it's this mob
}

export class MobIdentificationServiceV2 {
  
  /**
   * Analyze combat events between two kills to extract stats
   */
  analyzeKill(
    events: SessionEvent[],
    killEvent: SessionEvent,
    previousKillEvent?: SessionEvent
  ): KillAnalysis {
    if (killEvent.type !== 'MOB_KILLED') {
      throw new Error('killEvent must be MOB_KILLED type');
    }
    
    // Find events between previous kill and this kill (or session start)
    const killTimestamp = killEvent.timestamp;
    const startTimestamp = previousKillEvent?.timestamp || (killTimestamp - 300000); // Default 5 min window
    
    const combatEvents = events.filter(
      e => e.timestamp > startTimestamp && e.timestamp <= killTimestamp
    );
    
    // Calculate combat stats
    const hits = combatEvents.filter(e => e.type === 'HIT_REGISTERED').length;
    const misses = combatEvents.filter(e => e.type === 'MISS_REGISTERED').length;
    const dodges = combatEvents.filter(
      e => e.type === 'DODGE_REGISTERED' && e.payload.actor === 'target'
    ).length;
    const evades = combatEvents.filter(
      e => e.type === 'EVADE_REGISTERED' && e.payload.actor === 'target'
    ).length;
    
    const totalShots = hits + misses + dodges + evades;
    const accuracy = totalShots > 0 ? hits / totalShots : 0;
    
    // Calculate damage
    const hitEvents = combatEvents.filter(e => e.type === 'HIT_REGISTERED');
    
    // Track cumulative damage to detect overkill on final hit
    let cumulativeDamage = 0;
    let actualMobHP = 0;
    let overkillDetected = false;
    
    for (let i = 0; i < hitEvents.length; i++) {
      const event = hitEvents[i];
      if (event.type === 'HIT_REGISTERED') {
        const damage = event.payload.damage;
        const resistedDamage = event.payload.damageResisted || 0;
        const effectiveDamage = damage + resistedDamage;
        
        cumulativeDamage += effectiveDamage;
        
        // If this is the last hit, check for overkill
        // Heuristic: If final hit is significantly larger than average, it likely contains overkill
        if (i === hitEvents.length - 1 && hitEvents.length > 1) {
          // Calculate average damage per hit (excluding last hit)
          const previousHits = hitEvents.slice(0, -1);
          const avgDamage = previousHits.reduce((sum, e) => {
            if (e.type === 'HIT_REGISTERED') {
              return sum + e.payload.damage + (e.payload.damageResisted || 0);
            }
            return sum;
          }, 0) / previousHits.length;
          
          // If last hit is > 2x average, assume significant overkill
          // Use cumulative damage up to last hit + average damage as mob HP
          if (effectiveDamage > avgDamage * 2 && avgDamage > 0) {
            actualMobHP = cumulativeDamage - effectiveDamage + avgDamage;
            overkillDetected = true;
          } else {
            actualMobHP = cumulativeDamage;
          }
        } else {
          actualMobHP = cumulativeDamage;
        }
      }
    }
    
    // Fallback: if only 1 hit, use that damage as HP
    if (hitEvents.length === 1) {
      actualMobHP = cumulativeDamage;
    }
    
    const totalDamage = cumulativeDamage;
    
    // Calculate critical hits
    const criticals = hitEvents.filter(
      e => e.type === 'HIT_REGISTERED' && e.payload.critical
    ).length;
    const criticalRate = hits > 0 ? criticals / hits : 0;
    
    // Estimate actual mob health (with overkill correction)
    const estimatedHealth = actualMobHP;
    
    // Time to kill
    const firstCombatEvent = combatEvents[0];
    const timeToKill = firstCombatEvent
      ? killTimestamp - firstCombatEvent.timestamp
      : 0;
    
    return {
      totalDamage,
      totalShots,
      hits,
      misses,
      criticals,
      dodges,
      evades,
      timeToKill,
      estimatedHealth,
      accuracy,
      criticalRate,
      location: killEvent.payload.location,
    };
  }
  
  /**
   * Identify mob using database cross-reference (health + location + loot)
   */
  async identifyMob(
    analysis: KillAnalysis,
    lootItems?: string[]
  ): Promise<MobIdentificationResult | null> {
    if (!analysis.location || analysis.location.lon === 0 || analysis.location.lat === 0) {
      // No GPS data - can't identify without location
      return null;
    }
    
    const reasoning: string[] = [];
    
    // Query database via IPC
    const result = await window.electron.entropiaDB.identifyMob(
      analysis.estimatedHealth,
      analysis.location as { lon: number; lat: number },
      lootItems
    );
    
    if (!result.success || !result.data) {
      reasoning.push(`No mobs found matching ${analysis.estimatedHealth.toFixed(0)} HP near (${analysis.location.lon}, ${analysis.location.lat})`);
      return null;
    }
    
    const identified = result.data;
    
    // Calculate confidence based on distance and health match
    const healthDiff = Math.abs(identified.hp - analysis.estimatedHealth);
    const healthMatchPercent = 1 - (healthDiff / identified.hp);
    const distanceScore = identified.distance < 1000 ? 1.0 : 
                         identified.distance < 2000 ? 0.8 :
                         identified.distance < 3000 ? 0.6 : 0.4;
    
    const confidence = (healthMatchPercent * 0.6) + (distanceScore * 0.4);
    
    reasoning.push(
      `Health: ${analysis.estimatedHealth.toFixed(0)} HP matches ${identified.name} (${identified.hp} HP) - ${(healthMatchPercent * 100).toFixed(0)}% match`
    );
    
    reasoning.push(
      `Location: ${identified.distance.toFixed(0)}m from ${identified.name} spawn zone`
    );
    
    if (lootItems && lootItems.length > 0) {
      reasoning.push(`Loot: ${lootItems.join(', ')}`);
    }
    
    return {
      confidence,
      identifiedMob: `${identified.name}`,
      mobName: identified.name,
      species: identified.species || 'Unknown',
      maturity: identified.maturity || 'Unknown',
      hp: identified.hp,
      distance: identified.distance,
      reasoning,
    };
  }
}

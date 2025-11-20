/**
 * Mob Identification Service
 * Identifies which mob was killed based on combat patterns, location, and loot
 */

import { SessionEvent } from '../types/Events';
import type { Coordinate } from '../types/GPS';

// Mob profile data (health, spawn locations, typical loot)
export interface MobProfile {
  name: string;
  maturity: string; // Young, Mature, Old, Provider, etc.
  
  // Combat characteristics
  minHealth: number;
  maxHealth: number;
  avgHealth: number;
  
  // Location data
  spawnZones: {
    center: Coordinate;
    radius: number; // meters
    planet: string;
  }[];
  
  // Loot signatures (helps identification)
  commonLoot: string[]; // Item names that frequently drop
  uniqueLoot: string[]; // Items that ONLY this mob drops
  
  // Combat behavior
  avgDefenseSkill: number; // Higher = more dodges/evades
  damageResistance: number; // % damage reduction
}

// Known Entropia Universe mobs
const MOB_DATABASE: MobProfile[] = [
  // Calypso - Common hunting mobs
  {
    name: 'Snablesnot',
    maturity: 'Young',
    minHealth: 45,
    maxHealth: 55,
    avgHealth: 50,
    spawnZones: [
      { center: { lon: 61000, lat: 75000 }, radius: 5000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Snablesnot Hide'],
    uniqueLoot: ['Snablesnot Tail'],
    avgDefenseSkill: 20,
    damageResistance: 0.05,
  },
  {
    name: 'Snablesnot',
    maturity: 'Mature',
    minHealth: 80,
    maxHealth: 100,
    avgHealth: 90,
    spawnZones: [
      { center: { lon: 61000, lat: 75000 }, radius: 5000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Snablesnot Hide'],
    uniqueLoot: ['Snablesnot Tail'],
    avgDefenseSkill: 30,
    damageResistance: 0.1,
  },
  {
    name: 'Atrox',
    maturity: 'Young',
    minHealth: 600,
    maxHealth: 700,
    avgHealth: 650,
    spawnZones: [
      { center: { lon: 78000, lat: 68000 }, radius: 3000, planet: 'Calypso' }, // Near user's current location
    ],
    commonLoot: ['Animal Oil Residue', 'Atrox Hide', 'Animal Muscle Oil'],
    uniqueLoot: ['Atrox Skull'],
    avgDefenseSkill: 50,
    damageResistance: 0.15,
  },
  {
    name: 'Atrox',
    maturity: 'Mature',
    minHealth: 1200,
    maxHealth: 1400,
    avgHealth: 1300,
    spawnZones: [
      { center: { lon: 78000, lat: 68000 }, radius: 3000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Atrox Hide', 'Animal Muscle Oil'],
    uniqueLoot: ['Atrox Skull'],
    avgDefenseSkill: 70,
    damageResistance: 0.2,
  },
  {
    name: 'Foul',
    maturity: 'Young',
    minHealth: 250,
    maxHealth: 300,
    avgHealth: 275,
    spawnZones: [
      { center: { lon: 65000, lat: 70000 }, radius: 4000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Foul Hide'],
    uniqueLoot: ['Foul Beak'],
    avgDefenseSkill: 35,
    damageResistance: 0.08,
  },
  {
    name: 'Foul',
    maturity: 'Mature',
    minHealth: 450,
    maxHealth: 550,
    avgHealth: 500,
    spawnZones: [
      { center: { lon: 65000, lat: 70000 }, radius: 4000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Foul Hide'],
    uniqueLoot: ['Foul Beak'],
    avgDefenseSkill: 50,
    damageResistance: 0.12,
  },
  {
    name: 'Cornundacauda',
    maturity: 'Young',
    minHealth: 150,
    maxHealth: 200,
    avgHealth: 175,
    spawnZones: [
      { center: { lon: 70000, lat: 80000 }, radius: 6000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Cornundacauda Hide'],
    uniqueLoot: ['Cornundacauda Horn'],
    avgDefenseSkill: 25,
    damageResistance: 0.1,
  },
  {
    name: 'Exarosaur',
    maturity: 'Young',
    minHealth: 900,
    maxHealth: 1100,
    avgHealth: 1000,
    spawnZones: [
      { center: { lon: 55000, lat: 65000 }, radius: 5000, planet: 'Calypso' },
    ],
    commonLoot: ['Animal Oil Residue', 'Exarosaur Hide', 'Animal Muscle Oil'],
    uniqueLoot: ['Exarosaur Claw'],
    avgDefenseSkill: 60,
    damageResistance: 0.18,
  },
  // Add more mobs as needed
];

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
  identifiedMob: string; // e.g., "Atrox (Young)"
  mobName: string;
  maturity: string;
  alternatives: Array<{ mob: string; confidence: number }>; // Other possibilities
  reasoning: string[]; // Why we think it's this mob
}

export class MobIdentificationService {
  /**
   * Analyze combat events between two kills to extract stats
   */
  static analyzeKill(
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
    
    // Track cumulative damage to detect when mob HP reaches zero (to exclude overkill)
    let cumulativeDamage = 0;
    let actualMobHP = 0;
    let overkillDetected = false;
    
    for (const event of hitEvents) {
      if (event.type === 'HIT_REGISTERED') {
        const damage = event.payload.damage;
        const resistedDamage = event.payload.damageResisted || 0;
        const effectiveDamage = damage + resistedDamage;
        
        cumulativeDamage += effectiveDamage;
        
        // If this is the last hit, check for overkill
        // Heuristic: If this hit is significantly larger than average, it likely contains overkill
        if (event === hitEvents[hitEvents.length - 1] && hitEvents.length > 1) {
          // Calculate average damage per hit (excluding last hit)
          const previousHits = hitEvents.slice(0, -1);
          const avgDamage = previousHits.reduce((sum, e) => {
            if (e.type === 'HIT_REGISTERED') {
              return sum + e.payload.damage + (e.payload.damageResisted || 0);
            }
            return sum;
          }, 0) / previousHits.length;
          
          // If last hit is > 2x average, assume significant overkill
          // Use cumulative damage up to last hit as mob HP
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
    
    const totalDamage = hitEvents.reduce((sum, e) => {
      if (e.type === 'HIT_REGISTERED') {
        return sum + e.payload.damage;
      }
      return sum;
    }, 0);
    
    const criticals = hitEvents.filter(
      e => e.type === 'HIT_REGISTERED' && e.payload.critical
    ).length;
    const criticalRate = hits > 0 ? criticals / hits : 0;
    
    // Use the overkill-corrected HP estimate
    const estimatedHealth = Math.round(actualMobHP);
    
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
   * Identify mob based on combat analysis and loot
   */
  static identifyMob(
    analysis: KillAnalysis,
    lootItems?: string[]
  ): MobIdentificationResult {
    const candidates: Array<{ profile: MobProfile; score: number; reasoning: string[] }> = [];
    
    for (const mobProfile of MOB_DATABASE) {
      const reasoning: string[] = [];
      let score = 0;
      
      // 1. Health-based matching (40 points max)
      const healthDiff = Math.abs(analysis.estimatedHealth - mobProfile.avgHealth);
      const healthRange = mobProfile.maxHealth - mobProfile.minHealth;
      
      if (analysis.estimatedHealth >= mobProfile.minHealth &&
          analysis.estimatedHealth <= mobProfile.maxHealth) {
        score += 40; // Perfect match
        reasoning.push(`Health ${analysis.estimatedHealth.toFixed(0)} HP matches ${mobProfile.name} range (${mobProfile.minHealth}-${mobProfile.maxHealth})`);
      } else if (healthDiff < healthRange * 1.5) {
        const healthScore = 40 * (1 - (healthDiff / (healthRange * 2)));
        score += healthScore;
        reasoning.push(`Health ${analysis.estimatedHealth.toFixed(0)} HP is close to ${mobProfile.name} (avg: ${mobProfile.avgHealth})`);
      }
      
      // 2. Location-based matching (30 points max)
      if (analysis.location) {
        for (const zone of mobProfile.spawnZones) {
          const distance = this.calculateDistance(analysis.location, zone.center);
          if (distance <= zone.radius) {
            score += 30;
            reasoning.push(`Location matches ${mobProfile.name} spawn zone in ${zone.planet}`);
            break;
          } else if (distance <= zone.radius * 2) {
            score += 15;
            reasoning.push(`Location near ${mobProfile.name} spawn zone`);
            break;
          }
        }
      }
      
      // 3. Loot-based matching (30 points max)
      if (lootItems && lootItems.length > 0) {
        const uniqueLootMatches = lootItems.filter(item =>
          mobProfile.uniqueLoot.some(unique => item.includes(unique))
        ).length;
        
        if (uniqueLootMatches > 0) {
          score += 30; // Unique loot = definitive
          reasoning.push(`Unique loot confirms ${mobProfile.name}`);
        } else {
          const commonLootMatches = lootItems.filter(item =>
            mobProfile.commonLoot.some(common => item.includes(common))
          ).length;
          
          if (commonLootMatches > 0) {
            score += 15 * (commonLootMatches / mobProfile.commonLoot.length);
            reasoning.push(`${commonLootMatches} common loot items match ${mobProfile.name}`);
          }
        }
      }
      
      candidates.push({ profile: mobProfile, score, reasoning });
    }
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    const bestMatch = candidates[0];
    const confidence = bestMatch ? bestMatch.score / 100 : 0;
    
    const alternatives = candidates
      .slice(1, 4)
      .map(c => ({
        mob: `${c.profile.name} (${c.profile.maturity})`,
        confidence: c.score / 100,
      }));
    
    return {
      confidence,
      identifiedMob: bestMatch
        ? `${bestMatch.profile.name} (${bestMatch.profile.maturity})`
        : 'Unknown Creature',
      mobName: bestMatch?.profile.name || 'Unknown Creature',
      maturity: bestMatch?.profile.maturity || 'Unknown',
      alternatives,
      reasoning: bestMatch?.reasoning || ['No matching mob profiles'],
    };
  }
  
  /**
   * Calculate distance between two GPS coordinates (simplified)
   */
  private static calculateDistance(
    coord1: Coordinate,
    coord2: Coordinate
  ): number {
    // Simplified distance calculation (Euclidean)
    // In EU, 1 unit ≈ 1 meter
    const dx = coord1.lon - coord2.lon;
    const dy = coord1.lat - coord2.lat;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Update mob database with user's hunting data (machine learning approach)
   */
  static learnFromKill(
    identificationResult: MobIdentificationResult,
    analysis: KillAnalysis,
    actualMobName?: string // If user manually corrects
  ): void {
    // TODO: Implement adaptive learning
    // - Update health ranges if we see consistent outliers
    // - Add new spawn zones if kills happen outside known areas
    // - Update loot tables based on what actually drops
    // - Improve confidence thresholds over time
    
    console.log('[MobIdentification] Learning opportunity:', {
      identified: identificationResult.identifiedMob,
      actual: actualMobName,
      confidence: identificationResult.confidence,
      health: analysis.estimatedHealth,
    });
  }
}

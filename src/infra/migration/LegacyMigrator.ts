/**
 * Legacy Session Migrator
 * Converts V1 session JSON files to V2 event-sourced format
 */

import { Session, SessionEvent } from '../../core/types';
import { SessionService } from '../../core/services/SessionService';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Legacy V1 session format
 */
interface LegacySession {
  name: string;
  timestamp: number;
  startTime: number;
  endTime: number;
  duration: number;
  stats: {
    totalShots: number;
    totalHits: number;
    totalMisses: number;
    totalKills: number;
    totalDeaths: number;
    totalHitsTaken: number;
    totalEvaded: number;
    totalDodged: number;
    totalDamageDealt: number;
    damageValues: number[];
    criticalHits: number;
    criticalHitTotalDamageDealt: number;
    criticalHitDamageValues: number[];
    totalDamageAll: number;
    totalCost: number;
    totalLoot: number;
    lootItems: Array<{
      item: string;
      quantity: number;
      value: number;
      timestamp: number;
      location: { lon: number; lat: number } | null;
    }>;
    estimatedArmorCost: number;
    estimatedDamageTaken: number;
    skillGains: Record<string, number>;
    attributeGains: Record<string, number>;
  };
  loadout?: {
    name: string;
    weapon: string;
    amp?: string;
    absorber?: string;
    armorSet?: string;
  };
}

export class LegacyMigrator {
  /**
   * Read all V1 session files from disk
   */
  static readV1Sessions(basePath: string = process.cwd()): LegacySession[] {
    const sessionsDir = join(basePath, 'data', 'userData', 'userSessions');
    
    try {
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      const sessions: LegacySession[] = [];
      
      for (const file of files) {
        try {
          const content = readFileSync(join(sessionsDir, file), 'utf-8');
          const session = JSON.parse(content) as LegacySession;
          sessions.push(session);
        } catch (err) {
          console.warn(`Failed to read session file ${file}:`, err);
        }
      }
      
      return sessions;
    } catch (err) {
      console.error('Failed to read V1 sessions directory:', err);
      return [];
    }
  }
  
  /**
   * Convert a single V1 session to V2 event-sourced format
   * Note: This is lossy - we reconstruct events from aggregated stats
   */
  static convertV1ToV2(legacy: LegacySession, userId: string = 'migrated'): Session {
    // Start with empty session
    let session = SessionService.create(userId, legacy.name);
    
    // Override timestamps from legacy data
    session = {
      ...session,
      id: `legacy-${legacy.timestamp}`,
      startTime: legacy.startTime,
      endTime: legacy.endTime,
      duration: legacy.duration,
      tags: ['migrated', 'v1'],
    };
    
    // Reconstruct events from legacy stats
    const events = this.reconstructEvents(legacy);
    
    // Add all events at once
    session = SessionService.addEvents(session, events);
    
    // Mark as ended
    session = SessionService.end(session);
    
    return session;
  }
  
  /**
   * Reconstruct events from legacy aggregated stats
   * This is lossy but necessary for migration
   */
  private static reconstructEvents(legacy: LegacySession): SessionEvent[] {
    const events: SessionEvent[] = [];
    const sessionId = `legacy-${legacy.timestamp}`;
    const userId = 'migrated';
    
    // Calculate average time between events
    const totalEvents = legacy.stats.totalShots + legacy.stats.lootItems.length;
    const timePerEvent = legacy.duration > 0 
      ? (legacy.endTime - legacy.startTime) / totalEvents 
      : 1000;
    
    let eventTime = legacy.startTime;
    
    // Reconstruct shot events
    for (let i = 0; i < legacy.stats.totalShots; i++) {
      // SHOT_FIRED event
      events.push({
        id: `${sessionId}-shot-${i}`,
        timestamp: eventTime,
        sessionId,
        userId,
        type: 'SHOT_FIRED',
        payload: {
          weaponId: legacy.loadout?.weapon || 'unknown',
          ammoUsed: legacy.stats.totalCost / legacy.stats.totalShots || 0.1,
          ammoCost: legacy.stats.totalCost / legacy.stats.totalShots || 0.1,
        },
      });
      
      // HIT or MISS event
      if (i < legacy.stats.totalHits) {
        const damage = legacy.stats.damageValues[i] || 50;
        const isCritical = legacy.stats.criticalHitDamageValues.includes(damage);
        
        events.push({
          id: `${sessionId}-hit-${i}`,
          timestamp: eventTime + 100,
          sessionId,
          userId,
          type: 'HIT_REGISTERED',
          payload: {
            damage,
            mobId: undefined,
            critical: isCritical,
          },
        });
      } else {
        events.push({
          id: `${sessionId}-miss-${i}`,
          timestamp: eventTime + 100,
          sessionId,
          userId,
          type: 'MISS_REGISTERED',
          payload: {
            weaponId: legacy.loadout?.weapon || 'unknown',
          },
        });
      }
      
      eventTime += timePerEvent;
    }
    
    // Reconstruct loot events
    legacy.stats.lootItems.forEach((lootItem, idx) => {
      events.push({
        id: `${sessionId}-loot-${idx}`,
        timestamp: lootItem.timestamp || eventTime,
        sessionId,
        userId,
        type: 'LOOT_RECEIVED',
        payload: {
          items: [{
            name: lootItem.item,
            quantity: lootItem.quantity,
            ttValue: lootItem.value,
          }],
          totalTTValue: lootItem.value,
          isGlobal: lootItem.value >= 50,
        },
      });
      
      // Add GPS event if location available
      if (lootItem.location) {
        events.push({
          id: `${sessionId}-gps-${idx}`,
          timestamp: lootItem.timestamp || eventTime,
          sessionId,
          userId,
          type: 'GPS_UPDATE',
          payload: {
            location: lootItem.location,
          },
        });
      }
    });
    
    // Reconstruct mob kill events (estimate from recentKills or totalKills)
    for (let i = 0; i < legacy.stats.totalKills; i++) {
      events.push({
        id: `${sessionId}-kill-${i}`,
        timestamp: legacy.startTime + (i * timePerEvent * 10), // Estimate timing
        sessionId,
        userId,
        type: 'MOB_KILLED',
        payload: {
          mobName: 'Unknown Mob',
          mobId: `unknown-${i}`,
          location: { lon: 0, lat: 0 },
        },
      });
    }
    
    // Reconstruct dodge/evade events
    for (let i = 0; i < legacy.stats.totalDodged; i++) {
      events.push({
        id: `${sessionId}-dodge-${i}`,
        timestamp: legacy.startTime + (i * timePerEvent * 5),
        sessionId,
        userId,
        type: 'DODGE_REGISTERED',
        payload: {},
      });
    }
    
    for (let i = 0; i < legacy.stats.totalEvaded; i++) {
      events.push({
        id: `${sessionId}-evade-${i}`,
        timestamp: legacy.startTime + (i * timePerEvent * 5),
        sessionId,
        userId,
        type: 'EVADE_REGISTERED',
        payload: {},
      });
    }
    
    // Reconstruct damage taken events
    for (let i = 0; i < legacy.stats.totalHitsTaken; i++) {
      events.push({
        id: `${sessionId}-dmgtaken-${i}`,
        timestamp: legacy.startTime + (i * timePerEvent * 5),
        sessionId,
        userId,
        type: 'HIT_TAKEN',
        payload: {
          damage: legacy.stats.estimatedDamageTaken / legacy.stats.totalHitsTaken || 30,
          armorCost: legacy.stats.estimatedArmorCost / legacy.stats.totalHitsTaken || 0.01,
        },
      });
    }
    
    // Reconstruct death events
    for (let i = 0; i < legacy.stats.totalDeaths; i++) {
      events.push({
        id: `${sessionId}-death-${i}`,
        timestamp: legacy.startTime + (i * timePerEvent * 20),
        sessionId,
        userId,
        type: 'PLAYER_DEATH',
        payload: {
          location: { lon: 0, lat: 0 },
        },
      });
    }
    
    // Reconstruct skill gain events
    Object.entries(legacy.stats.skillGains || {}).forEach(([skillName, gainAmount], idx) => {
      if (gainAmount > 0) {
        events.push({
          id: `${sessionId}-skill-${idx}`,
          timestamp: legacy.startTime + (idx * timePerEvent * 3),
          sessionId,
          userId,
          type: 'SKILL_GAIN',
          payload: {
            skillName,
            gainAmount,
          },
        });
      }
    });
    
    // Reconstruct attribute gain events
    Object.entries(legacy.stats.attributeGains || {}).forEach(([attributeName, gainAmount], idx) => {
      if (gainAmount > 0) {
        events.push({
          id: `${sessionId}-attribute-${idx}`,
          timestamp: legacy.startTime + (idx * timePerEvent * 3),
          sessionId,
          userId,
          type: 'ATTRIBUTE_GAIN',
          payload: {
            attributeName,
            gainAmount,
          },
        });
      }
    });
    
    // Sort events by timestamp
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Migrate all V1 sessions to V2 format
   */
  static migrateAll(basePath?: string): Session[] {
    const legacySessions = this.readV1Sessions(basePath);
    console.log(`Found ${legacySessions.length} V1 sessions to migrate`);
    
    return legacySessions.map(legacy => {
      try {
        return this.convertV1ToV2(legacy);
      } catch (err) {
        console.error(`Failed to migrate session ${legacy.name}:`, err);
        return null;
      }
    }).filter((s): s is Session => s !== null);
  }
}

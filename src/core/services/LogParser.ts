/**
 * LogParser Service
 * Parses Entropia Universe chat.log lines into SessionEvents
 * Based on real EU log format from November 2025
 */

import { randomUUID } from '../utils/uuid';
import { SessionEvent } from '../types/Events';

export interface ParseResult {
  event: SessionEvent | null;
  line: string;
  timestamp: number;
  error?: string;
}

export class LogParser {
  /**
   * Parse a single chat.log line into a SessionEvent
   */
  static parseLine(
    line: string,
    sessionId: string,
    userId: string
  ): ParseResult {
    const result: ParseResult = {
      event: null,
      line,
      timestamp: Date.now(),
    };

    // Extract timestamp from log line if present
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (timestampMatch) {
      result.timestamp = new Date(timestampMatch[1]).getTime();
    }

    // Skip non-system messages
    if (!line.includes('[System]')) {
      return result;
    }

    // ==================== Combat Events ====================

    // Damage dealt (normal hit)
    const hitMatch = line.match(/You inflicted ([\d.]+) points of damage(?:\. Target resisted some additional damage)?/);
    if (hitMatch) {
      const damage = parseFloat(hitMatch[1]);
      const hasResist = line.includes('Target resisted');
      const isCritical = line.includes('Critical hit');
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'HIT_REGISTERED',
        payload: {
          damage,
          critical: isCritical,
          damageResisted: hasResist ? damage * 0.2 : undefined, // Estimate 20% resisted
        },
      };
      return result;
    }

    // Target dodged/evaded (mob's defensive action - affects YOUR accuracy)
    if (line.includes('The target Dodged your attack')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'DODGE_REGISTERED',
        payload: {
          actor: 'target',
        },
      };
      return result;
    }

    if (line.includes('The target Evaded your attack')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'EVADE_REGISTERED',
        payload: {
          actor: 'target',
        },
      };
      return result;
    }

    // ==================== Defensive Events ====================

    // Player evaded/dodged (YOUR defensive action - counts toward YOUR defense stats)
    if (line.includes('You Evaded the attack')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'EVADE_REGISTERED',
        payload: {
          actor: 'player',
        },
      };
      return result;
    }

    if (line.includes('You Dodged the attack')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'DODGE_REGISTERED',
        payload: {
          actor: 'player',
        },
      };
      return result;
    }

    // "The attack missed you" = mob's attack missed = counts as player evade
    if (line.includes('The attack missed you')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'EVADE_REGISTERED',
        payload: {
          actor: 'player',
        },
      };
      return result;
    }

    if (line.includes('Damage deflected!')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'DAMAGE_DEFLECTED',
        payload: {},
      };
      return result;
    }

    // ==================== Damage Taken Events ====================

    // Normal damage taken
    const damageTakenMatch = line.match(/You took ([\d.]+) points of damage/);
    if (damageTakenMatch) {
      const damage = parseFloat(damageTakenMatch[1]);
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'HIT_TAKEN',
        payload: {
          damage,
          armorCost: damage * 0.02, // Estimate 2% armor decay
          inVehicle: line.includes('Vehicle took'),
        },
      };
      return result;
    }

    // Critical damage taken
    if (line.includes('Critical hit') && line.includes('You took')) {
      const critDamageMatch = line.match(/You took ([\d.]+) points of damage/);
      if (critDamageMatch) {
        const damage = parseFloat(critDamageMatch[1]);
        const damageType = line.includes('Armor penetration') ? 'penetration' : 'additional';
        
        result.event = {
          id: randomUUID(),
          timestamp: result.timestamp,
          sessionId,
          userId,
          type: 'CRITICAL_HIT_TAKEN',
          payload: {
            damage,
            damageType: damageType as 'additional' | 'penetration',
            inVehicle: line.includes('Vehicle took'),
          },
        };
        return result;
      }
    }

    // ==================== Loot Events ====================

    // Loot received: "You received [Item Name] x (quantity) Value: X.XX PED"
    const lootMatch = line.match(
      /You received\s+\[?(.+?)\]?\s+x\s+\((\d+)\)\s+Value:\s+([\d.]+)\s+PED/i
    );
    
    if (lootMatch) {
      const itemName = lootMatch[1].trim().replace(/[\[\]]/g, '');
      const quantity = parseInt(lootMatch[2]);
      const value = parseFloat(lootMatch[3]);
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'LOOT_RECEIVED',
        payload: {
          items: [{
            name: itemName,
            quantity,
            ttValue: value,
          }],
          totalTTValue: value,
          isGlobal: value >= 50, // Globals are 50+ PED
        },
      };
      return result;
    }

    // ==================== Skill Events ====================

    // Skill rank gain: "You have gained a new rank in [Skill Name]!"
    const skillRankMatch = line.match(/You have gained a new rank in (.+?)!/);
    if (skillRankMatch) {
      const skillName = skillRankMatch[1].trim();
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'SKILL_RANK_GAIN',
        payload: {
          skillName,
        },
      };
      return result;
    }

    // New skill acquired: "Congratulations, you have acquired a new skill; [Skill Name]"
    const newSkillMatch = line.match(/Congratulations, you have acquired a new skill; (.+)/);
    if (newSkillMatch) {
      const skillName = newSkillMatch[1].trim();
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'NEW_SKILL_ACQUIRED',
        payload: {
          skillName,
        },
      };
      return result;
    }

    // Skill gain: "You have gained X experience in your [Skill Name] skill"
    const skillGainMatch = line.match(/You have gained ([\d.]+) experience in your (.+?) skill/);
    if (skillGainMatch) {
      const gainAmount = parseFloat(skillGainMatch[1]);
      const skillName = skillGainMatch[2].trim();
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'SKILL_GAIN',
        payload: {
          skillName,
          gainAmount,
        },
      };
      return result;
    }

    // Attribute gain: "You have gained X [Attribute]" (no "experience" or "skill")
    const attributeGainMatch = line.match(/You have gained ([\d.]+) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/);
    if (attributeGainMatch) {
      const gainAmount = parseFloat(attributeGainMatch[1]);
      const attributeName = attributeGainMatch[2].trim();
      
      // Only match if it's NOT followed by "experience" (to avoid false positives)
      if (!line.includes('experience')) {
        result.event = {
          id: randomUUID(),
          timestamp: result.timestamp,
          sessionId,
          userId,
          type: 'ATTRIBUTE_GAIN',
          payload: {
            attributeName,
            gainAmount,
          },
        };
        return result;
      }
    }

    // ==================== Effect Events ====================

    // Effect received: "Received Effect Over Time: [Effect Name]"
    const effectMatch = line.match(/Received Effect Over Time: (.+)/);
    if (effectMatch) {
      const effectName = effectMatch[1].trim();
      const effectType = this.categorizeEffect(effectName);
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'EFFECT_RECEIVED',
        payload: {
          effectName,
          effectType,
        },
      };
      return result;
    }

    // Equipment effect: "Equip Effect: [Effect Name]"
    const equipEffectMatch = line.match(/Equip Effect: (.+)/);
    if (equipEffectMatch) {
      const effectName = equipEffectMatch[1].trim();
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'EQUIP_EFFECT',
        payload: {
          effectName,
        },
      };
      return result;
    }

    // ==================== GPS Location ====================

    // GPS from <,> command: "[System] [] [Calypso, 54263, 64963, 102, Waypoint]"
    const gpsMatch = line.match(/\[System\]\s*\[\]\s*\[([^,]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (gpsMatch && gpsMatch[1] && gpsMatch[2] && gpsMatch[3] && gpsMatch[4]) {
      const x = parseFloat(gpsMatch[2]);
      const y = parseFloat(gpsMatch[3]);
      const z = parseFloat(gpsMatch[4]);
      
      console.log(`[LogParser] 📍 GPS parsed: ${gpsMatch[1]} (${x}, ${y}, ${z})`);
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'GPS_UPDATE',
        payload: {
          location: {
            lon: x,
            lat: y,
          },
          altitude: z,
        },
      };
      return result;
    }

    // ==================== Death Event ====================

    if (line.includes('You have died')) {
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'PLAYER_DEATH',
        payload: {
          location: { lon: 0, lat: 0 }, // Will be filled by GPS service
        },
      };
      return result;
    }

    // ==================== Global Events ====================

    // Globals: "[Player] killed a creature ([Mob]) with a value of X PED"
    const globalMatch = line.match(/\[Globals\].*?(\S+\s+\S+\s+\S+) killed a creature \((.+?)\) with a value of ([\d.]+) PED/);
    if (globalMatch) {
      const playerName = globalMatch[1].trim();
      const mobName = globalMatch[2].trim();
      const value = parseFloat(globalMatch[3]);
      
      result.event = {
        id: randomUUID(),
        timestamp: result.timestamp,
        sessionId,
        userId,
        type: 'GLOBAL_EVENT_OBSERVED',
        payload: {
          playerName,
          itemName: mobName,
          value,
          rawLog: line,
        },
      };
      return result;
    }

    return result;
  }

  /**
   * Categorize effect type based on name
   */
  private static categorizeEffect(
    effectName: string
  ): 'buff' | 'debuff' | 'heal' | 'damage' | 'stat_increase' | 'stat_decrease' | 'other' {
    const name = effectName.toLowerCase();
    
    if (name.includes('heal') || name.includes('regeneration')) {
      return 'heal';
    }
    if (name.includes('damage') && !name.includes('increased')) {
      return 'damage';
    }
    if (name.includes('increased') || name.includes('boost')) {
      return 'stat_increase';
    }
    if (name.includes('decreased') || name.includes('slowed')) {
      return 'stat_decrease';
    }
    if (name.includes('divine intervention') || name.includes('auto loot')) {
      return 'buff';
    }
    
    return 'other';
  }

  /**
   * Parse multiple lines at once
   */
  static parseLines(
    lines: string[],
    sessionId: string,
    userId: string
  ): ParseResult[] {
    return lines.map(line => this.parseLine(line, sessionId, userId));
  }

  /**
   * Extract events from parse results
   * Groups consecutive loot events and adds MOB_KILLED events
   * Enriches mob kill locations with last known GPS position
   */
  static extractEvents(results: ParseResult[]): SessionEvent[] {
    const events: SessionEvent[] = [];
    let currentLootBatch: SessionEvent[] = [];
    let lastEventTimestamp = 0;
    const LOOT_BATCH_TIMEOUT = 2000; // 2 seconds - if loot events are more than 2s apart, they're from different kills
    const GPS_TAG_WINDOW = 5000; // 5 seconds - GPS ping after kill to tag location

    for (const result of results) {
      if (!result.event) continue;

      const event = result.event;

      // Handle GPS updates - retroactively tag the most recent MOB_KILLED event
      if (event.type === 'GPS_UPDATE' && event.payload.location) {
        const loc = event.payload.location;
        if (loc.lon !== undefined && loc.lat !== undefined && loc.lon !== 0 && loc.lat !== 0) {
          // Look back for the most recent MOB_KILLED event within the GPS_TAG_WINDOW
          for (let i = events.length - 1; i >= 0; i--) {
            const prevEvent = events[i];
            if (prevEvent.type === 'MOB_KILLED') {
              const timeDiff = event.timestamp - prevEvent.timestamp;
              // If the GPS ping is within 5 seconds after the kill, tag it
              if (timeDiff >= 0 && timeDiff <= GPS_TAG_WINDOW) {
                // Update the kill location with the GPS ping
                prevEvent.payload.location = { lon: loc.lon, lat: loc.lat };
                break; // Only tag the most recent kill
              }
            }
          }
        }
      }

      // Check if this is a loot event
      if (event.type === 'LOOT_RECEIVED') {
        // If time gap is large, flush previous batch and start new one
        if (currentLootBatch.length > 0 && event.timestamp - lastEventTimestamp > LOOT_BATCH_TIMEOUT) {
          // Previous loot batch is complete - add mob kill (location will be tagged by subsequent GPS ping)
          events.push(...this.finalizeLootBatch(currentLootBatch));
          currentLootBatch = [];
        }
        
        // Add to current batch
        currentLootBatch.push(event);
        lastEventTimestamp = event.timestamp;
      } else {
        // Non-loot event - flush any pending loot batch first
        if (currentLootBatch.length > 0) {
          events.push(...this.finalizeLootBatch(currentLootBatch));
          currentLootBatch = [];
        }
        
        // Add the non-loot event
        events.push(event);
        lastEventTimestamp = event.timestamp;
      }
    }

    // Flush any remaining loot batch
    if (currentLootBatch.length > 0) {
      events.push(...this.finalizeLootBatch(currentLootBatch));
    }

    return events;
  }

  /**
   * Finalize a batch of loot events by aggregating them and adding a MOB_KILLED event
   * Location will be tagged by subsequent GPS_UPDATE event (when user presses location button)
   */
  private static finalizeLootBatch(
    lootEvents: SessionEvent[]
  ): SessionEvent[] {
    if (lootEvents.length === 0) return [];

    const result: SessionEvent[] = [];
    
    // First, add a MOB_KILLED event (mob was killed to get this loot)
    const firstLoot = lootEvents[0];
    const mobKillEvent: SessionEvent = {
      id: randomUUID(),
      timestamp: firstLoot.timestamp - 100, // Slightly before first loot
      sessionId: firstLoot.sessionId,
      userId: firstLoot.userId,
      type: 'MOB_KILLED',
      payload: {
        mobName: 'Unknown Creature', // We don't know mob name from loot alone
        mobId: `mob-${firstLoot.timestamp}`,
        location: {
          lon: 0, // Will be updated by GPS_UPDATE event if user presses location button
          lat: 0,
        },
      },
    };
    
    result.push(mobKillEvent);
    
    // Then add all the loot events
    result.push(...lootEvents);
    
    return result;
  }
}

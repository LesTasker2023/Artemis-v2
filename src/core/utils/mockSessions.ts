/**
 * Mock Session Generator
 * Creates realistic test sessions with GPS and combat data
 */

import { Session, SessionEvent } from '../types';
import { SessionService } from '../services/SessionService';

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Calypso coordinates (approximate hunting areas)
const huntingAreas = [
  { name: 'Fort Ithaca', center: { lon: 74300, lat: 67500 }, radius: 1000 },
  { name: 'Camp Icarus', center: { lon: 75800, lat: 69200 }, radius: 1500 },
  { name: 'Twin Peaks', center: { lon: 77200, lat: 66800 }, radius: 800 },
  { name: 'Cape Corinth', center: { lon: 72500, lat: 68900 }, radius: 1200 },
  { name: 'Port Atlantis Outskirts', center: { lon: 61700, lat: 63800 }, radius: 2000 },
];

const mobTypes = [
  { name: 'Snablesnot', maturity: ['Young', 'Mature', 'Old', 'Provider'] },
  { name: 'Atrox', maturity: ['Young', 'Mature', 'Old', 'Alpha'] },
  { name: 'Cornundacauda', maturity: ['Young', 'Mature', 'Guardian'] },
  { name: 'Foul', maturity: ['Young', 'Mature', 'Old', 'Stalker'] },
  { name: 'Sabakuma', maturity: ['Young', 'Mature', 'Alpha', 'Dominant'] },
  { name: 'Exarosaur', maturity: ['Young', 'Mature', 'Old'] },
];

const lootItems = [
  { name: 'Shrapnel', avgValue: 0.01, variance: 0.005 },
  { name: 'Animal Oil Residue', avgValue: 0.05, variance: 0.02 },
  { name: 'Animal Eye Oil', avgValue: 0.15, variance: 0.08 },
  { name: 'Animal Muscle Oil', avgValue: 0.03, variance: 0.01 },
  { name: 'Wool', avgValue: 0.08, variance: 0.04 },
  { name: 'Hide', avgValue: 0.12, variance: 0.06 },
  { name: 'Socket 1 Component', avgValue: 0.50, variance: 0.30 },
];

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max));
}

function randomGPSNearPoint(center: { lon: number; lat: number }, radiusMeters: number): { lon: number; lat: number } {
  // Convert radius from meters to degrees (rough approximation)
  const radiusDeg = radiusMeters / 111320;
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusDeg;
  
  return {
    lon: center.lon + distance * Math.cos(angle),
    lat: center.lat + distance * Math.sin(angle),
  };
}

export function generateMockSession(
  userId: string = 'test-user',
  areaIndex: number = 0,
  durationMinutes: number = 30
): Session {
  const area = huntingAreas[areaIndex % huntingAreas.length];
  const startTime = Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000); // Random time in last 7 days
  const duration = durationMinutes * 60;
  const endTime = startTime + duration * 1000;
  
  const sessionId = randomUUID();
  const events: SessionEvent[] = [];
  
  let currentTime = startTime;
  const timeIncrement = (duration * 1000) / 150; // Spread events over session duration
  
  // Combat parameters
  const totalMobsToKill = randomInt(15, 40);
  const baseAccuracy = randomInRange(0.75, 0.95);
  const criticalChance = randomInRange(0.05, 0.15);
  const avgShotsPerKill = randomInt(8, 15);
  const ammoCostPerShot = 0.165; // Average ammo cost
  
  let totalShots = 0;
  let totalHits = 0;
  let totalKills = 0;
  let totalLootValue = 0;
  
  // Generate GPS updates throughout session
  for (let i = 0; i < 20; i++) {
    const gpsLocation = randomGPSNearPoint(area.center, area.radius);
    events.push({
      id: randomUUID(),
      timestamp: startTime + (duration * 1000 / 20) * i,
      sessionId,
      userId,
      type: 'GPS_UPDATE',
      payload: {
        location: gpsLocation,
      },
    });
  }
  
  // Generate mob encounters
  for (let mobNum = 0; mobNum < totalMobsToKill; mobNum++) {
    const mob = mobTypes[randomInt(0, mobTypes.length)];
    const maturity = mob.maturity[randomInt(0, mob.maturity.length)];
    const mobName = `${mob.name} ${maturity}`;
    const mobId = randomUUID();
    const shotsForThisMob = randomInt(avgShotsPerKill - 3, avgShotsPerKill + 3);
    const gpsLocation = randomGPSNearPoint(area.center, area.radius);
    
    // Combat sequence for this mob
    for (let shot = 0; shot < shotsForThisMob; shot++) {
      currentTime += timeIncrement;
      
      // Shot fired
      events.push({
        id: randomUUID(),
        timestamp: currentTime,
        sessionId,
        userId,
        type: 'SHOT_FIRED',
        payload: {
          weaponId: 'Isis LLP 4 (L)',
          ammoUsed: ammoCostPerShot,
          ammoCost: ammoCostPerShot,
        },
      });
      totalShots++;
      
      // Determine hit or miss
      const hitRoll = Math.random();
      if (hitRoll < baseAccuracy) {
        // Hit!
        const isCritical = Math.random() < criticalChance;
        const damage = isCritical 
          ? randomInRange(15, 25) 
          : randomInRange(6, 12);
        
        events.push({
          id: randomUUID(),
          timestamp: currentTime + 10,
          sessionId,
          userId,
          type: 'HIT_REGISTERED',
          payload: {
            damage,
            mobId,
            mobName,
            critical: isCritical,
          },
        });
        totalHits++;
      } else {
        // Miss (target dodged/evaded or we missed)
        if (Math.random() < 0.5) {
          events.push({
            id: randomUUID(),
            timestamp: currentTime + 10,
            sessionId,
            userId,
            type: 'DODGE_REGISTERED',
            payload: {
              actor: 'target',
              mobId,
            },
          });
        } else {
          events.push({
            id: randomUUID(),
            timestamp: currentTime + 10,
            sessionId,
            userId,
            type: 'MISS_REGISTERED',
            payload: {
              weaponId: 'Isis LLP 4 (L)',
            },
          });
        }
      }
      
      // Occasionally mob attacks and we defend
      if (Math.random() < 0.3) {
        currentTime += 50;
        const defendRoll = Math.random();
        if (defendRoll < 0.2) {
          // We evaded
          events.push({
            id: randomUUID(),
            timestamp: currentTime,
            sessionId,
            userId,
            type: 'EVADE_REGISTERED',
            payload: {
              actor: 'player',
              mobId,
            },
          });
        } else if (defendRoll < 0.25) {
          // We dodged
          events.push({
            id: randomUUID(),
            timestamp: currentTime,
            sessionId,
            userId,
            type: 'DODGE_REGISTERED',
            payload: {
              actor: 'player',
              mobId,
            },
          });
        } else {
          // We took damage
          events.push({
            id: randomUUID(),
            timestamp: currentTime,
            sessionId,
            userId,
            type: 'HIT_TAKEN',
            payload: {
              damage: randomInRange(5, 20),
              mobName,
              mobId,
              inVehicle: false,
            },
          });
        }
      }
    }
    
    // Mob killed
    currentTime += timeIncrement;
    events.push({
      id: randomUUID(),
      timestamp: currentTime,
      sessionId,
      userId,
      type: 'MOB_KILLED',
      payload: {
        mobName,
        mobId,
        mobMaturity: maturity,
        location: gpsLocation,
      },
    });
    totalKills++;
    
    // Loot (with some globals!)
    const lootRoll = Math.random();
    const isGlobal = lootRoll < 0.03; // 3% global chance
    const lootCount = isGlobal ? randomInt(3, 6) : randomInt(1, 3);
    const lootItems_selected: Array<{ name: string; quantity: number; ttValue: number }> = [];
    
    for (let i = 0; i < lootCount; i++) {
      const item = lootItems[randomInt(0, lootItems.length)];
      const quantity = randomInt(1, isGlobal ? 50 : 10);
      const ttValue = quantity * (item.avgValue + randomInRange(-item.variance, item.variance));
      lootItems_selected.push({
        name: item.name,
        quantity,
        ttValue: Math.max(0.01, ttValue),
      });
    }
    
    const totalTTValue = lootItems_selected.reduce((sum, item) => sum + item.ttValue, 0);
    totalLootValue += totalTTValue;
    
    currentTime += 100;
    events.push({
      id: randomUUID(),
      timestamp: currentTime,
      sessionId,
      userId,
      type: 'LOOT_RECEIVED',
      payload: {
        items: lootItems_selected,
        totalTTValue,
        isGlobal,
      },
    });
    
    // Add skill gains occasionally
    if (Math.random() < 0.3) {
      currentTime += 50;
      const skills = [
        'Laser Weaponry Technology',
        'Handgun',
        'Anatomy',
        'Combat Reflexes',
        'Evade',
        'Courage',
        'Alertness',
      ];
      const skill = skills[randomInt(0, skills.length)];
      
      if (skill === 'Courage' || skill === 'Alertness') {
        events.push({
          id: randomUUID(),
          timestamp: currentTime,
          sessionId,
          userId,
          type: 'ATTRIBUTE_GAIN',
          payload: { attributeName: skill, gainAmount: randomInRange(0.1, 0.5) },
        });
      } else {
        events.push({
          id: randomUUID(),
          timestamp: currentTime,
          sessionId,
          userId,
          type: 'SKILL_GAIN',
          payload: { skillName: skill, gainAmount: randomInRange(0.1, 0.8) },
        });
      }
    }
  }
  
  // Sort events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  
  // Create session
  let session: Session = {
    id: sessionId,
    name: `Hunt ${new Date(startTime).toLocaleDateString()} - ${area.name}`,
    userId,
    startTime,
    endTime,
    duration,
    events,
    tags: ['mock', 'test', area.name.toLowerCase().replace(/\s+/g, '-')],
    version: '2.0',
    createdAt: startTime,
    updatedAt: endTime,
    stats: SessionService.calculateStats(events),
  };
  
  return session;
}

export function generateMultipleMockSessions(count: number = 10): Session[] {
  const sessions: Session[] = [];
  
  for (let i = 0; i < count; i++) {
    const areaIndex = i % huntingAreas.length;
    const duration = randomInt(20, 60); // 20-60 minutes
    sessions.push(generateMockSession('test-user', areaIndex, duration));
  }
  
  return sessions;
}

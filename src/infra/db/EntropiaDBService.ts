/**
 * Entropia Database Service
 * Query the entropia.db for mob data, spawn locations, and loot tables
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import type { Coordinate } from '../../core/types/GPS';

export interface MobData {
  id: number;
  name: string;
  planet: string;
  hp: number;
  maturity: string;
  level: number;
  loot_table: string; // JSON array
  species: string;
  mob_type: string;
}

export interface SpawnLocation {
  id: number;
  mob_name: string;
  planet: string;
  latitude: number;
  longitude: number;
  density: string;
}

export interface MobWithDistance extends MobData {
  distance: number;
  spawnLocations: SpawnLocation[];
}

export class EntropiaDBService {
  private db: Database.Database;
  
  constructor(dbPath?: string) {
    const defaultPath = dbPath || this.getDefaultPath();
    this.db = new Database(defaultPath, { readonly: true });
  }
  
  private getDefaultPath(): string {
    // In development: use project directory
    // In production: use app.getAppPath() which points to app.asar or unpacked resources
    if (app && app.getPath) {
      // Get the app path (works in both dev and production)
      const appPath = process.env.VITE_DEV_SERVER_URL 
        ? process.cwd() // Development
        : path.join(process.resourcesPath, 'app.asar.unpacked'); // Production
      
      const dbPath = path.join(appPath, 'data', 'entropia.db');
      console.log('[Entropia DB] Resolved path:', dbPath);
      return dbPath;
    }
    // Fallback
    return path.join(process.cwd(), 'data', 'entropia.db');
  }
  
  /**
   * Find mobs by health range
   */
  findMobsByHealth(estimatedHealth: number, tolerance: number = 0.2): MobData[] {
    const minHealth = estimatedHealth * (1 - tolerance);
    const maxHealth = estimatedHealth * (1 + tolerance);
    
    const stmt = this.db.prepare(`
      SELECT * FROM mobs 
      WHERE hp BETWEEN ? AND ?
      ORDER BY ABS(hp - ?) ASC
      LIMIT 50
    `);
    
    return stmt.all(minHealth, maxHealth, estimatedHealth) as MobData[];
  }

  /**
   * Identify mob using spawn-first approach
   * 1. Find nearest spawn
   * 2. Get possible mobs from that spawn
   * 3. Match HP to maturity within those mobs
   * 4. Return range if uncertain (e.g., "Foul Young-Adult")
   */
  async identifyMobBySpawn(
    location: Coordinate,
    estimatedHealth: number
  ): Promise<{
    mobName: string;
    distance: number;
    confidence: 'high' | 'medium' | 'low';
  } | null> {
    // Step 1: Find nearest spawn
    const nearbySpawns = await this.findSpawnsNearLocation(location, 5000);
    if (nearbySpawns.length === 0) {
      return null;
    }

    // Step 2: Find the SINGLE closest spawn (don't group by mob type)
    // Note: nearbySpawns is sorted by polygon containment first, then distance
    const closestSpawn = nearbySpawns[0]; // Already sorted: inside polygon > nearest distance
    const baseName = this.extractBaseMobName(closestSpawn.mob_name);
    const closestDistance = closestSpawn.distance;
    const insideSpawn = closestSpawn.insidePolygon || false;

    console.log(`[Entropia DB] Best spawn match: ${closestSpawn.mob_name} (${closestDistance.toFixed(0)}m, inside=${insideSpawn})`);

    // Step 3: Get maturities from THIS spawn only (not all spawns of this mob type)
    const spawnMaturities = this.extractAllMaturities(closestSpawn.mob_name);
    
    if (spawnMaturities.length === 0) {
      // No maturity info in spawn name, just return the spawn name as-is
      return {
        mobName: closestSpawn.mob_name,
        distance: closestDistance,
        confidence: insideSpawn ? 'high' : (closestDistance < 500 ? 'high' : 'medium'),
      };
    }

    // Step 4: Query database for HP values of these specific maturities
    const mobsStmt = this.db.prepare(`
      SELECT name, hp, maturity 
      FROM mobs 
      WHERE name LIKE ? AND planet = 'Calypso'
      ORDER BY hp
    `);
    
    const possibleMobs = mobsStmt.all(`${baseName}%`) as MobData[];
    
    // Find which maturity/maturities match the HP
    // Key insight: Damage dealt >= Mob HP (accounting for overkill + HP regen)
    // - If mob.hp > damage * 1.5: Impossible (mob would survive even with 50% overkill)
    // - If mob.hp <= damage: Possible (we dealt enough + extra for regen/overkill)
    // - Prefer LOWER maturities when multiple match (more common + regen explains excess damage)
    const matchingMobs: Array<{ maturity: string; hp: number; score: number }> = [];
    
    for (const mob of possibleMobs) {
      // Only consider maturities that exist in this spawn
      if (!spawnMaturities.includes(mob.maturity)) continue;
      
      // CRITICAL: If mob HP > damage dealt * 1.5, it's impossible (mob would survive)
      if (mob.hp > estimatedHealth * 1.5) {
        continue;
      }
      
      // Calculate how well this maturity fits
      // Prefer mobs where: damage >= mob.hp (we dealt enough to kill + regen)
      const damageOverHP = estimatedHealth - mob.hp;
      
      // Score: Lower is better
      // - If damage < mob.hp: Negative score (bad fit, we didn't deal enough)
      // - If damage >= mob.hp: Positive score (good fit, regen explains excess)
      // - Prefer smallest positive score (lowest maturity that fits)
      const regenTolerance = mob.hp * 0.5; // Allow up to 50% extra damage for regen
      
      if (damageOverHP >= 0 && damageOverHP <= regenTolerance) {
        // Good match: We dealt enough to kill + reasonable regen amount
        matchingMobs.push({
          maturity: mob.maturity,
          hp: mob.hp,
          score: damageOverHP, // Lower score = closer to base HP = better match
        });
      } else if (damageOverHP < 0 && Math.abs(damageOverHP) <= mob.hp * 0.2) {
        // Acceptable: Slight under-damage (maybe missed some hits in parsing)
        matchingMobs.push({
          maturity: mob.maturity,
          hp: mob.hp,
          score: Math.abs(damageOverHP) * 2, // Penalize under-damage
        });
      }
    }
    
    // Sort by score (prefer lowest = closest to base HP)
    matchingMobs.sort((a, b) => a.score - b.score);
    
    // Extract just the maturity names
    const matchingMaturities = matchingMobs.map(m => m.maturity);
    const bestHpDiff = matchingMobs.length > 0 ? matchingMobs[0].score : Infinity;

    if (matchingMaturities.length === 0) {
      // No HP match from spawn maturities
      // FALLBACK: If spawn is far away (>500m), try HP-based identification across ALL mobs
      if (closestDistance > 500) {
        console.log(`[Entropia DB] Spawn too far (${closestDistance}m) and no HP match - trying HP-based identification`);
        
        // Find all mobs that match this HP (not just from this spawn)
        const allMobsStmt = this.db.prepare(`
          SELECT name, hp, maturity 
          FROM mobs 
          WHERE planet = 'Calypso' AND hp IS NOT NULL
          ORDER BY ABS(hp - ?) ASC
          LIMIT 5
        `);
        
        const closestHPMobs = allMobsStmt.all(estimatedHealth) as MobData[];
        
        if (closestHPMobs.length > 0) {
          const bestMatch = closestHPMobs[0];
          const hpDiff = Math.abs(bestMatch.hp - estimatedHealth);
          const tolerance = bestMatch.hp * 0.3; // 30% tolerance for HP-only match
          
          if (hpDiff <= tolerance) {
            console.log(`[Entropia DB] HP match found: ${bestMatch.name} (${bestMatch.hp} HP, ${hpDiff.toFixed(0)} diff)`);
            return {
              mobName: `${bestMatch.name} (HP match, no nearby spawn)`,
              distance: closestDistance,
              confidence: 'medium',
            };
          }
        }
      }
      
      // No HP match at all, show spawn name with low confidence
      return {
        mobName: closestSpawn.mob_name,
        distance: closestDistance,
        confidence: 'low',
      };
    }

    // Step 5: Format output with range if multiple maturities match
    let displayName: string;
    if (matchingMaturities.length === 1) {
      displayName = `${baseName} ${matchingMaturities[0]}`;
    } else if (matchingMaturities.length === 2) {
      displayName = `${baseName} ${matchingMaturities[0]}-${matchingMaturities[1]}`;
    } else {
      displayName = `${baseName} (${matchingMaturities.join('/')})`;
    }

    // Add location indicator if inside spawn polygon
    const locationNote = insideSpawn ? ' (inside spawn)' : '';

    // Confidence: High if inside polygon OR close + good HP match
    const confidence = 
      insideSpawn ? 'high' :
      closestDistance < 500 && bestHpDiff < estimatedHealth * 0.2 ? 'high' :
      closestDistance < 1000 ? 'medium' : 'low';

    return {
      mobName: displayName + locationNote,
      distance: closestDistance,
      confidence,
    };
  }

  /**
   * Extract all maturities from a spawn name
   * "Foul (Calypso) - Young/Adult/Scout" → ["Young", "Adult", "Scout"]
   */
  private extractAllMaturities(spawnName: string): string[] {
    // Remove planet tags
    const cleaned = spawnName.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
    
    // Split by " - " to get maturity part
    const parts = cleaned.split(' - ');
    if (parts.length < 2) return [];
    
    // Split maturities by "/"
    const maturities = parts[1].split('/').map(m => m.trim());
    return maturities.filter(m => m.length > 0);
  }

  /**
   * Extract base mob name (without maturity)
   * "Foul Young" → "Foul"
   * "Daikiba Provider" → "Daikiba"
   */
  private extractBaseMobName(fullName: string): string {
    const maturities = ['Young', 'Mature', 'Old', 'Provider', 'Guardian', 'Dominant', 
                        'Alpha', 'Stalker', 'Scout', 'Gatherer', 'Gen', 'Prowler'];
    
    for (const maturity of maturities) {
      if (fullName.endsWith(` ${maturity}`)) {
        return fullName.replace(` ${maturity}`, '').trim();
      }
    }
    
    return fullName; // No maturity found
  }

  /**
   * Extract maturity from mob name
   * "Foul Young" → "Young"
   */
  private extractMaturity(fullName: string): string | null {
    const maturities = ['Young', 'Mature', 'Old', 'Provider', 'Guardian', 'Dominant',
                        'Alpha', 'Stalker', 'Scout', 'Gatherer', 'Gen', 'Prowler'];
    
    for (const maturity of maturities) {
      if (fullName.endsWith(` ${maturity}`)) {
        return maturity;
      }
    }
    
    return null;
  }

  /**
   * Check if a point is inside a polygon using ray-casting algorithm
   * @param point - The point to check {lon, lat}
   * @param vertices - Array of coordinates [lon1, lat1, lon2, lat2, ...]
   * @returns true if point is inside polygon
   */
  private isPointInPolygon(point: Coordinate, vertices: number[]): boolean {
    if (!vertices || vertices.length < 6) {
      // Need at least 3 points (6 numbers) for a polygon
      return false;
    }

    let inside = false;
    const x = point.lon;
    const y = point.lat;

    // Convert flat array to point pairs
    for (let i = 0, j = vertices.length - 2; i < vertices.length; j = i, i += 2) {
      const xi = vertices[i];
      const yi = vertices[i + 1];
      const xj = vertices[j];
      const yj = vertices[j + 1];

      // Ray-casting algorithm: count intersections
      const intersect = ((yi > y) !== (yj > y)) &&
                       (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }
  
  /**
   * Parse mob names from Nexus spawn format
   * Examples:
   *   "Foul (Calypso) - Adult/Young" → ["Foul Adult", "Foul Young"]
   *   "Argonaut, Foul - Adult, Molisk" → ["Argonaut Adult", "Foul Adult", "Molisk"]
   */
  private parseNexusMobNames(spawnName: string): string[] {
    const mobNames: string[] = [];
    
    // Remove planet tags like (Calypso), (Rocktropia)
    const cleaned = spawnName.replace(/\s*\([^)]+\)\s*/g, ' ');
    
    // Split by commas to get individual mob groups
    const mobGroups = cleaned.split(',').map(g => g.trim());
    
    for (const group of mobGroups) {
      // Split by " - " to separate mob name from maturities
      const parts = group.split(' - ');
      const baseName = parts[0].trim();
      
      if (parts.length > 1) {
        // Has maturities: "Foul - Adult/Young/Guardian"
        const maturities = parts[1].split('/').map(m => m.trim());
        for (const maturity of maturities) {
          mobNames.push(`${baseName} ${maturity}`);
        }
      } else {
        // No maturities listed, just use base name
        mobNames.push(baseName);
      }
    }
    
    return mobNames.filter(name => name.length > 0);
  }

  /**
   * Find spawn locations near coordinates
   * Now uses nexus_spawns table (Entropia Nexus API data)
   */
  findSpawnsNearLocation(location: Coordinate, radiusMeters: number = 5000): Array<SpawnLocation & { distance: number; vertices?: number[]; insidePolygon?: boolean }> {
    const stmt = this.db.prepare(`
      SELECT 
        name as spawn_name,
        center_lon as longitude,
        center_lat as latitude,
        planet,
        density,
        data_json
      FROM nexus_spawns
      WHERE planet = 'Calypso'
        AND center_lon IS NOT NULL
        AND center_lat IS NOT NULL
    `);
    
    const rawSpawns = stmt.all() as Array<{
      spawn_name: string;
      longitude: number;
      latitude: number;
      planet: string;
      density: string | null;
      data_json: string | null;
    }>;
    
    // Parse spawn names and expand into individual mob spawn locations
    const expandedSpawns: Array<SpawnLocation & { distance: number; vertices?: number[]; insidePolygon?: boolean }> = [];
    
    for (const spawn of rawSpawns) {
      const distance = this.calculateDistance(
        location,
        { lon: spawn.longitude, lat: spawn.latitude }
      );
      
      // Parse polygon data from data_json
      let vertices: number[] | undefined;
      let insidePolygon = false;
      
      if (spawn.data_json) {
        try {
          const data = JSON.parse(spawn.data_json);
          vertices = data.vertices;
          
          // Check if point is inside this polygon
          if (vertices && vertices.length >= 6) {
            insidePolygon = this.isPointInPolygon(location, vertices);
          }
        } catch (err) {
          console.warn('[Entropia DB] Failed to parse data_json:', err);
        }
      }
      
      // Only process spawns within radius OR inside polygon
      if (distance <= radiusMeters || insidePolygon) {
        const mobNames = this.parseNexusMobNames(spawn.spawn_name);
        
        // Create a spawn entry for each mob at this location
        for (const mobName of mobNames) {
          expandedSpawns.push({
            id: 0, // Not needed for matching, just for type compatibility
            mob_name: mobName,
            longitude: spawn.longitude,
            latitude: spawn.latitude,
            planet: spawn.planet,
            density: spawn.density || 'Unknown',
            distance,
            vertices,
            insidePolygon,
          });
        }
      }
    }
    
    // CRITICAL: Sort by polygon containment FIRST, then by distance
    // If we're inside a spawn polygon, that's our spawn (even if center is far)
    // If we're not inside any polygon, use nearest spawn by center distance
    return expandedSpawns.sort((a, b) => {
      // Prioritize spawns we're inside
      if (a.insidePolygon && !b.insidePolygon) return -1;
      if (!a.insidePolygon && b.insidePolygon) return 1;
      // If both inside or both outside, sort by distance
      return a.distance - b.distance;
    });
  }
  
  /**
   * Find mobs by location - returns mobs that spawn near the given coordinates
   */
  findMobsByLocation(location: Coordinate, radiusMeters: number = 5000): MobWithDistance[] {
    // First, find nearby spawn locations
    const nearbySpawns = this.findSpawnsNearLocation(location, radiusMeters);
    
    if (nearbySpawns.length === 0) {
      return [];
    }
    
    // Get unique mob names from spawn locations
    const mobNames = [...new Set(nearbySpawns.map(s => s.mob_name))];
    
    // Query mobs table for these mob names
    const placeholders = mobNames.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM mobs
      WHERE name IN (${placeholders})
    `);
    
    const mobs = stmt.all(...mobNames) as MobData[];
    
    // Attach spawn locations and calculate closest distance for each mob
    return mobs.map(mob => {
      const mobSpawns = nearbySpawns.filter(s => s.mob_name === mob.name);
      const closestDistance = Math.min(...mobSpawns.map(s => s.distance));
      
      return {
        ...mob,
        distance: closestDistance,
        spawnLocations: mobSpawns,
      };
    }).sort((a, b) => a.distance - b.distance);
  }
  
  /**
   * Identify mob by health AND location (cross-reference)
   */
  identifyMob(
    estimatedHealth: number,
    location: Coordinate,
    lootItems?: string[]
  ): MobWithDistance | null {
    const healthTolerance = 0.2; // ±20%
    const locationRadius = 3000; // 3km search radius
    
    // Step 1: Get mobs by health
    const healthMatches = this.findMobsByHealth(estimatedHealth, healthTolerance);
    
    if (healthMatches.length === 0) {
      return null;
    }
    
    // Step 2: Get mobs by location
    const locationMatches = this.findMobsByLocation(location, locationRadius);
    
    if (locationMatches.length === 0) {
      // No mobs spawn here, return best health match
      return {
        ...healthMatches[0],
        distance: Infinity,
        spawnLocations: [],
      };
    }
    
    // Step 3: Find mobs that match BOTH health AND location
    const crossReferences = locationMatches.filter(locMob =>
      healthMatches.some(hMob => hMob.id === locMob.id)
    );
    
    if (crossReferences.length > 0) {
      // Perfect match - mob matches both health and location
      const bestMatch = crossReferences[0];
      
      // Step 4: Validate with loot if available
      if (lootItems && lootItems.length > 0) {
        const lootMatch = this.validateLoot(crossReferences, lootItems);
        if (lootMatch) {
          return lootMatch;
        }
      }
      
      return bestMatch;
    }
    
    // Step 5: No exact match - prioritize location over health
    // (If you're hunting in a zone, it's more likely to be a mob from that zone)
    return locationMatches[0];
  }
  
  /**
   * Validate loot against mob's loot table
   */
  private validateLoot(mobs: MobWithDistance[], lootItems: string[]): MobWithDistance | null {
    for (const mob of mobs) {
      try {
        const lootTable = JSON.parse(mob.loot_table) as Array<{ name: string }>;
        const lootNames = lootTable.map(l => l.name);
        
        // Check if any loot item matches
        const hasMatch = lootItems.some(item =>
          lootNames.some(lootName => 
            item.toLowerCase().includes(lootName.toLowerCase()) ||
            lootName.toLowerCase().includes(item.toLowerCase())
          )
        );
        
        if (hasMatch) {
          return mob;
        }
      } catch (e) {
        // Invalid JSON, skip
        continue;
      }
    }
    
    return null;
  }
  
  /**
   * Calculate distance between two coordinates (Euclidean)
   */
  private calculateDistance(a: Coordinate, b: Coordinate): number {
    const dx = a.lon - b.lon;
    const dy = a.lat - b.lat;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Get mob by exact name and maturity
   */
  findMobByName(name: string, maturity?: string): MobData | null {
    const stmt = maturity
      ? this.db.prepare('SELECT * FROM mobs WHERE name = ? AND maturity = ? LIMIT 1')
      : this.db.prepare('SELECT * FROM mobs WHERE name = ? LIMIT 1');
    
    const result = maturity
      ? stmt.get(name, maturity)
      : stmt.get(name);
    
    return result as MobData | null;
  }
  
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

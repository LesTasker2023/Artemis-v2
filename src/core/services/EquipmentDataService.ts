/**
 * Equipment Data Service
 * Loads and searches equipment data from V1 JSON files
 */

import { z } from 'zod';

// V1 Equipment schemas (matches JSON structure)
const V1EconomyData = z.object({
  Efficiency: z.number().nullable().optional(),
  MaxTT: z.number().nullable().optional(),
  MinTT: z.number().nullable().optional(),
  Decay: z.number().nullable().optional(), // PEC value - not all items have this
  AmmoBurn: z.number().nullable().optional(), // PEC*100 value - not all items have this
});

const V1DamageData = z.object({
  Stab: z.number().nullable().optional(),
  Cut: z.number().nullable().optional(),
  Impact: z.number().nullable().optional(),
  Penetration: z.number().nullable().optional(),
  Shrapnel: z.number().nullable().optional(),
  Burn: z.number().nullable().optional(),
  Cold: z.number().nullable().optional(),
  Acid: z.number().nullable().optional(),
  Electric: z.number().nullable().optional(),
});

const V1SkillData = z.object({
  Hit: z.object({
    LearningIntervalStart: z.number().nullable().optional(),
    LearningIntervalEnd: z.number().nullable().optional(),
  }).optional(),
  Dmg: z.object({
    LearningIntervalStart: z.number().nullable().optional(),
    LearningIntervalEnd: z.number().nullable().optional(),
  }).optional(),
  IsSiB: z.boolean().optional(),
});

const V1PropertiesData = z.object({
  Description: z.string().nullable().optional(),
  Weight: z.number().nullable().optional(),
  Type: z.string().optional(), // BLP, Laser, etc.
  Category: z.string().optional(), // Rifle, Pistol, etc.
  Class: z.string().optional(), // Ranged, Melee, etc.
  UsesPerMinute: z.number().nullable().optional(),
  Range: z.number().nullable().optional(),
  ImpactRadius: z.number().nullable().optional(),
  Mindforce: z.any().optional(),
  Economy: V1EconomyData.optional(),
  Damage: V1DamageData.optional(),
  Skill: V1SkillData.optional(),
});

const V1AmmoData = z.object({
  Name: z.string().optional(),
  Links: z.object({
    $Url: z.string().optional(),
  }).optional(),
});

const V1EquipmentItem = z.object({
  Id: z.number(),
  ItemId: z.number(),
  Name: z.string(),
  Properties: V1PropertiesData.nullable().optional(),
  Ammo: V1AmmoData.optional(),
});

export type V1EquipmentItem = z.infer<typeof V1EquipmentItem>;
export type V1EconomyData = z.infer<typeof V1EconomyData>;
export type V1DamageData = z.infer<typeof V1DamageData>;

// Equipment type enum
export enum EquipmentType {
  WEAPON = 'weapon',
  AMP = 'amp',
  SCOPE = 'scope',
  SIGHT = 'sight',
  ABSORBER = 'absorber',
  ARMOR_SET = 'armor_set',
  ARMOR_PLATING = 'armor_plating',
  WEAPON_ENHANCER = 'weapon_enhancer',
  ARMOR_ENHANCER = 'armor_enhancer',
}

// Simplified search result for UI
export interface EquipmentSearchResult {
  id: number;
  name: string;
  type: EquipmentType;
  economy: V1EconomyData | null;
  damage: V1DamageData | null;
  category?: string;
  description?: string | null;
}

export class EquipmentDataService {
  private data: Map<EquipmentType, V1EquipmentItem[]> = new Map();
  private initialized = false;

  /**
   * Load equipment data from JSON files
   */
  async loadData(dataPath: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Load each equipment file
      const files: [EquipmentType, string][] = [
        [EquipmentType.WEAPON, 'weapons.json'],
        [EquipmentType.AMP, 'amps.json'],
        [EquipmentType.SCOPE, 'scopes.json'],
        [EquipmentType.SIGHT, 'sights.json'],
        [EquipmentType.ABSORBER, 'absorbers.json'],
        [EquipmentType.ARMOR_SET, 'armorsets.json'],
        [EquipmentType.ARMOR_PLATING, 'armorplatings.json'],
        [EquipmentType.WEAPON_ENHANCER, 'weapon-enhancers.json'],
        [EquipmentType.ARMOR_ENHANCER, 'armor-enhancers.json'],
      ];

      for (const [type, filename] of files) {
        try {
          const filePath = path.join(dataPath, filename);
          let fileContent = await fs.readFile(filePath, 'utf-8');
          
          // Remove BOM if present (UTF-8 BOM: EF BB BF)
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            fileContent = fileContent.slice(1);
          }
          
          const jsonData = JSON.parse(fileContent);
          
          // Validate and store - use parseAsync to handle partial failures
          const validItems: V1EquipmentItem[] = [];
          for (const item of jsonData) {
            try {
              const validated = V1EquipmentItem.parse(item);
              validItems.push(validated);
            } catch (itemError) {
              // Skip invalid items silently (likely incomplete data)
              console.warn(`[EquipmentDataService] Skipped invalid item in ${filename}:`, item.Name || 'unknown');
            }
          }
          
          this.data.set(type, validItems);
          
          console.log(`[EquipmentDataService] Loaded ${validItems.length} ${type}s from ${filename}`);
        } catch (error) {
          console.error(`[EquipmentDataService] Failed to load ${filename}:`, error);
          // Store empty array for this type
          this.data.set(type, []);
        }
      }

      this.initialized = true;
      console.log('[EquipmentDataService] All equipment data loaded');
    } catch (error) {
      console.error('[EquipmentDataService] Failed to load equipment data:', error);
      throw error;
    }
  }

  /**
   * Search equipment by name (fuzzy match)
   */
  search(query: string, type?: EquipmentType, limit = 20): EquipmentSearchResult[] {
    if (!this.initialized) {
      console.warn('[EquipmentDataService] Not initialized, returning empty results');
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    const results: EquipmentSearchResult[] = [];

    // Determine which types to search
    const typesToSearch = type 
      ? [type] 
      : Array.from(this.data.keys());

    for (const searchType of typesToSearch) {
      const items = this.data.get(searchType) || [];
      
      for (const item of items) {
        // Fuzzy match: name contains query
        if (item.Name.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: item.Id,
            name: item.Name,
            type: searchType,
            economy: item.Properties?.Economy || null,
            damage: item.Properties?.Damage || null,
            category: item.Properties?.Category,
            description: item.Properties?.Description,
          });

          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get equipment by exact ID
   */
  getById(id: number, type: EquipmentType): EquipmentSearchResult | null {
    if (!this.initialized) {
      console.warn('[EquipmentDataService] Not initialized');
      return null;
    }

    const items = this.data.get(type) || [];
    const item = items.find(i => i.Id === id);

    if (!item) return null;

    return {
      id: item.Id,
      name: item.Name,
      type,
      economy: item.Properties?.Economy || null,
      damage: item.Properties?.Damage || null,
      category: item.Properties?.Category,
      description: item.Properties?.Description,
    };
  }

  /**
   * Get equipment by exact name
   */
  getByName(name: string, type?: EquipmentType): EquipmentSearchResult | null {
    if (!this.initialized) {
      console.warn('[EquipmentDataService] Not initialized');
      return null;
    }

    const typesToSearch = type 
      ? [type] 
      : Array.from(this.data.keys());

    for (const searchType of typesToSearch) {
      const items = this.data.get(searchType) || [];
      const item = items.find(i => i.Name === name);

      if (item) {
        return {
          id: item.Id,
          name: item.Name,
          type: searchType,
          economy: item.Properties?.Economy || null,
          damage: item.Properties?.Damage || null,
          category: item.Properties?.Category,
          description: item.Properties?.Description,
        };
      }
    }

    return null;
  }

  /**
   * Get all items of a specific type
   */
  getAllByType(type: EquipmentType): EquipmentSearchResult[] {
    if (!this.initialized) {
      console.warn('[EquipmentDataService] Not initialized');
      return [];
    }

    const items = this.data.get(type) || [];
    
    return items.map(item => ({
      id: item.Id,
      name: item.Name,
      type,
      economy: item.Properties?.Economy || null,
      damage: item.Properties?.Damage || null,
      category: item.Properties?.Category,
      description: item.Properties?.Description,
    }));
  }

  /**
   * Get statistics about loaded data
   */
  getStats(): Record<EquipmentType, number> {
    const stats: Record<string, number> = {};
    
    for (const [type, items] of this.data.entries()) {
      stats[type] = items.length;
    }

    return stats as Record<EquipmentType, number>;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let instance: EquipmentDataService | null = null;

export function getEquipmentDataService(): EquipmentDataService {
  if (!instance) {
    instance = new EquipmentDataService();
  }
  return instance;
}

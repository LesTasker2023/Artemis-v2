/**
 * Loadout Type Definitions
 * Equipment and gear configurations with cost calculations
 * Based on V1 ARTEMIS loadout system
 */

import { z } from 'zod';

// ==================== Equipment Data Structures ====================

export const EconomyProperties = z.object({
  Decay: z.number().default(0),        // PEC per shot
  AmmoBurn: z.number().default(0),     // PEC * 100 per shot
  Efficiency: z.number().optional(),
  MaxTT: z.number().optional(),
  MinTT: z.number().optional(),
});

export const DamageProperties = z.object({
  Stab: z.number().default(0),
  Cut: z.number().default(0),
  Impact: z.number().default(0),
  Penetration: z.number().default(0),
  Shrapnel: z.number().default(0),
  Burn: z.number().default(0),
  Cold: z.number().default(0),
  Acid: z.number().default(0),
  Electric: z.number().default(0),
});

export const EquipmentData = z.object({
  Id: z.number().optional(),
  ItemId: z.number().optional(),
  Name: z.string(),
  Properties: z.object({
    Economy: EconomyProperties.optional(),
    Damage: DamageProperties.optional(),
    Weight: z.number().optional(),
    Type: z.string().optional(),
    Category: z.string().optional(),
    UsesPerMinute: z.number().optional(),
    Range: z.number().optional(),
    MaxTT: z.number().optional(),
    Durability: z.number().optional(),
  }),
});

export const EnhancerData = z.object({
  Name: z.string(),
  Properties: z.object({
    Economy: z.object({
      Decay: z.string().or(z.number()).transform(val => 
        typeof val === 'string' ? parseFloat(val) : val
      ),
      AmmoBurn: z.string().or(z.number()).transform(val => 
        typeof val === 'string' ? parseFloat(val) : val
      ),
    }),
  }),
});

// ==================== Loadout Costs ====================

export const LoadoutCosts = z.object({
  weaponCost: z.number(),
  ampCost: z.number(),
  absorberCost: z.number(),
  scopeCost: z.number(),
  sightCost: z.number(),
  weaponEnhancersCost: z.number(),
  armorEnhancersCost: z.number(),
  totalPerShot: z.number(),
  armorDecayMultiplier: z.number().default(0.0009),
  
  // Manual override - if set, use this instead of calculated totalPerShot
  manualCostOverride: z.number().optional(),
});

// ==================== Loadout ====================

export const Loadout = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  userId: z.string(),
  
  // Equipment names (for display)
  weapon: z.string().optional(),
  amp: z.string().optional(),
  absorber: z.string().optional(),
  armorSet: z.string().optional(),
  armorPlating: z.string().optional(),
  scope: z.string().optional(),
  sight: z.string().optional(),
  
  // Full equipment data (for calculations)
  weaponData: EquipmentData.optional(),
  ampData: EquipmentData.optional(),
  absorberData: EquipmentData.optional(),
  armorSetData: EquipmentData.optional(),
  armorPlatingData: EquipmentData.optional(),
  scopeData: EquipmentData.optional(),
  sightData: EquipmentData.optional(),
  
  // Enhancers (up to 10 slots each)
  weaponEnhancers: z.record(z.string(), EnhancerData).default({}),
  armorEnhancers: z.record(z.string(), EnhancerData).default({}),
  
  // Calculated costs
  costs: LoadoutCosts.optional(),
  
  // Cost override - if true, use costs.manualCostOverride instead of calculated costs
  useManualCost: z.boolean().default(false),
  
  // Metadata
  timestamp: z.number(),
  totalPEDCycled: z.number().default(0),
  version: z.literal('2.0').default('2.0'),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type Loadout = z.infer<typeof Loadout>;
export type LoadoutCosts = z.infer<typeof LoadoutCosts>;
export type EquipmentData = z.infer<typeof EquipmentData>;
export type EnhancerData = z.infer<typeof EnhancerData>;
export type DamageProperties = z.infer<typeof DamageProperties>;
export type EconomyProperties = z.infer<typeof EconomyProperties>;

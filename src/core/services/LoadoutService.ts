/**
 * LoadoutService
 * Pure functions for loadout management and cost calculations
 * Based on V1 ARTEMIS cost calculation system
 */

import { produce } from 'immer';
import type { Loadout, LoadoutCosts, EquipmentData, EnhancerData } from '../types/Loadout';

export class LoadoutService {
  // Conversion constants
  private static readonly DECAY_PEC_TO_PED = 1 / 100;
  private static readonly AMMOBURN_TO_PED = 1 / 10000;
  private static readonly ARMOR_DECAY_MULTIPLIER = 0.0009;

  /**
   * Calculate cost per shot for a loadout
   * Formula: Sum all equipment decay + ammo burn costs
   */
  static calculateCosts(loadout: Loadout): LoadoutCosts {
    let weaponCost = 0;
    let ampCost = 0;
    let absorberCost = 0;
    let scopeCost = 0;
    let sightCost = 0;
    let weaponEnhancersCost = 0;
    let armorEnhancersCost = 0;

    // Weapon cost (decay + ammo burn)
    if (loadout.weaponData?.Properties?.Economy) {
      const econ = loadout.weaponData.Properties.Economy;
      weaponCost = 
        (econ.Decay ?? 0) * this.DECAY_PEC_TO_PED +
        (econ.AmmoBurn ?? 0) * this.AMMOBURN_TO_PED;
    }

    // Amp cost (decay + ammo burn)
    if (loadout.ampData?.Properties?.Economy) {
      const econ = loadout.ampData.Properties.Economy;
      ampCost = 
        (econ.Decay ?? 0) * this.DECAY_PEC_TO_PED +
        (econ.AmmoBurn ?? 0) * this.AMMOBURN_TO_PED;
    }

    // Absorber cost (decay only, no ammo burn)
    if (loadout.absorberData?.Properties?.Economy) {
      const econ = loadout.absorberData.Properties.Economy;
      absorberCost = (econ.Decay ?? 0) * this.DECAY_PEC_TO_PED;
    }

    // Scope cost (decay only)
    if (loadout.scopeData?.Properties?.Economy) {
      const econ = loadout.scopeData.Properties.Economy;
      scopeCost = (econ.Decay ?? 0) * this.DECAY_PEC_TO_PED;
    }

    // Sight cost (decay only)
    if (loadout.sightData?.Properties?.Economy) {
      const econ = loadout.sightData.Properties.Economy;
      sightCost = (econ.Decay ?? 0) * this.DECAY_PEC_TO_PED;
    }

    // Weapon enhancers (up to 10 slots)
    weaponEnhancersCost = this.calculateEnhancersCost(loadout.weaponEnhancers);

    // Armor enhancers (up to 10 slots)
    armorEnhancersCost = this.calculateEnhancersCost(loadout.armorEnhancers);

    // Total cost per shot
    const totalPerShot = 
      weaponCost +
      ampCost +
      absorberCost +
      scopeCost +
      sightCost +
      weaponEnhancersCost +
      armorEnhancersCost;

    return {
      weaponCost,
      ampCost,
      absorberCost,
      scopeCost,
      sightCost,
      weaponEnhancersCost,
      armorEnhancersCost,
      totalPerShot,
      armorDecayMultiplier: this.ARMOR_DECAY_MULTIPLIER,
      manualCostOverride: loadout.costs?.manualCostOverride, // Preserve manual override if exists
    };
  }
  
  /**
   * Get effective cost per shot (respects manual override)
   */
  static getEffectiveCostPerShot(loadout: Loadout): number {
    if (!loadout.costs) return 0;
    
    // Use manual override if enabled
    if (loadout.useManualCost && loadout.costs.manualCostOverride !== undefined) {
      return loadout.costs.manualCostOverride;
    }
    
    // Otherwise use calculated cost
    return loadout.costs.totalPerShot;
  }

  /**
   * Calculate total cost for enhancers (weapon or armor)
   */
  private static calculateEnhancersCost(enhancers: Record<string, EnhancerData>): number {
    let totalCost = 0;

    for (const enhancer of Object.values(enhancers)) {
      const decay = enhancer.Properties.Economy.Decay;
      const ammoBurn = enhancer.Properties.Economy.AmmoBurn;
      
      totalCost += 
        decay * this.DECAY_PEC_TO_PED +
        ammoBurn * this.AMMOBURN_TO_PED;
    }

    return totalCost;
  }

  /**
   * Calculate total damage (sum all damage types)
   */
  static calculateTotalDamage(equipment: EquipmentData): number {
    const damage = equipment.Properties.Damage;
    if (!damage) return 0;

    return (
      damage.Stab +
      damage.Cut +
      damage.Impact +
      damage.Penetration +
      damage.Shrapnel +
      damage.Burn +
      damage.Cold +
      damage.Acid +
      damage.Electric
    );
  }

  /**
   * Calculate enhanced damage range with enhancers and amp
   * Returns { min, max }
   */
  static calculateEnhancedDamage(loadout: Loadout): { min: number; max: number } {
    if (!loadout.weaponData) {
      return { min: 0, max: 0 };
    }

    // 1. Base weapon damage
    const totalBaseDamage = this.calculateTotalDamage(loadout.weaponData);
    const weaponBaseMin = totalBaseDamage * 0.5;
    const weaponBaseMax = totalBaseDamage * 1.0;

    // 2. Apply enhancer multiplier (1 + slots * 0.1)
    const enhancerCount = Object.keys(loadout.weaponEnhancers).length;
    const enhancerMultiplier = 1 + (enhancerCount * 0.1);

    let enhancedMin = weaponBaseMin * enhancerMultiplier;
    let enhancedMax = weaponBaseMax * enhancerMultiplier;

    // 3. Apply amp damage (capped at weapon base min)
    if (loadout.ampData?.Properties?.Damage) {
      const ampDamage = this.calculateTotalDamage(loadout.ampData);
      const ampCap = Math.min(ampDamage, weaponBaseMin);

      enhancedMin += ampCap * 0.5;  // 50% to min
      enhancedMax += ampCap * 1.0;  // 100% to max
    }

    return {
      min: Math.round(enhancedMin * 10) / 10,
      max: Math.round(enhancedMax * 10) / 10,
    };
  }

  /**
   * Calculate armor decay cost based on damage taken
   */
  static calculateArmorDecayCost(damageTaken: number): number {
    return damageTaken * this.ARMOR_DECAY_MULTIPLIER;
  }

  /**
   * Create a new loadout
   */
  static create(userId: string, name: string): Loadout {
    return {
      id: crypto.randomUUID(),
      name,
      userId,
      weaponEnhancers: {},
      armorEnhancers: {},
      timestamp: Date.now(),
      totalPEDCycled: 0,
      version: '2.0',
      tags: [],
    };
  }

  /**
   * Update loadout costs (immutable)
   */
  static updateCosts(loadout: Loadout): Loadout {
    return produce(loadout, draft => {
      draft.costs = this.calculateCosts(loadout);
    });
  }

  /**
   * Validate loadout has required equipment
   */
  static isValid(loadout: Loadout): boolean {
    return !!(loadout.weaponData);
  }

  /**
   * Get loadout summary string
   */
  static getSummary(loadout: Loadout): string {
    const parts: string[] = [];
    
    if (loadout.weapon) parts.push(loadout.weapon);
    if (loadout.amp) parts.push(`+ ${loadout.amp}`);
    if (loadout.armorSet) parts.push(`[${loadout.armorSet}]`);
    
    const enhancerCount = Object.keys(loadout.weaponEnhancers).length;
    if (enhancerCount > 0) parts.push(`${enhancerCount}x enhancers`);

    return parts.join(' ');
  }
}

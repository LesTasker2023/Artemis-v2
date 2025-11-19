/**
 * LoadoutService Tests
 * Tests for loadout cost calculations
 */

import { describe, it, expect } from 'vitest';
import { LoadoutService } from '../../src/core/services/LoadoutService';
import type { Loadout, EquipmentData, EnhancerData } from '../../src/core/types/Loadout';

describe('LoadoutService', () => {
  describe('create', () => {
    it('should create a new loadout with valid defaults', () => {
      const loadout = LoadoutService.create('user-123', 'Test Loadout');

      expect(loadout.id).toBeDefined();
      expect(loadout.name).toBe('Test Loadout');
      expect(loadout.userId).toBe('user-123');
      expect(loadout.weaponEnhancers).toEqual({});
      expect(loadout.armorEnhancers).toEqual({});
      expect(loadout.version).toBe('2.0');
    });

    it('should create loadouts with unique IDs', () => {
      const loadout1 = LoadoutService.create('user-123', 'Loadout 1');
      const loadout2 = LoadoutService.create('user-123', 'Loadout 2');

      expect(loadout1.id).not.toBe(loadout2.id);
    });
  });

  describe('calculateCosts', () => {
    it('should calculate zero cost for empty loadout', () => {
      const loadout = LoadoutService.create('user-123', 'Empty Loadout');
      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.weaponCost).toBe(0);
      expect(costs.ampCost).toBe(0);
      expect(costs.absorberCost).toBe(0);
      expect(costs.totalPerShot).toBe(0);
    });

    it('should calculate weapon decay cost correctly', () => {
      const loadout = LoadoutService.create('user-123', 'Weapon Test');
      
      // Mock weapon with decay
      loadout.weaponData = {
        ID: 1,
        Name: 'Test Rifle',
        Properties: {
          Economy: {
            Decay: 50, // 50 pec per shot
            AmmoBurn: 0,
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      // 50 pec = 0.50 PED
      expect(costs.weaponCost).toBe(0.50);
      expect(costs.totalPerShot).toBe(0.50);
    });

    it('should calculate weapon ammo burn cost correctly', () => {
      const loadout = LoadoutService.create('user-123', 'Ammo Test');
      
      loadout.weaponData = {
        ID: 1,
        Name: 'Test Rifle',
        Properties: {
          Economy: {
            Decay: 0,
            AmmoBurn: 1000, // Represents 0.1 PED
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      // 1000 / 10000 = 0.1 PED
      expect(costs.weaponCost).toBe(0.1);
    });

    it('should calculate weapon decay + ammo burn together', () => {
      const loadout = LoadoutService.create('user-123', 'Combined Test');
      
      loadout.weaponData = {
        ID: 1,
        Name: 'Opalo',
        Properties: {
          Economy: {
            Decay: 12, // 0.12 PED
            AmmoBurn: 500, // 0.05 PED
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.weaponCost).toBeCloseTo(0.17, 2); // 0.12 + 0.05
    });

    it('should calculate amp costs correctly', () => {
      const loadout = LoadoutService.create('user-123', 'Amp Test');
      
      loadout.ampData = {
        ID: 2,
        Name: 'Test Amp',
        Properties: {
          Economy: {
            Decay: 30, // 0.30 PED
            AmmoBurn: 200, // 0.02 PED
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.ampCost).toBeCloseTo(0.32, 2); // 0.30 + 0.02
      expect(costs.totalPerShot).toBeCloseTo(0.32, 2);
    });

    it('should calculate absorber cost (decay only, no ammo burn)', () => {
      const loadout = LoadoutService.create('user-123', 'Absorber Test');
      
      loadout.absorberData = {
        ID: 3,
        Name: 'Test Absorber',
        Properties: {
          Economy: {
            Decay: 5, // 0.05 PED
            AmmoBurn: 100, // Should be ignored for absorbers
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.absorberCost).toBe(0.05); // Only decay
    });

    it('should calculate scope and sight costs', () => {
      const loadout = LoadoutService.create('user-123', 'Attachments Test');
      
      loadout.scopeData = {
        ID: 4,
        Name: 'Test Scope',
        Properties: {
          Economy: {
            Decay: 2, // 0.02 PED
            AmmoBurn: 0,
          },
        },
      } as EquipmentData;

      loadout.sightData = {
        ID: 5,
        Name: 'Test Sight',
        Properties: {
          Economy: {
            Decay: 1, // 0.01 PED
            AmmoBurn: 0,
          },
        },
      } as EquipmentData;

      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.scopeCost).toBe(0.02);
      expect(costs.sightCost).toBe(0.01);
      expect(costs.totalPerShot).toBeCloseTo(0.03, 2);
    });

    it('should calculate weapon enhancer costs', () => {
      const loadout = LoadoutService.create('user-123', 'Enhancer Test');
      
      loadout.weaponEnhancers = {
        '1': {
          ID: 100,
          Name: 'Damage Enhancer 1',
          Properties: {
            Economy: {
              Decay: 3,
              AmmoBurn: 50,
            },
          },
        } as EnhancerData,
        '2': {
          ID: 101,
          Name: 'Damage Enhancer 2',
          Properties: {
            Economy: {
              Decay: 3,
              AmmoBurn: 50,
            },
          },
        } as EnhancerData,
      };

      const costs = LoadoutService.calculateCosts(loadout);

      // Each enhancer: 0.03 + 0.005 = 0.035 PED
      // Total: 0.035 * 2 = 0.07 PED
      expect(costs.weaponEnhancersCost).toBeCloseTo(0.07, 2);
    });

    it('should calculate armor enhancer costs', () => {
      const loadout = LoadoutService.create('user-123', 'Armor Enhancer Test');
      
      loadout.armorEnhancers = {
        '1': {
          ID: 200,
          Name: 'Shrapnel Plating',
          Properties: {
            Economy: {
              Decay: 2,
              AmmoBurn: 0,
            },
          },
        } as EnhancerData,
      };

      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.armorEnhancersCost).toBe(0.02);
    });

    it('should calculate full loadout cost correctly', () => {
      const loadout = LoadoutService.create('user-123', 'Full Loadout');
      
      // Weapon
      loadout.weaponData = {
        ID: 1,
        Name: 'Opalo',
        Properties: {
          Economy: { Decay: 12, AmmoBurn: 500 },
        },
      } as EquipmentData;

      // Amp
      loadout.ampData = {
        ID: 2,
        Name: 'Adjusted L23B',
        Properties: {
          Economy: { Decay: 30, AmmoBurn: 200 },
        },
      } as EquipmentData;

      // Scope
      loadout.scopeData = {
        ID: 3,
        Name: 'Test Scope',
        Properties: {
          Economy: { Decay: 2, AmmoBurn: 0 },
        },
      } as EquipmentData;

      // 2 Weapon Enhancers
      loadout.weaponEnhancers = {
        '1': {
          ID: 100,
          Name: 'Damage Enhancer 1',
          Properties: {
            Economy: { Decay: 3, AmmoBurn: 50 },
          },
        } as EnhancerData,
        '2': {
          ID: 101,
          Name: 'Damage Enhancer 2',
          Properties: {
            Economy: { Decay: 3, AmmoBurn: 50 },
          },
        } as EnhancerData,
      };

      const costs = LoadoutService.calculateCosts(loadout);

      // Weapon: 0.12 + 0.05 = 0.17
      // Amp: 0.30 + 0.02 = 0.32
      // Scope: 0.02
      // Enhancers: (0.03 + 0.005) * 2 = 0.07
      // Total: 0.17 + 0.32 + 0.02 + 0.07 = 0.58
      expect(costs.totalPerShot).toBeCloseTo(0.58, 2);
    });

    it('should handle up to 10 weapon enhancers', () => {
      const loadout = LoadoutService.create('user-123', '10 Enhancers');
      
      // Add 10 enhancers
      for (let i = 1; i <= 10; i++) {
        loadout.weaponEnhancers[i.toString()] = {
          ID: 100 + i,
          Name: `Enhancer ${i}`,
          Properties: {
            Economy: { Decay: 1, AmmoBurn: 0 },
          },
        } as EnhancerData;
      }

      const costs = LoadoutService.calculateCosts(loadout);

      // 10 enhancers * 0.01 PED = 0.10 PED
      expect(costs.weaponEnhancersCost).toBeCloseTo(0.10, 2);
    });

    it('should return armor decay multiplier', () => {
      const loadout = LoadoutService.create('user-123', 'Test');
      const costs = LoadoutService.calculateCosts(loadout);

      expect(costs.armorDecayMultiplier).toBe(0.0009);
    });
  });
});

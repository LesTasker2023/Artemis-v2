/**
 * WeaponStats Component
 * Displays weapon statistics: damage, DPS, ammo burn, damage per PEC
 */

import { createMemo, Show } from "solid-js";
import type {
  V1DamageData,
  V1EconomyData,
} from "../../../core/services/EquipmentDataService";

interface WeaponStatsProps {
  weaponData?: {
    name: string;
    economy: V1EconomyData | null;
    damage: V1DamageData | null;
  } | null;
  ampData?: {
    name: string;
    economy: V1EconomyData | null;
    damage: V1DamageData | null;
  } | null;
  enhancerCount: number;
}

export function WeaponStats(props: WeaponStatsProps) {
  // Calculate total weapon damage (sum of all damage types)
  const weaponBaseDamage = createMemo(() => {
    const damage = props.weaponData?.damage;
    if (!damage) return 0;

    return (
      (damage.Stab || 0) +
      (damage.Cut || 0) +
      (damage.Impact || 0) +
      (damage.Penetration || 0) +
      (damage.Shrapnel || 0) +
      (damage.Burn || 0) +
      (damage.Cold || 0) +
      (damage.Acid || 0) +
      (damage.Electric || 0)
    );
  });

  // Calculate amp damage
  const ampDamage = createMemo(() => {
    const damage = props.ampData?.damage;
    if (!damage) return 0;

    return (
      (damage.Stab || 0) +
      (damage.Cut || 0) +
      (damage.Impact || 0) +
      (damage.Penetration || 0) +
      (damage.Shrapnel || 0) +
      (damage.Burn || 0) +
      (damage.Cold || 0) +
      (damage.Acid || 0) +
      (damage.Electric || 0)
    );
  });

  // Apply enhancer multiplier (1 + enhancerCount * 0.1)
  const enhancerMultiplier = createMemo(() => 1 + props.enhancerCount * 0.1);

  // Calculate damage range with enhancers (50%-100% of max damage)
  const minDamage = createMemo(() => {
    const baseMin = weaponBaseDamage() * 0.5;
    const enhancedMin = baseMin * enhancerMultiplier();

    // Add amp damage (capped at weapon base min, 50% contribution)
    const ampContribution =
      Math.min(ampDamage(), weaponBaseDamage() * 0.5) * 0.5;

    return enhancedMin + ampContribution;
  });

  const maxDamage = createMemo(() => {
    const baseMax = weaponBaseDamage() * 1.0;
    const enhancedMax = baseMax * enhancerMultiplier();

    // Add amp damage (capped at weapon base min, 100% contribution)
    const ampContribution =
      Math.min(ampDamage(), weaponBaseDamage() * 0.5) * 1.0;

    return enhancedMax + ampContribution;
  });

  // Calculate uses per minute (for DPS calculation)
  const usesPerMinute = createMemo(() => {
    // Get from weapon properties, default to 60 if not available
    return 60; // Placeholder - would come from weaponData.Properties.UsesPerMinute
  });

  // Calculate DPS (Damage Per Second) - using average damage
  const dps = createMemo(() => {
    const avgDamage = (minDamage() + maxDamage()) / 2;
    const upm = usesPerMinute();
    if (avgDamage === 0 || upm === 0) return 0;
    return (avgDamage * upm) / 60;
  });

  // Calculate total ammo burn
  const totalAmmoBurn = createMemo(() => {
    let burn = 0;

    // Weapon ammo burn
    if (props.weaponData?.economy?.AmmoBurn) {
      burn += props.weaponData.economy.AmmoBurn;
    }

    // Amp ammo burn
    if (props.ampData?.economy?.AmmoBurn) {
      burn += props.ampData.economy.AmmoBurn;
    }

    return burn;
  });

  // Calculate damage per PEC (efficiency metric)
  const damagePerPEC = createMemo(() => {
    const avgDamage = (minDamage() + maxDamage()) / 2;
    const burnInPEC = totalAmmoBurn(); // Already in PEC
    if (avgDamage === 0 || burnInPEC === 0) return 0;
    return avgDamage / burnInPEC;
  });

  const hasStats = createMemo(() => {
    return (
      props.weaponData && props.weaponData.damage && weaponBaseDamage() > 0
    );
  });

  return (
    <div class="space-y-2">
      <label class="block text-sm font-medium text-orange-400 mb-3">
        Weapon Stats
      </label>

      <Show
        when={hasStats()}
        fallback={
          <div class="text-sm text-primary/40 italic">
            Select weapon to see stats
          </div>
        }
      >
        <div class="grid grid-cols-2 gap-2 text-sm">
          {/* Total Damage Range */}
          <div class="bg-background border border-orange-500/20 rounded p-2">
            <div class="text-orange-400/80 text-xs mb-1">Damage Range</div>
            <div class="text-orange-400 font-semibold">
              {minDamage().toFixed(1)} - {maxDamage().toFixed(1)}
            </div>
          </div>

          {/* DPS */}
          <div class="bg-background border border-orange-500/20 rounded p-2">
            <div class="text-orange-400/80 text-xs mb-1">DPS (Avg)</div>
            <div class="text-orange-400 font-semibold">{dps().toFixed(1)}</div>
          </div>

          {/* Ammo Burn */}
          <div class="bg-background border border-orange-500/20 rounded p-2">
            <div class="text-orange-400/80 text-xs mb-1">Ammo Burn</div>
            <div class="text-orange-400 font-semibold">
              {totalAmmoBurn().toFixed(0)}{" "}
              <span class="text-orange-400/60 text-xs">PEC</span>
            </div>
          </div>

          {/* Damage per PEC */}
          <div class="bg-background border border-orange-500/20 rounded p-2">
            <div class="text-orange-400/80 text-xs mb-1">Damage/PEC</div>
            <div class="text-orange-400 font-semibold">
              {damagePerPEC().toFixed(1)}
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

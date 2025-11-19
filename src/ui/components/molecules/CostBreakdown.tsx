/**
 * CostBreakdown Component
 * Display itemized cost calculation with manual override option
 */

import { Show } from "solid-js";
import type { LoadoutCosts } from "../../../core/types/Loadout";

interface CostBreakdownProps {
  costs: LoadoutCosts;
  useManualCost: boolean;
  onToggleManual: (enabled: boolean) => void;
  onManualCostChange: (cost: number) => void;
}

export function CostBreakdown(props: CostBreakdownProps) {
  const effectiveCost = () => {
    if (props.useManualCost && props.costs.manualCostOverride !== undefined) {
      return props.costs.manualCostOverride;
    }
    return props.costs.totalPerShot;
  };

  return (
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-primary">Cost Breakdown</h3>

      {/* Itemized Costs */}
      <div class="space-y-2 text-sm">
        <Show when={props.costs.weaponCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Weapon:</span>
            <span>{props.costs.weaponCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.ampCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Amp:</span>
            <span>{props.costs.ampCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.absorberCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Absorber:</span>
            <span>{props.costs.absorberCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.scopeCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Scope:</span>
            <span>{props.costs.scopeCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.sightCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Sight:</span>
            <span>{props.costs.sightCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.weaponEnhancersCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Weapon Enhancers:</span>
            <span>{props.costs.weaponEnhancersCost.toFixed(4)} PED</span>
          </div>
        </Show>

        <Show when={props.costs.armorEnhancersCost > 0}>
          <div class="flex justify-between text-primary/80">
            <span>Armor Enhancers:</span>
            <span>{props.costs.armorEnhancersCost.toFixed(4)} PED</span>
          </div>
        </Show>

        {/* Total */}
        <div class="pt-3 border-t border-primary/20 flex justify-between font-semibold">
          <span class="text-primary">Calculated Total:</span>
          <span class="text-primary">
            {props.costs.totalPerShot.toFixed(4)} PED
          </span>
        </div>
      </div>

      {/* Manual Override Option */}
      <div class="pt-4 border-t border-primary/20 space-y-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={props.useManualCost}
            onChange={(e) => props.onToggleManual(e.currentTarget.checked)}
            class="w-4 h-4 rounded border-primary/20 bg-background text-blue-500 focus:ring-2 focus:ring-blue-400"
          />
          <span class="text-sm text-primary/80">Use manual cost override</span>
        </label>

        <Show when={props.useManualCost}>
          <div class="flex items-center gap-2">
            <input
              type="number"
              value={props.costs.manualCostOverride?.toFixed(2) || "0.00"}
              onInput={(e) => {
                const value = parseFloat(e.currentTarget.value);
                if (!isNaN(value) && value >= 0) {
                  props.onManualCostChange(value);
                }
              }}
              step="0.01"
              min="0"
              class="flex-1 px-3 py-2 bg-background border border-primary/20 rounded text-primary focus:outline-none focus:border-blue-400"
            />
            <span class="text-sm text-primary/60">PED per shot</span>
          </div>
          <p class="text-xs text-primary/40">
            Manual override replaces calculated cost in session stats
          </p>
        </Show>
      </div>

      {/* Effective Cost Display */}
      <div class="pt-4 border-t border-primary/20">
        <div class="text-center">
          <div class="text-sm text-primary/60 mb-1">Cost per shot</div>
          <div class="text-3xl font-bold text-green-400">
            {effectiveCost().toFixed(5)} PED
          </div>
          <Show
            when={
              props.useManualCost &&
              props.costs.manualCostOverride !== undefined
            }
          >
            <div class="text-xs text-primary/40 mt-1">
              (using manual override)
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

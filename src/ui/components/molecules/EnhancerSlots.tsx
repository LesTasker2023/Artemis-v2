/**
 * EnhancerSlots Component
 * Visual display of 10 enhancer slots with add/remove functionality
 */

import { Show, For } from "solid-js";
import { X } from "lucide-solid";
import type { EnhancerData } from "../../../core/types/Loadout";
import { EquipmentSelect } from "./EquipmentSelect";

interface EnhancerSlotsProps {
  label: string;
  enhancers: Record<string, EnhancerData>;
  availableEnhancers: EnhancerData[];
  onAdd: (enhancer: EnhancerData) => void;
  onRemove: (enhancerName: string) => void;
  loading?: boolean;
}

export function EnhancerSlots(props: EnhancerSlotsProps) {
  const enhancerList = () => Object.entries(props.enhancers);
  const slotsUsed = () => Object.keys(props.enhancers).length;
  const canAddMore = () => slotsUsed() < 10;

  // Render visual slot display: ⬛⬛⬛⬜⬜⬜⬜⬜⬜⬜
  const renderSlots = () => {
    const filled = "⬛".repeat(Math.min(slotsUsed(), 10));
    const empty = "⬜".repeat(Math.max(0, 10 - slotsUsed()));
    return `${filled}${empty}`;
  };

  return (
    <div class="space-y-3">
      {/* Header with slot visualization */}
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-primary/80">
          {props.label} ({slotsUsed()}/10 slots)
        </label>
        <div
          class="text-lg font-mono text-primary/60"
          title={`${slotsUsed()} of 10 slots used`}
        >
          {renderSlots()}
        </div>
      </div>

      {/* Add Enhancer Dropdown */}
      <Show when={canAddMore()}>
        <EquipmentSelect
          label=""
          equipment={props.availableEnhancers}
          selected={null}
          onSelect={(enhancer) => {
            if (enhancer) {
              props.onAdd(enhancer);
            }
          }}
          placeholder="Add enhancer..."
          loading={props.loading}
        />
      </Show>

      {/* Max slots warning */}
      <Show when={!canAddMore()}>
        <div class="px-4 py-2 bg-primary/5 border border-primary/20 rounded text-sm text-primary/60">
          Maximum of 10 enhancers reached
        </div>
      </Show>

      {/* Currently equipped enhancers */}
      <Show when={slotsUsed() > 0}>
        <div class="space-y-2">
          <For each={enhancerList()}>
            {([name, enhancer]) => (
              <div class="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded">
                <div class="flex-1">
                  <div class="text-sm text-primary">{enhancer.Name}</div>
                  <div class="text-xs text-primary/60">
                    Decay: {enhancer.Properties.Economy.Decay} · Ammo:{" "}
                    {enhancer.Properties.Economy.AmmoBurn}
                  </div>
                </div>
                <button
                  onClick={() => props.onRemove(name)}
                  class="text-primary/40 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

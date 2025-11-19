/**
 * LoadoutSelector Component
 * Dropdown to select active loadout for hunting session
 */

import { createSignal, For, Show, createEffect, onCleanup } from "solid-js";
import { Card } from "../atoms/Card";
import { Button } from "../atoms/Button";
import type { Loadout } from "../../../core/types/Loadout";

interface LoadoutSelectorProps {
  loadouts: Loadout[];
  selectedLoadout: Loadout | null;
  onSelect: (loadout: Loadout | null) => void;
  onCreateNew: () => void;
}

export function LoadoutSelector(props: LoadoutSelectorProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  // Click outside to close dropdown
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  createEffect(() => {
    if (isOpen()) {
      document.addEventListener("click", handleClickOutside);
      onCleanup(() => {
        document.removeEventListener("click", handleClickOutside);
      });
    }
  });

  const handleSelect = (loadout: Loadout) => {
    props.onSelect(loadout);
    setIsOpen(false);
  };

  const getCostDisplay = (loadout: Loadout): string => {
    if (!loadout.costs) return "N/A";

    // Use manual override if enabled
    if (
      loadout.useManualCost &&
      loadout.costs.manualCostOverride !== undefined
    ) {
      return `${loadout.costs.manualCostOverride.toFixed(5)} PED/shot (manual)`;
    }

    return `${loadout.costs.totalPerShot.toFixed(5)} PED/shot`;
  };

  return (
    <div class="space-y-3" ref={containerRef}>
      <label class="text-sm font-medium text-primary/80 uppercase tracking-wide">
        Active Loadout
      </label>

      <div class="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen());
          }}
          class="w-full px-4 py-3 text-left bg-background-lighter border border-primary/20 rounded-lg hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
        >
          <Show
            when={props.selectedLoadout}
            fallback={<span class="text-primary/40">Select loadout...</span>}
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-white">
                {props.selectedLoadout!.name}
              </span>
              <span class="text-sm text-primary/60 font-mono">
                {getCostDisplay(props.selectedLoadout!)}
              </span>
            </div>
          </Show>
        </button>

        <Show when={isOpen()}>
          <div class="absolute z-10 w-full mt-1 bg-background-card border border-primary/20 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            <Show
              when={props.loadouts.length > 0}
              fallback={
                <div class="px-4 py-3 text-sm text-primary/40 text-center">
                  No loadouts available
                </div>
              }
            >
              <For each={props.loadouts}>
                {(loadout) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(loadout);
                    }}
                    class="w-full px-4 py-3 text-left hover:bg-primary/10 border-b border-primary/10 last:border-b-0 transition-colors"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="font-medium text-white">{loadout.name}</div>
                        <Show when={loadout.weapon}>
                          <div class="text-sm text-primary/60 mt-1">
                            {loadout.weapon}
                            <Show when={loadout.amp}>
                              {" + " + loadout.amp}
                            </Show>
                          </div>
                        </Show>
                      </div>
                      <div class="text-sm text-primary/60 ml-4 font-mono">
                        {getCostDisplay(loadout)}
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </Show>

            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect(null);
                setIsOpen(false);
              }}
              class="w-full px-4 py-2 text-left text-sm text-primary/60 hover:bg-primary/5 border-t border-primary/20"
            >
              Clear selection
            </button>
          </div>
        </Show>
      </div>

      <Show when={props.selectedLoadout}>
        <div class="p-4 bg-background-lighter rounded-lg border border-primary/10">
          <div class="text-sm space-y-2">
            <Show when={props.selectedLoadout!.weapon}>
              <div class="flex justify-between items-center">
                <span class="text-primary/60">Weapon</span>
                <span class="font-medium text-white">
                  {props.selectedLoadout!.weapon}
                </span>
              </div>
            </Show>
            <Show when={props.selectedLoadout!.amp}>
              <div class="flex justify-between items-center">
                <span class="text-primary/60">Amp</span>
                <span class="font-medium text-white">
                  {props.selectedLoadout!.amp}
                </span>
              </div>
            </Show>
            <Show when={props.selectedLoadout!.armorSet}>
              <div class="flex justify-between items-center">
                <span class="text-primary/60">Armor</span>
                <span class="font-medium text-white">
                  {props.selectedLoadout!.armorSet}
                </span>
              </div>
            </Show>
            <Show when={props.selectedLoadout!.costs}>
              <div class="pt-2 mt-2 border-t border-primary/10">
                <div class="flex justify-between items-center">
                  <span class="text-primary/60 uppercase text-xs tracking-wide">
                    Cost per shot
                  </span>
                  <span class="font-bold text-primary font-mono">
                    {props.selectedLoadout!.costs!.totalPerShot.toFixed(4)} PED
                  </span>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

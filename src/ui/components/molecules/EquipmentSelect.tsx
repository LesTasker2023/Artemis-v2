/**
 * EquipmentSelect Component
 * Searchable dropdown for equipment selection
 */

import { createSignal, Show, For, createEffect, onCleanup } from "solid-js";
import { Search, X } from "lucide-solid";
import type { EquipmentData } from "../../../core/types/Loadout";

interface EquipmentSelectProps {
  label: string;
  equipment: EquipmentData[];
  selected: EquipmentData | null;
  onSelect: (equipment: EquipmentData | null) => void;
  placeholder?: string;
  loading?: boolean;
}

export function EquipmentSelect(props: EquipmentSelectProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  let containerRef: HTMLDivElement | undefined;

  // Click outside to close
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

  // Filter equipment by search
  const filtered = () => {
    const query = search().toLowerCase().trim();
    if (!query) return props.equipment.slice(0, 50); // Show first 50 items

    return props.equipment
      .filter((e) => e.Name.toLowerCase().includes(query))
      .slice(0, 50); // Limit results
  };

  const handleSelect = (equipment: EquipmentData) => {
    props.onSelect(equipment);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    props.onSelect(null);
    setSearch("");
  };

  return (
    <div class="relative" ref={containerRef}>
      <label class="block text-sm font-medium text-primary/80 mb-2">
        {props.label}
      </label>

      {/* Selected Item Display */}
      <Show
        when={props.selected}
        fallback={
          <button
            onClick={() => setIsOpen(!isOpen())}
            class="w-full px-4 py-2 bg-background border border-primary/20 rounded text-left text-primary/60 hover:border-primary/40 transition-colors"
            disabled={props.loading}
          >
            {props.loading ? "Loading..." : props.placeholder || "Select..."}
          </button>
        }
      >
        <div class="flex items-center gap-2 px-4 py-2 bg-background border border-primary/20 rounded">
          <button
            onClick={() => setIsOpen(!isOpen())}
            class="flex-1 text-left text-primary hover:text-primary/80 transition-colors"
          >
            {props.selected!.Name}
          </button>
          <button
            onClick={handleClear}
            class="text-primary/40 hover:text-red-400 transition-colors"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      </Show>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div class="absolute z-50 mt-2 w-full bg-background border border-primary/20 rounded shadow-xl max-h-80 flex flex-col">
          {/* Search Input */}
          <div class="p-2 border-b border-primary/20">
            <div class="relative">
              <Search
                class="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40"
                size={16}
              />
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search..."
                class="w-full pl-9 pr-3 py-2 bg-background border border-primary/20 rounded text-primary placeholder-primary/40 focus:outline-none focus:border-blue-400"
                autofocus
              />
            </div>
          </div>

          {/* Results List */}
          <div class="overflow-y-auto">
            <Show
              when={filtered().length > 0}
              fallback={
                <div class="p-4 text-center text-primary/40">
                  No equipment found
                </div>
              }
            >
              <For each={filtered()}>
                {(equipment) => (
                  <button
                    onClick={() => handleSelect(equipment)}
                    class="w-full px-4 py-2 text-left hover:bg-primary/10 transition-colors"
                  >
                    <div class="text-primary">{equipment.Name}</div>
                    <Show when={equipment.Properties?.Economy}>
                      <div class="text-xs text-primary/60 mt-1">
                        Decay: {equipment.Properties.Economy!.Decay} PEC
                        {equipment.Properties.Economy!.AmmoBurn && (
                          <> · Ammo: {equipment.Properties.Economy!.AmmoBurn}</>
                        )}
                      </div>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </div>

          {/* Footer hint */}
          <Show when={filtered().length === 50}>
            <div class="p-2 border-t border-primary/20 text-xs text-primary/40 text-center">
              Showing first 50 results. Search to narrow down.
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

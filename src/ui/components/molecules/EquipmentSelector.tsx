/**
 * Equipment Selector Component
 * Searchable dropdown for selecting weapons, amps, scopes, etc.
 */

import { createSignal, createEffect, Show, For } from "solid-js";
import { Search, X, ChevronDown } from "lucide-solid";
import { Card } from "../atoms/Card";
import type { EquipmentSearchResult } from "../../../core/services/EquipmentDataService";
import { EquipmentType } from "../../../core/services/EquipmentDataService";

interface EquipmentSelectorProps {
  type: EquipmentType;
  label: string;
  selectedEquipment?: EquipmentSearchResult | null;
  onSelect: (equipment: EquipmentSearchResult | null) => void;
  placeholder?: string;
}

export function EquipmentSelector(props: EquipmentSelectorProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<
    EquipmentSearchResult[]
  >([]);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  // Search equipment when query changes
  createEffect(() => {
    const query = searchQuery();

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Check if equipment API is available
    if (!window.electron?.equipment) {
      console.error("Equipment API not available");
      return;
    }

    setIsLoading(true);

    // Use void to handle async in effect
    void (async () => {
      try {
        console.log(
          `[EquipmentSelector] Searching for "${query}" in ${props.type}`
        );
        const results = await window.electron.equipment.search(
          query,
          props.type,
          20 // Limit to 20 results
        );
        console.log(`[EquipmentSelector] Found ${results.length} results`);
        setSearchResults(results);
      } catch (error) {
        console.error("Failed to search equipment:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    })();
  });

  const handleSelect = (equipment: EquipmentSearchResult) => {
    props.onSelect(equipment);
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleClear = () => {
    props.onSelect(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const formatCost = (economy: any) => {
    if (!economy) return "No cost data";
    const decay = economy.Decay || 0;
    const ammoBurn = economy.AmmoBurn || 0;
    const cost = decay / 100 + ammoBurn / 10000;
    return `${cost.toFixed(4)} PED/use`;
  };

  return (
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-300">{props.label}</label>

      {/* Selected Equipment Display */}
      <Show when={props.selectedEquipment}>
        <Card class="p-3 bg-gray-800 border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="font-medium text-white">
                {props.selectedEquipment!.name}
              </div>
              <div class="text-sm text-gray-400">
                {formatCost(props.selectedEquipment!.economy)}
              </div>
              <Show when={props.selectedEquipment!.category}>
                <div class="text-xs text-gray-500">
                  {props.selectedEquipment!.category}
                </div>
              </Show>
            </div>
            <button
              onClick={handleClear}
              class="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Remove equipment"
            >
              <X size={16} class="text-gray-400" />
            </button>
          </div>
        </Card>
      </Show>

      {/* Search Input */}
      <Show when={!props.selectedEquipment}>
        <div class="relative">
          <button
            onClick={() => setIsOpen(!isOpen())}
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-left hover:border-gray-600 transition-colors flex items-center justify-between"
          >
            <span class="text-gray-400">
              {props.placeholder || `Search ${props.label.toLowerCase()}...`}
            </span>
            <ChevronDown
              size={16}
              class="text-gray-500"
              classList={{ "transform rotate-180": isOpen() }}
            />
          </button>

          {/* Dropdown Panel */}
          <Show when={isOpen()}>
            <Card class="absolute z-50 mt-2 w-full p-3 bg-gray-800 border-gray-700 shadow-xl max-h-96 overflow-y-auto">
              {/* Search Input */}
              <div class="relative mb-3">
                <Search
                  size={16}
                  class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder={`Type to search ${props.label.toLowerCase()}...`}
                  class="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
                  autofocus
                />
              </div>

              {/* Loading State */}
              <Show when={isLoading()}>
                <div class="text-center py-4 text-gray-400">Searching...</div>
              </Show>

              {/* No Results */}
              <Show
                when={
                  !isLoading() &&
                  searchQuery().length >= 2 &&
                  searchResults().length === 0
                }
              >
                <div class="text-center py-4 text-gray-400">
                  No {props.label.toLowerCase()} found
                </div>
              </Show>

              {/* Search Results */}
              <Show when={!isLoading() && searchResults().length > 0}>
                <div class="space-y-1">
                  <For each={searchResults()}>
                    {(equipment) => (
                      <button
                        onClick={() => handleSelect(equipment)}
                        class="w-full p-3 text-left hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <div class="font-medium text-white text-sm">
                          {equipment.name}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">
                          {formatCost(equipment.economy)}
                        </div>
                        <Show when={equipment.category}>
                          <div class="text-xs text-gray-500 mt-0.5">
                            {equipment.category}
                          </div>
                        </Show>
                        <Show when={equipment.damage}>
                          <div class="text-xs text-blue-400 mt-0.5">
                            {Object.entries(equipment.damage!)
                              .filter(([_, value]) => value && value > 0)
                              .map(([type, value]) => `${type}: ${value}`)
                              .join(", ")}
                          </div>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              {/* Help Text */}
              <Show when={searchQuery().length < 2}>
                <div class="text-center py-4 text-gray-500 text-sm">
                  Type at least 2 characters to search
                </div>
              </Show>
            </Card>
          </Show>
        </div>
      </Show>
    </div>
  );
}

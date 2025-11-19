/**
 * EnhancerMultiSelector Component
 * Multi-select dropdown for weapon/armor enhancers (up to 10 slots)
 */

import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { Search, X, Plus } from "lucide-solid";
import { EquipmentType } from "../../../core/services/EquipmentDataService";
import type { EquipmentSearchResult } from "../../../core/services/EquipmentDataService";
import { Card } from "../atoms/Card";

interface EnhancerMultiSelectorProps {
  type: EquipmentType.WEAPON_ENHANCER | EquipmentType.ARMOR_ENHANCER;
  label: string;
  selectedEnhancers: EquipmentSearchResult[];
  onSelect: (enhancers: EquipmentSearchResult[]) => void;
  maxSlots?: number;
  placeholder?: string;
}

export function EnhancerMultiSelector(props: EnhancerMultiSelectorProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<
    EquipmentSearchResult[]
  >([]);
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const maxSlots = () => props.maxSlots || 10;

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsDropdownOpen(false);
    }
  };

  createEffect(() => {
    if (isDropdownOpen()) {
      document.addEventListener("click", handleClickOutside);
      onCleanup(() => {
        document.removeEventListener("click", handleClickOutside);
      });
    }
  });

  // Search for enhancers when query changes
  createEffect(() => {
    const query = searchQuery();
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    if (!window.electron?.equipment) {
      console.warn("[EnhancerMultiSelector] Equipment API not available");
      return;
    }

    setIsLoading(true);

    void (async () => {
      try {
        const results = await window.electron.equipment.search(
          query,
          props.type,
          20
        );
        console.log(
          `[EnhancerMultiSelector] Found ${results.length} enhancers for "${query}"`
        );
        setSearchResults(results);
      } catch (error) {
        console.error("[EnhancerMultiSelector] Search error:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    })();
  });

  const handleAddEnhancer = (enhancer: EquipmentSearchResult) => {
    const current = props.selectedEnhancers;

    // Check if already added
    if (current.some((e) => e.name === enhancer.name)) {
      return;
    }

    // Check slots limit
    if (current.length >= maxSlots()) {
      alert(`Maximum ${maxSlots()} enhancers allowed`);
      return;
    }

    props.onSelect([...current, enhancer]);
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownOpen(false);
  };

  const handleRemoveEnhancer = (index: number) => {
    const current = props.selectedEnhancers;
    props.onSelect(current.filter((_, i) => i !== index));
  };

  const getTierColor = (name: string): string => {
    if (name.includes("10.")) return "text-orange-600";
    if (name.includes("9.")) return "text-orange-500";
    if (name.includes("8.")) return "text-purple-600";
    if (name.includes("7.")) return "text-purple-500";
    if (name.includes("6.")) return "text-blue-600";
    if (name.includes("5.")) return "text-blue-500";
    return "text-gray-600";
  };

  const getCostDisplay = (enhancer: EquipmentSearchResult): string => {
    if (!enhancer.economy?.Decay) return "Unknown cost";
    const decay = enhancer.economy.Decay;
    const ammoBurn = enhancer.economy.AmmoBurn || 0;
    const totalCost = decay / 100 + ammoBurn / 10000;
    return `${totalCost.toFixed(4)} PED/use`;
  };

  return (
    <div ref={containerRef} class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        {props.label}{" "}
        <span class="text-gray-500">
          ({props.selectedEnhancers.length}/{maxSlots()})
        </span>
      </label>

      {/* Selected Enhancers List */}
      <Show when={props.selectedEnhancers.length > 0}>
        <div class="space-y-2 mb-2">
          <For each={props.selectedEnhancers}>
            {(enhancer, index) => (
              <Card class="p-3 bg-gray-50 border border-gray-200">
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class={`font-medium ${getTierColor(enhancer.name)}`}
                      >
                        {enhancer.name}
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {getCostDisplay(enhancer)}
                      <Show when={enhancer.damage}>
                        <span class="ml-2">
                          • Dmg:{" "}
                          {Object.values(enhancer.damage!).reduce(
                            (a, b) => (a || 0) + (b || 0),
                            0
                          )}
                        </span>
                      </Show>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEnhancer(index())}
                    class="p-1 hover:bg-red-100 rounded text-red-600"
                    title="Remove enhancer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>

      {/* Search Input */}
      <Show when={props.selectedEnhancers.length < maxSlots()}>
        <div class="relative">
          <div class="relative">
            <Search
              class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={
                props.placeholder || `Search ${props.label.toLowerCase()}...`
              }
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Dropdown Results */}
          <Show when={isDropdownOpen() && searchQuery().length >= 2}>
            <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <Show
                when={!isLoading()}
                fallback={
                  <div class="p-3 text-sm text-gray-500 text-center">
                    Searching...
                  </div>
                }
              >
                <Show
                  when={searchResults().length > 0}
                  fallback={
                    <div class="p-3 text-sm text-gray-500 text-center">
                      No enhancers found
                    </div>
                  }
                >
                  <For each={searchResults()}>
                    {(enhancer) => (
                      <button
                        onClick={() => handleAddEnhancer(enhancer)}
                        class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-start justify-between gap-2"
                        disabled={props.selectedEnhancers.some(
                          (e) => e.name === enhancer.name
                        )}
                      >
                        <div class="flex-1 min-w-0">
                          <div
                            class={`font-medium text-sm ${getTierColor(enhancer.name)}`}
                          >
                            {enhancer.name}
                          </div>
                          <div class="text-xs text-gray-500 mt-1">
                            {getCostDisplay(enhancer)}
                            <Show when={enhancer.category}>
                              <span class="ml-2">• {enhancer.category}</span>
                            </Show>
                            <Show when={enhancer.damage}>
                              <span class="ml-2">
                                • Dmg:{" "}
                                {Object.values(enhancer.damage!).reduce(
                                  (a, b) => (a || 0) + (b || 0),
                                  0
                                )}
                              </span>
                            </Show>
                          </div>
                        </div>
                        <Show
                          when={props.selectedEnhancers.some(
                            (e) => e.name === enhancer.name
                          )}
                        >
                          <span class="text-xs text-green-600 font-medium">
                            Added
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Add More hint */}
      <Show when={props.selectedEnhancers.length === 0}>
        <div class="text-xs text-gray-500 italic">
          Search and add up to {maxSlots()} enhancers
        </div>
      </Show>
    </div>
  );
}

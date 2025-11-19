/**
 * Loadouts Page
 * Manage hunting gear configurations with cost calculations
 */

import { createSignal, onMount, Show, For } from "solid-js";
import { Plus } from "lucide-solid";
import type { Loadout } from "../../core/types/Loadout";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { LoadoutModal } from "../components/organisms/LoadoutModal";

export default function Loadouts() {
  const [loadouts, setLoadouts] = createSignal<Loadout[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showModal, setShowModal] = createSignal(false);
  const [editingLoadout, setEditingLoadout] = createSignal<Loadout | null>(
    null
  );

  // Load loadouts from database
  onMount(async () => {
    if (window.electron?.loadout) {
      try {
        const loaded = await window.electron.loadout.findAll();
        setLoadouts(loaded);
        console.log(`[Loadouts] Loaded ${loaded.length} loadouts`);
      } catch (error) {
        console.error("[Loadouts] Failed to load:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  });

  const handleCreate = () => {
    setEditingLoadout(null);
    setShowModal(true);
  };

  const handleEdit = (loadout: Loadout) => {
    setEditingLoadout(loadout);
    setShowModal(true);
  };

  const handleDelete = async (loadout: Loadout) => {
    if (!confirm(`Delete loadout "${loadout.name}"?`)) return;

    try {
      await window.electron.loadout.delete(loadout.id);
      setLoadouts(loadouts().filter((l) => l.id !== loadout.id));
      console.log(`[Loadouts] Deleted: ${loadout.name}`);
    } catch (error) {
      console.error("[Loadouts] Delete failed:", error);
      alert("Failed to delete loadout");
    }
  };

  const handleSave = async (loadout: Loadout) => {
    try {
      // Save works for both create and update
      await window.electron.loadout.save(loadout);

      if (editingLoadout()) {
        // Update existing in list
        setLoadouts(loadouts().map((l) => (l.id === loadout.id ? loadout : l)));
        console.log(`[Loadouts] Updated: ${loadout.name}`);
      } else {
        // Add new to list
        setLoadouts([...loadouts(), loadout]);
        console.log(`[Loadouts] Created: ${loadout.name}`);
      }
      setShowModal(false);
    } catch (error) {
      console.error("[Loadouts] Save failed:", error);
      alert("Failed to save loadout");
    }
  };

  return (
    <div class="min-h-screen bg-background p-6">
      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-3xl font-bold text-primary">Loadouts</h1>
          <p class="text-primary/60 mt-1">
            Manage your hunting gear configurations
          </p>
        </div>
        <Button onClick={handleCreate} class="flex items-center gap-2">
          <Plus size={20} />
          New Loadout
        </Button>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="text-center py-12 text-primary/60">Loading loadouts...</div>
      </Show>

      {/* Empty State */}
      <Show when={!loading() && loadouts().length === 0}>
        <Card class="p-12 text-center">
          <div class="text-primary/40 mb-4">
            <svg
              class="w-16 h-16 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-primary mb-2">
            No loadouts yet
          </h2>
          <p class="text-primary/60 mb-6">
            Create your first hunting setup to track costs and optimize your
            gear
          </p>
          <Button onClick={handleCreate}>Create Your First Loadout</Button>
        </Card>
      </Show>

      {/* Loadouts Grid */}
      <Show when={!loading() && loadouts().length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={loadouts()}>
            {(loadout) => (
              <Card class="p-4 hover:border-primary/40 transition-colors">
                <div class="flex items-start justify-between mb-3">
                  <h3 class="text-lg font-semibold text-primary">
                    {loadout.name}
                  </h3>
                  <div class="flex gap-2">
                    <button
                      onClick={() => handleEdit(loadout)}
                      class="text-primary/60 hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(loadout)}
                      class="text-primary/60 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="space-y-2 text-sm">
                  <Show when={loadout.weapon}>
                    <div class="text-primary/80">
                      <span class="text-primary/60">Weapon:</span>{" "}
                      {loadout.weapon}
                    </div>
                  </Show>
                  <Show when={loadout.amp}>
                    <div class="text-primary/80">
                      <span class="text-primary/60">Amp:</span> {loadout.amp}
                    </div>
                  </Show>
                  <Show when={loadout.armorSet}>
                    <div class="text-primary/80">
                      <span class="text-primary/60">Armor:</span>{" "}
                      {loadout.armorSet}
                    </div>
                  </Show>

                  {/* Enhancer Slots Visual */}
                  <Show when={Object.keys(loadout.weaponEnhancers).length > 0}>
                    <div class="text-primary/60">
                      Weapon:{" "}
                      {renderEnhancerSlots(
                        Object.keys(loadout.weaponEnhancers).length
                      )}
                    </div>
                  </Show>
                  <Show when={Object.keys(loadout.armorEnhancers).length > 0}>
                    <div class="text-primary/60">
                      Armor:{" "}
                      {renderEnhancerSlots(
                        Object.keys(loadout.armorEnhancers).length
                      )}
                    </div>
                  </Show>
                </div>

                {/* Cost Display */}
                <div class="mt-4 pt-4 border-t border-primary/20">
                  <div class="text-2xl font-bold text-green-400">
                    {getCostDisplay(loadout)} PED
                  </div>
                  <div class="text-xs text-primary/60">per shot</div>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>

      {/* Modal */}
      <Show when={showModal()}>
        <LoadoutModal
          loadout={editingLoadout()}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      </Show>
    </div>
  );
}

// Helper: Render enhancer slots visual
function renderEnhancerSlots(count: number): string {
  const filled = "⬛".repeat(Math.min(count, 10));
  const empty = "⬜".repeat(Math.max(0, 10 - count));
  return `${filled}${empty}`;
}

// Helper: Get cost display (respects manual override)
function getCostDisplay(loadout: Loadout): string {
  if (!loadout.costs) return "0.00";

  if (loadout.useManualCost && loadout.costs.manualCostOverride !== undefined) {
    return loadout.costs.manualCostOverride.toFixed(2);
  }

  return loadout.costs.totalPerShot.toFixed(2);
}

/**
 * Loadouts Page
 * Manage hunting equipment configurations
 */

import { createSignal, onMount, For, Show } from "solid-js";
import { Trash2, Edit2, Plus, X } from "lucide-solid";
import type { Loadout } from "../../core/types/Loadout";
import { LoadoutService } from "../../core/services/LoadoutService";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { EquipmentSelector } from "../components/molecules/EquipmentSelector";
import { EnhancerMultiSelector } from "../components/molecules/EnhancerMultiSelector";
import { EquipmentType } from "../../core/services/EquipmentDataService";
import type { EquipmentSearchResult } from "../../core/services/EquipmentDataService";

export default function Loadouts() {
  const [loadouts, setLoadouts] = createSignal<Loadout[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editingLoadout, setEditingLoadout] = createSignal<Loadout | null>(
    null
  );
  const [newLoadoutName, setNewLoadoutName] = createSignal("");

  // Equipment selections for edit modal
  const [selectedWeapon, setSelectedWeapon] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedAmp, setSelectedAmp] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedAbsorber, setSelectedAbsorber] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedScope, setSelectedScope] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedSight, setSelectedSight] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedArmorSet, setSelectedArmorSet] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedArmorPlating, setSelectedArmorPlating] =
    createSignal<EquipmentSearchResult | null>(null);
  const [selectedWeaponEnhancers, setSelectedWeaponEnhancers] = createSignal<
    EquipmentSearchResult[]
  >([]);
  const [selectedArmorEnhancers, setSelectedArmorEnhancers] = createSignal<
    EquipmentSearchResult[]
  >([]);

  // Manual cost override
  const [useManualCost, setUseManualCost] = createSignal(false);
  const [manualCostValue, setManualCostValue] = createSignal<string>("");

  onMount(async () => {
    await loadLoadouts();
  });

  const loadLoadouts = async () => {
    if (!window.electron?.loadout) return;

    try {
      const data = await window.electron.loadout.findAll();
      setLoadouts(data);
    } catch (error) {
      console.error("Failed to load loadouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.electron?.loadout) return;
    if (!confirm("Delete this loadout?")) return;

    try {
      await window.electron.loadout.delete(id);
      await loadLoadouts();
    } catch (error) {
      console.error("Failed to delete loadout:", error);
      alert("Failed to delete loadout");
    }
  };

  const handleCreateNew = async () => {
    if (!window.electron?.loadout) return;

    const name = newLoadoutName().trim();
    if (!name) return;

    try {
      // Create a new empty loadout
      const newLoadout = LoadoutService.create("demo-user", name);
      await window.electron.loadout.save(newLoadout);
      await loadLoadouts();
      setShowCreateModal(false);
      setNewLoadoutName("");
    } catch (error) {
      console.error("Failed to create loadout:", error);
      alert("Failed to create loadout");
    }
  };

  const getCostDisplay = (loadout: Loadout): string => {
    if (!loadout.costs) return "Not calculated";

    // Use manual override if enabled
    if (
      loadout.useManualCost &&
      loadout.costs.manualCostOverride !== undefined
    ) {
      return `${loadout.costs.manualCostOverride.toFixed(5)} PED (manual)`;
    }

    return `${loadout.costs.totalPerShot.toFixed(5)} PED`;
  };

  const handleEdit = (loadout: Loadout) => {
    setEditingLoadout(loadout);

    // Clear previous selections
    setSelectedWeapon(null);
    setSelectedAmp(null);
    setSelectedAbsorber(null);
    setSelectedScope(null);
    setSelectedSight(null);
    setSelectedArmorSet(null);
    setSelectedArmorPlating(null);
    setSelectedWeaponEnhancers([]);
    setSelectedArmorEnhancers([]);

    // Load manual cost override if set
    setUseManualCost(loadout.useManualCost || false);
    setManualCostValue(loadout.costs?.manualCostOverride?.toFixed(5) || "");

    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!window.electron?.loadout || !editingLoadout()) return;

    try {
      let updatedLoadout = { ...editingLoadout()! };

      // Update equipment data from selections
      if (selectedWeapon()) {
        const weapon = selectedWeapon()!;
        updatedLoadout.weapon = weapon.name;
        updatedLoadout.weaponData = {
          Name: weapon.name,
          Properties: {
            Economy: weapon.economy
              ? {
                  Decay: weapon.economy.Decay || 0,
                  AmmoBurn: weapon.economy.AmmoBurn || 0,
                  Efficiency: weapon.economy.Efficiency ?? undefined,
                  MaxTT: weapon.economy.MaxTT ?? undefined,
                  MinTT: weapon.economy.MinTT ?? undefined,
                }
              : undefined,
            Damage: weapon.damage
              ? {
                  Stab: weapon.damage.Stab || 0,
                  Cut: weapon.damage.Cut || 0,
                  Impact: weapon.damage.Impact || 0,
                  Penetration: weapon.damage.Penetration || 0,
                  Shrapnel: weapon.damage.Shrapnel || 0,
                  Burn: weapon.damage.Burn || 0,
                  Cold: weapon.damage.Cold || 0,
                  Acid: weapon.damage.Acid || 0,
                  Electric: weapon.damage.Electric || 0,
                }
              : undefined,
            Category: weapon.category,
          },
        };
      }

      if (selectedAmp()) {
        const amp = selectedAmp()!;
        updatedLoadout.amp = amp.name;
        updatedLoadout.ampData = {
          Name: amp.name,
          Properties: {
            Economy: amp.economy
              ? {
                  Decay: amp.economy.Decay || 0,
                  AmmoBurn: amp.economy.AmmoBurn || 0,
                  Efficiency: amp.economy.Efficiency ?? undefined,
                  MaxTT: amp.economy.MaxTT ?? undefined,
                  MinTT: amp.economy.MinTT ?? undefined,
                }
              : undefined,
            Damage: amp.damage
              ? {
                  Stab: amp.damage.Stab || 0,
                  Cut: amp.damage.Cut || 0,
                  Impact: amp.damage.Impact || 0,
                  Penetration: amp.damage.Penetration || 0,
                  Shrapnel: amp.damage.Shrapnel || 0,
                  Burn: amp.damage.Burn || 0,
                  Cold: amp.damage.Cold || 0,
                  Acid: amp.damage.Acid || 0,
                  Electric: amp.damage.Electric || 0,
                }
              : undefined,
            Category: amp.category,
          },
        };
      }

      if (selectedAbsorber()) {
        const absorber = selectedAbsorber()!;
        updatedLoadout.absorber = absorber.name;
        updatedLoadout.absorberData = {
          Name: absorber.name,
          Properties: {
            Economy: absorber.economy
              ? {
                  Decay: absorber.economy.Decay || 0,
                  AmmoBurn: absorber.economy.AmmoBurn || 0,
                }
              : undefined,
          },
        };
      }

      if (selectedScope()) {
        const scope = selectedScope()!;
        updatedLoadout.scope = scope.name;
        updatedLoadout.scopeData = {
          Name: scope.name,
          Properties: {
            Economy: scope.economy
              ? {
                  Decay: scope.economy.Decay || 0,
                  AmmoBurn: scope.economy.AmmoBurn || 0,
                }
              : undefined,
          },
        };
      }

      if (selectedSight()) {
        const sight = selectedSight()!;
        updatedLoadout.sight = sight.name;
        updatedLoadout.sightData = {
          Name: sight.name,
          Properties: {
            Economy: sight.economy
              ? {
                  Decay: sight.economy.Decay || 0,
                  AmmoBurn: sight.economy.AmmoBurn || 0,
                }
              : undefined,
          },
        };
      }

      if (selectedArmorSet()) {
        const armorSet = selectedArmorSet()!;
        updatedLoadout.armorSet = armorSet.name;
        updatedLoadout.armorSetData = {
          Name: armorSet.name,
          Properties: {
            Economy: armorSet.economy
              ? {
                  Decay: armorSet.economy.Decay || 0,
                  AmmoBurn: armorSet.economy.AmmoBurn || 0,
                }
              : undefined,
          },
        };
      }

      if (selectedArmorPlating()) {
        const armorPlating = selectedArmorPlating()!;
        updatedLoadout.armorPlating = armorPlating.name;
        updatedLoadout.armorPlatingData = {
          Name: armorPlating.name,
          Properties: {
            Economy: armorPlating.economy
              ? {
                  Decay: armorPlating.economy.Decay || 0,
                  AmmoBurn: armorPlating.economy.AmmoBurn || 0,
                }
              : undefined,
          },
        };
      }

      // Update enhancers
      if (selectedWeaponEnhancers().length > 0) {
        updatedLoadout.weaponEnhancers = {};
        selectedWeaponEnhancers().forEach((enhancer, index) => {
          updatedLoadout.weaponEnhancers![`slot${index + 1}`] = {
            Name: enhancer.name,
            Properties: {
              Economy: {
                Decay: enhancer.economy?.Decay || 0,
                AmmoBurn: enhancer.economy?.AmmoBurn || 0,
              },
            },
          };
        });
      } else {
        updatedLoadout.weaponEnhancers = {};
      }

      if (selectedArmorEnhancers().length > 0) {
        updatedLoadout.armorEnhancers = {};
        selectedArmorEnhancers().forEach((enhancer, index) => {
          updatedLoadout.armorEnhancers![`slot${index + 1}`] = {
            Name: enhancer.name,
            Properties: {
              Economy: {
                Decay: enhancer.economy?.Decay || 0,
                AmmoBurn: enhancer.economy?.AmmoBurn || 0,
              },
            },
          };
        });
      } else {
        updatedLoadout.armorEnhancers = {};
      }

      // Recalculate costs
      updatedLoadout = LoadoutService.updateCosts(updatedLoadout);

      // Apply manual cost override if enabled (create new object to avoid immutability issues)
      let finalCosts = { ...updatedLoadout.costs! };

      if (useManualCost() && manualCostValue().trim()) {
        const manualCost = parseFloat(manualCostValue());
        if (!isNaN(manualCost) && manualCost >= 0) {
          finalCosts.manualCostOverride = manualCost;
        }
      } else {
        // Clear manual override if disabled or empty
        finalCosts.manualCostOverride = undefined;
      }

      const finalLoadout = {
        ...updatedLoadout,
        useManualCost: useManualCost(),
        costs: finalCosts,
      };

      console.log("[Loadouts] Saving loadout:", {
        name: finalLoadout.name,
        useManualCost: finalLoadout.useManualCost,
        manualCostOverride: finalLoadout.costs?.manualCostOverride,
        calculatedCost: finalLoadout.costs?.totalPerShot,
      });

      // Save to database
      await window.electron.loadout.save(finalLoadout);
      await loadLoadouts();

      // Close modal
      setShowEditModal(false);
      setEditingLoadout(null);
    } catch (error) {
      console.error("Failed to update loadout:", error);
      alert("Failed to update loadout");
    }
  };

  return (
    <div class="p-8 max-w-7xl mx-auto">
      {/* Edit Loadout Modal */}
      <Show when={showEditModal() && editingLoadout()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
          onClick={() => setShowEditModal(false)}
        >
          <Card
            class="w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-bold">
                Edit Loadout: {editingLoadout()!.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                class="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div class="space-y-6">
              {/* Weapon Section */}
              <div class="space-y-4">
                <h4 class="text-md font-semibold text-gray-700 border-b pb-2">
                  Weapon & Attachments
                </h4>

                <EquipmentSelector
                  type={EquipmentType.WEAPON}
                  label="Weapon"
                  selectedEquipment={selectedWeapon()}
                  onSelect={setSelectedWeapon}
                  placeholder="Search weapons (e.g., Opalo, ArMatrix)"
                />

                <EquipmentSelector
                  type={EquipmentType.AMP}
                  label="Amplifier"
                  selectedEquipment={selectedAmp()}
                  onSelect={setSelectedAmp}
                  placeholder="Search amps (e.g., L23B, Adjusted)"
                />

                <EquipmentSelector
                  type={EquipmentType.ABSORBER}
                  label="Absorber (FAP/Tool)"
                  selectedEquipment={selectedAbsorber()}
                  onSelect={setSelectedAbsorber}
                  placeholder="Search absorbers (optional)"
                />

                <EquipmentSelector
                  type={EquipmentType.SCOPE}
                  label="Scope"
                  selectedEquipment={selectedScope()}
                  onSelect={setSelectedScope}
                  placeholder="Search scopes (optional)"
                />

                <EquipmentSelector
                  type={EquipmentType.SIGHT}
                  label="Sight (regular sight / scope attachment)"
                  selectedEquipment={selectedSight()}
                  onSelect={setSelectedSight}
                  placeholder="Search sights (optional)"
                />
              </div>

              {/* Armor Section */}
              <div class="space-y-4 border-t border-gray-200 pt-4 mt-4">
                <h4 class="text-md font-semibold text-gray-700 border-b pb-2">
                  Armor & Protection
                </h4>

                <EquipmentSelector
                  type={EquipmentType.ARMOR_SET}
                  label="Armor Set"
                  selectedEquipment={selectedArmorSet()}
                  onSelect={setSelectedArmorSet}
                  placeholder="Search armor sets (e.g., Ghost, Vanguard)"
                />

                <EquipmentSelector
                  type={EquipmentType.ARMOR_PLATING}
                  label="Armor Plating"
                  selectedEquipment={selectedArmorPlating()}
                  onSelect={setSelectedArmorPlating}
                  placeholder="Search armor platings (optional)"
                />
              </div>

              {/* Enhancer Selectors */}
              <div class="border-t border-gray-200 pt-4 mt-4">
                <h4 class="text-md font-semibold text-gray-700 mb-4 border-b pb-2">
                  Enhancers (Up to 10 slots each)
                </h4>

                <div class="space-y-4">
                  <EnhancerMultiSelector
                    type={EquipmentType.WEAPON_ENHANCER}
                    label="Weapon Enhancers"
                    selectedEnhancers={selectedWeaponEnhancers()}
                    onSelect={setSelectedWeaponEnhancers}
                    maxSlots={10}
                    placeholder="Search weapon enhancers (e.g., damage, accuracy)"
                  />

                  <EnhancerMultiSelector
                    type={EquipmentType.ARMOR_ENHANCER}
                    label="Armor Enhancers"
                    selectedEnhancers={selectedArmorEnhancers()}
                    onSelect={setSelectedArmorEnhancers}
                    maxSlots={10}
                    placeholder="Search armor enhancers (e.g., protection, durability)"
                  />
                </div>
              </div>

              {/* Cost Preview */}
              <Show
                when={
                  selectedWeapon() ||
                  selectedAmp() ||
                  selectedWeaponEnhancers().length > 0 ||
                  selectedArmorEnhancers().length > 0
                }
              >
                <Card class="p-4 bg-blue-50 border-blue-200">
                  <div class="text-sm font-medium text-blue-900 mb-2">
                    Cost Preview
                  </div>
                  <div class="space-y-1 text-sm text-blue-800">
                    <Show when={selectedWeapon()}>
                      <div>
                        Weapon:{" "}
                        {(
                          (selectedWeapon()!.economy?.Decay || 0) / 100 +
                          (selectedWeapon()!.economy?.AmmoBurn || 0) / 10000
                        ).toFixed(4)}{" "}
                        PED
                      </div>
                    </Show>
                    <Show when={selectedAmp()}>
                      <div>
                        Amp:{" "}
                        {(
                          (selectedAmp()!.economy?.Decay || 0) / 100 +
                          (selectedAmp()!.economy?.AmmoBurn || 0) / 10000
                        ).toFixed(4)}{" "}
                        PED
                      </div>
                    </Show>
                    <Show when={selectedScope()}>
                      <div>
                        Scope:{" "}
                        {(
                          (selectedScope()!.economy?.Decay || 0) / 100 +
                          (selectedScope()!.economy?.AmmoBurn || 0) / 10000
                        ).toFixed(4)}{" "}
                        PED
                      </div>
                    </Show>
                    <Show when={selectedSight()}>
                      <div>
                        Sight:{" "}
                        {(
                          (selectedSight()!.economy?.Decay || 0) / 100 +
                          (selectedSight()!.economy?.AmmoBurn || 0) / 10000
                        ).toFixed(4)}{" "}
                        PED
                      </div>
                    </Show>
                    <Show when={selectedWeaponEnhancers().length > 0}>
                      <div>
                        Weapon Enhancers:{" "}
                        {selectedWeaponEnhancers()
                          .reduce(
                            (sum, e) =>
                              sum +
                              (e.economy?.Decay || 0) / 100 +
                              (e.economy?.AmmoBurn || 0) / 10000,
                            0
                          )
                          .toFixed(4)}{" "}
                        PED ({selectedWeaponEnhancers().length})
                      </div>
                    </Show>
                    <Show when={selectedArmorEnhancers().length > 0}>
                      <div>
                        Armor Enhancers:{" "}
                        {selectedArmorEnhancers()
                          .reduce(
                            (sum, e) =>
                              sum +
                              (e.economy?.Decay || 0) / 100 +
                              (e.economy?.AmmoBurn || 0) / 10000,
                            0
                          )
                          .toFixed(4)}{" "}
                        PED ({selectedArmorEnhancers().length})
                      </div>
                    </Show>
                    <div class="pt-2 border-t border-blue-300 font-bold">
                      Total:{" "}
                      {(
                        (selectedWeapon()?.economy?.Decay || 0) / 100 +
                        (selectedWeapon()?.economy?.AmmoBurn || 0) / 10000 +
                        ((selectedAmp()?.economy?.Decay || 0) / 100 +
                          (selectedAmp()?.economy?.AmmoBurn || 0) / 10000) +
                        ((selectedScope()?.economy?.Decay || 0) / 100 +
                          (selectedScope()?.economy?.AmmoBurn || 0) / 10000) +
                        ((selectedSight()?.economy?.Decay || 0) / 100 +
                          (selectedSight()?.economy?.AmmoBurn || 0) / 10000) +
                        selectedWeaponEnhancers().reduce(
                          (sum, e) =>
                            sum +
                            (e.economy?.Decay || 0) / 100 +
                            (e.economy?.AmmoBurn || 0) / 10000,
                          0
                        ) +
                        selectedArmorEnhancers().reduce(
                          (sum, e) =>
                            sum +
                            (e.economy?.Decay || 0) / 100 +
                            (e.economy?.AmmoBurn || 0) / 10000,
                          0
                        )
                      ).toFixed(4)}{" "}
                      PED/shot
                    </div>
                  </div>
                </Card>
              </Show>

              {/* Manual Cost Override */}
              <div class="border-t border-gray-200 pt-4 mt-4">
                <div class="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="use-manual-cost"
                    checked={useManualCost()}
                    onChange={(e) => setUseManualCost(e.target.checked)}
                    class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label
                    for="use-manual-cost"
                    class="text-sm font-medium text-gray-700 cursor-pointer"
                  >
                    Use Manual Cost Override
                  </label>
                </div>

                <Show when={useManualCost()}>
                  <div class="ml-7">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Cost Per Shot (PED)
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="0"
                      placeholder="0.00000"
                      value={manualCostValue()}
                      onInput={(e) => setManualCostValue(e.target.value)}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                    <p class="mt-1 text-xs text-gray-500">
                      Manual override will be used instead of calculated cost
                      when enabled
                    </p>
                  </div>
                </Show>
              </div>

              <div class="flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  variant="primary"
                  class="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="secondary"
                  class="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Show>

      {/* Create Loadout Modal */}
      <Show when={showCreateModal()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <Card
            class="w-full max-w-md p-6"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-bold">Create New Loadout</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                class="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Loadout Name
                </label>
                <input
                  type="text"
                  value={newLoadoutName()}
                  onInput={(e) => setNewLoadoutName(e.currentTarget.value)}
                  placeholder="e.g., Opalo + L23B"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleCreateNew();
                  }}
                  autofocus
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                />
              </div>
              <div class="flex gap-2">
                <Button
                  onClick={handleCreateNew}
                  variant="primary"
                  class="flex-1"
                  disabled={!newLoadoutName().trim()}
                >
                  Create
                </Button>
                <Button
                  onClick={() => setShowCreateModal(false)}
                  variant="secondary"
                  class="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Show>

      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-primary tracking-tight">
            Loadouts
          </h1>
          <p class="text-primary/60 mt-1">
            Manage your hunting equipment configurations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={20} class="mr-2" />
          Create Loadout
        </Button>
      </div>

      <Show when={loading()}>
        <Card class="p-8 text-center text-gray-500">Loading loadouts...</Card>
      </Show>

      <Show when={!loading() && loadouts().length === 0}>
        <Card class="p-12 text-center">
          <div class="max-w-md mx-auto">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">
              No Loadouts Yet
            </h3>
            <p class="text-gray-600 mb-6">
              Create your first loadout to track equipment costs and
              performance.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={20} class="mr-2" />
              Create Your First Loadout
            </Button>
          </div>
        </Card>
      </Show>

      <Show when={!loading() && loadouts().length > 0}>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <For each={loadouts()}>
            {(loadout) => (
              <Card class="hover:border-primary/40 transition-all duration-300">
                <div class="space-y-4">
                  {/* Header */}
                  <div class="flex items-start justify-between">
                    <h3 class="text-xl font-bold text-primary">
                      {loadout.name}
                    </h3>
                    <div class="flex gap-2">
                      <button
                        onClick={() => handleEdit(loadout)}
                        class="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(loadout.id)}
                        class="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Equipment Details */}
                  <div class="space-y-2 text-sm">
                    <Show when={loadout.weapon}>
                      <div class="flex justify-between items-start p-2 bg-background-lighter rounded-lg">
                        <span class="text-primary/60">Weapon</span>
                        <span class="font-medium text-white text-right ml-2">
                          {loadout.weapon}
                        </span>
                      </div>
                    </Show>
                    <Show when={loadout.amp}>
                      <div class="flex justify-between items-start p-2 bg-background-lighter rounded-lg">
                        <span class="text-primary/60">Amp</span>
                        <span class="font-medium text-white text-right ml-2">
                          {loadout.amp}
                        </span>
                      </div>
                    </Show>
                    <Show when={loadout.armorSet}>
                      <div class="flex justify-between items-start p-2 bg-background-lighter rounded-lg">
                        <span class="text-primary/60">Armor</span>
                        <span class="font-medium text-white text-right ml-2">
                          {loadout.armorSet}
                        </span>
                      </div>
                    </Show>

                    <Show
                      when={Object.keys(loadout.weaponEnhancers).length > 0}
                    >
                      <div class="p-2 bg-background-lighter rounded-lg text-primary/80">
                        {Object.keys(loadout.weaponEnhancers).length}x Weapon
                        Enhancers
                      </div>
                    </Show>
                  </div>

                  {/* Cost Statistics */}
                  <div class="pt-3 border-t border-primary/10 space-y-3">
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-primary/60 uppercase tracking-wide">
                        Cost per shot
                      </span>
                      <span class="text-xl font-bold text-primary font-mono">
                        {getCostDisplay(loadout)}
                      </span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-primary/60 uppercase tracking-wide">
                        Total Cycled
                      </span>
                      <span class="text-lg font-bold text-success font-mono">
                        {(loadout.totalPEDCycled || 0).toFixed(2)} PED
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <Show when={loadout.tags && loadout.tags.length > 0}>
                    <div class="flex flex-wrap gap-2">
                      <For each={loadout.tags}>
                        {(tag) => (
                          <span class="px-2 py-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded">
                            {tag}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * LoadoutModal Component
 * Create or edit hunting loadout configurations
 */

import {
  createSignal,
  onMount,
  Show,
  createMemo,
  createResource,
} from "solid-js";
import { X } from "lucide-solid";
import type { Loadout } from "../../../core/types/Loadout";
import { LoadoutService } from "../../../core/services/LoadoutService";
import { EquipmentType } from "../../../core/services/EquipmentDataService";
import { Button } from "../atoms/Button";
import { Card } from "../atoms/Card";
import { CostBreakdown } from "../molecules/CostBreakdown";
import { AutocompleteInput } from "../molecules/AutocompleteInput";
import { WeaponStats } from "../molecules/WeaponStats";

interface LoadoutModalProps {
  loadout: Loadout | null; // null = create new, otherwise edit
  onSave: (loadout: Loadout) => void;
  onClose: () => void;
}

export function LoadoutModal(props: LoadoutModalProps) {
  // Form state - simple text inputs
  const [name, setName] = createSignal("");
  const [weapon, setWeapon] = createSignal("");
  const [amp, setAmp] = createSignal("");
  const [absorber, setAbsorber] = createSignal("");
  const [armorSet, setArmorSet] = createSignal("");
  const [armorPlating, setArmorPlating] = createSignal("");
  const [scope, setScope] = createSignal("");
  const [sight, setSight] = createSignal("");
  const [weaponEnhancerTiers, setWeaponEnhancerTiers] = createSignal<boolean[]>(
    Array(10).fill(false)
  );
  const [armorEnhancerTiers, setArmorEnhancerTiers] = createSignal<boolean[]>(
    Array(10).fill(false)
  );
  const [useManualCost, setUseManualCost] = createSignal(false);
  const [manualCost, setManualCost] = createSignal(0);

  // Equipment suggestions
  const [weaponSuggestions, setWeaponSuggestions] = createSignal<string[]>([]);
  const [ampSuggestions, setAmpSuggestions] = createSignal<string[]>([]);
  const [absorberSuggestions, setAbsorberSuggestions] = createSignal<string[]>(
    []
  );
  const [scopeSuggestions, setScopeSuggestions] = createSignal<string[]>([]);
  const [sightSuggestions, setSightSuggestions] = createSignal<string[]>([]);
  const [armorSetSuggestions, setArmorSetSuggestions] = createSignal<string[]>(
    []
  );
  const [armorPlatingSuggestions, setArmorPlatingSuggestions] = createSignal<
    string[]
  >([]);

  // Load equipment suggestions
  onMount(async () => {
    console.log("[LoadoutModal] Loading equipment suggestions...");

    try {
      // Load equipment data from window.electron if available
      if (window.electron?.equipment) {
        console.log("[LoadoutModal] window.electron.equipment is available");

        const [
          weapons,
          amps,
          absorbers,
          scopes,
          sights,
          armorSets,
          armorPlating,
        ] = await Promise.all([
          window.electron.equipment.getAllByType(EquipmentType.WEAPON),
          window.electron.equipment.getAllByType(EquipmentType.AMP),
          window.electron.equipment.getAllByType(EquipmentType.ABSORBER),
          window.electron.equipment.getAllByType(EquipmentType.SCOPE),
          window.electron.equipment.getAllByType(EquipmentType.SIGHT),
          window.electron.equipment.getAllByType(EquipmentType.ARMOR_SET),
          window.electron.equipment.getAllByType(EquipmentType.ARMOR_PLATING),
        ]);

        console.log("[LoadoutModal] Equipment loaded:", {
          weapons: weapons.length,
          amps: amps.length,
          absorbers: absorbers.length,
          scopes: scopes.length,
          sights: sights.length,
          armorSets: armorSets.length,
          armorPlating: armorPlating.length,
        });

        setWeaponSuggestions(weapons.map((w: any) => w.name));
        setAmpSuggestions(amps.map((a: any) => a.name));
        setAbsorberSuggestions(absorbers.map((a: any) => a.name));
        setScopeSuggestions(scopes.map((s: any) => s.name));
        setSightSuggestions(sights.map((s: any) => s.name));
        setArmorSetSuggestions(armorSets.map((a: any) => a.name));
        setArmorPlatingSuggestions(armorPlating.map((a: any) => a.name));
      } else {
        console.log(
          "[LoadoutModal] window.electron.equipment not available, using fallback data"
        );

        // Fallback static suggestions if no database available
        setWeaponSuggestions([
          "Opalo (L)",
          "Herman LAW-202 (L)",
          "Herman ARK-0 (L)",
          "Castorian EnBlade-6 Combat (L)",
          "S.I. HK110 (L)",
        ]);
        setAmpSuggestions([
          "A-105 (L)",
          "A-106 (L)",
          "Omegaton A101 (L)",
          "Omegaton A102 (L)",
          "Omegaton A103 (L)",
        ]);
        setAbsorberSuggestions([
          "Vivo S10 (L)",
          "Vivo S20 (L)",
          "Vivo T10 (L)",
          "Vivo T20 (L)",
          "Genesis Star S (L)",
        ]);
        setScopeSuggestions([
          "EWE S40X",
          "Breer S1X (L)",
          "Breer S2X (L)",
          "UrbanEye S40",
          "Wilco S40X",
        ]);
        setSightSuggestions([
          "EWE XT300",
          "Breer XT100 (L)",
          "Breer XT200 (L)",
          "UrbanEye XT300",
          "Wilco XT300",
        ]);
        setArmorSetSuggestions([
          "Gremlin",
          "Pixie",
          "Goblin",
          "Ghost",
          "Wraith",
        ]);
        setArmorPlatingSuggestions(["5A", "5B", "6A", "6B", "7A", "7B"]);
      }

      console.log("[LoadoutModal] All suggestions set");
    } catch (error) {
      console.error("Failed to load equipment suggestions:", error);

      // Set fallback data on error
      setWeaponSuggestions(["Opalo (L)", "Herman LAW-202 (L)"]);
      setAmpSuggestions(["A-105 (L)", "A-106 (L)"]);
      setAbsorberSuggestions(["Vivo S10 (L)", "Vivo S20 (L)"]);
      setScopeSuggestions(["EWE S40X", "Breer S1X (L)"]);
      setSightSuggestions(["EWE XT300", "Breer XT100 (L)"]);
      setArmorSetSuggestions(["Gremlin", "Pixie"]);
      setArmorPlatingSuggestions(["5A", "5B", "6A", "6B"]);
    }

    // Populate form if editing existing loadout
    if (props.loadout) {
      setName(props.loadout.name);
      setWeapon(props.loadout.weapon || "");
      setAmp(props.loadout.amp || "");
      setAbsorber(props.loadout.absorber || "");
      setArmorSet(props.loadout.armorSet || "");
      setArmorPlating(props.loadout.armorPlating || "");
      setScope(props.loadout.scope || "");
      setSight(props.loadout.sight || "");

      // Convert enhancers to tier checkboxes
      const weaponTiers = Array(10).fill(false);
      const armorTiers = Array(10).fill(false);
      Object.keys(props.loadout.weaponEnhancers || {}).forEach((_, i) => {
        if (i < 10) weaponTiers[i] = true;
      });
      Object.keys(props.loadout.armorEnhancers || {}).forEach((_, i) => {
        if (i < 10) armorTiers[i] = true;
      });
      setWeaponEnhancerTiers(weaponTiers);
      setArmorEnhancerTiers(armorTiers);

      setUseManualCost(props.loadout.useManualCost);
      setManualCost(props.loadout.costs?.manualCostOverride || 0);
    }
  });

  // Fetch equipment data for cost calculation
  const [equipmentData] = createResource(
    () => ({
      weapon: weapon().trim(),
      amp: amp().trim(),
      absorber: absorber().trim(),
      scope: scope().trim(),
      sight: sight().trim(),
    }),
    async (names) => {
      if (!window.electron?.equipment) return null;

      try {
        const [weaponData, ampData, absorberData, scopeData, sightData] =
          await Promise.all([
            names.weapon
              ? window.electron.equipment.getByName(
                  names.weapon,
                  EquipmentType.WEAPON
                )
              : null,
            names.amp
              ? window.electron.equipment.getByName(
                  names.amp,
                  EquipmentType.AMP
                )
              : null,
            names.absorber
              ? window.electron.equipment.getByName(
                  names.absorber,
                  EquipmentType.ABSORBER
                )
              : null,
            names.scope
              ? window.electron.equipment.getByName(
                  names.scope,
                  EquipmentType.SCOPE
                )
              : null,
            names.sight
              ? window.electron.equipment.getByName(
                  names.sight,
                  EquipmentType.SIGHT
                )
              : null,
          ]);

        return {
          weaponData: weaponData
            ? {
                name: weaponData.name,
                economy: weaponData.economy,
                damage: weaponData.damage,
              }
            : null,
          ampData: ampData
            ? {
                name: ampData.name,
                economy: ampData.economy,
                damage: ampData.damage,
              }
            : null,
          absorberData,
          scopeData,
          sightData,
        };
      } catch (error) {
        console.error("[LoadoutModal] Failed to fetch equipment data:", error);
        return null;
      }
    }
  );

  // Real-time cost calculation
  const calculatedCosts = createMemo(() => {
    // Convert tier checkboxes to EnhancerData format
    const weaponEnhancers: Record<string, any> = {};
    weaponEnhancerTiers().forEach((checked, i) => {
      if (checked) {
        weaponEnhancers[`T${i + 1}`] = {
          Name: `Weapon Damage Enhancer ${i + 1}`,
          Properties: {
            Economy: { Decay: 0, AmmoBurn: 103 },
          },
        };
      }
    });

    const armorEnhancers: Record<string, any> = {};
    armorEnhancerTiers().forEach((checked, i) => {
      if (checked) {
        armorEnhancers[`T${i + 1}`] = {
          Name: `Armor Defense Enhancer ${i + 1}`,
          Properties: {
            Economy: { Decay: 0, AmmoBurn: 0 },
          },
        };
      }
    });

    const loadout: Partial<Loadout> = {
      weapon: weapon().trim() || undefined,
      amp: amp().trim() || undefined,
      absorber: absorber().trim() || undefined,
      scope: scope().trim() || undefined,
      sight: sight().trim() || undefined,
      armorSet: armorSet().trim() || undefined,
      armorPlating: armorPlating().trim() || undefined,
      weaponEnhancers,
      armorEnhancers,
      costs: {
        weaponCost: 0,
        ampCost: 0,
        absorberCost: 0,
        scopeCost: 0,
        sightCost: 0,
        weaponEnhancersCost: 0,
        armorEnhancersCost: 0,
        totalPerShot: 0,
        armorDecayMultiplier: 0.0009,
        manualCostOverride: manualCost(),
      },
    };

    // Attach equipment data if available
    const data = equipmentData();
    if (data) {
      // Convert EquipmentSearchResult to EquipmentData format
      if (data.weaponData?.economy) {
        loadout.weaponData = {
          Name: data.weaponData.name,
          Properties: {
            Economy: data.weaponData.economy,
          },
        };
      }
      if (data.ampData?.economy) {
        loadout.ampData = {
          Name: data.ampData.name,
          Properties: {
            Economy: data.ampData.economy,
          },
        };
      }
      if (data.absorberData?.economy) {
        loadout.absorberData = {
          Name: data.absorberData.name,
          Properties: {
            Economy: data.absorberData.economy,
          },
        };
      }
      if (data.scopeData?.economy) {
        loadout.scopeData = {
          Name: data.scopeData.name,
          Properties: {
            Economy: data.scopeData.economy,
          },
        };
      }
      if (data.sightData?.economy) {
        loadout.sightData = {
          Name: data.sightData.name,
          Properties: {
            Economy: data.sightData.economy,
          },
        };
      }
    }

    return LoadoutService.calculateCosts(loadout as Loadout);
  });

  // Validation
  const isValid = () => {
    return name().trim().length > 0 && weapon().trim().length > 0;
  };

  // Save handler
  const handleSave = () => {
    if (!isValid()) {
      alert("Please enter a name and select at least a weapon");
      return;
    }

    const costs = calculatedCosts();
    costs.manualCostOverride = manualCost();

    // Convert tier checkboxes to EnhancerData format
    const weaponEnhancers: Record<string, any> = {};
    weaponEnhancerTiers().forEach((checked, i) => {
      if (checked) {
        weaponEnhancers[`T${i + 1}`] = {
          Name: `Weapon Damage Enhancer ${i + 1}`,
          Properties: {
            Economy: { Decay: 0, AmmoBurn: 103 },
          },
        };
      }
    });

    const armorEnhancers: Record<string, any> = {};
    armorEnhancerTiers().forEach((checked, i) => {
      if (checked) {
        armorEnhancers[`T${i + 1}`] = {
          Name: `Armor Defense Enhancer ${i + 1}`,
          Properties: {
            Economy: { Decay: 0, AmmoBurn: 0 },
          },
        };
      }
    });

    const loadout: Loadout = {
      id: props.loadout?.id || crypto.randomUUID(),
      name: name().trim(),
      userId: "demo-user", // TODO: Get from current user
      weapon: weapon().trim() || undefined,
      amp: amp().trim() || undefined,
      absorber: absorber().trim() || undefined,
      armorSet: armorSet().trim() || undefined,
      armorPlating: armorPlating().trim() || undefined,
      scope: scope().trim() || undefined,
      sight: sight().trim() || undefined,
      weaponEnhancers: weaponEnhancers,
      armorEnhancers: armorEnhancers,
      costs,
      useManualCost: useManualCost(),
      timestamp: props.loadout?.timestamp || Date.now(),
      totalPEDCycled: props.loadout?.totalPEDCycled || 0,
      version: "2.0",
      tags: props.loadout?.tags || [],
      notes: props.loadout?.notes,
    };

    props.onSave(loadout);
  };

  // Handle Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
    >
      <Card class="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          {/* Header */}
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-orange-400">
              {props.loadout ? "Edit Loadout" : "Create New Loadout"}
            </h2>
            <button
              onClick={props.onClose}
              class="text-primary/60 hover:text-primary transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div class="space-y-6">
            {/* Loadout Name */}
            <div>
              <label class="block text-sm font-medium text-primary/80 mb-2">
                Loadout Name *
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="e.g., Opalo Hunting Build"
                class="w-full px-4 py-2 bg-background border border-primary/20 rounded text-primary placeholder-primary/40 focus:outline-none focus:border-blue-400"
                autocomplete="off"
              />
            </div>

            {/* Weapon Container */}
            <div class="border border-orange-500/30 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-orange-400 mb-4">
                Weapon Setup
              </h3>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weapon Equipment */}
                <div class="space-y-4">
                  {/* Weapon */}
                  <AutocompleteInput
                    label="Weapon"
                    value={weapon()}
                    onInput={setWeapon}
                    placeholder="e.g., Opalo (L)"
                    suggestions={weaponSuggestions()}
                    required
                  />

                  {/* Amp */}
                  <AutocompleteInput
                    label="Amp"
                    value={amp()}
                    onInput={setAmp}
                    placeholder="e.g., A-105 (L)"
                    suggestions={ampSuggestions()}
                  />

                  {/* Absorber */}
                  <AutocompleteInput
                    label="Absorber"
                    value={absorber()}
                    onInput={setAbsorber}
                    placeholder="e.g., Vivo S10 (L)"
                    suggestions={absorberSuggestions()}
                  />

                  {/* Scope */}
                  <AutocompleteInput
                    label="Scope"
                    value={scope()}
                    onInput={setScope}
                    placeholder="e.g., EWE S40X"
                    suggestions={scopeSuggestions()}
                  />

                  {/* Sight */}
                  <AutocompleteInput
                    label="Sight"
                    value={sight()}
                    onInput={setSight}
                    placeholder="e.g., EWE XT300"
                    suggestions={sightSuggestions()}
                  />
                </div>

                {/* Weapon Damage Enhancers - Tier Checkboxes */}
                <div>
                  <label class="block text-sm font-medium text-primary/80 mb-3">
                    Weapon Damage Enhancers
                  </label>
                  <div class="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <label class="relative flex items-center justify-center h-9 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={weaponEnhancerTiers()[i]}
                          onChange={(e) => {
                            const newTiers = [...weaponEnhancerTiers()];
                            newTiers[i] = e.currentTarget.checked;
                            setWeaponEnhancerTiers(newTiers);
                          }}
                          class="sr-only peer"
                        />
                        <span class="absolute inset-0 border border-primary/20 rounded bg-background peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors" />
                        <span class="relative z-10 text-sm font-medium text-primary/80 peer-checked:text-white">
                          T{i + 1}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weapon Stats */}
              <div class="col-span-1 lg:col-span-2">
                <WeaponStats
                  weaponData={equipmentData()?.weaponData}
                  ampData={equipmentData()?.ampData}
                  enhancerCount={weaponEnhancerTiers().filter(Boolean).length}
                />
              </div>
            </div>

            {/* Armor Container */}
            <div class="border border-orange-500/30 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-orange-400 mb-4">
                Armor Setup
              </h3>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Armor Equipment */}
                <div class="space-y-4">
                  {/* Armor Set */}
                  <AutocompleteInput
                    label="Armor Set"
                    value={armorSet()}
                    onInput={setArmorSet}
                    placeholder="e.g., Gremlin"
                    suggestions={armorSetSuggestions()}
                  />

                  {/* Armor Plating */}
                  <AutocompleteInput
                    label="Armor Plating"
                    value={armorPlating()}
                    onInput={setArmorPlating}
                    placeholder="e.g., 5B"
                    suggestions={armorPlatingSuggestions()}
                  />
                </div>

                {/* Armor Damage Reduction Enhancers - Tier Checkboxes */}
                <div>
                  <label class="block text-sm font-medium text-primary/80 mb-3">
                    Armor Defense Enhancers
                  </label>
                  <div class="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <label class="relative flex items-center justify-center h-9 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={armorEnhancerTiers()[i]}
                          onChange={(e) => {
                            const newTiers = [...armorEnhancerTiers()];
                            newTiers[i] = e.currentTarget.checked;
                            setArmorEnhancerTiers(newTiers);
                          }}
                          class="sr-only peer"
                        />
                        <span class="absolute inset-0 border border-primary/20 rounded bg-background peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors" />
                        <span class="relative z-10 text-sm font-medium text-primary/80 peer-checked:text-white">
                          T{i + 1}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Per Shot Display */}
            <div class="text-center">
              <div class="text-sm text-primary/60 mb-1">Cost Per Shot</div>
              <div class="text-3xl font-bold text-green-400">
                {useManualCost()
                  ? manualCost().toFixed(5)
                  : calculatedCosts().totalPerShot.toFixed(5)}{" "}
                PED
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class="flex gap-3 mt-6 pt-6 border-t border-primary/20">
            <Button onClick={props.onClose} variant="secondary" class="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid()} class="flex-1">
              {props.loadout ? "Update Loadout" : "Create Loadout"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

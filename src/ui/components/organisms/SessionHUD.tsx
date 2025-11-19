import { Component, createSignal, Show } from "solid-js";
import { Session, Loadout } from "@core/types";
import {
  Activity,
  Target,
  DollarSign,
  Crosshair,
  Clock,
  X,
  Minimize2,
  ChevronDown,
} from "lucide-solid";

interface SessionHUDProps {
  session: Session;
  loadout?: Loadout;
  onClose: () => void;
  onMinimize: () => void;
}

export const SessionHUD: Component<SessionHUDProps> = (props) => {
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<
    "stats" | "economy" | "loadout"
  >("stats");

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div class="fixed top-4 right-4 select-none">
      <Show
        when={!isMinimized()}
        fallback={
          <button
            onClick={() => setIsMinimized(false)}
            class="bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-lg px-4 py-2 flex items-center gap-2 hover:border-orange-500/50 transition-colors"
          >
            <Activity size={16} class="text-orange-500 animate-pulse" />
            <span class="text-white text-sm font-medium">Session Active</span>
            <ChevronDown size={14} class="text-gray-400" />
          </button>
        }
      >
        <div class="bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-lg overflow-hidden w-96 shadow-2xl">
          {/* Header */}
          <div class="bg-gradient-to-r from-[#1a1a1a] to-[#0a0a0a] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Activity size={16} class="text-orange-500 animate-pulse" />
              <span class="text-white text-sm font-bold uppercase tracking-wider">
                Session Tracker
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                class="p-1.5 hover:bg-white/5 rounded transition-colors"
                title="Minimize"
              >
                <Minimize2 size={14} class="text-gray-400" />
              </button>
              <button
                onClick={props.onClose}
                class="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                title="Close"
              >
                <X size={14} class="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div class="bg-[#0f0f0f] border-b border-[#2a2a2a] px-2 py-2 flex gap-1">
            <button
              onClick={() => setActiveTab("stats")}
              class={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
                activeTab() === "stats"
                  ? "bg-orange-500/20 border border-orange-500/50 text-orange-500"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Target size={14} />
              <span class="text-xs font-medium uppercase">Combat</span>
            </button>
            <button
              onClick={() => setActiveTab("economy")}
              class={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
                activeTab() === "economy"
                  ? "bg-orange-500/20 border border-orange-500/50 text-orange-500"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <DollarSign size={14} />
              <span class="text-xs font-medium uppercase">Economy</span>
            </button>
            <button
              onClick={() => setActiveTab("loadout")}
              class={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
                activeTab() === "loadout"
                  ? "bg-orange-500/20 border border-orange-500/50 text-orange-500"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Crosshair size={14} />
              <span class="text-xs font-medium uppercase">Loadout</span>
            </button>
          </div>

          {/* Content Area */}
          <div class="p-4 bg-[#0a0a0a]">
            <Show when={activeTab() === "stats"}>
              <div class="space-y-4">
                {/* Combat Stats Grid */}
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">
                      Shots
                    </div>
                    <div class="text-white text-xl font-bold tabular-nums">
                      {props.session.stats.totalShots}
                    </div>
                  </div>
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">Hits</div>
                    <div class="text-white text-xl font-bold tabular-nums">
                      {props.session.stats.totalHits}
                    </div>
                  </div>
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">
                      Accuracy
                    </div>
                    <div class="text-orange-500 text-xl font-bold tabular-nums">
                      {(props.session.stats.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">
                      Kills
                    </div>
                    <div class="text-white text-xl font-bold tabular-nums">
                      {props.session.stats.totalKills}
                    </div>
                  </div>
                </div>

                {/* Time & Damage */}
                <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <Clock size={14} class="text-orange-500" />
                      <span class="text-gray-500 text-xs uppercase">Time</span>
                    </div>
                    <span class="text-white text-lg font-bold tabular-nums">
                      {formatDuration(props.session.duration)}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-gray-500 text-xs uppercase">
                      Total Damage
                    </span>
                    <span class="text-white text-lg font-bold tabular-nums">
                      {(props.session.stats.totalLootTTValue || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === "economy"}>
              <div class="space-y-4">
                {/* Profit/Loss Hero Card */}
                <div
                  class={`border-2 rounded-lg p-4 ${
                    props.session.stats.profit >= 0
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div class="text-gray-400 text-xs uppercase mb-1">
                    Net Profit/Loss
                  </div>
                  <div
                    class={`text-3xl font-bold tabular-nums ${
                      props.session.stats.profit >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {props.session.stats.profit >= 0 ? "+" : ""}
                    {props.session.stats.profit.toFixed(2)} PED
                  </div>
                  <div class="text-gray-500 text-xs mt-1">
                    {props.session.stats.profitPerHour.toFixed(2)} PED/hr
                  </div>
                </div>

                {/* Economy Breakdown */}
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">
                      Loot Value
                    </div>
                    <div class="text-green-500 text-lg font-bold tabular-nums">
                      {(props.session.stats.totalLootTTValue || 0).toFixed(2)}
                    </div>
                    <div class="text-gray-600 text-xs">PED</div>
                  </div>
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-1">
                      Ammo Cost
                    </div>
                    <div class="text-orange-500 text-lg font-bold tabular-nums">
                      {props.session.stats.totalAmmoCost.toFixed(2)}
                    </div>
                    <div class="text-gray-600 text-xs">PED</div>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === "loadout"}>
              <div class="space-y-3">
                <Show
                  when={props.loadout}
                  fallback={
                    <div class="text-gray-500 text-sm italic text-center py-8">
                      No loadout selected
                    </div>
                  }
                >
                  <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                    <div class="text-gray-500 text-xs uppercase mb-2">
                      Current Loadout
                    </div>
                    <div class="text-white font-medium">
                      {props.loadout?.name}
                    </div>
                  </div>

                  <Show when={props.loadout?.weapon}>
                    <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                      <div class="text-gray-500 text-xs uppercase mb-1">
                        Weapon
                      </div>
                      <div class="text-white text-sm">
                        {props.loadout?.weaponData?.Name ||
                          props.loadout?.weapon}
                      </div>
                    </div>
                  </Show>

                  <Show when={props.loadout?.armorSet}>
                    <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
                      <div class="text-gray-500 text-xs uppercase mb-1">
                        Armor
                      </div>
                      <div class="text-white text-sm">
                        {props.loadout?.armorSetData?.Name ||
                          props.loadout?.armorSet}
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>

          {/* Footer - Inventory Style */}
          <div class="bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] border-t border-[#2a2a2a] px-4 py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <span class="text-xs font-bold text-yellow-900">₱</span>
                </div>
                <div>
                  <div class="text-gray-500 text-xs uppercase">Balance</div>
                  <div class="text-white text-sm font-bold tabular-nums">
                    {(props.session.stats.totalLootTTValue || 0).toFixed(2)} PED
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-gray-500 text-xs uppercase">Status</div>
                <div class="flex items-center gap-1.5">
                  <Activity size={12} class="text-green-500 animate-pulse" />
                  <span class="text-white text-xs font-medium">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

/**
 * Live GPS Overlay Component
 * Shows other users' real-time locations on the map
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { LiveGPSUpdate } from "../../../core/types/User";
import { Users, Navigation, Crosshair } from "lucide-solid";
import { coordsToPixels } from "@core/utils/mapUtils";

export interface LiveGPSOverlayProps {
  updates: LiveGPSUpdate[];
  currentUserId: string;
  onUserClick?: (userId: string) => void;
  visible?: boolean;
  transform?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
}

export function LiveGPSOverlay(props: LiveGPSOverlayProps) {
  return (
    <Show when={props.visible !== false}>
      <div class="absolute inset-0 pointer-events-none z-20">
        <For each={props.updates}>
          {(update) => (
            <LiveUserMarker
              update={update}
              transform={props.transform}
              onClick={() => props.onUserClick?.(update.userId)}
              isCurrentUser={update.userId === props.currentUserId}
            />
          )}
        </For>
      </div>

      {/* Live users counter */}
      <div class="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div class="bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2">
          <span class="text-sm font-medium text-primary">
            Hunters Online
          </span>
        </div>
      </div>
    </Show>
  );
}

interface LiveUserMarkerProps {
  update: LiveGPSUpdate;
  onClick?: () => void;
  transform?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
  isCurrentUser?: boolean;
}

function LiveUserMarker(props: LiveUserMarkerProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const pixelPosition = createMemo(() =>
    coordsToPixels(props.update.location.lon, props.update.location.lat)
  );

  const screenPosition = createMemo(() => {
    const transform = props.transform || {
      translateX: 0,
      translateY: 0,
      scale: 1,
    };
    const pixel = pixelPosition();
    return {
      x: transform.translateX + pixel.x * transform.scale,
      y: transform.translateY + pixel.y * transform.scale,
    };
  });

  const getStatusColor = () => {
    switch (props.update.status) {
      case "hunting":
        return "border-red-500 bg-red-500/20";
      case "traveling":
        return "border-yellow-500 bg-yellow-500/20";
      case "idle":
        return "border-gray-500 bg-gray-500/20";
      default:
        return "border-primary bg-primary/20";
    }
  };

  const getStatusIcon = () => {
    switch (props.update.status) {
      case "hunting":
        return <Crosshair size={12} class="text-red-500" />;
      case "traveling":
        return <Navigation size={12} class="text-yellow-500" />;
      default:
        return <Users size={12} class="text-primary" />;
    }
  };

  return (
    <div
      class="absolute pointer-events-auto"
      style={{
        left: `${screenPosition().x}px`,
        top: `${screenPosition().y}px`,
        transform: "translate(-50%, -50%)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.onClick}
    >
      {/* User marker */}
      <div class="flex flex-col items-center gap-1">
        <div
          class={`relative w-8 h-8 rounded-full border-2 ${getStatusColor()} transition-all cursor-pointer hover:scale-110`}
        >
          {/* Avatar or icon */}
          <Show
            when={props.update.avatar}
            fallback={
              <div class="w-full h-full flex items-center justify-center">
                {getStatusIcon()}
              </div>
            }
          >
            <img
              src={props.update.avatar}
              alt={props.update.username}
              class="w-full h-full rounded-full object-cover"
            />
          </Show>

          {/* Pulse animation for active hunters */}
          <Show when={props.update.status === "hunting"}>
            <div class="absolute inset-0 rounded-full border-2 border-red-500 animate-ping"></div>
          </Show>
        </div>

        {/* Username label */}
        <div class="bg-background-card/90 backdrop-blur-sm border border-primary/30 rounded px-2 py-0.5 whitespace-nowrap">
          <span class="text-xs font-medium text-white">
            {props.update.username}
          </span>
        </div>
      </div>

      {/* Info tooltip */}
      <Show when={isHovered()}>
        <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 pointer-events-none">
          <div class="bg-background-card border border-primary/20 rounded-lg p-3 shadow-lg">
            {/* Header */}
            <div class="flex items-center gap-2 mb-2">
              <Show
                when={props.update.avatar}
                fallback={
                  <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users size={16} class="text-primary" />
                  </div>
                }
              >
                <img
                  src={props.update.avatar}
                  alt={props.update.username}
                  class="w-8 h-8 rounded-full object-cover"
                />
              </Show>
              <div class="flex-1">
                <div class="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{props.update.username}</span>
                  <Show when={props.isCurrentUser}>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary uppercase tracking-wide">
                      You
                    </span>
                  </Show>
                </div>
                <div class="text-xs text-primary/60 capitalize">
                  {props.update.status}
                </div>
              </div>
            </div>

            {/* Stats section */}
            <div class="space-y-1.5">
              <div class="flex justify-between">
                <span class="text-primary/60">Location:</span>
                <span class="text-white font-mono">
                  {props.update.location.lon.toFixed(0)},{" "}
                  {props.update.location.lat.toFixed(0)}
                </span>
              </div>

              <Show when={props.update.loadoutName}>
                <div class="flex justify-between">
                  <span class="text-primary/60">Loadout:</span>
                  <span class="text-white">{props.update.loadoutName}</span>
                </div>
              </Show>

              <Show when={props.update.currentProfit !== undefined}>
                <div class="flex justify-between">
                  <span class="text-primary/60">Profit:</span>
                  <span
                    class={`font-mono ${
                      props.update.currentProfit! >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {props.update.currentProfit!.toFixed(2)} PED
                  </span>
                </div>
              </Show>

              <Show when={props.update.killCount !== undefined}>
                <div class="flex justify-between">
                  <span class="text-primary/60">Kills:</span>
                  <span class="text-white font-mono">
                    {props.update.killCount}
                  </span>
                </div>
              </Show>

              <Show when={props.update.lastKill}>
                <div class="flex justify-between">
                  <span class="text-primary/60">Last Kill:</span>
                  <span class="text-yellow-400 truncate ml-2">
                    💀 {props.update.lastKill}
                  </span>
                </div>
              </Show>
            </div>
          </div>

          {/* Arrow pointer */}
          <div class="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-primary/20 mx-auto"></div>
        </div>
      </Show>
    </div>
  );
}

/**
 * Live GPS Control Panel
 * Toggle GPS sharing and view online users
 */

export interface LiveGPSControlsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onlineUsers: number;
  nearbyUsers: number;
}

export function LiveGPSControls(props: LiveGPSControlsProps) {
  return (
    <div class="bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg p-4">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div
            class={`w-3 h-3 rounded-full ${props.enabled ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
          ></div>
          <span class="text-sm font-semibold text-primary">Live GPS</span>
        </div>

        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(e) => props.onToggle(e.currentTarget.checked)}
            class="sr-only peer"
            aria-label="Toggle GPS sharing"
          />
          <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      <div class="space-y-2 text-xs">
        <div class="flex justify-between">
          <span class="text-primary/60">Online:</span>
          <span class="text-white font-mono">{props.onlineUsers}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-primary/60">Nearby:</span>
          <span class="text-white font-mono">{props.nearbyUsers}</span>
        </div>
      </div>

      <Show when={props.enabled}>
        <div class="mt-3 pt-3 border-t border-primary/10">
          <div class="flex items-start gap-2">
            <div class="w-1 h-1 rounded-full bg-green-500 mt-1.5"></div>
            <p class="text-xs text-primary/60">
              Your location is being shared with other ARTEMIS users
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}

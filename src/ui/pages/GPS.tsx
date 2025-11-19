/**
 * GPS Page
 * Live hunter location tracking - see where other hunters are in real-time
 */

import { createSignal, onMount, onCleanup, Show } from "solid-js";
import {
  Radio,
  Users,
  Settings as SettingsIcon,
  RefreshCw,
  Map as MapIcon,
} from "lucide-solid";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { LiveGPSService } from "@core/services/LiveGPSService";
import { InteractiveMapView } from "../components/map/InteractiveMapView";
import { settings, updateLiveGPSSettings } from "../stores/settingsStore";
import {
  reinitializeLiveGPS,
  activeSession,
  activeLoadout,
} from "../stores/sessionStore";
import type { LiveGPSUpdate } from "@core/types/User";

export function GPS() {
  // State - using Map to store updates by userId for easy updating
  const [liveUpdatesMap, setLiveUpdatesMap] = createSignal<
    Map<string, LiveGPSUpdate>
  >(new Map());
  const [isConfigured, setIsConfigured] = createSignal(false);
  const [isBroadcasting, setIsBroadcasting] = createSignal(false);
  const [gpsEnabled, setGpsEnabled] = createSignal(false);
  const [isPulsing, setIsPulsing] = createSignal(false);

  // Computed: Convert Map to Array for rendering (includes all updates, even expired - let UI fade them)
  const liveUpdates = () => Array.from(liveUpdatesMap().values());

  // Live GPS service
  let liveGPS: LiveGPSService | null = null;
  let updateInterval: NodeJS.Timeout | null = null;
  let discordPollInterval: NodeJS.Timeout | null = null;

  // Poll Discord channel for GPS updates
  async function pollDiscordChannel() {
    try {
      const userSettings = settings();
      const botToken = userSettings.liveGPS.discordBotToken;
      const channelId = userSettings.liveGPS.discordChannelId;

      if (!botToken) {
        console.log(
          "[GPS] ⚠️ No Discord bot token configured - cannot read messages"
        );
        return;
      }

      if (!channelId) {
        console.log("[GPS] ⚠️ No Discord channel ID configured");
        return;
      }

      console.log("[GPS] 📡 Polling Discord channel for GPS updates...");

      // Use Electron IPC proxy to bypass CORS
      const result = await window.electron.discord.getChannelMessages(
        channelId,
        botToken,
        50
      );

      if (!result.success) {
        console.log(
          `[GPS] ⚠️ Discord API error: ${result.error} - Keeping existing markers`
        );
        return; // Don't update map on error, keep existing markers
      }

      const messages = result.messages || [];
      console.log(`[GPS] 📥 Received ${messages.length} messages from Discord`);

      // Validate response is an array
      if (!Array.isArray(messages)) {
        console.error(
          "[GPS] ❌ Invalid response format from Discord - Keeping existing markers"
        );
        return; // Don't update map on invalid response
      }

      // Parse GPS updates from messages - Discord returns newest first
      // Group by userId and keep only the most recent update for each hunter
      const updatesByUser = new Map<string, LiveGPSUpdate>();
      const offlineUsers = new Set<string>(); // Track users who went offline
      const maxMessages = Math.min(messages.length, 50); // Process max 50 messages

      for (let i = 0; i < maxMessages; i++) {
        const msg = messages[i];
        if (!msg || typeof msg !== "object") continue;

        // Check for offline/termination messages (format: GPS_OFFLINE:userId)
        if (
          msg.content &&
          typeof msg.content === "string" &&
          msg.content.startsWith("GPS_OFFLINE:")
        ) {
          const userId = msg.content.split(":")[1];
          if (userId) {
            offlineUsers.add(userId);
            console.log(`[GPS] 🔴 User ${userId} went offline`);
          }
          continue;
        }

        if (
          msg.content &&
          typeof msg.content === "string" &&
          msg.content.startsWith("GPS:")
        ) {
          const parsed = LiveGPSService.parseDiscordMessage(msg.content);
          if (parsed && parsed.userId && parsed.location) {
            // Skip if we already have a newer message for this user
            if (updatesByUser.has(parsed.userId)) continue;

            // Skip if user has gone offline
            if (offlineUsers.has(parsed.userId)) continue;

            // Extract full update from embed if available
            if (msg.embeds && msg.embeds[0]) {
              const embed = msg.embeds[0];
              const fields = embed.fields || [];

              const update: LiveGPSUpdate = {
                userId: parsed.userId,
                username: embed.title || parsed.userId,
                location: parsed.location,
                status: "hunting",
                timestamp:
                  parsed.timestamp || new Date(msg.timestamp).getTime(),
                ttl: 30000,
                sessionId: "discord",
                currentProfit:
                  parseFloat(
                    fields.find((f: any) => f.name === "Profit")?.value
                  ) || undefined,
                killCount:
                  parseInt(
                    fields.find((f: any) => f.name === "Kills")?.value
                  ) || undefined,
                loadoutName:
                  fields.find((f: any) => f.name === "Loadout")?.value ||
                  undefined,
              };
              updatesByUser.set(parsed.userId, update);
            }
          }
        }
      }

      // Convert map to array
      const updates = Array.from(updatesByUser.values());

      // Always update the map, even if no new updates (keeps existing markers)
      console.log(
        `[GPS] ✅ Parsed ${updates.length} unique hunters from Discord`
      );

      // Merge new updates into existing map (don't replace, accumulate)
      setLiveUpdatesMap((prevMap) => {
        console.log(
          `[GPS] 🔄 Updating map. Previous size: ${prevMap.size}, New updates: ${updates.length}, Offline users: ${offlineUsers.size}`
        );
        const newMap = new Map(prevMap);

        // Remove offline users from the map
        for (const offlineUserId of offlineUsers) {
          if (newMap.has(offlineUserId)) {
            newMap.delete(offlineUserId);
            console.log(`[GPS] 🗑️ Removed offline user: ${offlineUserId}`);
          }
        }

        // Add/update active hunters
        for (const update of updates) {
          // Store/update in our state map (don't feed to LiveGPS service, it has TTL checks)
          newMap.set(update.userId, update);
          console.log(
            `[GPS] ➕ Added/Updated hunter: ${update.username} at ${update.location.lon}, ${update.location.lat}`
          );
        }

        // Enforce max map size to prevent memory issues (max 100 hunters)
        if (newMap.size > 100) {
          console.warn(
            `[GPS] ⚠️ Map size limit reached (${newMap.size}), cleaning oldest entries`
          );
          // Remove oldest entries
          const sorted = Array.from(newMap.entries()).sort(
            (a, b) => a[1].timestamp - b[1].timestamp
          );
          const toKeep = sorted.slice(-100);
          return new Map(toKeep);
        }

        console.log(`[GPS] ✅ Map updated. New size: ${newMap.size}`);
        return newMap;
      });
    } catch (error) {
      console.error("[GPS] ❌ Failed to poll Discord channel:", error);
    }
  }

  // Initialize LiveGPS service
  function initializeLiveGPS() {
    const userSettings = settings();

    if (!userSettings.liveGPS.discordWebhookUrl) {
      setIsConfigured(false);
      return;
    }

    liveGPS = new LiveGPSService({
      discordWebhookUrl: userSettings.liveGPS.discordWebhookUrl,
      updateInterval: userSettings.liveGPS.updateInterval,
      ttl: 30000, // 30 seconds
    });

    setIsConfigured(true);
    console.log("[GPS] 📡 LiveGPS service initialized");

    // Always start polling Discord to see other hunters (independent of GPS broadcast toggle)
    if (discordPollInterval) {
      clearInterval(discordPollInterval);
    }
    discordPollInterval = setInterval(() => {
      pollDiscordChannel();
    }, 3000);

    // Initial poll
    pollDiscordChannel();
  } // Test broadcast my GPS
  const testMyGPS = async () => {
    if (!liveGPS) {
      alert(
        "LiveGPS service not configured. Please set up your Discord webhook in Settings."
      );
      return;
    }

    const mockUpdate = {
      userId: settings().userId,
      username: settings().username,
      location: {
        lon: 62000 + Math.random() * 1000,
        lat: 75000 + Math.random() * 1000,
      },
      status: "hunting" as const,
      timestamp: Date.now(),
      ttl: 30000,
      sessionId: "test-session-" + Date.now(),
      loadoutName: "Test Loadout",
      currentProfit: 125.5,
      killCount: 15,
    };

    try {
      await liveGPS.broadcastLocation(mockUpdate);
      setIsBroadcasting(true);

      // Store our own broadcast in the local map
      setLiveUpdatesMap((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(mockUpdate.userId, mockUpdate);
        return newMap;
      });

      // Trigger pulse animation
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 1000);

      console.log("[GPS] 📍 Test broadcast successful:", mockUpdate);
      alert(
        `✅ GPS broadcast successful!\nLocation: ${mockUpdate.location.lon.toFixed(0)}, ${mockUpdate.location.lat.toFixed(0)}\nCheck Discord!`
      );
    } catch (error) {
      console.error("[GPS] Test broadcast failed:", error);
      alert(
        "❌ Failed to broadcast GPS. Check console and Discord webhook URL."
      );
    }
  };

  // Test simulate other player
  const testOtherPlayer = () => {
    if (!liveGPS) {
      alert("LiveGPS service not configured.");
      return;
    }

    const mockUpdate = {
      userId: "mock-player-" + Math.floor(Math.random() * 1000),
      username: "TestHunter" + Math.floor(Math.random() * 100),
      location: {
        lon: 63000 + Math.random() * 2000,
        lat: 76000 + Math.random() * 2000,
      },
      status: "hunting" as const,
      timestamp: Date.now(),
      ttl: 30000,
      sessionId: "mock-session-" + Date.now(),
      loadoutName: "Mock Loadout",
      currentProfit: 89.25,
      killCount: 8,
    };

    liveGPS.receiveUpdate(mockUpdate);

    console.log("[GPS] 👥 Simulated other player:", mockUpdate);
    alert(
      `✅ Mock player added!\nUsername: ${mockUpdate.username}\nLocation: ${mockUpdate.location.lon.toFixed(0)}, ${mockUpdate.location.lat.toFixed(0)}`
    );
  };

  // Refresh updates
  const refreshUpdates = async () => {
    console.log("[GPS] 🔄 Manual refresh triggered");
    await pollDiscordChannel();
    console.log("[GPS] 🔄 Refresh complete:", liveUpdates().length, "hunters");
  };

  onMount(() => {
    // Initialize GPS enabled state from settings
    setGpsEnabled(settings().liveGPS.enabled);
    initializeLiveGPS();
  });

  onCleanup(() => {
    // Send termination message before cleanup
    if (liveGPS && isBroadcasting()) {
      console.log("[GPS] 👋 Sending termination message...");
      const userSettings = settings();
      liveGPS
        .sendTerminationMessage(userSettings.userId, userSettings.username)
        .catch((err) =>
          console.error("[GPS] Failed to send termination:", err)
        );
    }

    if (updateInterval) {
      clearInterval(updateInterval);
    }
    if (discordPollInterval) {
      clearInterval(discordPollInterval);
    }
  });

  return (
    <div class="p-8 max-w-[2000px] mx-auto">
      {/* Header */}
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-2 text-white">GPS Tracking</h1>
            <p class="text-primary/60">
              See where other hunters are in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Warning */}
      <Show when={!isConfigured()}>
        <Card class="mb-8 bg-yellow-500/10 border-yellow-500/30">
          <div class="flex items-start gap-4">
            <SettingsIcon
              size={24}
              class="text-yellow-500 flex-shrink-0 mt-1"
            />
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-yellow-500 mb-2">
                GPS Not Configured
              </h3>
              <p class="text-white/80 mb-4">
                To use live GPS tracking, you need to set up a Discord webhook
                URL in Settings. This allows you to broadcast your location and
                see other hunters on the map.
              </p>
              <Button
                onClick={() => (window.location.hash = "#/settings")}
                variant="ghost"
                class="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
              >
                <SettingsIcon size={18} />
                Go to Settings
              </Button>
            </div>
          </div>
        </Card>
      </Show>

      {/* Map */}
      <Card
        header={
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Radio
                size={20}
                classList={{
                  "text-green-500": isConfigured() && gpsEnabled(),
                  "text-red-500": !isConfigured() || !gpsEnabled(),
                  "animate-pulse drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]":
                    isPulsing() && isConfigured() && gpsEnabled(),
                }}
              />
              <h2 class="text-xl font-semibold">Live Hunter Map</h2>
              <Show when={gpsEnabled()}>
                <span class="text-sm text-primary/60 ml-2">
                  {liveUpdates().length} hunters online
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-primary/60">GPS</span>
              <button
                onClick={async () => {
                  const newState = !gpsEnabled();
                  setGpsEnabled(newState);
                  // Update settings
                  updateLiveGPSSettings({ enabled: newState });
                  console.log(`[GPS] GPS ${newState ? "enabled" : "disabled"}`);

                  if (newState) {
                    // GPS turned ON - start polling and broadcasting
                    // Reinitialize global LiveGPS service and send instant update
                    await reinitializeLiveGPS();

                    // Start local polling
                    if (discordPollInterval) {
                      clearInterval(discordPollInterval);
                    }
                    discordPollInterval = setInterval(() => {
                      pollDiscordChannel();
                    }, 3000);
                    pollDiscordChannel(); // Initial poll

                    // Trigger pulse animation
                    setIsPulsing(true);
                    setTimeout(() => setIsPulsing(false), 1000);

                    // Refresh to show self on map
                    setTimeout(() => refreshUpdates(), 100);
                  } else {
                    // GPS turned OFF - stop polling and send termination
                    if (discordPollInterval) {
                      clearInterval(discordPollInterval);
                      discordPollInterval = null;
                    }

                    // Send termination message
                    if (liveGPS) {
                      const userSettings = settings();
                      await liveGPS.sendTerminationMessage(
                        userSettings.userId,
                        userSettings.username
                      );
                    }

                    console.log("[GPS] 🛑 Polling stopped");
                  }
                }}
                disabled={!isConfigured()}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                classList={{
                  "bg-green-500": gpsEnabled() && isConfigured(),
                  "bg-primary/20": !gpsEnabled() || !isConfigured(),
                }}
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  classList={{
                    "translate-x-6": gpsEnabled(),
                    "translate-x-1": !gpsEnabled(),
                  }}
                />
              </button>
              <span class="text-sm font-medium">
                {gpsEnabled() ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        }
      >
        <Show
          when={isConfigured() && gpsEnabled()}
          fallback={
            <div class="h-[600px] flex items-center justify-center text-primary/40">
              <div class="text-center">
                <Show
                  when={isConfigured()}
                  fallback={
                    <>
                      <SettingsIcon size={48} class="mx-auto mb-4 opacity-50" />
                      <p>Configure GPS tracking in Settings to view the map</p>
                    </>
                  }
                >
                  <MapIcon size={48} class="mx-auto mb-4 opacity-50" />
                  <p class="text-lg font-medium mb-2">GPS is OFF</p>
                  <p class="text-sm">
                    Enable GPS tracking to view hunter locations on the map
                  </p>
                </Show>
              </div>
            </div>
          }
        >
          <InteractiveMapView
            zones={[]}
            height="600px"
            liveGPS={liveGPS}
            liveUpdates={liveUpdates()}
            showLiveGPSByDefault={true}
          />
        </Show>
      </Card>
    </div>
  );
}

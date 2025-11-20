/**
 * ActiveSession Page
 * Real-time hunting session tracker with live stats
 */

import {
  createSignal,
  onCleanup,
  onMount,
  Show,
  For,
  createEffect,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ExternalLink } from "lucide-solid";
import type { Session } from "../../core/types/Session";
import type { Loadout } from "../../core/types/Loadout";
import type { SessionEvent } from "../../core/types/Events";
import { SessionService } from "../../core/services/SessionService";
import { LiveGPSService } from "../../core/services/LiveGPSService";
import type { LiveGPSUpdate } from "../../core/types/User";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { StatCard } from "../components/molecules/StatCard";
import { LoadoutSelector } from "../components/molecules/LoadoutSelector";
import { SessionHUD } from "../components/organisms/SessionHUD";
import {
  activeSession,
  activeLoadout,
  isSessionActive,
  isTracking,
  startSession as startGlobalSession,
  stopSession as stopGlobalSession,
  updateLoadout,
  setTrackingState,
  reinitializeLiveGPS,
} from "../stores/sessionStore";
import { settings, updateLiveGPSSettings } from "../stores/settingsStore";

export default function ActiveSession() {
  const navigate = useNavigate();

  // Use global session store - all state derived from activeSession()
  // Local UI state removed - derive from global session instead

  const [watcherError, setWatcherError] = createSignal<string>("");

  // GPS state - derive from settings store
  const gpsEnabled = () => settings().liveGPS.enabled;
  const [, setGpsEnabled] = createSignal(false);
  const [gpsCount, setGpsCount] = createSignal(0);
  const [lastGpsTime, setLastGpsTime] = createSignal<string>("");
  const [isPulsing, setIsPulsing] = createSignal(false);

  // Loadout state
  const [loadouts, setLoadouts] = createSignal<Loadout[]>([]);

  // User state
  const [currentUser, setCurrentUser] = createSignal<any>(null);

  // Live GPS service
  let liveGPS: LiveGPSService | null = null;
  const [lastGPSBroadcast, setLastGPSBroadcast] = createSignal(0);

  // Derive values from activeSession signal
  const eventCount = () => activeSession()?.events.length || 0;
  const lastEvent = () => {
    const session = activeSession();
    if (!session || session.events.length === 0) return "";
    return session.events[session.events.length - 1]?.type || "";
  };

  // Debug: Track when signal changes
  createEffect(() => {
    const session = activeSession();
    console.log("[ActiveSession] 🔄 EFFECT: activeSession changed:", {
      events: session?.events.length,
      shots: session?.stats.totalShots,
      tracking: isTracking(),
    });
  });

  // Register event listeners once on mount to avoid duplicates
  onMount(async () => {
    console.log(
      "[ActiveSession] 🎬 Component mounted, setting up event listeners..."
    );

    // Debug: Test signal reactivity
    console.log(
      "[ActiveSession] 🔍 activeSession signal test:",
      activeSession()
    );
    console.log("[ActiveSession] 🔍 isTracking signal test:", isTracking());

    // Check if there's already an active session tracking
    if (activeSession() && window.electron?.logWatcher) {
      try {
        const status = await window.electron.logWatcher.status();
        if (status?.isRunning) {
          console.log("[ActiveSession] 🔄 Resumed tracking existing session");
          setTrackingState(true);
        }
      } catch (error) {
        console.error("Failed to check log watcher status:", error);
      }
    }

    // Load current user from database
    if (window.electron?.user) {
      try {
        const user = await window.electron.user.getCurrent();
        setCurrentUser(user);

        // Initialize Live GPS service if webhook configured
        if (user.discordWebhookUrl) {
          liveGPS = new LiveGPSService({
            discordWebhookUrl: user.discordWebhookUrl,
            updateInterval: 30000, // 30 seconds
            ttl: 30000, // 30 seconds
          });
          console.log(
            "[ActiveSession] 📡 LiveGPS service initialized for user:",
            user.username
          );
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    }

    // Load available loadouts and auto-select the last used one
    if (window.electron?.loadout) {
      try {
        const data = await window.electron.loadout.findAll();
        setLoadouts(data);
        // Auto-select first loadout if none selected yet
        if (data.length > 0 && !activeLoadout()) {
          updateLoadout(data[0]);
        }
      } catch (error) {
        console.error("Failed to load loadouts:", error);
      }
    }

    // Event listener is now registered globally in sessionStore.ts
    // No need to register here - avoids duplicate listeners
    console.log(
      "[ActiveSession] ✅ Using global event listener from sessionStore"
    );
  });

  // Broadcast GPS location to other users
  const broadcastGPSLocation = async (gpsEvent: SessionEvent) => {
    const user = currentUser();

    // Check if user exists and GPS sharing is enabled
    if (!user || !user.shareGPS || !liveGPS) {
      return;
    }

    // Rate limiting - don't broadcast more than once per 30 seconds
    const now = Date.now();
    const interval = 30000; // 30 seconds
    if (now - lastGPSBroadcast() < interval) {
      return;
    }

    // Get GPS coordinates from event
    if (gpsEvent.type !== "GPS_UPDATE") return;

    const currentSession = activeSession();
    if (!currentSession) return;

    try {
      const update: LiveGPSUpdate = {
        userId: user.id,
        username: user.username,
        location: {
          lon: gpsEvent.payload.location.lon,
          lat: gpsEvent.payload.location.lat,
        },
        status: "hunting",
        sessionId: currentSession.id,
        loadoutName: activeLoadout()?.name,
        currentProfit: currentSession.stats.profit,
        killCount: currentSession.stats.totalKills,
        timestamp: gpsEvent.timestamp,
        ttl: 30000, // 30 seconds
      };

      await liveGPS.broadcastLocation(update);
      setLastGPSBroadcast(now);
      console.log(
        `[LiveGPS] 📡 Broadcast location: ${update.location.lon}, ${update.location.lat}`
      );
    } catch (error) {
      console.error("[LiveGPS] ❌ Failed to broadcast location:", error);
    }
  };

  // Start new session
  const startSession = async (e?: Event) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!window.electron?.logWatcher) {
      alert("Log watcher not available");
      return;
    }

    // Validate loadout is selected
    const loadout = activeLoadout();
    if (!loadout) {
      alert(
        "⚠️ Please select a loadout before starting a session.\n\nLoadouts are used to calculate ammo costs and profit."
      );
      return;
    }

    // Create new session
    const user = currentUser();
    const userId = user?.id || "demo-user";
    const newSession = SessionService.create(
      userId,
      `Hunt ${new Date().toLocaleString()}`
    );

    // Link loadout to session
    newSession.loadoutId = loadout.id;

    // Set in global store (persists across navigation)
    startGlobalSession(newSession, loadout);

    // Auto-detect and start watching log
    try {
      let chatLogPath: string | null = null;
      
      // First, try to use saved path from settings
      const user = currentUser();
      if (user?.settings?.chatLogPath) {
        console.log(`[ActiveSession] 📁 Using saved path from settings: ${user.settings.chatLogPath}`);
        chatLogPath = user.settings.chatLogPath;
      } else {
        // No saved path - try auto-detect
        const detectResult = await window.electron.logWatcher.detectPath();
        if (detectResult.success && detectResult.path) {
          console.log(`[ActiveSession] ✅ Auto-detected: ${detectResult.path}`);
          chatLogPath = detectResult.path;
        }
      }
      
      // If still no path, prompt user to browse
      if (!chatLogPath) {
        console.warn(
          "[ActiveSession] ⚠️ No path found, prompting user to browse..."
        );

        const browseResult = await window.electron.logWatcher.browsePath();
        if (!browseResult.success || !browseResult.path) {
          const errorMsg =
            "Could not find chat.log. Please set it in Settings:\n" +
            "1. Go to Settings page\n" +
            "2. Set your chat.log path under 'Chat Log Path'\n" +
            "3. Common locations:\n" +
            "   • Documents\\Entropia Universe\\chat.log\n" +
            "   • C:\\Program Files (x86)\\Steam\\steamapps\\common\\Entropia Universe\\chat.log";
          setWatcherError(errorMsg);
          alert(errorMsg);
          return;
        }

        chatLogPath = browseResult.path;
        console.log(`[ActiveSession] ✅ User selected: ${chatLogPath}`);
      }

      // Start watching with the determined path
      console.log(
        `[ActiveSession] 🚀 Starting log watcher for session: ${newSession.id}`
      );
      const startResult = await window.electron.logWatcher.start({
        logPath: chatLogPath,
        sessionId: newSession.id,
        userId: "demo-user",
      });
      console.log(`[ActiveSession] ✅ Log watcher started:`, startResult);
      setTrackingState(true);
      setWatcherError("");

      // Start Live GPS broadcasting if enabled and user has shareGPS on
      if (user?.shareGPS && liveGPS) {
        liveGPS.startBroadcasting(user.id, user.username);
      }

      // Auto-save is now handled globally in sessionStore (every 5 seconds)
    } catch (error) {
      const errorMsg = `Failed to start tracking: ${error}`;
      setWatcherError(errorMsg);
      alert(errorMsg);
    }
  };

  // Stop session
  const stopSession = async (e?: Event) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!window.electron?.logWatcher) return;

    try {
      await window.electron.logWatcher.stop();
      setTrackingState(false);

      // Stop Live GPS broadcasting
      if (liveGPS) {
        liveGPS.stopBroadcasting();
        console.log("[LiveGPS] 🛑 Stopped GPS broadcasting");
      }

      // Auto-save timer is now cleared globally in sessionStore

      // End session and save (use global store)
      const currentSession = activeSession();
      if (currentSession && window.electron?.session) {
        console.log(
          `🛑 Stopping session with ${currentSession.events.length} events, ${currentSession.stats.totalKills} kills, ${currentSession.stats.profit.toFixed(2)} PED profit`
        );
        // Pass loadout to preserve cost calculations
        const loadout = activeLoadout();
        const endedSession = SessionService.end(currentSession, loadout);
        console.log(
          `💾 Saving ended session with ${endedSession.events.length} events, ${endedSession.stats.totalKills} kills, ${endedSession.stats.profit.toFixed(2)} PED profit`
        );
        await window.electron.session.save(endedSession);

        // Update loadout's total PED cycled
        if (endedSession.loadoutId && window.electron?.loadout) {
          try {
            const loadout = await window.electron.loadout.findById(
              endedSession.loadoutId
            );
            if (loadout) {
              const updatedLoadout = {
                ...loadout,
                totalPEDCycled:
                  (loadout.totalPEDCycled || 0) +
                  endedSession.stats.totalAmmoCost,
              };
              await window.electron.loadout.save(updatedLoadout);
              console.log(
                `💰 Updated loadout ${loadout.name} - added ${endedSession.stats.totalAmmoCost.toFixed(2)} PED (total: ${updatedLoadout.totalPEDCycled.toFixed(2)} PED)`
              );
            }
          } catch (error) {
            console.error("Failed to update loadout PED cycled:", error);
          }
        }

        // Update global store with ended session
        stopGlobalSession();
        console.log("✅ Session ended and saved");
      }
    } catch (error) {
      alert(`Failed to stop tracking: ${error}`);
    }
  };

  // Clean up on unmount
  onCleanup(() => {
    // Don't stop session on navigation - it should persist!
    // Session only stops when user clicks "Stop Session" button

    // Still stop GPS capture to free resources
    if (gpsEnabled()) {
      stopGPS();
    }
  });

  // GPS Controls
  const startGPS = async () => {
    if (!window.electron?.gps) {
      alert("GPS tracking not available");
      return;
    }

    try {
      const result = await window.electron.gps.start();

      if (result.success) {
        setGpsEnabled(true);
      } else {
        alert(`Failed to start GPS: ${result.error}`);
      }
    } catch (error) {
      alert(`GPS error: ${error}`);
    }
  };

  const stopGPS = async () => {
    if (!window.electron?.gps) return;

    try {
      await window.electron.gps.stop();
      setGpsEnabled(false);
    } catch (error) {
      console.error("Failed to stop GPS:", error);
    }
  };

  const stats = () => activeSession()?.stats;
  const duration = () => {
    const s = activeSession();
    if (!s) return "0:00";
    const mins = Math.floor(s.duration / 60);
    const secs = s.duration % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div class="p-8">
      <div class="max-w-7xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-primary tracking-tight">
              Active Session
            </h1>
            <p class="text-primary/60 mt-1">Real-time hunting tracker</p>
          </div>
          <div class="flex gap-3">
            <Show when={activeSession() && window.electron?.hud}>
              <Button
                onClick={async () => {
                  try {
                    await window.electron.hud.show();
                  } catch (error) {
                    console.error("Failed to open HUD overlay:", error);
                  }
                }}
                class="flex items-center gap-2"
              >
                <ExternalLink size={16} />
                Open Overlay HUD
              </Button>
            </Show>
          </div>
        </div>

        {/* Control Panel */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Loadout & Controls */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 text-white">Session Setup</h3>

            {/* Loadout Selector - Simplified */}
            <div class="mb-4">
              <label class="text-sm text-primary/60 mb-2 block">
                Active Loadout
              </label>
              <LoadoutSelector
                loadouts={loadouts()}
                selectedLoadout={activeLoadout()}
                onSelect={updateLoadout}
                onCreateNew={() => navigate("/loadouts")}
              />
            </div>

            {/* Session Controls */}
            <div class="space-y-3">
              {/* Session Button */}
              <div>
                {isTracking() ? (
                  <Button onClick={stopSession} variant="danger" class="w-full">
                    Stop Session
                  </Button>
                ) : (
                  <Button
                    onClick={startSession}
                    variant="primary"
                    class="w-full"
                  >
                    Start Tracking
                  </Button>
                )}
              </div>

              {/* GPS Toggle */}
              <div class="flex items-center justify-between p-3 bg-background-lighter/50 rounded-lg border border-primary/10">
                <div class="flex items-center gap-2">
                  <div
                    class={`w-2 h-2 rounded-full transition-all ${
                      gpsEnabled()
                        ? isPulsing()
                          ? "bg-green-500 animate-pulse"
                          : "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span class="text-sm font-medium text-white">
                    Live GPS Broadcast
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const newState = !gpsEnabled();
                    console.log(`[ActiveSession] 🗺️ GPS toggle: ${newState}`);

                    // Update settings store (syncs with GPS page)
                    updateLiveGPSSettings({ enabled: newState });

                    // Reinitialize GPS service in sessionStore
                    await reinitializeLiveGPS();

                    // Pulse animation when enabling
                    if (newState) {
                      setIsPulsing(true);
                      setTimeout(() => setIsPulsing(false), 2000);
                    }
                  }}
                  class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    gpsEnabled() ? "bg-green-600" : "bg-gray-600"
                  }`}
                  role="switch"
                  aria-checked={gpsEnabled()}
                >
                  <span
                    class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gpsEnabled() ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Error Display */}
            <Show when={watcherError()}>
              <div class="bg-red-900/20 border border-red-500 rounded-lg p-3 mt-4">
                <p class="text-red-400 text-sm">{watcherError()}</p>
              </div>
            </Show>
          </Card>

          {/* Right: Status */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 text-white">
              Session Status
            </h3>

            <Show
              when={isTracking()}
              fallback={
                <div class="flex items-center justify-center h-32 border-2 border-dashed border-primary/10 rounded-lg">
                  <div class="text-center">
                    <div class="text-primary/40 text-sm">Not tracking</div>
                    <div class="text-primary/30 text-xs mt-1">
                      Start a session to begin
                    </div>
                  </div>
                </div>
              }
            >
              <div class="space-y-4">
                {/* Active Status Badge */}
                <div class="flex items-center gap-3 p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
                  <div class="flex-shrink-0">
                    <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div class="flex-1">
                    <div class="text-green-400 font-semibold">
                      Live Tracking
                    </div>
                    <div class="text-gray-400 text-sm mt-0.5">
                      {eventCount()} events recorded
                    </div>
                  </div>
                </div>

                {/* Loadout Info Card */}
                <Show when={activeLoadout()}>
                  <div class="p-4 bg-background-lighter/50 rounded-lg border border-primary/10">
                    <div class="flex items-start justify-between">
                      <div>
                        <div class="text-xs text-primary/50 uppercase tracking-wide mb-1">
                          Loadout
                        </div>
                        <div class="text-white font-medium">
                          {activeLoadout()!.name}
                        </div>
                      </div>
                      <Show when={activeLoadout()!.costs}>
                        <div class="text-right">
                          <div class="text-xs text-primary/50 uppercase tracking-wide mb-1">
                            Cost/Shot
                          </div>
                          <div class="text-primary font-mono text-sm">
                            {activeLoadout()!.costs!.totalPerShot.toFixed(4)}
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                </Show>

                {/* Last Event */}
                <Show when={lastEvent()}>
                  <div class="text-xs text-gray-500">
                    Last event:{" "}
                    <span class="text-gray-400 font-mono">{lastEvent()}</span>
                  </div>
                </Show>
              </div>
            </Show>
          </Card>
        </div>

        {/* Stats Display */}
        <Show when={activeSession()}>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Duration" value={duration()} />
            <StatCard
              label="Total Shots"
              value={stats()?.totalShots.toString() || "0"}
            />
            <StatCard
              label="Accuracy"
              value={`${((stats()?.accuracy || 0) * 100).toFixed(1)}%`}
              positive={(stats()?.accuracy || 0) > 0.5}
            />
            <StatCard
              label="Kills"
              value={stats()?.totalKills.toString() || "0"}
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Combat Stats */}
            <Card>
              <h3 class="text-lg font-semibold mb-4">Combat</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-400">Hits</span>
                  <span class="font-semibold">{stats()?.totalHits || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Misses</span>
                  <span class="font-semibold">{stats()?.totalMisses || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Critical Hits</span>
                  <span class="font-semibold">
                    {stats()?.totalCriticals || 0}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Total Damage</span>
                  <span class="font-semibold">
                    {(stats()?.totalDamageDealt ?? 0).toFixed(1)}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Avg Damage/Hit</span>
                  <span class="font-semibold">
                    {(stats()?.avgDamagePerHit ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Economy Stats */}
            <Card>
              <h3 class="text-lg font-semibold mb-4">Economy</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-400">Loot Value</span>
                  <span class="font-semibold text-green-400">
                    {(stats()?.totalLootTTValue ?? 0).toFixed(2)} PED
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Ammo Cost</span>
                  <span class="font-semibold text-red-400">
                    {(stats()?.totalAmmoCost ?? 0).toFixed(2)} PED
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Profit</span>
                  <span
                    class={`font-semibold ${(stats()?.profit || 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {(stats()?.profit || 0).toFixed(2)} PED
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Return Rate</span>
                  <span class="font-semibold">
                    {((stats()?.returnRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">PED/Hour</span>
                  <span class="font-semibold">
                    {(stats()?.profitPerHour ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Skills */}
            <Card>
              <h3 class="text-lg font-semibold mb-4">Skills</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-400">Skill Gains</span>
                  <span class="font-semibold">
                    {stats()?.totalSkillGains || 0}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">New Skills</span>
                  <span class="font-semibold">
                    {stats()?.totalNewSkills || 0}
                  </span>
                </div>

                {/* Detailed Skill Breakdown */}
                <Show
                  when={
                    stats()?.skillGainsByName &&
                    Object.keys(stats()!.skillGainsByName!).length > 0
                  }
                >
                  <div class="mt-4 pt-4 border-t border-gray-700">
                    <div class="text-sm text-gray-400 mb-2">
                      Experience Gained:
                    </div>
                    <div class="space-y-2">
                      <For
                        each={Object.entries(
                          stats()!.skillGainsByName || {}
                        ).sort((a, b) => b[1] - a[1])}
                      >
                        {([skillName, amount]) => (
                          <div class="flex justify-between text-sm">
                            <span class="text-gray-300">{skillName}</span>
                            <span class="font-mono text-green-400">
                              +{amount.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Attribute Gains */}
                <Show
                  when={
                    stats()?.attributeGainsByName &&
                    Object.keys(stats()!.attributeGainsByName!).length > 0
                  }
                >
                  <div class="mt-4 pt-4 border-t border-gray-700">
                    <div class="text-sm text-gray-400 mb-2">Attributes:</div>
                    <div class="space-y-2">
                      <For
                        each={Object.entries(
                          stats()!.attributeGainsByName || {}
                        ).sort((a, b) => b[1] - a[1])}
                      >
                        {([attrName, amount]) => (
                          <div class="flex justify-between text-sm">
                            <span class="text-gray-300">{attrName}</span>
                            <span class="font-mono text-blue-400">
                              +{amount.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Card>

            {/* Defense */}
            <Card>
              <h3 class="text-lg font-semibold mb-4">Defense</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-400">Damage Taken</span>
                  <span class="font-semibold">
                    {(stats()?.totalDamageTaken ?? 0).toFixed(1)}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Dodges</span>
                  <span class="font-semibold">{stats()?.totalDodges || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Evades</span>
                  <span class="font-semibold">{stats()?.totalEvades || 0}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Deflects</span>
                  <span class="font-semibold">
                    {stats()?.totalDeflects || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </Show>

        <Show when={!activeSession()}>
          <Card>
            <div class="text-center py-12">
              <p class="text-gray-400 mb-4">No active session</p>
              <p class="text-sm text-gray-500">
                Enter your chat.log path and click "Start Session" to begin
                tracking
              </p>
            </div>
          </Card>
        </Show>
      </div>
    </div>
  );
}

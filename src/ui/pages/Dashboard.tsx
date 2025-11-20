import { createSignal, onMount, createMemo, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Plus,
  MapPin,
  Skull,
  Trash2,
} from "lucide-solid";
import type { Session } from "../../core/types/Session";
import { SessionService } from "../../core/services/SessionService";
import { GPSService } from "../../core/services/GPSService";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { StatCard } from "../components/molecules/StatCard";

export function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = createSignal<Session[]>([]);

  // Load sessions from database on mount
  onMount(async () => {
    if (window.electron?.session) {
      try {
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions);

        // Debug: Log session stats to diagnose missing data
        console.log("[Dashboard] Loaded sessions:", loadedSessions.length);
        loadedSessions.forEach((s, i) => {
          console.log(`[Dashboard] Session ${i + 1}:`, {
            name: s.name,
            hasLoadout: !!s.loadoutId,
            loadoutId: s.loadoutId,
            events: s.events.length,
            lootEvents: s.events.filter((e) => e.type === "LOOT_RECEIVED")
              .length,
            totalShots: s.stats.totalShots,
            totalLootValue: s.stats.totalLootTTValue,
            totalAmmoCost: s.stats.totalAmmoCost,
            profit: s.stats.profit,
          });
        });
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    }
  });

  // Create a demo session with realistic hunting data
  const createDemoSession = async () => {
    let newSession = SessionService.create(
      "demo-user",
      `Demo Hunt #${sessions().length + 1}`
    );

    const startTime = Date.now();
    let eventTime = startTime;

    // Simulate 5 minutes of hunting with 100 shots
    for (let i = 0; i < 100; i++) {
      // Shot fired
      newSession = SessionService.addEvent(newSession, {
        id: crypto.randomUUID(),
        timestamp: eventTime,
        sessionId: newSession.id,
        userId: "demo-user",
        type: "SHOT_FIRED",
        payload: {
          weaponId: "opalo",
          ammoUsed: 0.05,
          ammoCost: 0.5,
        },
      });

      eventTime += 500; // 0.5 seconds between shots

      // 75% hit rate
      if (Math.random() < 0.75) {
        const damage = 40 + Math.random() * 30; // 40-70 damage
        const isCritical = Math.random() < 0.15; // 15% critical rate

        newSession = SessionService.addEvent(newSession, {
          id: crypto.randomUUID(),
          timestamp: eventTime,
          sessionId: newSession.id,
          userId: "demo-user",
          type: "HIT_REGISTERED",
          payload: {
            damage: isCritical ? damage * 2 : damage,
            critical: isCritical,
          },
        });
      } else {
        // Miss
        newSession = SessionService.addEvent(newSession, {
          id: crypto.randomUUID(),
          timestamp: eventTime,
          sessionId: newSession.id,
          userId: "demo-user",
          type: "MISS_REGISTERED",
          payload: {
            weaponId: "opalo",
          },
        });
      }

      eventTime += 500;

      // Kill every 20 shots on average
      if (i > 0 && i % 20 === 0) {
        newSession = SessionService.addEvent(newSession, {
          id: crypto.randomUUID(),
          timestamp: eventTime,
          sessionId: newSession.id,
          userId: "demo-user",
          type: "MOB_KILLED",
          payload: {
            mobName: "Atrox",
            mobId: `atrox_${i}`,
            location: { lon: 0, lat: 0 },
          },
        });

        eventTime += 1000;

        // Loot after kill (50% chance)
        if (Math.random() < 0.5) {
          const lootValue = 5 + Math.random() * 20; // 5-25 PED
          newSession = SessionService.addEvent(newSession, {
            id: crypto.randomUUID(),
            timestamp: eventTime,
            sessionId: newSession.id,
            userId: "demo-user",
            type: "LOOT_RECEIVED",
            payload: {
              items: [
                {
                  name: "Shrapnel",
                  quantity: Math.floor(lootValue * 100),
                  ttValue: lootValue,
                  mvValue: lootValue,
                },
              ],
              totalTTValue: lootValue,
              totalMVValue: lootValue,
              isGlobal: lootValue > 50,
            },
          });
        }

        eventTime += 500;
      }

      // Take damage occasionally (30% chance)
      if (Math.random() < 0.3) {
        const incomingDamage = 10 + Math.random() * 20;

        if (Math.random() < 0.2) {
          // Dodge
          newSession = SessionService.addEvent(newSession, {
            id: crypto.randomUUID(),
            timestamp: eventTime,
            sessionId: newSession.id,
            userId: "demo-user",
            type: "DODGE_REGISTERED",
            payload: {
              mobId: "atrox_attacker",
            },
          });
        } else {
          // Take hit
          newSession = SessionService.addEvent(newSession, {
            id: crypto.randomUUID(),
            timestamp: eventTime,
            sessionId: newSession.id,
            userId: "demo-user",
            type: "HIT_TAKEN" as const,
            payload: {
              damage: incomingDamage,
              mobName: "Atrox",
              inVehicle: false,
            },
          });
        }
      }
    }

    newSession = SessionService.end(newSession);

    // Save to database
    if (window.electron?.session) {
      try {
        await window.electron.session.save(newSession);
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions);
      } catch (error) {
        console.error("Failed to save session:", error);
        setSessions([...sessions(), newSession]);
      }
    } else {
      setSessions([...sessions(), newSession]);
    }
  };

  // Generate mock test sessions (temporarily disabled)
  const generateMockSessions = async () => {
    alert(
      "Mock session generation temporarily disabled. Use Active Session page to create real sessions."
    );
  };

  // Clear all sessions
  const clearAllSessions = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL sessions? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      // Delete all sessions individually
      if (window.electron?.session) {
        const allSessions = sessions();
        for (const session of allSessions) {
          await window.electron.session.delete(session.id);
        }
      }
      setSessions([]);

      // Clear in-memory session state
      const { setActiveSession, setIsSessionActive } = await import(
        "../stores/sessionStore"
      );
      setActiveSession(null);
      setIsSessionActive(false);
      console.log("[Dashboard] ✅ Cleared all sessions and in-memory state");
    } catch (error) {
      console.error("Failed to clear sessions:", error);
    }
  };

  // Calculate aggregate stats
  const totalProfit = () =>
    sessions().reduce((sum, s) => sum + s.stats.profit, 0);
  const avgProfitPerHour = () => {
    const totalDuration = sessions().reduce((sum, s) => sum + s.duration, 0);
    return totalDuration > 0 ? (totalProfit() / totalDuration) * 3600 : 0;
  };
  const totalSessions = () => sessions().length;
  const totalKills = () =>
    sessions().reduce((sum, s) => sum + s.stats.totalKills, 0);

  // Extended statistics
  const totalShots = () =>
    sessions().reduce((sum, s) => sum + s.stats.totalShots, 0);
  const totalHits = () =>
    sessions().reduce((sum, s) => sum + s.stats.totalHits, 0);
  const overallAccuracy = () =>
    totalShots() > 0 ? (totalHits() / totalShots()) * 100 : 0;
  const totalDamage = () =>
    sessions().reduce((sum, s) => sum + (s.stats.totalDamageDealt || 0), 0);
  const totalLootValue = () =>
    sessions().reduce((sum, s) => sum + (s.stats.totalLootTTValue || 0), 0);
  const totalAmmoCost = () =>
    sessions().reduce((sum, s) => sum + s.stats.totalAmmoCost, 0);
  const overallReturnRate = () =>
    totalAmmoCost() > 0 ? (totalLootValue() / totalAmmoCost()) * 100 : 0;
  const totalHuntingTime = () =>
    sessions().reduce((sum, s) => sum + s.duration, 0);
  const bestSession = createMemo(() => {
    if (sessions().length === 0) return null;
    return sessions().reduce((best, s) =>
      s.stats.profit > best.stats.profit ? s : best
    );
  });
  const worstSession = createMemo(() => {
    if (sessions().length === 0) return null;
    return sessions().reduce((worst, s) =>
      s.stats.profit < worst.stats.profit ? s : worst
    );
  });

  // Mob statistics
  const mobKills = createMemo(() => {
    const mobCounts: Record<string, number> = {};
    let totalMobEvents = 0;
    let unknownCount = 0;

    sessions().forEach((session) => {
      session.events
        .filter((e) => e.type === "MOB_KILLED")
        .forEach((e) => {
          totalMobEvents++;
          const mobName = e.payload.mobName;
          console.log("[Dashboard] MOB_KILLED event:", mobName, e.payload);

          // Skip "Unknown Creature" entries
          if (mobName && mobName !== "Unknown Creature") {
            mobCounts[mobName] = (mobCounts[mobName] || 0) + 1;
          } else {
            unknownCount++;
          }
        });
    });

    console.log("[Dashboard] Mob Stats:", {
      totalEvents: totalMobEvents,
      unknownCount,
      identifiedMobs: Object.keys(mobCounts).length,
      mobCounts,
    });

    return Object.entries(mobCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  const favoriteMobs = createMemo(() => mobKills().slice(0, 5));

  // Favorite loadout (most used)
  const favoriteLoadout = createMemo(() => {
    const loadoutUsage: Record<
      string,
      { name: string; count: number; totalPED: number }
    > = {};
    sessions().forEach((session) => {
      if (session.loadoutId) {
        const loadoutName = session.loadoutId; // Could be enhanced to fetch actual loadout name
        if (!loadoutUsage[session.loadoutId]) {
          loadoutUsage[session.loadoutId] = {
            name: loadoutName,
            count: 0,
            totalPED: 0,
          };
        }
        loadoutUsage[session.loadoutId].count++;
        loadoutUsage[session.loadoutId].totalPED +=
          session.stats.totalAmmoCost || 0;
      }
    });
    const sortedLoadouts = Object.values(loadoutUsage).sort(
      (a, b) => b.count - a.count
    );
    return sortedLoadouts.length > 0 ? sortedLoadouts[0] : null;
  });

  // Best loot
  const bestLoots = createMemo(() => {
    const loots: Array<{
      value: number;
      items: any[];
      sessionName: string;
      timestamp: number;
    }> = [];
    sessions().forEach((session) => {
      session.events
        .filter((e) => e.type === "LOOT_RECEIVED")
        .forEach((e) => {
          const lootValue = e.payload.totalTTValue || 0;
          if (lootValue > 0) {
            loots.push({
              value: lootValue,
              items: e.payload.items,
              sessionName: session.name,
              timestamp: e.timestamp,
            });
          }
        });
    });
    return loots.sort((a, b) => b.value - a.value).slice(0, 5);
  });

  // GPS Analytics
  const huntingZones = createMemo(() =>
    GPSService.createHuntingZones(sessions())
  );
  const topProfitableZones = createMemo(() =>
    GPSService.getMostProfitableZones(huntingZones(), 3)
  );
  const topDangerousZones = createMemo(() =>
    GPSService.getMostDangerousZones(huntingZones(), 3)
  );

  // Check if sessions are missing loadout data (causes zero costs)
  const sessionsWithoutLoadout = createMemo(() =>
    sessions().filter((s) => !s.loadoutId && s.stats.totalShots > 0)
  );
  const hasDataIssues = createMemo(
    () => totalAmmoCost() === 0 && totalShots() > 0
  );
  const hasLootIssues = createMemo(
    () => totalLootValue() === 0 && totalKills() > 0
  );

  return (
    <div class="p-8">
      <div class="max-w-7xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold text-primary tracking-tight">
              Dashboard
            </h1>
            <p class="text-primary/60 mt-1">Hunting Session Analytics</p>
          </div>
          <div class="flex gap-3">
            <Button
              icon={Trash2}
              onClick={clearAllSessions}
              variant="secondary"
              disabled={sessions().length === 0}
            >
              Clear All
            </Button>
            <Button onClick={() => navigate("/active")} variant="primary">
              Start Hunt
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <Card class="mb-8">
          <h2 class="text-xl font-semibold mb-4 text-primary">
            Hunter Profile
          </h2>

          {/* Warning: Missing Loadout Data */}
          <Show when={hasDataIssues()}>
            <div class="mb-4 p-4 bg-warning/10 border border-warning rounded-lg">
              <div class="flex items-start gap-3">
                <div class="text-warning mt-0.5">⚠️</div>
                <div class="flex-1">
                  <h4 class="font-semibold text-warning mb-1">
                    Missing Loadout Data
                  </h4>
                  <p class="text-sm text-warning/80 mb-2">
                    {sessionsWithoutLoadout().length} session(s) recorded
                    without a loadout selected. Without loadout data, ammo costs
                    cannot be calculated, which causes profit/return rate to be
                    inaccurate.
                  </p>
                  <p class="text-sm text-warning/80">
                    <strong>Tip:</strong> Always select a loadout before
                    starting a hunt to track costs accurately. Go to{" "}
                    <span class="text-primary font-semibold">Loadouts</span>{" "}
                    page to create your gear setup.
                  </p>
                </div>
              </div>
            </div>
          </Show>

          {/* Warning: Missing Loot Data */}
          <Show when={hasLootIssues()}>
            <div class="mb-4 p-4 bg-danger/10 border border-danger rounded-lg">
              <div class="flex items-start gap-3">
                <div class="text-danger mt-0.5">❌</div>
                <div class="flex-1">
                  <h4 class="font-semibold text-danger mb-1">
                    No Loot Detected
                  </h4>
                  <p class="text-sm text-danger/80 mb-2">
                    You have {totalKills()} kills but no loot records. This
                    likely means ARTEMIS couldn't detect loot messages in your
                    chat.log.
                  </p>
                  <p class="text-sm text-danger/80">
                    <strong>Possible causes:</strong> Log file not found, log
                    watcher not running, or loot messages disabled in-game.
                    Check console logs for errors.
                  </p>
                </div>
              </div>
            </div>
          </Show>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={totalProfit() >= 0 ? TrendingUp : TrendingDown}
              label="Total Profit"
              value={`${totalProfit().toFixed(2)} PED`}
              positive={totalProfit() >= 0}
            />
            <StatCard
              icon={DollarSign}
              label="Avg PED/Hour"
              value={`${avgProfitPerHour().toFixed(1)}`}
              positive={avgProfitPerHour() >= 0}
            />
            <StatCard
              icon={Target}
              label="Total Sessions"
              value={totalSessions().toString()}
            />
            <StatCard
              icon={Skull}
              label="Total Kills"
              value={totalKills().toString()}
            />
          </div>
        </Card>

        {/* Extended Statistics */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Combat Stats */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target size={20} class="text-primary" />
              Combat Statistics
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Total Shots</span>
                <span class="font-mono font-bold text-white">
                  {totalShots().toLocaleString()}
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Total Hits</span>
                <span class="font-mono font-bold text-white">
                  {totalHits().toLocaleString()}
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Overall Accuracy</span>
                <span class="font-mono font-bold text-primary">
                  {overallAccuracy().toFixed(1)}%
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Total Damage</span>
                <span class="font-mono font-bold text-danger">
                  {totalDamage().toLocaleString()} HP
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Hunting Time</span>
                <span class="font-mono font-bold text-white">
                  {Math.floor(totalHuntingTime() / 3600)}h{" "}
                  {Math.floor((totalHuntingTime() % 3600) / 60)}m
                </span>
              </div>
            </div>
          </Card>

          {/* Economy Stats */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={20} class="text-primary" />
              Economy Overview
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Total Loot Value</span>
                <span class="font-mono font-bold text-success">
                  {totalLootValue().toFixed(2)} PED
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Total Ammo Cost</span>
                <span class="font-mono font-bold text-danger">
                  {totalAmmoCost().toFixed(2)} PED
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Overall Return Rate</span>
                <span
                  class={`font-mono font-bold ${overallReturnRate() >= 90 ? "text-success" : overallReturnRate() >= 70 ? "text-warning" : "text-danger"}`}
                >
                  {overallReturnRate().toFixed(1)}%
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Best Session</span>
                <span class="font-mono font-bold text-success">
                  {bestSession()
                    ? `+${bestSession()!.stats.profit.toFixed(2)} PED`
                    : "N/A"}
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Worst Session</span>
                <span class="font-mono font-bold text-danger">
                  {worstSession()
                    ? `${worstSession()!.stats.profit.toFixed(2)} PED`
                    : "N/A"}
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg">
                <span class="text-primary/60">Favorite Loadout</span>
                <span class="font-mono font-bold text-primary">
                  {favoriteLoadout()
                    ? `${favoriteLoadout()!.count}x sessions`
                    : "N/A"}
                </span>
              </div>
            </div>
          </Card>

          {/* Favorite Mobs */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Skull size={20} class="text-primary" />
              Favorite Mobs
            </h3>
            <div class="space-y-2">
              <Show
                when={favoriteMobs().length > 0}
                fallback={
                  <p class="text-primary/40 text-sm text-center py-4">
                    No mob data yet
                  </p>
                }
              >
                <For each={favoriteMobs()}>
                  {(mob, index) => (
                    <div class="flex justify-between items-center p-3 bg-background-lighter rounded-lg border border-primary/10">
                      <div class="flex items-center gap-3">
                        <span class="text-primary/40 font-mono text-sm">
                          #{index() + 1}
                        </span>
                        <span class="text-white font-medium">{mob.name}</span>
                      </div>
                      <span class="font-mono font-bold text-primary">
                        {mob.count} kills
                      </span>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Card>

          {/* Best Loots */}
          <Card>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={20} class="text-primary" />
              Best Loots
            </h3>
            <div class="space-y-2">
              <Show
                when={bestLoots().length > 0}
                fallback={
                  <p class="text-primary/40 text-sm text-center py-4">
                    No loot data yet
                  </p>
                }
              >
                <For each={bestLoots()}>
                  {(loot, index) => (
                    <div class="p-3 bg-background-lighter rounded-lg border border-primary/10">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-mono font-bold text-success">
                          {loot.value.toFixed(2)} PED
                        </span>
                        <span class="text-primary/40 font-mono text-xs">
                          #{index() + 1}
                        </span>
                      </div>
                      <div class="text-xs text-primary/60">
                        {loot.sessionName} •{" "}
                        {new Date(loot.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Card>
        </div>

        {/* GPS Analytics Section */}
        {huntingZones().length > 0 && (
          <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-2xl font-semibold flex items-center gap-2">
                <MapPin size={24} />
                GPS Analytics
              </h2>
              <Button onClick={() => navigate("/gps")} variant="ghost">
                View All Zones →
              </Button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Profitable Zones */}
              <Card>
                <div class="flex items-center gap-2 mb-4">
                  <TrendingUp class="text-green-500" size={20} />
                  <h3 class="text-lg font-semibold">Most Profitable Zones</h3>
                </div>
                <div class="space-y-3">
                  {topProfitableZones().map((zone) => (
                    <div class="bg-gray-800 p-3 rounded border border-gray-700">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-mono text-gray-400">
                          {zone.center.lon.toFixed(0)},{" "}
                          {zone.center.lat.toFixed(0)}
                        </span>
                        <span class="text-xs text-gray-500">
                          {zone.sessionCount} visits
                        </span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-green-500 font-semibold">
                          +{zone.avgProfitPerHour.toFixed(2)} PED/h
                        </span>
                        <span class="text-sm text-gray-400">
                          {(zone.avgAccuracy * 100).toFixed(1)}% accuracy
                        </span>
                      </div>
                    </div>
                  ))}
                  {topProfitableZones().length === 0 && (
                    <p class="text-gray-500 text-sm">
                      No profitable zones yet. Keep hunting!
                    </p>
                  )}
                </div>
              </Card>

              {/* Top Dangerous Zones */}
              <Card>
                <div class="flex items-center gap-2 mb-4">
                  <Skull class="text-red-500" size={20} />
                  <h3 class="text-lg font-semibold">Most Dangerous Zones</h3>
                </div>
                <div class="space-y-3">
                  {topDangerousZones().map((zone) => (
                    <div class="bg-gray-800 p-3 rounded border border-red-900">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-mono text-gray-400">
                          {zone.center.lon.toFixed(0)},{" "}
                          {zone.center.lat.toFixed(0)}
                        </span>
                        <span class="text-xs text-gray-500">
                          {zone.sessionCount} visits
                        </span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-red-500 font-semibold">
                          {(zone.dangerLevel * 100).toFixed(0)}% danger
                        </span>
                        <span class="text-sm text-orange-500">
                          {zone.deathCount} deaths
                        </span>
                      </div>
                    </div>
                  ))}
                  {topDangerousZones().length === 0 && (
                    <p class="text-gray-500 text-sm">
                      No dangerous zones identified yet.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => navigate("/sessions")}
              variant="outline"
              class="flex items-center justify-center gap-2 py-6"
            >
              View All Sessions →
            </Button>
            <Button
              onClick={() => navigate("/active")}
              class="flex items-center justify-center gap-2 py-6"
            >
              <Plus size={20} />
              Start New Session
            </Button>
            <Button
              onClick={() => navigate("/gps")}
              variant="outline"
              class="flex items-center justify-center gap-2 py-6"
            >
              <MapPin size={20} />
              GPS Analytics
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

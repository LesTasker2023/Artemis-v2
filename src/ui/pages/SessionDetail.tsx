import { createSignal, onMount, Show, For, createMemo } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  Trash2,
  MapPin,
  Zap,
  Crosshair,
  Trophy,
} from "lucide-solid";
import type { Session } from "../../core/types/Session";
import type { Coordinate } from "../../core/types/GPS";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { Badge } from "../components/atoms/Badge";
import { StatCard } from "../components/molecules/StatCard";
import { InteractiveMapView } from "../components/map/InteractiveMapView";
import { Line, Bar, Doughnut } from "solid-chartjs";
import type { ChartData, ChartOptions } from "chart.js";
import { getGradient, generateColors } from "../config/chartConfig";

export function SessionDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const sessionId = params.id;
    if (!sessionId) {
      console.error("No session ID provided");
      setLoading(false);
      return;
    }

    if (window.electron?.session) {
      try {
        const loadedSession = await window.electron.session.findById(sessionId);
        setSession(loadedSession);
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  });

  const deleteSession = async () => {
    if (!session() || !window.electron?.session) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${session()!.name}"?`
    );
    if (!confirmed) return;

    try {
      await window.electron.session.delete(session()!.id);
      navigate("/");
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Extract GPS data from session events
  const killLocations = createMemo(() => {
    if (!session()) return [];
    return (
      session()!
        .events.filter((e) => e.type === "MOB_KILLED")
        .map((e) => ({
          location: e.payload.location,
          mobName: e.payload.mobName,
          timestamp: e.timestamp,
        }))
        // Filter out invalid GPS coordinates (0,0) which indicate no GPS data was available
        .filter((kill) => kill.location.lon !== 0 || kill.location.lat !== 0)
    );
  });

  const deathLocations = createMemo(() => {
    if (!session()) return [];
    return session()!
      .events.filter((e) => e.type === "PLAYER_DEATH")
      .map((e) => ({
        location: e.payload.location,
        timestamp: e.timestamp,
      }));
  });

  const gpsPath = createMemo(() => {
    if (!session()) return [];
    return session()!
      .events.filter((e) => e.type === "GPS_UPDATE")
      .map((e) => e.payload.location as Coordinate)
      .filter((loc) => loc && loc.lon && loc.lat);
  });

  const hasGPSData = createMemo(() => {
    return (
      killLocations().length > 0 ||
      deathLocations().length > 0 ||
      gpsPath().length > 0
    );
  });

  // Chart: Profit Over Time
  const profitOverTimeData = createMemo<ChartData<"line">>(() => {
    if (!session()) return { labels: [], datasets: [] };

    const sess = session()!;

    // Get all events with timestamps
    const lootEvents = sess.events.filter((e) => e.type === "LOOT_RECEIVED");

    if (lootEvents.length === 0 && sess.stats.totalShots === 0) {
      return { labels: [], datasets: [] };
    }

    // Use session totals for accurate cost calculation
    const totalCost = sess.stats.totalAmmoCost || 0;
    const totalShots = sess.stats.totalShots || 1;

    // Group data into 5-minute buckets
    const sessionDuration = sess.duration;
    const bucketMinutes = 5;
    // Ensure we always have at least enough buckets to cover the full session
    const numBuckets = Math.max(
      1,
      Math.ceil(sessionDuration / 60 / bucketMinutes)
    );

    // Calculate actual session end time
    const sessionEndTime =
      sess.endTime || sess.startTime + sessionDuration * 1000;

    // Distribute cost evenly across time (shots happen throughout session)
    const costPerBucket = totalCost / numBuckets;

    const buckets: Array<{
      time: string;
      loot: number;
      cumulativeLoot: number;
      cumulativeCost: number;
      profit: number;
    }> = [];

    let cumulativeLoot = 0;
    let cumulativeCost = 0;

    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = sess.startTime + i * bucketMinutes * 60 * 1000;
      // Make sure the last bucket extends to session end
      const bucketEnd = Math.min(
        bucketStart + bucketMinutes * 60 * 1000,
        sessionEndTime
      );

      // Count loot in this bucket
      const bucketLoot = lootEvents
        .filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd)
        .reduce((sum, e) => sum + (e.payload.totalTTValue || 0), 0);

      cumulativeLoot += bucketLoot;
      cumulativeCost += costPerBucket;

      buckets.push({
        time: `${i * bucketMinutes}m`,
        loot: bucketLoot,
        cumulativeLoot,
        cumulativeCost,
        profit: cumulativeLoot - cumulativeCost,
      });
    }

    return {
      labels: buckets.map((b) => b.time),
      datasets: [
        {
          label: "Profit",
          data: buckets.map((b) => b.profit),
          borderColor: "#22c55e",
          backgroundColor: (context) => getGradient(context, "#22c55e"),
          fill: true,
          tension: 0.4,
        },
        {
          label: "Total Loot",
          data: buckets.map((b) => b.cumulativeLoot),
          borderColor: "#3b82f6",
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        },
        {
          label: "Total Cost",
          data: buckets.map((b) => b.cumulativeCost),
          borderColor: "#ef4444",
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        },
      ],
    };
  });

  const profitOverTimeOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${context.parsed.y.toFixed(2)} PED`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#374151" },
        ticks: { callback: (value) => `${value} PED` },
      },
      x: {
        grid: { display: false },
      },
    },
    elements: {
      line: {
        borderWidth: 2,
      },
      point: {
        radius: 3,
        hitRadius: 8,
        hoverRadius: 5,
      },
    },
  };

  // Chart: Damage Distribution
  const damageDistributionData = createMemo<ChartData<"bar">>(() => {
    if (!session()) return { labels: [], datasets: [] };

    const hitEvents = session()!.events.filter(
      (e) => e.type === "HIT_REGISTERED"
    );
    if (hitEvents.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Group damage into ranges
    const ranges = [
      { label: "0-10", min: 0, max: 10, count: 0 },
      { label: "11-25", min: 11, max: 25, count: 0 },
      { label: "26-50", min: 26, max: 50, count: 0 },
      { label: "51-100", min: 51, max: 100, count: 0 },
      { label: "100+", min: 101, max: Infinity, count: 0 },
    ];

    hitEvents.forEach((e) => {
      const damage = e.payload.damage;
      const range = ranges.find((r) => damage >= r.min && damage <= r.max);
      if (range) range.count++;
    });

    return {
      labels: ranges.map((r) => r.label),
      datasets: [
        {
          label: "Hit Count",
          data: ranges.map((r) => r.count),
          backgroundColor: "#3b82f6",
          borderColor: "#2563eb",
          borderWidth: 1,
        },
      ],
    };
  });

  const damageDistributionOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} hits`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#374151" },
        ticks: { stepSize: 1 },
      },
      x: { grid: { display: false } },
    },
  };

  // Chart: Combat Performance (Hits/Misses/Criticals)
  const combatPerformanceData = createMemo<ChartData<"doughnut">>(() => {
    if (!session()) return { labels: [], datasets: [] };

    const stats = session()!.stats;

    // Calculate misses from total shots if not provided
    const totalHits = stats.totalHits || 0;
    const totalCriticals = stats.totalCriticals || 0;
    const totalShots = stats.totalShots || 0;
    const totalMisses = stats.totalMisses || totalShots - totalHits;

    // Debug logging
    console.log("Combat Performance Chart Data:", {
      totalShots,
      totalHits,
      calculatedMisses: totalMisses,
      totalCriticals,
      chartData: [totalHits, totalMisses, totalCriticals],
    });

    return {
      labels: ["Hits", "Misses", "Criticals"],
      datasets: [
        {
          data: [totalHits, totalMisses, totalCriticals],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
          borderColor: "#1f2937",
          borderWidth: 2,
        },
      ],
    };
  });

  const combatPerformanceOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.label}: ${context.parsed} (${((context.parsed / (session()!.stats.totalShots || 1)) * 100).toFixed(1)}%)`,
        },
      },
    },
  };

  // Chart: Mob Kills Timeline
  const mobKillsTimelineData = createMemo<ChartData<"bar">>(() => {
    if (!session()) return { labels: [], datasets: [] };

    const killEvents = session()!.events.filter((e) => e.type === "MOB_KILLED");
    if (killEvents.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Group kills by 5-minute intervals
    const sessionDuration = session()!.duration;
    const intervalMinutes = 5;
    const intervals = Math.ceil(sessionDuration / 60 / intervalMinutes);
    const buckets = Array(intervals).fill(0);

    killEvents.forEach((e) => {
      const minutesElapsed = Math.floor(
        (e.timestamp - session()!.startTime) / 60000
      );
      const bucketIndex = Math.floor(minutesElapsed / intervalMinutes);
      if (bucketIndex < buckets.length) {
        buckets[bucketIndex]++;
      }
    });

    return {
      labels: buckets.map(
        (_, i) => `${i * intervalMinutes}-${(i + 1) * intervalMinutes}m`
      ),
      datasets: [
        {
          label: "Kills",
          data: buckets,
          backgroundColor: "#10b981",
          borderColor: "#059669",
          borderWidth: 1,
        },
      ],
    };
  });

  const mobKillsTimelineOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} kills`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#374151" },
        ticks: { stepSize: 1 },
      },
      x: { grid: { display: false } },
    },
  };

  // Mob breakdown
  const mobBreakdown = createMemo(() => {
    if (!session()) return [];

    const mobStats: Record<string, { kills: number; damage: number }> = {};

    session()!.events.forEach((e) => {
      if (e.type === "MOB_KILLED") {
        const mobName = e.payload.mobName;
        if (!mobStats[mobName]) {
          mobStats[mobName] = { kills: 0, damage: 0 };
        }
        mobStats[mobName].kills++;
      }
    });

    return Object.entries(mobStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.kills - a.kills);
  });

  // Chart: Skills vs Loot Over Time
  const skillsVsLootData = createMemo<ChartData<"line">>(() => {
    if (!session()) return { labels: [], datasets: [] };

    const sess = session()!;
    const lootEvents = sess.events.filter((e) => e.type === "LOOT_RECEIVED");
    const skillEvents = sess.events.filter((e) => e.type === "SKILL_GAIN");

    if (lootEvents.length === 0 && skillEvents.length === 0) {
      return { labels: [], datasets: [] };
    }

    // Group into 5-minute buckets
    const bucketMinutes = 5;
    const numBuckets = Math.ceil(sess.duration / 60 / bucketMinutes) || 1;

    // Calculate cost per bucket for profit calculation
    const totalCost = sess.stats.totalAmmoCost || 0;
    const costPerBucket = totalCost / numBuckets;

    const buckets: Array<{
      time: string;
      profit: number;
      skills: number;
    }> = [];

    let cumulativeLoot = 0;
    let cumulativeCost = 0;

    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = sess.startTime + i * bucketMinutes * 60 * 1000;
      const bucketEnd = bucketStart + bucketMinutes * 60 * 1000;

      const bucketLoot = lootEvents
        .filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd)
        .reduce((sum, e) => sum + (e.payload.totalTTValue || 0), 0);

      const bucketSkills = skillEvents
        .filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd)
        .reduce((sum, e) => sum + (e.payload.gainAmount || 0), 0);

      cumulativeLoot += bucketLoot;
      cumulativeCost += costPerBucket;

      buckets.push({
        time: `${i * bucketMinutes}m`,
        profit: cumulativeLoot - cumulativeCost,
        skills: bucketSkills,
      });
    }

    return {
      labels: buckets.map((b) => b.time),
      datasets: [
        {
          label: "Profit (PED)",
          data: buckets.map((b) => b.profit),
          borderColor: "#22c55e",
          backgroundColor: (context) => getGradient(context, "#22c55e"),
          fill: true,
          tension: 0.4,
          yAxisID: "y",
        },
        {
          label: "Skill Gains",
          data: buckets.map((b) => b.skills),
          borderColor: "#8b5cf6",
          backgroundColor: (context) => getGradient(context, "#8b5cf6"),
          fill: true,
          tension: 0.4,
          yAxisID: "y1",
        },
      ],
    };
  });

  const skillsVsLootOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y.toFixed(2);
            return context.datasetIndex === 0
              ? `${label}: ${value} PED`
              : `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        title: {
          display: true,
          text: "Profit (PED)",
          color: "#22c55e",
        },
        grid: { color: "#374151" },
        ticks: { color: "#22c55e" },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        title: {
          display: true,
          text: "Skill Gains",
          color: "#8b5cf6",
        },
        grid: { display: false },
        ticks: { color: "#8b5cf6" },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  return (
    <div class="p-8">
      <div class="max-w-7xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold text-primary tracking-tight">
              {session()?.name || "Loading..."}
            </h1>
            <Show when={session()}>
              <p class="text-primary/60 mt-1">
                {formatDate(session()!.startTime)}
              </p>
            </Show>
          </div>
          <Show when={session()}>
            <Button
              icon={Trash2}
              onClick={deleteSession}
              variant="danger"
              size="sm"
              aria-label="Delete session"
            >
              Delete
            </Button>
          </Show>
        </div>

        <Show when={loading()}>
          <div class="text-center text-gray-400 py-20">Loading session...</div>
        </Show>

        <Show when={!loading() && !session()}>
          <div class="text-center text-gray-400 py-20">Session not found</div>
        </Show>

        <Show when={session()}>
          <div class="space-y-6">
            {/* Tags */}
            <div class="flex gap-2 flex-wrap">
              <For each={session()!.tags}>
                {(tag) => <Badge variant="info">{tag}</Badge>}
              </For>
            </div>

            {/* Stats Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={DollarSign}
                label="Profit"
                value={`${(session()!.stats.profit || 0).toFixed(2)} PED`}
                positive={(session()!.stats.profit || 0) > 0}
              />
              <StatCard
                icon={TrendingUp}
                label="PED/Hour"
                value={(session()!.stats.profitPerHour || 0).toFixed(2)}
                positive={(session()!.stats.profitPerHour || 0) > 0}
              />
              <StatCard
                icon={Target}
                label="Accuracy"
                value={`${((session()!.stats.accuracy || 0) * 100).toFixed(1)}%`}
              />
              <StatCard
                icon={Clock}
                label="Duration"
                value={formatDuration(session()!.duration)}
              />
              <StatCard
                icon={Trophy}
                label="Total Kills"
                value={session()!.stats.totalKills.toString()}
              />
            </div>

            {/* Detailed Stats */}
            <Card
              header={<h2 class="text-xl font-semibold">Combat Statistics</h2>}
            >
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <div class="text-gray-400 text-sm">Total Shots</div>
                  <div class="text-2xl font-bold">
                    {session()!.stats.totalShots || 0}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Hits</div>
                  <div class="text-2xl font-bold text-green-500">
                    {session()!.stats.totalHits || 0}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Misses</div>
                  <div class="text-2xl font-bold text-red-500">
                    {session()!.stats.totalMisses || 0}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Criticals</div>
                  <div class="text-2xl font-bold text-yellow-500">
                    {session()!.stats.totalCriticals || 0}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Kills</div>
                  <div class="text-2xl font-bold">
                    {session()!.stats.totalKills || 0}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Damage Dealt</div>
                  <div class="text-2xl font-bold">
                    {(session()!.stats.totalDamageDealt || 0).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Avg Damage/Hit</div>
                  <div class="text-2xl font-bold text-blue-400">
                    {session()!.stats.totalHits > 0
                      ? (
                          (session()!.stats.totalDamageDealt || 0) /
                          session()!.stats.totalHits
                        ).toFixed(1)
                      : "0"}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Loot Value</div>
                  <div class="text-2xl font-bold text-green-500">
                    {(session()!.stats.totalLootTTValue || 0).toFixed(2)} PED
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Ammo Cost</div>
                  <div class="text-2xl font-bold text-red-500">
                    {(session()!.stats.totalAmmoCost || 0).toFixed(2)} PED
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Return Rate</div>
                  <div class="text-2xl font-bold">
                    {((session()!.stats.returnRate || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </Card>

            {/* Mob Breakdown */}
            <Show when={mobBreakdown().length > 0}>
              <Card
                header={<h2 class="text-xl font-semibold">Mob Breakdown</h2>}
              >
                <div class="space-y-2">
                  <For each={mobBreakdown()}>
                    {(mob) => (
                      <div class="flex items-center justify-between p-3 bg-surface-dark rounded-lg hover:bg-surface-hover transition-colors">
                        <div class="flex items-center gap-3">
                          <Zap size={18} class="text-primary" />
                          <span class="font-medium">{mob.name}</span>
                        </div>
                        <div class="flex items-center gap-6">
                          <div class="text-right">
                            <div class="text-sm text-gray-400">Kills</div>
                            <div class="text-lg font-bold">{mob.kills}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Card>
            </Show>

            {/* GPS Map */}
            <Show when={hasGPSData()}>
              <Card
                header={
                  <div class="flex items-center gap-2">
                    <MapPin size={20} class="text-primary" />
                    <h2 class="text-xl font-semibold">Hunting Map</h2>
                    <span class="text-sm text-primary/60 ml-2">
                      {killLocations().length} kills • {gpsPath().length} GPS
                      points
                      {deathLocations().length > 0 &&
                        ` • ${deathLocations().length} deaths`}
                    </span>
                  </div>
                }
              >
                <InteractiveMapView
                  zones={[]}
                  killLocations={killLocations()}
                  deathLocations={deathLocations()}
                  path={gpsPath()}
                  height="500px"
                />
              </Card>
            </Show>

            {/* Charts */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card
                header={<h2 class="text-xl font-semibold">Profit Over Time</h2>}
              >
                <Show
                  when={profitOverTimeData().labels.length > 0}
                  fallback={
                    <div class="h-64 flex items-center justify-center text-gray-400">
                      No economic data available
                    </div>
                  }
                >
                  <div class="h-64">
                    <Line
                      data={profitOverTimeData()}
                      options={profitOverTimeOptions}
                    />
                  </div>
                </Show>
              </Card>

              <Card
                header={
                  <h2 class="text-xl font-semibold">Combat Performance</h2>
                }
              >
                <Show
                  when={session()!.stats.totalShots > 0}
                  fallback={
                    <div class="h-64 flex items-center justify-center text-gray-400">
                      No combat data available
                    </div>
                  }
                >
                  <div class="h-64">
                    <Doughnut
                      data={combatPerformanceData()}
                      options={combatPerformanceOptions}
                    />
                  </div>
                </Show>
              </Card>

              <Card
                header={
                  <h2 class="text-xl font-semibold">Damage Distribution</h2>
                }
              >
                <Show
                  when={damageDistributionData().labels.length > 0}
                  fallback={
                    <div class="h-64 flex items-center justify-center text-gray-400">
                      No damage data available
                    </div>
                  }
                >
                  <div class="h-64">
                    <Bar
                      data={damageDistributionData()}
                      options={damageDistributionOptions}
                    />
                  </div>
                </Show>
              </Card>

              <Card
                header={<h2 class="text-xl font-semibold">Kills Timeline</h2>}
              >
                <Show
                  when={mobKillsTimelineData().labels.length > 0}
                  fallback={
                    <div class="h-64 flex items-center justify-center text-gray-400">
                      No kill data available
                    </div>
                  }
                >
                  <div class="h-64">
                    <Bar
                      data={mobKillsTimelineData()}
                      options={mobKillsTimelineOptions}
                    />
                  </div>
                </Show>
              </Card>
            </div>

            {/* Skills vs Loot Chart */}
            <Show when={skillsVsLootData().labels.length > 0}>
              <Card
                header={
                  <h2 class="text-xl font-semibold">
                    Skills vs Profit Over Time
                  </h2>
                }
              >
                <div class="h-80">
                  <Line
                    data={skillsVsLootData()}
                    options={skillsVsLootOptions}
                  />
                </div>
              </Card>
            </Show>

            {/* Event Timeline */}
            <Card
              header={<h2 class="text-xl font-semibold">Event Timeline</h2>}
            >
              <div class="space-y-2 max-h-96 overflow-y-auto">
                <Show
                  when={session()!.events.length > 0}
                  fallback={
                    <div class="text-gray-400 text-center py-4">
                      No events recorded
                    </div>
                  }
                >
                  <For each={session()!.events.slice(0, 50)}>
                    {(event) => (
                      <div class="flex items-center gap-3 p-2 hover:bg-gray-800 rounded">
                        <div class="text-gray-500 text-xs w-24">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                        <Badge
                          variant={
                            event.type === "LOOT_RECEIVED"
                              ? "success"
                              : event.type === "MOB_KILLED"
                                ? "warning"
                                : event.type === "GPS_UPDATE"
                                  ? "info"
                                  : event.type === "MISS_REGISTERED"
                                    ? "danger"
                                    : "neutral"
                          }
                        >
                          {event.type.replace(/_/g, " ")}
                        </Badge>
                        <div class="text-sm text-gray-300 flex-1">
                          {event.type === "HIT_REGISTERED" &&
                            `Damage: ${event.payload.damage.toFixed(1)}${
                              event.payload.critical ? " (Critical!)" : ""
                            }`}
                          {event.type === "LOOT_RECEIVED" &&
                            `+${event.payload.totalTTValue.toFixed(2)} PED`}
                          {event.type === "MOB_KILLED" &&
                            `Killed: ${event.payload.mobName}`}
                          {event.type === "SHOT_FIRED" &&
                            `Ammo: ${event.payload.ammoCost.toFixed(2)} PED`}
                          {event.type === "GPS_UPDATE" &&
                            `Location: ${event.payload.location.lon.toFixed(0)}, ${event.payload.location.lat.toFixed(0)}`}
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={session()!.events.length > 50}>
                    <div class="text-gray-500 text-sm text-center py-2">
                      ... and {session()!.events.length - 50} more events
                    </div>
                  </Show>
                </Show>
              </div>
            </Card>

            {/* Notes */}
            <Show when={session()!.notes}>
              <Card header={<h2 class="text-xl font-semibold">Notes</h2>}>
                <p class="text-gray-300">{session()!.notes}</p>
              </Card>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

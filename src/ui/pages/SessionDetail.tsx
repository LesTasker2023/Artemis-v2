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
} from "lucide-solid";
import type { Session } from "../../core/types/Session";
import type { Coordinate } from "../../core/types/GPS";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { Badge } from "../components/atoms/Badge";
import { StatCard } from "../components/molecules/StatCard";
import { ProfitChart } from "../components/molecules/ProfitChart";
import { AccuracyChart } from "../components/molecules/AccuracyChart";
import { InteractiveMapView } from "../components/map/InteractiveMapView";

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
    return session()!
      .events.filter((e) => e.type === "MOB_KILLED")
      .map((e) => ({
        location: e.payload.location,
        mobName: e.payload.mobName,
        timestamp: e.timestamp,
      }));
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
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>

            {/* Detailed Stats */}
            <Card
              header={<h2 class="text-xl font-semibold">Combat Statistics</h2>}
            >
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <div class="text-gray-400 text-sm">Total Shots</div>
                  <div class="text-2xl font-bold">
                    {session()!.stats.totalShots}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Hits</div>
                  <div class="text-2xl font-bold text-green-500">
                    {session()!.stats.totalHits}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Misses</div>
                  <div class="text-2xl font-bold text-red-500">
                    {session()!.stats.totalMisses}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Kills</div>
                  <div class="text-2xl font-bold">
                    {session()!.stats.totalKills}
                  </div>
                </div>
                <div>
                  <div class="text-gray-400 text-sm">Damage Dealt</div>
                  <div class="text-2xl font-bold">
                    {(session()!.stats.totalDamageDealt || 0).toFixed(0)}
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
                <ProfitChart session={session()!} />
              </Card>

              <Card
                header={
                  <h2 class="text-xl font-semibold">Combat Performance</h2>
                }
              >
                <AccuracyChart session={session()!} />
              </Card>
            </div>

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

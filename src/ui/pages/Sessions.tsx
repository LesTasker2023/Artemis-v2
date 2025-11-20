import { createSignal, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Plus, Clock, DollarSign, Target, TrendingUp } from "lucide-solid";
import type { Session } from "../../core/types/Session";
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";

export function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = createSignal<Session[]>([]);

  // Load sessions from database on mount
  onMount(async () => {
    if (window.electron?.session) {
      try {
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions.sort((a, b) => b.startTime - a.startTime));
        console.log("[Sessions] Loaded sessions:", loadedSessions.length);
      } catch (error) {
        console.error("[Sessions] Failed to load sessions:", error);
      }
    }
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-primary">Sessions</h1>
          <p class="text-primary/60 mt-1">
            View and manage all your hunting sessions
          </p>
        </div>

        <Button
          onClick={() => navigate("/active")}
          class="flex items-center gap-2"
        >
          <Plus size={18} />
          New Session
        </Button>
      </div>

      {/* Sessions List */}
      <Show
        when={sessions().length > 0}
        fallback={
          <Card>
            <div class="text-center py-12">
              <p class="text-primary/40 text-lg">No sessions yet</p>
              <p class="text-primary/30 text-sm mt-2">
                Start a new hunting session to begin tracking
              </p>
              <Button
                onClick={() => navigate("/active")}
                class="mt-6 flex items-center gap-2 mx-auto"
              >
                <Plus size={18} />
                Start First Session
              </Button>
            </div>
          </Card>
        }
      >
        <div class="grid gap-4">
          <For each={sessions()}>
            {(session) => (
              <Card
                onClick={() => navigate(`/session/${session.id}`)}
                class="cursor-pointer hover:border-primary/30 transition-all"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold text-white">
                      {session.name}
                    </h3>
                    <p class="text-sm text-primary/40 mt-1">
                      {formatDate(session.startTime)}
                    </p>
                  </div>

                  <div class="grid grid-cols-4 gap-6 ml-8">
                    {/* Duration */}
                    <div class="flex items-center gap-2">
                      <Clock size={16} class="text-primary/60" />
                      <div>
                        <div class="text-xs text-primary/40">Duration</div>
                        <div class="font-mono font-semibold text-white">
                          {formatDuration(session.duration)}
                        </div>
                      </div>
                    </div>

                    {/* Profit */}
                    <div class="flex items-center gap-2">
                      <DollarSign size={16} class={session.stats.profit >= 0 ? "text-green-500" : "text-red-500"} />
                      <div>
                        <div class="text-xs text-primary/40">Profit</div>
                        <div class={`font-mono font-semibold ${session.stats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {session.stats.profit.toFixed(2)} PED
                        </div>
                      </div>
                    </div>

                    {/* Accuracy */}
                    <div class="flex items-center gap-2">
                      <Target size={16} class="text-primary/60" />
                      <div>
                        <div class="text-xs text-primary/40">Accuracy</div>
                        <div class="font-mono font-semibold text-white">
                          {(session.stats.accuracy * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* PED/Hour */}
                    <div class="flex items-center gap-2">
                      <TrendingUp size={16} class="text-primary/60" />
                      <div>
                        <div class="text-xs text-primary/40">PED/Hour</div>
                        <div class="font-mono font-semibold text-white">
                          {session.stats.profitPerHour.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

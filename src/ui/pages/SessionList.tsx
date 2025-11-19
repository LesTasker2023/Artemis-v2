import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Target, TrendingUp, TrendingDown, Clock, Skull } from "lucide-solid";
import type { Session } from "../../core/types/Session";
import { SessionService } from "../../core/services/SessionService";
import { Card } from "../components/atoms/Card";
import { Badge } from "../components/atoms/Badge";
import { StatCard } from "../components/molecules/StatCard";

export interface SessionListProps {
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
}

export function SessionList(props: SessionListProps) {
  const navigate = useNavigate();
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
    <div class="space-y-4">
      <Show
        when={props.sessions.length > 0}
        fallback={
          <Card>
            <div class="text-center py-12 text-gray-400">
              <Target size={48} class="mx-auto mb-4 opacity-50" />
              <p class="text-lg">No sessions yet</p>
              <p class="text-sm mt-2">
                Start a new hunting session to track your stats
              </p>
            </div>
          </Card>
        }
      >
        <For each={props.sessions}>
          {(session) => {
            const profit = () => session.stats.profit;
            const profitPerHour = () =>
              SessionService.calculateProfitPerHour(session);

            return (
              <Card
                class="cursor-pointer hover:bg-gray-750 transition-colors"
                onClick={() => {
                  props.onSelectSession?.(session);
                  navigate(`/session/${session.id}`);
                }}
              >
                <div class="space-y-4">
                  {/* Header */}
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="text-xl font-semibold text-white">
                        {session.name}
                      </h3>
                      <div class="flex items-center gap-3 mt-2 text-sm text-gray-400">
                        <span class="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDate(session.startTime)}
                        </span>
                        <span>•</span>
                        <span>{formatDuration(session.duration)}</span>
                      </div>
                    </div>
                    <Badge variant={profit() >= 0 ? "success" : "danger"}>
                      {profit() >= 0 ? "+" : ""}
                      {profit().toFixed(2)} PED
                    </Badge>
                  </div>

                  {/* Stats Grid */}
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={profit() >= 0 ? TrendingUp : TrendingDown}
                      label="PED/Hour"
                      value={`${profitPerHour().toFixed(1)}`}
                      positive={profitPerHour() >= 0}
                    />
                    <StatCard
                      icon={Target}
                      label="Accuracy"
                      value={`${(session.stats.accuracy * 100).toFixed(1)}%`}
                    />
                    <StatCard
                      icon={Skull}
                      label="Kills"
                      value={session.stats.totalKills.toString()}
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Return"
                      value={`${(session.stats.returnRate * 100).toFixed(0)}%`}
                      positive={session.stats.returnRate >= 0.9}
                    />
                  </div>

                  {/* Tags */}
                  <Show when={session.tags.length > 0}>
                    <div class="flex gap-2 flex-wrap">
                      <For each={session.tags}>
                        {(tag) => <Badge variant="neutral">{tag}</Badge>}
                      </For>
                    </div>
                  </Show>
                </div>
              </Card>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

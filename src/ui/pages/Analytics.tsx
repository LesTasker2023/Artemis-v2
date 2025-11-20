/**
 * Analytics Page
 * Charts and visualizations for hunting performance analysis
 */

import { createSignal, onMount, createMemo, Show, For } from "solid-js";
import { Line, Bar, Doughnut } from "solid-chartjs";
import { TrendingUp, Target, Award, DollarSign } from "lucide-solid";
import type { Session } from "../../core/types/Session";
import { Card } from "../components/atoms/Card";
import { StatCard } from "../components/molecules/StatCard";
import {
  commonChartOptions,
  chartColors,
  getProfitColor,
  getProfitGradient,
} from "../config/chartConfig";
import "../config/chartConfig"; // Import to register Chart.js defaults

export default function Analytics() {
  const [sessions, setSessions] = createSignal<Session[]>([]);

  // Load sessions on mount
  onMount(async () => {
    if (window.electron?.session) {
      try {
        const loadedSessions = await window.electron.session.findAll();
        setSessions(loadedSessions);
        console.log("[Analytics] Loaded sessions:", loadedSessions.length);
      } catch (error) {
        console.error("[Analytics] Failed to load sessions:", error);
      }
    }
  });

  // Calculate aggregate stats
  const totalProfit = () =>
    sessions().reduce((sum, s) => sum + s.stats.profit, 0);
  const totalSessions = () => sessions().length;
  const avgProfitPerSession = () =>
    totalSessions() > 0 ? totalProfit() / totalSessions() : 0;
  const totalKills = () =>
    sessions().reduce((sum, s) => sum + s.stats.totalKills, 0);

  // Profit over time chart data
  const profitChartData = createMemo(() => {
    const sortedSessions = [...sessions()].sort(
      (a, b) => a.startTime - b.startTime
    );
    return {
      labels: sortedSessions.map((s) =>
        new Date(s.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      datasets: [
        {
          label: "Profit (PED)",
          data: sortedSessions.map((s) => s.stats.profit),
          borderColor: chartColors.success,
          backgroundColor: chartColors.successGradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  const profitChartOptions = {
    ...commonChartOptions,
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales?.y,
        beginAtZero: true,
        ticks: {
          ...commonChartOptions.scales?.y?.ticks,
          callback: (value: number) => `${value.toFixed(0)} PED`,
        },
      },
    },
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
        ...commonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => `Profit: ${context.parsed.y.toFixed(2)} PED`,
        },
      },
    },
  };

  // Return rate chart data
  const returnRateChartData = createMemo(() => {
    const sortedSessions = [...sessions()].sort(
      (a, b) => a.startTime - b.startTime
    );
    return {
      labels: sortedSessions.map((s) =>
        new Date(s.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      datasets: [
        {
          label: "Return Rate (%)",
          data: sortedSessions.map((s) => s.stats.returnRate * 100),
          borderColor: chartColors.primary,
          backgroundColor: chartColors.primaryGradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  const returnRateChartOptions = {
    ...commonChartOptions,
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales?.y,
        ticks: {
          ...commonChartOptions.scales?.y?.ticks,
          callback: (value: number) => `${value.toFixed(0)}%`,
        },
      },
    },
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
        ...commonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => `Return: ${context.parsed.y.toFixed(2)}%`,
        },
      },
    },
  };

  // Accuracy chart data
  const accuracyChartData = createMemo(() => {
    const sortedSessions = [...sessions()].sort(
      (a, b) => a.startTime - b.startTime
    );
    return {
      labels: sortedSessions.map((s) =>
        new Date(s.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      datasets: [
        {
          label: "Accuracy (%)",
          data: sortedSessions.map((s) => s.stats.accuracy * 100),
          borderColor: chartColors.info,
          backgroundColor: "rgba(6, 182, 212, 0.2)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  const accuracyChartOptions = {
    ...commonChartOptions,
    scales: {
      ...commonChartOptions.scales,
      y: {
        ...commonChartOptions.scales?.y,
        min: 0,
        max: 100,
        ticks: {
          ...commonChartOptions.scales?.y?.ticks,
          callback: (value: number) => `${value.toFixed(0)}%`,
        },
      },
    },
    plugins: {
      ...commonChartOptions.plugins,
      tooltip: {
        ...commonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => `Accuracy: ${context.parsed.y.toFixed(2)}%`,
        },
      },
    },
  };

  // Mob kills distribution
  const mobKills = createMemo(() => {
    const mobCounts: Record<string, number> = {};
    sessions().forEach((session) => {
      session.events
        .filter((e) => e.type === "MOB_KILLED")
        .forEach((e) => {
          const mobName = e.payload.mobName;
          mobCounts[mobName] = (mobCounts[mobName] || 0) + 1;
        });
    });
    return Object.entries(mobCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 mobs
  });

  const mobDistributionData = createMemo(() => ({
    labels: mobKills().map((m) => m.name),
    datasets: [
      {
        label: "Kills",
        data: mobKills().map((m) => m.count),
        backgroundColor: chartColors.palette,
        borderWidth: 2,
        borderColor: "#111827",
      },
    ],
  }));

  const mobDistributionOptions = {
    ...commonChartOptions,
    plugins: {
      ...commonChartOptions.plugins,
      legend: {
        ...commonChartOptions.plugins?.legend,
        position: "right" as const,
      },
      tooltip: {
        ...commonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed;
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0
            );
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  // Profit per hour comparison (bar chart)
  const profitPerHourData = createMemo(() => {
    const sorted = [...sessions()]
      .sort((a, b) => b.stats.profitPerHour - a.stats.profitPerHour)
      .slice(0, 10); // Top 10 sessions

    return {
      labels: sorted.map((s) => s.name),
      datasets: [
        {
          label: "Profit/Hour (PED)",
          data: sorted.map((s) => s.stats.profitPerHour),
          backgroundColor: sorted.map((s) => getProfitColor(s.stats.profit)),
          borderWidth: 0,
        },
      ],
    };
  });

  const profitPerHourOptions = {
    ...commonChartOptions,
    indexAxis: "y" as const,
    scales: {
      x: {
        ...commonChartOptions.scales?.x,
        beginAtZero: true,
        ticks: {
          ...commonChartOptions.scales?.x?.ticks,
          callback: (value: number) => `${value.toFixed(0)} PED`,
        },
      },
      y: {
        ...commonChartOptions.scales?.y,
        ticks: {
          ...commonChartOptions.scales?.y?.ticks,
          autoSkip: false,
        },
      },
    },
    plugins: {
      ...commonChartOptions.plugins,
      legend: {
        display: false,
      },
      tooltip: {
        ...commonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context: any) => `${context.parsed.x.toFixed(2)} PED/hour`,
        },
      },
    },
  };

  return (
    <div class="p-8">
      <div class="max-w-7xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-primary">Analytics</h1>
          <p class="text-muted-foreground mt-1">
            Performance insights and trends
          </p>
        </div>

        <Show when={sessions().length === 0}>
          <Card>
            <div class="text-center py-12">
              <TrendingUp
                class="mx-auto text-muted-foreground mb-4"
                size={48}
              />
              <h2 class="text-xl font-semibold mb-2">No Data Yet</h2>
              <p class="text-muted-foreground">
                Complete some hunting sessions to see analytics
              </p>
            </div>
          </Card>
        </Show>

        <Show when={sessions().length > 0}>
          {/* Summary Stats */}
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Total Profit"
              value={`${totalProfit().toFixed(2)} PED`}
              icon={DollarSign}
              positive={totalProfit() > 0}
            />
            <StatCard
              label="Total Sessions"
              value={totalSessions().toString()}
              icon={Target}
            />
            <StatCard
              label="Avg Profit/Session"
              value={`${avgProfitPerSession().toFixed(2)} PED`}
              icon={TrendingUp}
              positive={avgProfitPerSession() > 0}
            />
            <StatCard
              label="Total Kills"
              value={totalKills().toString()}
              icon={Award}
            />
          </div>

          {/* Charts Grid */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit Over Time */}
            <Card>
              <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={24} />
                Profit Over Time
              </h2>
              <div style={{ height: "300px" }}>
                <Line data={profitChartData()} options={profitChartOptions} />
              </div>
            </Card>

            {/* Return Rate Trend */}
            <Card>
              <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                <DollarSign size={24} />
                Return Rate Trend
              </h2>
              <div style={{ height: "300px" }}>
                <Line
                  data={returnRateChartData()}
                  options={returnRateChartOptions}
                />
              </div>
            </Card>

            {/* Accuracy Trend */}
            <Card>
              <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target size={24} />
                Accuracy Trend
              </h2>
              <div style={{ height: "300px" }}>
                <Line
                  data={accuracyChartData()}
                  options={accuracyChartOptions}
                />
              </div>
            </Card>

            {/* Mob Distribution */}
            <Card>
              <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
                <Award size={24} />
                Mob Distribution
              </h2>
              <div style={{ height: "300px" }}>
                <Doughnut
                  data={mobDistributionData()}
                  options={mobDistributionOptions}
                />
              </div>
            </Card>

            {/* Profit Per Hour Comparison */}
            <Card class="lg:col-span-2">
              <h2 class="text-xl font-semibold mb-4">
                Top Sessions by Profit/Hour
              </h2>
              <div style={{ height: "400px" }}>
                <Bar
                  data={profitPerHourData()}
                  options={profitPerHourOptions}
                />
              </div>
            </Card>
          </div>
        </Show>
      </div>
    </div>
  );
}

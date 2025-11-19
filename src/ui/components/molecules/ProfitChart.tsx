/**
 * ProfitChart Component
 * Simple SVG line chart showing cumulative profit over session duration
 */

import { For } from "solid-js";
import type { Session } from "../../../core/types/Session";

interface ProfitChartProps {
  session: Session;
}

export function ProfitChart(props: ProfitChartProps) {
  // Generate data points from events
  const generateChartData = () => {
    const { session } = props;
    const lootEvents = session.events.filter((e) => e.type === "LOOT_RECEIVED");
    const shotEvents = session.events.filter((e) => e.type === "SHOT_FIRED");

    if (lootEvents.length === 0 && shotEvents.length === 0) {
      return [];
    }

    const dataPoints: Array<{
      time: number;
      profit: number;
      loot: number;
      cost: number;
    }> = [];
    let cumulativeLoot = 0;
    let cumulativeCost = 0;

    // Combine and sort all economic events
    const economicEvents = [
      ...lootEvents.map((e) => ({
        timestamp: e.timestamp,
        type: "loot",
        value: e.payload.totalTTValue,
      })),
      ...shotEvents.map((e) => ({
        timestamp: e.timestamp,
        type: "cost",
        value: e.payload.ammoCost,
      })),
    ].sort((a, b) => a.timestamp - b.timestamp);

    // Generate data points
    const startTime = session.startTime;
    economicEvents.forEach((event) => {
      if (event.type === "loot") {
        cumulativeLoot += event.value;
      } else {
        cumulativeCost += event.value;
      }

      const timeMinutes = Math.round((event.timestamp - startTime) / 60000);

      dataPoints.push({
        time: timeMinutes,
        profit: Number((cumulativeLoot - cumulativeCost).toFixed(2)),
        loot: Number(cumulativeLoot.toFixed(2)),
        cost: Number(cumulativeCost.toFixed(2)),
      });
    });

    return dataPoints;
  };

  const data = generateChartData();

  if (data.length === 0) {
    return (
      <div class="flex items-center justify-center h-64 text-gray-400">
        No economic data to display
      </div>
    );
  }

  // Chart dimensions
  const width = 600;
  const height = 250;
  const padding = 40;

  // Calculate scales
  const maxTime = Math.max(...data.map((d) => d.time));
  const maxProfit = Math.max(
    ...data.map((d) => Math.max(d.profit, d.loot, d.cost))
  );
  const minProfit = Math.min(...data.map((d) => Math.min(d.profit, 0)));

  const xScale = (time: number) =>
    padding + (time / maxTime) * (width - 2 * padding);
  const yScale = (value: number) =>
    height -
    padding -
    ((value - minProfit) / (maxProfit - minProfit)) * (height - 2 * padding);

  // Generate path strings
  const createPath = (dataKey: "profit" | "loot" | "cost") => {
    return data
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d[dataKey])}`
      )
      .join(" ");
  };

  return (
    <div class="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto">
        {/* Grid lines */}
        <For each={[0, 0.25, 0.5, 0.75, 1]}>
          {(ratio) => (
            <line
              x1={padding}
              y1={padding + ratio * (height - 2 * padding)}
              x2={width - padding}
              y2={padding + ratio * (height - 2 * padding)}
              stroke="#374151"
              stroke-dasharray="3 3"
            />
          )}
        </For>

        {/* Profit line */}
        <path
          d={createPath("profit")}
          fill="none"
          stroke="#22c55e"
          stroke-width="2"
        />

        {/* Loot line */}
        <path
          d={createPath("loot")}
          fill="none"
          stroke="#3b82f6"
          stroke-width="2"
        />

        {/* Cost line */}
        <path
          d={createPath("cost")}
          fill="none"
          stroke="#ef4444"
          stroke-width="2"
        />

        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#9ca3af"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#9ca3af"
        />

        {/* Labels */}
        <text
          x={width / 2}
          y={height - 5}
          fill="#9ca3af"
          text-anchor="middle"
          font-size="12"
        >
          Time (minutes)
        </text>
        <text
          x={10}
          y={height / 2}
          fill="#9ca3af"
          text-anchor="middle"
          font-size="12"
          transform={`rotate(-90 10 ${height / 2})`}
        >
          PED
        </text>
      </svg>

      {/* Legend */}
      <div class="flex justify-center gap-4 mt-2 text-sm">
        <div class="flex items-center gap-2">
          <div class="w-4 h-0.5 bg-green-500"></div>
          <span>Profit</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-0.5 bg-blue-500"></div>
          <span>Loot</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-0.5 bg-red-500"></div>
          <span>Cost</span>
        </div>
      </div>
    </div>
  );
}

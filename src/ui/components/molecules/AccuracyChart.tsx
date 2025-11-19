/**
 * AccuracyChart Component
 * Bar chart showing hit/miss/critical distribution
 */

import { For } from "solid-js";
import type { Session } from "../../../core/types/Session";

interface AccuracyChartProps {
  session: Session;
}

export function AccuracyChart(props: AccuracyChartProps) {
  const { session } = props;

  const data = [
    { name: "Hits", count: session.stats.totalHits, fill: "#22c55e" },
    { name: "Misses", count: session.stats.totalMisses, fill: "#ef4444" },
    { name: "Criticals", count: session.stats.totalCriticals, fill: "#f59e0b" },
  ];

  if (session.stats.totalShots === 0) {
    return (
      <div class="flex items-center justify-center h-64 text-gray-400">
        No combat data to display
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));
  const barWidth = 60;
  const barSpacing = 80;
  const width = data.length * barSpacing + 60;
  const height = 250;
  const padding = 40;
  const chartHeight = height - 2 * padding;

  return (
    <div class="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto">
        {/* Grid lines */}
        <For each={[0, 0.25, 0.5, 0.75, 1]}>
          {(ratio) => (
            <>
              <line
                x1={padding}
                y1={padding + ratio * chartHeight}
                x2={width - 20}
                y2={padding + ratio * chartHeight}
                stroke="#374151"
                stroke-dasharray="3 3"
              />
              <text
                x={padding - 10}
                y={padding + ratio * chartHeight + 4}
                fill="#9ca3af"
                text-anchor="end"
                font-size="12"
              >
                {Math.round(maxCount * (1 - ratio))}
              </text>
            </>
          )}
        </For>

        {/* Bars */}
        <For each={data}>
          {(item, i) => {
            const x = padding + i() * barSpacing + 10;
            const barHeight = (item.count / maxCount) * chartHeight;
            const y = padding + chartHeight - barHeight;

            return (
              <>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={item.fill}
                  rx="4"
                />
                <text
                  x={x + barWidth / 2}
                  y={height - padding + 20}
                  fill="#9ca3af"
                  text-anchor="middle"
                  font-size="12"
                >
                  {item.name}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  fill="#f3f4f6"
                  text-anchor="middle"
                  font-size="14"
                  font-weight="bold"
                >
                  {item.count}
                </text>
              </>
            );
          }}
        </For>

        {/* Axes */}
        <line
          x1={padding}
          y1={padding + chartHeight}
          x2={width - 20}
          y2={padding + chartHeight}
          stroke="#9ca3af"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={padding + chartHeight}
          stroke="#9ca3af"
        />

        {/* Y-axis label */}
        <text
          x={10}
          y={height / 2}
          fill="#9ca3af"
          text-anchor="middle"
          font-size="12"
          transform={`rotate(-90 10 ${height / 2})`}
        >
          Count
        </text>
      </svg>
    </div>
  );
}

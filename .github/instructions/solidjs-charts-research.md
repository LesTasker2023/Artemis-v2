# Solid.js Chart Library Research

## Current Situation

- Using **Recharts** (React-based library)
- Need Solid.js-native alternatives for better performance and compatibility

## Option 1: **solid-chartjs** ⭐ RECOMMENDED

**Package:** `solid-chartjs`  
**Based on:** Chart.js (most popular JS charting library)  
**Install:** `npm install chart.js solid-chartjs`

### Pros:

- ✅ **Native Solid.js bindings** - Reactive by design
- ✅ **Lightweight** - Chart.js is ~60KB gzipped
- ✅ **Highly customizable** - Full Chart.js API access
- ✅ **Active maintenance** - Regular updates
- ✅ **TypeScript support** - Full type definitions
- ✅ **Wide chart types**: Line, Bar, Pie, Doughnut, Radar, Polar, Bubble, Scatter
- ✅ **Great documentation** - Chart.js has extensive docs
- ✅ **Animation support** - Smooth transitions

### Cons:

- ⚠️ Requires learning Chart.js API (different from Recharts)
- ⚠️ Less "React-like" declarative syntax

### Example Usage:

```tsx
import { Line } from "solid-chartjs";
import { Chart, Title, Tooltip, Legend, Colors } from "chart.js";

Chart.register(Title, Tooltip, Legend, Colors);

function ProfitChart() {
  const data = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets: [
      {
        label: "Profit (PED)",
        data: [12, 19, 3, 5, 2],
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Profit Over Time" },
    },
  };

  return <Line data={data} options={options} />;
}
```

**Verdict:** Best choice for ARTEMIS. Chart.js is battle-tested, performant, and has a mature ecosystem.

---

## Option 2: **solid-apexcharts**

**Package:** `solid-apexcharts`  
**Based on:** ApexCharts (modern, feature-rich)  
**Install:** `npm install apexcharts solid-apexcharts`

### Pros:

- ✅ Beautiful default styling (modern look)
- ✅ Interactive tooltips and zoom
- ✅ Real-time data updates
- ✅ Built-in dark mode
- ✅ Animations and transitions

### Cons:

- ⚠️ **Larger bundle** - ~140KB gzipped (2x Chart.js)
- ⚠️ Fewer customization options
- ⚠️ Less active Solid bindings maintenance
- ⚠️ Can be overkill for simple charts

### Example Usage:

```tsx
import SolidApexCharts from "solid-apexcharts";

function ProfitChart() {
  const options = {
    chart: { type: "line" },
    series: [{ name: "Profit", data: [30, 40, 35, 50, 49] }],
    xaxis: { categories: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  };

  return <SolidApexCharts {...options} />;
}
```

**Verdict:** Good for dashboards with complex visualizations, but heavier than needed.

---

## Option 3: **Lightweight Canvas (Custom)**

**Package:** None - Use native HTML5 Canvas  
**Based on:** Raw Canvas API or lightweight wrappers

### Pros:

- ✅ **Smallest bundle** - No dependencies
- ✅ Maximum performance
- ✅ Full control over rendering
- ✅ No framework lock-in

### Cons:

- ❌ **High development cost** - Build everything from scratch
- ❌ No built-in accessibility
- ❌ No TypeScript types (unless you build them)
- ❌ Animation is manual work
- ❌ Tooltip/legend logic required

### Example Libraries:

- **ZingChart** - Fast, but proprietary
- **uPlot** - Ultra-fast time-series (~40KB), but limited chart types
- **ECharts** - Powerful but massive (~800KB)

**Verdict:** Not worth the effort unless extreme performance is needed.

---

## Option 4: **Keep Recharts (with Workaround)**

**Package:** `recharts` (React-based)  
**Current setup:** Already installed

### Pros:

- ✅ Already integrated
- ✅ Zero migration cost
- ✅ Declarative, React-like API
- ✅ Good TypeScript support

### Cons:

- ❌ **React dependency** - Pulls in React runtime (~100KB)
- ❌ Not reactive with Solid signals
- ❌ Potential rendering issues (React → Solid bridge)
- ❌ Double reactivity systems (React + Solid)

### Workaround:

Use Recharts inside a non-reactive container to avoid conflicts:

```tsx
import { onMount } from "solid-js";

function ProfitChart() {
  let chartRef;

  onMount(() => {
    // Render Recharts into static container
    import("recharts").then(({ LineChart, Line }) => {
      // React render logic here
    });
  });

  return <div ref={chartRef} />;
}
```

**Verdict:** Short-term OK, but should migrate to solid-chartjs for better performance.

---

## Option 5: **SVG-based (Victory Native)**

**Package:** `victory-native` (React Native charts, no Solid bindings)  
**Status:** Not compatible - React Native only

---

## Comparison Table

| Library           | Bundle Size    | Solid Native      | Chart Types      | Customization | Maturity   | Recommendation         |
| ----------------- | -------------- | ----------------- | ---------------- | ------------- | ---------- | ---------------------- |
| **solid-chartjs** | ~60KB          | ✅ Yes            | 8+ types         | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐   | ✅ **BEST**            |
| solid-apexcharts  | ~140KB         | ✅ Yes            | 10+ types        | ⭐⭐⭐⭐      | ⭐⭐⭐     | ⚠️ Good for dashboards |
| Recharts (React)  | ~100KB + React | ❌ No             | 6 types          | ⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐ | ⚠️ Keep temporarily    |
| Custom Canvas     | 0KB            | ✅ Yes            | Custom           | ⭐⭐⭐⭐⭐    | N/A        | ❌ Too much work       |
| uPlot             | ~40KB          | ⚠️ Wrapper needed | Time-series only | ⭐⭐⭐        | ⭐⭐⭐     | ⚠️ Niche use case      |

---

## Recommendation for ARTEMIS

### **Immediate Action: Migrate to `solid-chartjs`**

**Why:**

1. **Native Solid reactivity** - Works seamlessly with Solid signals
2. **Smaller bundle** - Chart.js (60KB) vs Recharts + React (200KB+)
3. **Better performance** - No React overhead
4. **More chart types** - Includes radar, polar, bubble charts
5. **Active maintenance** - Chart.js is industry standard

**Migration Plan:**

1. Install: `npm install chart.js solid-chartjs`
2. Replace Recharts components gradually:
   - `LineChart` → `Line` from solid-chartjs
   - `BarChart` → `Bar` from solid-chartjs
   - `PieChart` → `Pie` from solid-chartjs
3. Update data format (Recharts → Chart.js format)
4. Test all charts
5. Remove Recharts + React dependencies

**Estimated Time:** 2-3 hours

---

## Chart.js Setup for ARTEMIS

### Installation:

```bash
npm install chart.js solid-chartjs
```

### Global Configuration (`src/ui/chartConfig.ts`):

```typescript
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

// Register Chart.js components globally
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ARTEMIS theme defaults
ChartJS.defaults.color = "#9ca3af"; // Gray text
ChartJS.defaults.borderColor = "#374151"; // Gray borders
ChartJS.defaults.backgroundColor = "rgba(59, 130, 246, 0.5)"; // Blue fill
ChartJS.defaults.font.family = "'Inter', sans-serif";
```

### Example: Profit Over Time (Line Chart)

```tsx
import { Line } from "solid-chartjs";
import { createMemo } from "solid-js";

function ProfitChart(props: { sessions: Session[] }) {
  const chartData = createMemo(() => ({
    labels: props.sessions.map((s) =>
      new Date(s.startTime).toLocaleDateString()
    ),
    datasets: [
      {
        label: "Profit (PED)",
        data: props.sessions.map((s) => s.stats.profit),
        borderColor: "#22c55e", // Green
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4, // Smooth curves
      },
    ],
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Profit: ${context.parsed.y.toFixed(2)} PED`,
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
  };

  return (
    <div style={{ height: "300px" }}>
      <Line data={chartData()} options={options} />
    </div>
  );
}
```

### Example: Return Rate (Bar Chart)

```tsx
import { Bar } from "solid-chartjs";

function ReturnRateChart(props: { sessions: Session[] }) {
  const data = {
    labels: props.sessions.map((s) => s.name),
    datasets: [
      {
        label: "Return Rate (%)",
        data: props.sessions.map((s) => s.stats.returnRate * 100),
        backgroundColor: props.sessions.map((s) =>
          s.stats.returnRate > 1 ? "#22c55e" : "#ef4444"
        ),
      },
    ],
  };

  return <Bar data={data} />;
}
```

### Example: Mob Distribution (Pie Chart)

```tsx
import { Doughnut } from "solid-chartjs";

function MobDistribution(props: {
  mobKills: { name: string; count: number }[];
}) {
  const data = {
    labels: props.mobKills.map((m) => m.name),
    datasets: [
      {
        data: props.mobKills.map((m) => m.count),
        backgroundColor: [
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#8b5cf6",
        ],
      },
    ],
  };

  return <Doughnut data={data} />;
}
```

---

## Implementation Checklist

### Phase 1: Setup (30 min)

- [ ] Install `chart.js` and `solid-chartjs`
- [ ] Create `chartConfig.ts` with global defaults
- [ ] Import config in `App.tsx`

### Phase 2: Migration (2 hours)

- [ ] Replace line charts (session trends)
- [ ] Replace bar charts (loadout comparison)
- [ ] Replace pie charts (mob distribution)
- [ ] Test all chart interactions

### Phase 3: Cleanup (30 min)

- [ ] Remove `recharts` from package.json
- [ ] Remove React from dependencies
- [ ] Update imports across codebase
- [ ] Test build size reduction

---

## Benefits After Migration

1. **Bundle Size:** -140KB (200KB → 60KB for charts)
2. **Performance:** No React reconciliation overhead
3. **Reactivity:** Charts update automatically with Solid signals
4. **Type Safety:** Better TypeScript integration
5. **Maintenance:** Fewer dependencies to manage

---

## Fallback Plan

If Chart.js doesn't meet needs:

1. Try **solid-apexcharts** for advanced features
2. Keep **Recharts** temporarily (acceptable short-term)
3. Build **custom SVG charts** for specific needs (last resort)

---

**Final Verdict:** Migrate to `solid-chartjs` using Chart.js. Best balance of performance, features, and developer experience for ARTEMIS.

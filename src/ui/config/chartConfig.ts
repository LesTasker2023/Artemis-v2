/**
 * Chart.js Global Configuration
 * Sets up defaults and theme for all charts in ARTEMIS
 */

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
  type ChartOptions,
} from 'chart.js';

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

// ARTEMIS Dark Theme Defaults
ChartJS.defaults.color = '#9ca3af'; // Gray-400 text
ChartJS.defaults.borderColor = '#374151'; // Gray-700 borders
ChartJS.defaults.backgroundColor = 'rgba(59, 130, 246, 0.5)'; // Blue with transparency
ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
ChartJS.defaults.font.size = 12;

// Common chart options for ARTEMIS
export const commonChartOptions: Partial<ChartOptions<any>> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: '#9ca3af',
        padding: 12,
        font: {
          size: 13,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.95)', // Gray-900 with transparency
      titleColor: '#f3f4f6', // Gray-100
      bodyColor: '#d1d5db', // Gray-300
      borderColor: '#374151', // Gray-700
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        // Format numbers with 2 decimals
        label: (context: any) => {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(2);
          }
          return label;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: '#1f2937', // Gray-800
        drawOnChartArea: true,
        drawTicks: false,
      },
      ticks: {
        color: '#9ca3af',
        padding: 8,
      },
      border: {
        color: '#374151',
      },
    },
    y: {
      grid: {
        color: '#1f2937',
        drawOnChartArea: true,
        drawTicks: false,
      },
      ticks: {
        color: '#9ca3af',
        padding: 8,
      },
      border: {
        color: '#374151',
      },
    },
  },
};

// Color palette for ARTEMIS charts
export const chartColors = {
  primary: '#3b82f6', // Blue
  success: '#22c55e', // Green
  danger: '#ef4444', // Red
  warning: '#f59e0b', // Orange
  info: '#06b6d4', // Cyan
  purple: '#8b5cf6', // Purple
  pink: '#ec4899', // Pink
  
  // Gradients (for backgrounds)
  primaryGradient: 'rgba(59, 130, 246, 0.2)',
  successGradient: 'rgba(34, 197, 94, 0.2)',
  dangerGradient: 'rgba(239, 68, 68, 0.2)',
  warningGradient: 'rgba(245, 158, 11, 0.2)',
  
  // Multi-color palette for pie/doughnut charts
  palette: [
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#14b8a6', // Teal
  ],
};

// Profit color helper (green for positive, red for negative)
export function getProfitColor(value: number): string {
  return value >= 0 ? chartColors.success : chartColors.danger;
}

// Profit gradient helper
export function getProfitGradient(value: number): string {
  return value >= 0 ? chartColors.successGradient : chartColors.dangerGradient;
}

// Generate color array for multiple datasets
export function generateColors(count: number): string[] {
  const colors = chartColors.palette;
  return Array(count)
    .fill(0)
    .map((_, i) => colors[i % colors.length]);
}

// Create gradient fill for line charts
export function getGradient(context: any, color: string): CanvasGradient | string {
  const chart = context.chart;
  const { ctx, chartArea } = chart;
  
  if (!chartArea) {
    return color;
  }
  
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `${color}40`); // 25% opacity
  gradient.addColorStop(1, `${color}00`); // Transparent
  return gradient;
}

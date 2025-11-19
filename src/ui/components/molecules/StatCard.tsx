import type { Component } from "solid-js";

export interface StatCardProps {
  icon?: any;
  label: string;
  value: string;
  positive?: boolean;
}

export function StatCard(props: StatCardProps) {
  const Icon = props.icon;
  const colorClass = () =>
    props.positive === undefined
      ? "text-primary"
      : props.positive
        ? "text-success"
        : "text-danger";

  const glowClass = () =>
    props.positive === undefined
      ? "shadow-glow-primary"
      : props.positive
        ? "shadow-[0_0_20px_rgba(34,197,94,0.3)]"
        : "shadow-[0_0_20px_rgba(239,68,68,0.3)]";

  return (
    <div class="bg-background-card border border-primary/10 rounded-lg p-5 hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
      {/* Large background icon */}
      {Icon && (
        <div class="absolute right-0 top-1/2 -translate-y-1/2 opacity-5">
          <Icon class={colorClass()} size={240} />
        </div>
      )}

      <div class="relative z-10">
        <span class="text-sm text-primary/60 tracking-wide uppercase font-medium block mb-3">
          {props.label}
        </span>
        <div
          class={`text-3xl font-bold ${colorClass()} tracking-tight font-mono`}
        >
          {props.value}
        </div>
      </div>
    </div>
  );
}

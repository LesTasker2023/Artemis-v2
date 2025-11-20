/**
 * Layout Component
 * Main application layout with navigation sidebar
 */

import { Component, JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import {
  Home,
  Target,
  Map,
  Sword,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-solid";

interface LayoutProps {
  children?: JSX.Element;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/active", label: "Active Session", icon: Target },
  { path: "/gps", label: "GPS", icon: Map },
  { path: "/loadouts", label: "Loadouts", icon: Sword },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

export const Layout: Component<LayoutProps> = (props) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div class="flex h-screen bg-background text-white">
      {/* Sidebar Navigation */}
      <aside class="w-64 bg-background-light border-r border-primary/10 flex flex-col relative overflow-hidden">
        {/* Sci-fi grid background */}
        <div class="absolute inset-0 bg-grid-pattern bg-grid opacity-30"></div>

        {/* Glow effect at top */}
        <div class="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>

        <div class="relative z-10 flex flex-col h-full">
          {/* Logo/Header */}
          <div class="p-6 border-b border-primary/20">
            <div>
              <h1 class="text-2xl font-bold text-primary tracking-wider">
                ARTEMIS
              </h1>
              <p class="text-xs text-accent tracking-widest uppercase">
                Hunting Analytics
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav class="p-4 space-y-1">
            {navItems.map((item) => (
              <A
                href={item.path}
                class={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group border ${
                  isActive(item.path)
                    ? "bg-primary/10 border-primary/30 text-white"
                    : "text-primary/70 border-transparent hover:bg-primary/5 hover:border-primary/20 hover:text-primary"
                }`}
                aria-current={isActive(item.path) ? "page" : undefined}
              >
                <item.icon size={20} />
                <span class="font-medium tracking-wide">{item.label}</span>
              </A>
            ))}
          </nav>

          {/* Spacer to push footer to bottom */}
          <div class="flex-1"></div>

          {/* Footer */}
          <div class="p-4 border-t border-primary/10">
            <div class="px-4 py-2 bg-background-lighter rounded-lg border border-primary/10">
              <div class="text-xs text-primary/40 text-center tracking-wider">
                VERSION
              </div>
              <div class="text-sm text-primary font-mono text-center mt-1">
                v{import.meta.env.PACKAGE_VERSION || '2.0.0-alpha.10'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main class="flex-1 overflow-auto bg-background relative">
        {/* Subtle grid overlay */}
        <div class="absolute inset-0 bg-grid-pattern bg-grid opacity-20 pointer-events-none"></div>
        <div class="relative z-10">{props.children}</div>
      </main>
    </div>
  );
};

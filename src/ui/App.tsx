import { HashRouter, Route } from "@solidjs/router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { SessionDetail } from "./pages/SessionDetail";
import { GPS } from "./pages/GPS";
import ActiveSession from "./pages/ActiveSession";
import Loadouts from "./pages/Loadouts";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import { HUDOverlay } from "./pages/HUDOverlay";
import { Show, onMount, onCleanup } from "solid-js";
import { initSessionStore } from "./stores/sessionStore";
import { settings } from "./stores/settingsStore";
import { LiveGPSService } from "@core/services/LiveGPSService";

export default function App() {
  console.log("[App] 🚀 App component initializing...");

  // Initialize global session store on app startup
  onMount(() => {
    console.log("[App] 📦 onMount fired - calling initSessionStore...");
    initSessionStore();

    // Add beforeunload handler to send termination message when app closes
    const handleBeforeUnload = () => {
      const userSettings = settings();
      if (
        userSettings.liveGPS.enabled &&
        userSettings.liveGPS.discordWebhookUrl
      ) {
        console.log(
          "[App] 👋 App closing - sending GPS termination message..."
        );
        const gpsService = new LiveGPSService({
          discordWebhookUrl: userSettings.liveGPS.discordWebhookUrl,
          updateInterval: userSettings.liveGPS.updateInterval,
          ttl: 30000,
        });
        // Fire and forget - can't await in beforeunload
        gpsService
          .sendTerminationMessage(userSettings.userId, userSettings.username)
          .catch((err) =>
            console.error("[App] Failed to send termination:", err)
          );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    onCleanup(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });
  });

  // Check if we're on the HUD route
  const isHUDRoute = window.location.hash === "#/hud";

  return (
    <Show when={!isHUDRoute} fallback={<HUDOverlay />}>
      {/* Main app routes with layout */}
      <HashRouter root={Layout}>
        <Route path="/" component={Dashboard} />
        <Route path="/session/:id" component={SessionDetail} />
        <Route path="/gps" component={GPS} />
        <Route path="/active" component={ActiveSession} />
        <Route path="/loadouts" component={Loadouts} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
      </HashRouter>
    </Show>
  );
}

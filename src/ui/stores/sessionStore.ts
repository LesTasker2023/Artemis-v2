/**
 * Global Session Store
 * Manages the active hunting session state across page navigation
 */

import { createSignal } from "solid-js";
import type { Session } from "../../core/types/Session";
import type { Loadout } from "../../core/types/Loadout";
import type { SessionEvent } from "../../core/types/Events";
import type { LiveGPSUpdate } from "../../core/types/User";
import { SessionService } from "../../core/services/SessionService";
import { LiveGPSService } from "../../core/services/LiveGPSService";
import { settings } from "./settingsStore";

// Global signals for active session
const [activeSession, setActiveSession] = createSignal<Session | null>(null);
const [activeLoadout, setActiveLoadout] = createSignal<Loadout | null>(null);
const [isSessionActive, setIsSessionActive] = createSignal(false);
const [isTracking, setIsTracking] = createSignal(false);

// Event listener registration - only register once globally
let eventListenerRegistered = false;

// Auto-save timer - persists across navigation
let autoSaveTimer: NodeJS.Timeout | null = null;

// Duration update timer - updates session duration every second for real-time display
let durationTimer: NodeJS.Timeout | null = null;

// LiveGPS service - global instance for broadcasting
let liveGPS: LiveGPSService | null = null;

// Track pending kill broadcasts (waiting for GPS_UPDATE)
const pendingKillBroadcasts = new Map<string, SessionEvent>(); // mobId -> kill event

/**
 * Initialize the global session store
 * Registers event listener and loads any active session from database
 */
export async function initSessionStore() {
  console.log("[SessionStore] 🚀 Initializing global session store...");
  
  // Initialize LiveGPS service if webhook configured
  const userSettings = settings();
  if (userSettings.liveGPS.discordWebhookUrl && userSettings.liveGPS.enabled) {
    liveGPS = new LiveGPSService({
      discordWebhookUrl: userSettings.liveGPS.discordWebhookUrl,
      updateInterval: userSettings.liveGPS.updateInterval,
      ttl: 300000, // 5 minutes
    });
    console.log("[SessionStore] 📡 LiveGPS service initialized");
  } else {
    console.log("[SessionStore] ⚠️ LiveGPS not configured or disabled");
  }
  
  // Only load from database if we don't already have an active session in memory
  // This prevents overwriting the in-memory session with stale DB data on tab switch
  if (!activeSession()) {
    try {
      const active = await window.electron?.session.findActive();
      if (active) {
        setActiveSession(active);
        setIsSessionActive(true);
        console.log(`[SessionStore] 📂 Loaded active session from DB: ${active.name}`);
        
        // Check if log watcher is still running for this session
        if (window.electron?.logWatcher) {
          const status = await window.electron.logWatcher.status();
          if (status?.isRunning) {
            setIsTracking(true);
            console.log(`[SessionStore] 🔄 Log watcher is already tracking`);
          }
        }
      }
    } catch (error) {
      console.error("[SessionStore] ❌ Failed to load active session:", error);
    }
  } else {
    console.log(`[SessionStore] ✅ Using existing in-memory session: ${activeSession()!.name} (${activeSession()!.events.length} events)`);
  }

  // Register event listener once globally
  if (!eventListenerRegistered && window.electron?.logWatcher) {
    console.log("[SessionStore] 🎧 Registering global event listener...");
    console.log("[SessionStore] 🔍 window.electron.logWatcher:", window.electron.logWatcher);
    console.log("[SessionStore] 🔍 onEvents function:", typeof window.electron.logWatcher.onEvents);
    
    window.electron.logWatcher.onEvents((events: SessionEvent[]) => {
      console.log(`[SessionStore] 📥 ✨✨✨ CALLBACK FIRED! Received ${events.length} events`);
      console.log(`[SessionStore] 📋 Events:`, events);
      console.log(`[SessionStore] 🔍 Event types:`, events.map(e => e.type).join(', '));
      
      // Handle MOB_KILLED events
      const killEvents = events.filter(e => e.type === 'MOB_KILLED');
      console.log(`[SessionStore] 💀 Found ${killEvents.length} MOB_KILLED events`);
      
      for (const killEvent of killEvents) {
        console.log(`[SessionStore] 💀 Mob kill detected:`, killEvent.payload.mobName);
        
        // Always trigger in-game location ping (for GPS_UPDATE event)
        if (window.electron?.keyboard) {
          window.electron.keyboard.sendKeys(',').then(result => {
            if (result.success) {
              console.log(`[SessionStore] ✅ Location keypress sent successfully`);
            } else {
              console.error(`[SessionStore] ❌ Failed to send keypress:`, result.error);
            }
          }).catch(err => {
            console.error(`[SessionStore] ❌ Keypress error:`, err);
          });
        }
        
        // If GPS is enabled, queue kill for Discord broadcast (wait for GPS_UPDATE)
        const userSettings = settings();
        if (userSettings.liveGPS.enabled && userSettings.liveGPS.discordWebhookUrl) {
          console.log(`[SessionStore] 📡 GPS enabled - queuing kill for broadcast after GPS_UPDATE`);
          // Use kill event ID as key to match with upcoming GPS_UPDATE
          pendingKillBroadcasts.set(killEvent.id, killEvent);
          
          // Safety timeout: broadcast anyway after 3 seconds if no GPS_UPDATE received
          // (Accounts for: keypress delay ~400ms + game processing + chat.log write + log watcher read)
          setTimeout(() => {
            if (pendingKillBroadcasts.has(killEvent.id)) {
              console.log(`[SessionStore] ⏱️ Timeout (3s) - broadcasting kill without waiting for GPS_UPDATE`);
              pendingKillBroadcasts.delete(killEvent.id);
              broadcastKillToDiscord(killEvent);
            }
          }, 3000);
        }
      }
      
      // Handle GPS_UPDATE events - check for pending kill broadcasts
      const gpsEvents = events.filter(e => e.type === 'GPS_UPDATE');
      console.log(`[SessionStore] 📍 Found ${gpsEvents.length} GPS_UPDATE events`);
      
      if (gpsEvents.length > 0 && pendingKillBroadcasts.size > 0) {
        // We have a GPS update and pending kills - broadcast them now with fresh location
        const latestGPS = gpsEvents[gpsEvents.length - 1]; // Use most recent GPS event
        console.log(`[SessionStore] 📍 GPS_UPDATE received - broadcasting ${pendingKillBroadcasts.size} pending kills`);
        
        for (const [killId, killEvent] of pendingKillBroadcasts.entries()) {
          if (killEvent.type === 'MOB_KILLED') {
            console.log(`[SessionStore] 📤 Broadcasting kill with fresh GPS:`, killEvent.payload.mobName);
            broadcastKillToDiscordWithGPS(killEvent, latestGPS);
          }
          pendingKillBroadcasts.delete(killId);
        }
      }
      
      setActiveSession((prev) => {
        if (!prev) {
          console.warn("[SessionStore] ⚠️ No active session - events ignored");
          return null;
        }

        // Update session with new events
        const loadout = activeLoadout();
        const updated = SessionService.addEvents(prev, events, loadout);
        
        console.log(
          `[SessionStore] 📊 Session updated: ${updated.events.length} events, ` +
          `${updated.stats.totalShots} shots, ${updated.stats.totalKills} kills, ` +
          `${updated.stats.profit.toFixed(2)} PED`
        );

        // Send live update to HUD overlay
        window.electron?.hud.updateSession(updated, loadout);

        return updated;
      });
    });

    eventListenerRegistered = true;
    console.log("[SessionStore] ✅ Event listener registered globally");
  }
}

/**
 * Start a new hunting session
 * Note: This only creates the session. Call setTrackingState(true) after log watcher starts.
 */
export function startSession(session: Session, loadout: Loadout | null = null) {
  console.log(`[SessionStore] ▶️ Starting session: ${session.name}`);
  setActiveSession(session);
  setActiveLoadout(loadout);
  setIsSessionActive(true);
  // isTracking set to true separately when log watcher actually starts
  
  // Start auto-save every 5 seconds
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  
  autoSaveTimer = setInterval(async () => {
    const currentSession = activeSession();
    if (currentSession && window.electron?.session) {
      console.log(
        `[SessionStore] 💾 Auto-saving session with ${currentSession.events.length} events, ${currentSession.stats.totalKills} kills, ${currentSession.stats.profit.toFixed(2)} PED`
      );
      await window.electron.session.save(currentSession);
      console.log(`[SessionStore] ✅ Auto-save complete`);
    }
  }, 5000);
  
  console.log(`[SessionStore] ⏰ Auto-save timer started (every 5 seconds)`);
  
  // Start duration update timer - updates every second for real-time display
  if (durationTimer) {
    clearInterval(durationTimer);
  }
  
  durationTimer = setInterval(() => {
    setActiveSession((prev) => {
      if (!prev || prev.endTime) return prev; // Don't update if no session or session ended
      
      // Recalculate duration
      const now = Date.now();
      const duration = Math.floor((now - prev.startTime) / 1000);
      
      // Update session with new duration (triggers reactivity)
      return { ...prev, duration };
    });
  }, 1000);
  
  console.log(`[SessionStore] ⏱️ Duration timer started (updates every second)`);
}

/**
 * Stop the current session
 */
export function stopSession() {
  const current = activeSession();
  if (current) {
    console.log(`[SessionStore] ⏹️ Stopping session: ${current.name}`);
    // Pass loadout to preserve cost calculations
    const loadout = activeLoadout();
    const ended = SessionService.end(current, loadout);
    setActiveSession(ended);
    setIsSessionActive(false);
    setIsTracking(false);
    
    // Clear auto-save timer
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
      console.log(`[SessionStore] ⏰ Auto-save timer stopped`);
    }
    
    // Clear duration update timer
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
      console.log(`[SessionStore] ⏱️ Duration timer stopped`);
    }
  }
}

/**
 * Update the active session (for manual edits)
 */
export function updateSession(session: Session) {
  setActiveSession(session);
}

/**
 * Update the active loadout
 */
export function updateLoadout(loadout: Loadout | null) {
  setActiveLoadout(loadout);
  
  // Recalculate session stats with new loadout
  const current = activeSession();
  if (current) {
    const updated = SessionService.addEvents(current, [], loadout);
    setActiveSession(updated);
  }
}

/**
 * Clear the active session (after save)
 */
export function clearSession() {
  console.log("[SessionStore] 🗑️ Clearing active session");
  setActiveSession(null);
  setActiveLoadout(null);
  setIsSessionActive(false);
}

/**
 * Get the current active session
 */
export function getActiveSession(): Session | null {
  return activeSession();
}

/**
 * Get the current active loadout
 */
export function getActiveLoadout(): Loadout | null {
  return activeLoadout();
}

/**
 * Check if a session is currently active
 */
export function isActive(): boolean {
  return isSessionActive();
}

/**
 * Check if log watcher is currently tracking
 */
export function getIsTracking(): boolean {
  return isTracking();
}

/**
 * Set tracking state (internal use - called by log watcher lifecycle)
 */
export function setTrackingState(tracking: boolean) {
  setIsTracking(tracking);
  console.log(`[SessionStore] 📊 Tracking state: ${tracking ? 'ON' : 'OFF'}`);
}

/**
 * Reinitialize LiveGPS service (call when settings change)
 * GPS service is used only for reading Discord messages and showing map
 * Discord broadcasts only happen on mob kills when GPS is enabled
 */
export async function reinitializeLiveGPS() {
  const userSettings = settings();
  
  if (userSettings.liveGPS.discordWebhookUrl && userSettings.liveGPS.enabled) {
    liveGPS = new LiveGPSService({
      discordWebhookUrl: userSettings.liveGPS.discordWebhookUrl,
      updateInterval: userSettings.liveGPS.updateInterval,
      ttl: 300000, // 5 minutes
    });
    console.log("[SessionStore] 📡 LiveGPS service reinitialized (map view only)");
  } else {
    liveGPS = null;
    console.log("[SessionStore] ⚠️ LiveGPS disabled or not configured");
  }
}

/**
 * Broadcast mob kill to Discord with the GPS location from the provided GPS event
 * This ensures we use the fresh location that was just posted in-game
 */
async function broadcastKillToDiscordWithGPS(killEvent: SessionEvent, gpsEvent: SessionEvent) {
  if (killEvent.type !== 'MOB_KILLED' || gpsEvent.type !== 'GPS_UPDATE') return;
  
  const userSettings = settings();
  const currentSession = activeSession();
  const currentLoadout = activeLoadout();
  
  if (!currentSession) {
    console.log(`[SessionStore] ❌ No active session - kill broadcast skipped`);
    return;
  }
  
  const webhookUrl = userSettings.liveGPS.discordWebhookUrl;
  if (!webhookUrl) {
    console.log(`[SessionStore] ❌ No webhook URL - kill broadcast skipped`);
    return;
  }
  
  // Ensure global liveGPS exists
  if (!liveGPS) {
    liveGPS = new LiveGPSService({
      discordWebhookUrl: webhookUrl,
      updateInterval: 30000,
      ttl: 300000,
    });
  }
  
  try {
    const update: LiveGPSUpdate = {
      userId: userSettings.userId,
      username: userSettings.username,
      location: {
        lon: gpsEvent.payload.location.lon,
        lat: gpsEvent.payload.location.lat,
      },
      status: 'hunting',
      sessionId: currentSession.id,
      loadoutName: currentLoadout?.name,
      currentProfit: currentSession.stats.profit,
      killCount: currentSession.stats.totalKills,
      lastKill: killEvent.payload.mobName, // Include the killed mob name
      timestamp: killEvent.timestamp,
      ttl: 300000,
    };
    
    console.log(`[SessionStore] 📤 Broadcasting kill to Discord with fresh GPS:`, update);
    await liveGPS.broadcastLocation(update);
    console.log(`[SessionStore] ✅ Kill broadcast successful!`);
  } catch (error) {
    console.error('[SessionStore] ❌ Kill broadcast failed:', error);
  }
}

/**
 * Broadcast mob kill to Discord with location and stats
 * Uses last known location from session (fallback for timeout scenario)
 */
async function broadcastKillToDiscord(killEvent: SessionEvent) {
  if (killEvent.type !== 'MOB_KILLED') return;
  
  const userSettings = settings();
  const currentSession = activeSession();
  const currentLoadout = activeLoadout();
  
  if (!currentSession) {
    console.log(`[SessionStore] ❌ No active session - kill broadcast skipped`);
    return;
  }
  
  const webhookUrl = userSettings.liveGPS.discordWebhookUrl;
  if (!webhookUrl) {
    console.log(`[SessionStore] ❌ No webhook URL - kill broadcast skipped`);
    return;
  }
  
  // Ensure global liveGPS exists
  if (!liveGPS) {
    liveGPS = new LiveGPSService({
      discordWebhookUrl: webhookUrl,
      updateInterval: 30000,
      ttl: 300000,
    });
  }
  
  try {
    // Get last known location from session
    const lastGPSEvent = [...currentSession.events]
      .reverse()
      .find(e => e.type === 'GPS_UPDATE');
    
    if (!lastGPSEvent || lastGPSEvent.type !== 'GPS_UPDATE') {
      console.log(`[SessionStore] ⚠️ No GPS location available for kill broadcast`);
      return;
    }
    
    const update: LiveGPSUpdate = {
      userId: userSettings.userId,
      username: userSettings.username,
      location: {
        lon: lastGPSEvent.payload.location.lon,
        lat: lastGPSEvent.payload.location.lat,
      },
      status: 'hunting',
      sessionId: currentSession.id,
      loadoutName: currentLoadout?.name,
      currentProfit: currentSession.stats.profit,
      killCount: currentSession.stats.totalKills,
      lastKill: killEvent.payload.mobName, // Include the killed mob name
      timestamp: killEvent.timestamp,
      ttl: 300000,
    };
    
    console.log(`[SessionStore] 📤 Broadcasting kill to Discord (fallback location):`, update);
    await liveGPS.broadcastLocation(update);
    console.log(`[SessionStore] ✅ Kill broadcast successful!`);
  } catch (error) {
    console.error('[SessionStore] ❌ Kill broadcast failed:', error);
  }
}

/**
 * @deprecated No longer used - GPS_UPDATE events don't broadcast automatically
 * Keeping for reference during transition
 */
async function broadcastGPSImmediate(gpsEvent: SessionEvent & { lastKill?: string }) {
  console.log('[SessionStore] ⚠️ broadcastGPSImmediate called but is deprecated');
}

// Export signals for reactive components
export { 
  activeSession, 
  setActiveSession,
  activeLoadout, 
  setActiveLoadout,
  isSessionActive, 
  setIsSessionActive,
  isTracking,
  setIsTracking,
};

/**
 * Get the global LiveGPS service instance
 */
export function getLiveGPS(): LiveGPSService | null {
  return liveGPS;
}

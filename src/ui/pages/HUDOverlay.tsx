import { Component, createSignal, onMount, createEffect, Show } from "solid-js";
import {
  Activity,
  DollarSign,
  Target,
  Crosshair,
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Minimize2,
  X,
  Zap,
} from "lucide-solid";
import { Session } from "../../core/types/Session";
import { Loadout } from "../../core/types/Loadout";
import { SessionService } from "../../core/services/SessionService";

/**
 * HUDOverlay - Always-on-top overlay window
 * Combat Mode: Minimal essential stats (profit, shots, kills)
 * Standard Mode: Full phone-like interface with all details
 */
export const HUDOverlay: Component = () => {
  console.log("🎯 [HUDOverlay] Component mounting...");

  const [session, setSession] = createSignal<Session | null>(null);
  const [loadout, setLoadout] = createSignal<Loadout | null>(null);
  const [mode, setMode] = createSignal<"combat" | "standard">("combat");
  
  // Auto-keypress state
  const [fKeyActive, setFKeyActive] = createSignal(false);
  const [eKeyActive, setEKeyActive] = createSignal(false);
  let fKeyInterval: NodeJS.Timeout | null = null;
  let eKeyInterval: NodeJS.Timeout | null = null;

  // Debug: Track session updates
  createEffect(() => {
    const s = session();
    if (s) {
      console.log(`[HUDOverlay] Session signal updated:`, {
        name: s.name,
        events: s.events.length,
        shots: s.stats.totalShots,
        kills: s.stats.totalKills,
        profit: s.stats.profit.toFixed(2),
      });
    } else {
      console.log(`[HUDOverlay] Session signal cleared (null)`);
    }
  });

  // Auto-resize window when mode changes
  createEffect(() => {
    const currentMode = mode();
    if (currentMode === "combat") {
      // Combat mode: Small horizontal bar
      window.electron?.hud.resize(500, 120, true);
    } else {
      // Standard mode: Phone-like interface
      window.electron?.hud.resize(400, 600, true);
    }
  });

  // Listen for live session updates from ActiveSession page
  onMount(() => {
    console.log("[HUDOverlay] 🎧 Setting up live session listener...");

    // Listen for real-time updates from ActiveSession
    window.electron?.hud.onSessionUpdate((liveSession, liveLoadout) => {
      console.log(
        "[HUDOverlay] 📡 Received live update:",
        liveSession
          ? `${liveSession.name} - ${liveSession.events.length} events, ${liveSession.stats.totalShots} shots, ${liveSession.stats.totalKills} kills, ${liveSession.stats.profit.toFixed(2)} PED`
          : "Session cleared"
      );
      setSession(liveSession);
      setLoadout(liveLoadout || null);
    });

    // Also poll database as fallback (in case HUD was opened after session started)
    const updateSession = async () => {
      try {
        const activeSession = await window.electron?.session.findActive();

        if (activeSession && activeSession.loadoutId) {
          // Fetch loadout if session has one
          const loadoutData = await window.electron?.loadout.findById(
            activeSession.loadoutId
          );
          setLoadout(loadoutData || null);

          // Recalculate stats with loadout to get accurate profit/costs
          if (loadoutData) {
            const recalculatedSession = {
              ...activeSession,
              stats: SessionService.calculateStats(
                activeSession.events,
                loadoutData
              ),
            };
            console.log(
              "[HUDOverlay] Active session check:",
              `Found: ${recalculatedSession.name} (${recalculatedSession.events.length} events, ${recalculatedSession.stats.totalKills} kills, ${recalculatedSession.stats.profit.toFixed(2)} PED)`
            );
            setSession(recalculatedSession);
          } else {
            console.log(
              "[HUDOverlay] Active session check:",
              `Found: ${activeSession.name} (${activeSession.events.length} events, ${activeSession.stats.totalKills} kills, ${activeSession.stats.profit.toFixed(2)} PED) - No loadout`
            );
            setSession(activeSession);
          }
        } else {
          console.log(
            "[HUDOverlay] Active session check:",
            activeSession
              ? `Found: ${activeSession.name} (${activeSession.events.length} events, no loadout)`
              : "None"
          );
          setSession(activeSession || null);
        }
      } catch (error) {
        console.error("HUDOverlay: Failed to fetch session:", error);
      }
    };

    // Initial load (for cold-start when HUD opened after session started)
    updateSession();

    // Polling disabled - using real-time IPC updates from ActiveSession instead
    // Database polling was causing flickering by overwriting live data with stale DB data
    // const interval = setInterval(updateSession, 2000);
    // return () => clearInterval(interval);
  });

  const handleClose = async () => {
    try {
      await window.electron?.hud.hide();
    } catch (error) {
      console.error("Failed to hide HUD:", error);
    }
  };

  // Calculate metrics
  const stats = () => session()?.stats;
  const profit = () => stats()?.profit ?? 0;
  const profitPerHour = () => stats()?.profitPerHour ?? 0;
  const accuracy = () => ((stats()?.accuracy ?? 0) * 100).toFixed(1);
  const returnRate = () => ((stats()?.returnRate ?? 0) * 100).toFixed(0);
  const isProfitable = () => profit() >= 0;

  const duration = () => {
    if (!session()) return "0:00";
    const seconds = session()!.duration;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0)
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // ============================================================
  // AUTO-KEYPRESS FUNCTIONS
  // ============================================================
  const toggleFKey = () => {
    if (fKeyActive()) {
      // Stop F key
      if (fKeyInterval) {
        clearInterval(fKeyInterval);
        fKeyInterval = null;
      }
      setFKeyActive(false);
      console.log('[HUDOverlay] F key auto-press stopped');
    } else {
      // Start F key
      setFKeyActive(true);
      console.log('[HUDOverlay] F key auto-press started');
      
      const sendFKey = async () => {
        const result = await window.electron?.keyboard.sendKeys('f');
        if (!result?.success) {
          console.error('[HUDOverlay] Failed to send F key:', result?.error);
        }
      };
      
      // Send immediately, then repeat
      sendFKey();
      fKeyInterval = setInterval(() => {
        // Add human variance: 950-1050ms instead of exactly 1000ms
        const variance = Math.random() * 100 - 50; // -50 to +50ms
        setTimeout(sendFKey, variance);
      }, 1000);
    }
  };

  const toggleEKey = () => {
    if (eKeyActive()) {
      // Stop E key
      if (eKeyInterval) {
        clearInterval(eKeyInterval);
        eKeyInterval = null;
      }
      setEKeyActive(false);
      console.log('[HUDOverlay] E key auto-press stopped');
    } else {
      // Start E key
      setEKeyActive(true);
      console.log('[HUDOverlay] E key auto-press started');
      
      const sendEKey = async () => {
        const result = await window.electron?.keyboard.sendKeys('e');
        if (!result?.success) {
          console.error('[HUDOverlay] Failed to send E key:', result?.error);
        }
      };
      
      // Send immediately, then repeat
      sendEKey();
      eKeyInterval = setInterval(() => {
        // Add human variance: 950-1050ms instead of exactly 1000ms
        const variance = Math.random() * 100 - 50; // -50 to +50ms
        setTimeout(sendEKey, variance);
      }, 1000);
    }
  };

  // Cleanup on unmount
  onMount(() => {
    return () => {
      if (fKeyInterval) clearInterval(fKeyInterval);
      if (eKeyInterval) clearInterval(eKeyInterval);
    };
  });

  // ============================================================
  // COMBAT MODE - Ultra minimal
  // ============================================================
  const CombatMode = () => (
    <div class="combat-container">
      {/* Top accent bar */}
      <div class="accent-bar" />

      {/* Stats bar */}
      <div class="combat-stats-bar">
        {/* Live indicator */}
        <div class="live-indicator">
          <Activity size={14} />
          <span>LIVE</span>
        </div>

        <div class="divider" />

        {/* Profit */}
        <div class="stat-item">
          <DollarSign
            size={12}
            class={isProfitable() ? "text-success" : "text-danger"}
          />
          <div class="stat-content">
            <span
              class={`stat-value ${isProfitable() ? "text-success" : "text-danger"}`}
            >
              {profit() >= 0 ? "+" : ""}
              {profit().toFixed(2)}
            </span>
            <span class="stat-label">PED</span>
          </div>
        </div>

        <div class="divider" />

        {/* Shots */}
        <div class="stat-item">
          <Target size={12} />
          <div class="stat-content">
            <span class="stat-value">{stats()?.totalShots ?? 0}</span>
            <span class="stat-label">SHOTS</span>
          </div>
        </div>

        <div class="divider" />

        {/* Kills */}
        <div class="stat-item">
          <Crosshair size={12} />
          <div class="stat-content">
            <span class="stat-value">{stats()?.totalKills ?? 0}</span>
            <span class="stat-label">KILLS</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // STANDARD MODE - Full interface
  // ============================================================
  const StandardMode = () => (
    <div class="standard-container">
      {/* Hero profit card */}
      <div class="hero-card">
        <div class="hero-header">
          <div class="flex items-center gap-2">
            {isProfitable() ? (
              <TrendingUp size={18} class="text-success" />
            ) : (
              <TrendingDown size={18} class="text-danger" />
            )}
            <span class="hero-label">ECONOMIC STATUS</span>
          </div>
          <div
            class={`status-badge ${isProfitable() ? "badge-success" : "badge-danger"}`}
          >
            {isProfitable() ? "PROFIT" : "LOSS"}
          </div>
        </div>
        <div
          class={`hero-value ${isProfitable() ? "text-success" : "text-danger"}`}
        >
          {profit() >= 0 ? "+" : ""}
          {profit().toFixed(2)}
          <span class="hero-unit">PED</span>
        </div>
        <div class="hero-meta">
          <span>Per Hour: {profitPerHour().toFixed(0)} PED/h</span>
          <div class="meta-divider" />
          <span
            class={`
            ${
              parseFloat(returnRate()) >= 90
                ? "text-success"
                : parseFloat(returnRate()) >= 70
                  ? "text-warning"
                  : "text-danger"
            }
          `}
          >
            Return: {returnRate()}%
          </span>
        </div>
      </div>

      {/* Quick stats grid */}
      <div class="quick-stats">
        <div class="quick-stat">
          <Target size={16} />
          <span class="quick-stat-value">{accuracy()}%</span>
          <span class="quick-stat-label">ACCURACY</span>
        </div>
        <div class="quick-stat">
          <Crosshair size={16} />
          <span class="quick-stat-value">{stats()?.totalKills ?? 0}</span>
          <span class="quick-stat-label">KILLS</span>
        </div>
        <div class="quick-stat">
          <Activity size={16} />
          <span class="quick-stat-value">{stats()?.totalShots ?? 0}</span>
          <span class="quick-stat-label">SHOTS</span>
        </div>
      </div>

      {/* Combat details */}
      <div class="detail-card">
        <div class="detail-header">
          <Zap size={14} />
          <span>COMBAT ANALYSIS</span>
        </div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Hits</span>
            <span class="detail-value">{stats()?.totalHits ?? 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Misses</span>
            <span class="detail-value">{stats()?.totalMisses ?? 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Criticals</span>
            <span class="detail-value text-warning">
              {stats()?.totalCriticals ?? 0}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Damage</span>
            <span class="detail-value">
              {(stats()?.totalDamageDealt ?? 0).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Defense */}
      <div class="detail-card">
        <div class="detail-header">
          <Shield size={14} />
          <span>DEFENSE</span>
        </div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Taken</span>
            <span class="detail-value text-danger">
              {(stats()?.totalDamageTaken ?? 0).toFixed(1)}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Dodges</span>
            <span class="detail-value">{stats()?.totalDodges ?? 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Evades</span>
            <span class="detail-value">{stats()?.totalEvades ?? 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Deflects</span>
            <span class="detail-value">{stats()?.totalDeflects ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Economy */}
      <div class="detail-card">
        <div class="detail-header">
          <DollarSign size={14} />
          <span>ECONOMY</span>
        </div>
        <div class="economy-list">
          <div class="economy-item">
            <span class="economy-label">Loot Value</span>
            <span class="economy-value text-success">
              +{(stats()?.totalLootTTValue ?? 0).toFixed(2)}
            </span>
          </div>
          <div class="economy-item">
            <span class="economy-label">Ammo Cost</span>
            <span class="economy-value text-danger">
              -{(stats()?.totalAmmoCost ?? 0).toFixed(2)}
            </span>
          </div>
          <div class="economy-item">
            <span class="economy-label">Decay Cost</span>
            <span class="economy-value text-danger">
              -{(stats()?.totalDecayCost ?? 0).toFixed(2)}
            </span>
          </div>
          <div class="economy-item economy-total">
            <span class="economy-label">Net Profit</span>
            <span
              class={`economy-value ${isProfitable() ? "text-success" : "text-danger"}`}
            >
              {profit() >= 0 ? "+" : ""}
              {profit().toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div class="detail-card">
        <div class="detail-header">
          <Clock size={14} />
          <span>SESSION INFO</span>
        </div>
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Duration</span>
            <span class="info-value">{duration()}</span>
          </div>
          <Show when={(stats()?.totalLoots ?? 0) > 0}>
            <div class="info-item">
              <span class="info-label">Loots</span>
              <span class="info-value">{stats()?.totalLoots ?? 0}</span>
            </div>
          </Show>
          <Show when={loadout()}>
            <div class="info-item">
              <span class="info-label">Loadout</span>
              <span class="info-value">{loadout()?.name}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Auto-Keypress Controls */}
      <div class="detail-card">
        <div class="detail-header">
          <Zap size={14} />
          <span>AUTO-KEYPRESS</span>
        </div>
        <div class="keypress-controls">
          <button
            class={`keypress-btn ${fKeyActive() ? 'keypress-btn-active' : ''}`}
            onClick={toggleFKey}
            title={fKeyActive() ? 'Stop F key auto-press' : 'Start F key auto-press (1s interval)'}
          >
            <span class="keypress-key">F</span>
            <span class="keypress-label">{fKeyActive() ? 'ACTIVE' : 'START'}</span>
          </button>
          <button
            class={`keypress-btn ${eKeyActive() ? 'keypress-btn-active' : ''}`}
            onClick={toggleEKey}
            title={eKeyActive() ? 'Stop E key auto-press' : 'Start E key auto-press (1s interval)'}
          >
            <span class="keypress-key">E</span>
            <span class="keypress-label">{eKeyActive() ? 'ACTIVE' : 'START'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div class="hud-window">
      {/* Draggable title bar */}
      <div class="titlebar">
        <div class="drag-region" />
        <div class="titlebar-buttons titlebar-buttons-left">
          <button
            class="mode-toggle"
            onClick={() => setMode(mode() === "combat" ? "standard" : "combat")}
            title={mode() === "combat" ? "Full Interface" : "Combat Mode"}
          >
            {mode() === "combat" ? (
              <Maximize2 size={14} />
            ) : (
              <Minimize2 size={14} />
            )}
          </button>
        </div>
        <div class="title-container">
          <div class="title-line title-line-left" />
          <span class="title">ARTEMIS</span>
          <div class="title-line title-line-right" />
        </div>
        <div class="titlebar-buttons titlebar-buttons-right">
          <button class="close-btn" onClick={handleClose} title="Hide HUD">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="content">
        <Show
          when={session()}
          fallback={
            <div class="no-session">
              <Activity size={32} class="opacity-30" />
              <p class="no-session-text">No active session</p>
              <p class="no-session-subtext">
                Open the main ARTEMIS window and start a new session from the
                Active Session page
              </p>
            </div>
          }
        >
          {mode() === "combat" ? <CombatMode /> : <StandardMode />}
        </Show>
      </div>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .hud-window {
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.92);
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Titlebar */
        .titlebar {
          position: relative;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(251, 146, 60, 0.3);
          padding: 0 12px;
          flex-shrink: 0;
        }

        .title {
          color: white;
          font-size: 24px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
          pointer-events: none;
          white-space: nowrap;
        }

        .title-container {
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 10;
          position: absolute;
          left: 0;
          right: 0;
          justify-content: center;
          padding: 0 12px;
        }

        .title-line {
          height: 2px;
          flex: 1;
          pointer-events: none;
        }

        .title-line-left {
          background: linear-gradient(to left, rgba(251, 146, 60, 0.8), transparent);
        }

        .title-line-right {
          background: linear-gradient(to right, rgba(251, 146, 60, 0.8), transparent);
        }

        .drag-region {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          -webkit-app-region: drag;
          cursor: move;
        }

        .titlebar-buttons {
          display: flex;
          gap: 8px;
          z-index: 10000;
          position: relative;
        }

        .titlebar-buttons-left {
          margin-right: auto;
          z-index: 10000;
        }

        .titlebar-buttons-right {
          margin-left: auto;
          z-index: 10000;
        }

        .mode-toggle,
        .close-btn {
          -webkit-app-region: no-drag;
          position: relative;
          width: 28px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(251, 146, 60, 0.1);
          border: 1px solid rgba(251, 146, 60, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 10000;
          color: rgba(251, 146, 60, 0.9);
        }

        .mode-toggle:hover {
          background: rgba(251, 146, 60, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .close-btn {
          background: transparent;
          color: rgba(109, 109, 109, 0.7);
        }

        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        /* Content */
        .content {
          flex: 1;
          overflow-y: auto;
          -webkit-app-region: no-drag;
          min-height: 80px;
        }

        .content::-webkit-scrollbar {
          width: 3px;
        }

        .content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        .content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 1);
          border-radius: 3px;
        }

        .content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        /* No Session */
        .no-session {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 8px;
          color: rgba(255, 255, 255, 0.3);
        }

        .no-session-text {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }

        .no-session-subtext {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          margin-bottom: 16px;
          text-align: center;
          max-width: 280px;
        }

        /* === COMBAT MODE === */
        .combat-container {
          padding: 12px;
        }

        .accent-bar {
            display: none;
        }

        .combat-stats-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(251, 146, 60, 0.2);
          border-radius: 10px;
          padding: 12px 16px;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #fb923c;
        }

        .live-indicator span {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .divider {
          width: 1px;
          height: 24px;
          background: rgba(251, 146, 60, 0.2);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-content {
          display: flex;
          flex-direction: row;
          align-items: baseline;
          gap: 4px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: white;
        }

        .stat-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.7);
          letter-spacing: 0.5px;
        }

        /* === STANDARD MODE === */
        .standard-container {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Hero Card */
        .hero-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(30, 41, 59, 0.7));
          backdrop-filter: blur(12px);
          border: 1px solid rgba(251, 146, 60, 0.3);
          border-radius: 12px;
          padding: 20px;
        }

        .hero-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .hero-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(148, 163, 184, 0.9);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .badge-success {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .badge-danger {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .hero-value {
          font-size: 42px;
          font-weight: 900;
          font-family: 'Courier New', monospace;
          line-height: 1;
          margin-bottom: 8px;
        }

        .hero-unit {
          font-size: 20px;
          color: rgba(148, 163, 184, 0.5);
          margin-left: 8px;
        }

        .hero-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: rgba(148, 163, 184, 0.7);
          font-family: 'Courier New', monospace;
        }

        .meta-divider {
          width: 1px;
          height: 14px;
          background: rgba(148, 163, 184, 0.3);
        }

        /* Quick Stats */
        .quick-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .quick-stat {
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(96, 165, 250, 0.2);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .quick-stat-value {
          font-size: 20px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: white;
        }

        .quick-stat-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.7);
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* Detail Cards */
        .detail-card {
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(96, 165, 250, 0.2);
          border-radius: 10px;
          padding: 12px;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #fb923c;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .detail-grid {
          display: flex;
          flex-direction: row;
          gap: 12px;
          flex-wrap: wrap;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .detail-label {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
        }

        .detail-value {
          font-size: 14px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          color: white;
        }

        /* Economy List */
        .economy-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .economy-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .economy-total {
          padding-top: 8px;
          margin-top: 4px;
          border-top: 1px solid rgba(96, 165, 250, 0.2);
        }

        .economy-label {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
        }

        .economy-value {
          font-size: 14px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        /* Info List */
        .info-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .info-label {
          font-size: 12px;
          color: rgba(148, 163, 184, 0.7);
        }

        .info-value {
          font-size: 13px;
          font-weight: 600;
          font-family: 'Courier New', monospace;
          color: white;
        }

        /* Auto-Keypress Controls */
        .keypress-controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .keypress-btn {
          background: rgba(30, 41, 59, 0.8);
          border: 2px solid rgba(96, 165, 250, 0.3);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: rgba(148, 163, 184, 0.9);
        }

        .keypress-btn:hover {
          background: rgba(30, 41, 59, 1);
          border-color: rgba(96, 165, 250, 0.5);
          transform: translateY(-1px);
        }

        .keypress-btn-active {
          background: rgba(34, 197, 94, 0.2);
          border-color: #22c55e;
          color: #22c55e;
          animation: pulse-border 2s ease-in-out infinite;
        }

        .keypress-btn-active:hover {
          background: rgba(34, 197, 94, 0.3);
        }

        @keyframes pulse-border {
          0%, 100% { border-color: #22c55e; }
          50% { border-color: rgba(34, 197, 94, 0.5); }
        }

        .keypress-key {
          font-size: 24px;
          font-weight: 900;
          font-family: 'Courier New', monospace;
          line-height: 1;
        }

        .keypress-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Color utilities */
        .text-success { color: #22c55e; }
        .text-danger { color: #ef4444; }
        .text-warning { color: #f59e0b; }
        .opacity-30 { opacity: 0.3; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .gap-2 { gap: 8px; }
      `}</style>
    </div>
  );
};

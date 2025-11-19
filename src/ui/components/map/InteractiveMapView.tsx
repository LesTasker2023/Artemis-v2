import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { Coordinate, HuntingZone } from "@core/types/GPS";
import {
  coordsToPixels,
  clusterKills,
  CALYPSO_CONFIG,
} from "@core/utils/mapUtils";
import { XCircle, ZoomIn, ZoomOut, Maximize2, Layers } from "lucide-solid";
import { LiveGPSOverlay } from "./LiveGPSOverlay";
import type { LiveGPSUpdate } from "@core/types/User";
import { LiveGPSService } from "@core/services/LiveGPSService";
import { settings } from "../../stores/settingsStore";

interface InteractiveMapViewProps {
  zones: HuntingZone[];
  killLocations?: Array<{
    location: Coordinate;
    mobName: string;
    timestamp: number;
  }>;
  deathLocations?: Array<{
    location: Coordinate;
    timestamp: number;
  }>;
  path?: Coordinate[];
  height?: string;
  onZoneClick?: (zone: HuntingZone) => void;
  liveGPS?: LiveGPSService; // Optional LiveGPS service instance
  liveUpdates?: LiveGPSUpdate[]; // Optional direct updates (bypasses liveGPS polling)
  showLiveGPSByDefault?: boolean; // Whether to show GPS overlay by default
}

/**
 * Interactive map with zoom, pan, and layer controls
 * Full-featured GPS visualization for hunting analysis
 */
export function InteractiveMapView(props: InteractiveMapViewProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let mapImage: HTMLImageElement | undefined;

  const [hoveredZone, setHoveredZone] = createSignal<HuntingZone | null>(null);
  const [mousePos, setMousePos] = createSignal<{ x: number; y: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = createSignal(true);
  const [imageLoaded, setImageLoaded] = createSignal(false);

  // Pan and zoom state
  const [scale, setScale] = createSignal(0.5);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });

  // Layer toggles
  const [showZones, setShowZones] = createSignal(false); // Start with zones hidden
  const [showKills, setShowKills] = createSignal(true);
  const [showDeaths, setShowDeaths] = createSignal(true);
  const [showPath, setShowPath] = createSignal(true);
  const [showLayerPanel, setShowLayerPanel] = createSignal(false);

  // Live GPS signals
  const [liveUpdates, setLiveUpdates] = createSignal<LiveGPSUpdate[]>(
    props.liveUpdates || []
  );
  const [showLiveGPS, setShowLiveGPS] = createSignal(
    props.showLiveGPSByDefault ?? (props.liveGPS ? true : false)
  );

  // Cluster settings
  const [clusterDistance, setClusterDistance] = createSignal(500);
  const minClusterRadius = 50; // Minimum cluster radius in meters

  // Cluster kills for better visualization
  const killClusters = createMemo(() => {
    if (!props.killLocations) return [];
    return clusterKills(
      props.killLocations,
      clusterDistance(),
      minClusterRadius
    );
  });

  // Draw the map with current zoom/pan
  const drawMap = () => {
    if (!canvasRef || !imageLoaded() || !mapImage) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply pan and zoom transformations
    const currentScale = scale();
    const pos = position();
    ctx.translate(pos.x, pos.y);
    ctx.scale(currentScale, currentScale);

    // Draw background map image
    ctx.drawImage(
      mapImage,
      0,
      0,
      CALYPSO_CONFIG.IMAGE_WIDTH,
      CALYPSO_CONFIG.IMAGE_HEIGHT
    );

    // Draw path if enabled
    if (showPath() && props.path && props.path.length > 1) {
      ctx.strokeStyle = "rgba(96, 165, 250, 0.6)";
      ctx.lineWidth = 3 / currentScale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const firstPoint = coordsToPixels(props.path[0]!.lon, props.path[0]!.lat);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < props.path.length; i++) {
        const point = coordsToPixels(props.path[i]!.lon, props.path[i]!.lat);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw hunting zones if enabled (light outlines only)
    if (showZones()) {
      props.zones.forEach((zone) => {
        const center = coordsToPixels(zone.center.lon, zone.center.lat);

        const isProfitable = zone.avgProfitPerHour > 0;
        const strokeColor = isProfitable ? "#22c55e" : "#ef4444";

        // Draw zone outline only (no fill)
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5 / currentScale;
        ctx.setLineDash([5 / currentScale, 5 / currentScale]); // Dashed line
        ctx.beginPath();
        ctx.arc(center.x, center.y, zone.radius / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Highlight hovered zone with glow
        if (hoveredZone() === zone) {
          ctx.strokeStyle = "#60a5fa";
          ctx.lineWidth = 3 / currentScale;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(center.x, center.y, zone.radius / 2 + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      });
    }

    // Draw kill clusters if enabled
    if (showKills()) {
      const clusters = killClusters();

      clusters.forEach((cluster) => {
        const center = coordsToPixels(cluster.center.lon, cluster.center.lat);
        const pixelRadius =
          (cluster.radius / CALYPSO_CONFIG.PLANET_WIDTH) *
          CALYPSO_CONFIG.IMAGE_WIDTH *
          CALYPSO_CONFIG.COORDINATE_MULTIPLIER;

        // Draw cluster circle (subtle fill)
        ctx.fillStyle = "rgba(251, 146, 60, 0.1)";
        ctx.strokeStyle = "#fb923c";
        ctx.lineWidth = 2 / currentScale;
        ctx.beginPath();
        ctx.arc(center.x, center.y, pixelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw individual kill markers within cluster
        cluster.kills.forEach((kill) => {
          const point = coordsToPixels(kill.location.lon, kill.location.lat);

          // Draw kill dot
          ctx.fillStyle = "#fb923c";
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4 / currentScale, 0, Math.PI * 2);
          ctx.fill();

          // Add white center dot for visibility
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1.5 / currentScale, 0, Math.PI * 2);
          ctx.fill();
        });

        // Note: minClusterRadius is applied in clusterKills function

        // Draw cluster count label
        ctx.fillStyle = "#fb923c";
        ctx.font = `bold ${14 / currentScale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${cluster.kills.length}`, center.x, center.y);
      });
    }

    // Draw death locations if enabled
    if (showDeaths()) {
      props.deathLocations?.forEach((death) => {
        const point = coordsToPixels(death.location.lon, death.location.lat);
        ctx.strokeStyle = "#ef4444";
        ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
        ctx.lineWidth = 3 / currentScale;
        const size = 10 / currentScale;

        // Draw red circle background
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Draw X
        ctx.beginPath();
        ctx.moveTo(point.x - size * 0.6, point.y - size * 0.6);
        ctx.lineTo(point.x + size * 0.6, point.y + size * 0.6);
        ctx.moveTo(point.x + size * 0.6, point.y - size * 0.6);
        ctx.lineTo(point.x - size * 0.6, point.y + size * 0.6);
        ctx.stroke();
      });
    }

    ctx.restore();
  };

  // Mouse wheel zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = scale();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, currentScale * zoomFactor));

    // Zoom towards mouse position
    const pos = position();
    const scaleChange = newScale / currentScale;
    const newX = mouseX - (mouseX - pos.x) * scaleChange;
    const newY = mouseY - (mouseY - pos.y) * scaleChange;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  // Mouse drag pan
  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position().x, y: e.clientY - position().y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef || !canvasRef) return;

    // Update hover state
    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    // Pan if dragging
    if (isDragging()) {
      const drag = dragStart();
      setPosition({
        x: e.clientX - drag.x,
        y: e.clientY - drag.y,
      });
      return;
    }

    // Check zone hover
    const currentScale = scale();
    const pos = position();
    const mapX = (x - pos.x) / currentScale;
    const mapY = (y - pos.y) / currentScale;

    let foundZone: HuntingZone | null = null;
    if (showZones()) {
      for (const zone of props.zones) {
        const center = coordsToPixels(zone.center.lon, zone.center.lat);
        const distance = Math.sqrt(
          Math.pow(mapX - center.x, 2) + Math.pow(mapY - center.y, 2)
        );
        if (distance <= zone.radius / 2) {
          foundZone = zone;
          break;
        }
      }
    }

    setHoveredZone(foundZone);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredZone(null);
    setMousePos(null);
  };

  const handleClick = () => {
    const zone = hoveredZone();
    if (zone && props.onZoneClick) {
      props.onZoneClick(zone);
    }
  };

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(5, prev * 1.3));
  const zoomOut = () => setScale((prev) => Math.max(0.1, prev / 1.3));
  const resetView = () => {
    setScale(0.5);
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setPosition({
        x: (rect.width - CALYPSO_CONFIG.IMAGE_WIDTH * 0.5) / 2,
        y: (rect.height - CALYPSO_CONFIG.IMAGE_HEIGHT * 0.5) / 2,
      });
    }
  };

  // Setup
  onMount(() => {
    mapImage = new Image();
    mapImage.onload = () => {
      setImageLoaded(true);
      setIsLoading(false);
      resetView();
      drawMap();
    };
    mapImage.onerror = () => {
      console.error("Failed to load map image");
      setIsLoading(false);
    };
    mapImage.src = CALYPSO_CONFIG.MAP_IMAGE;

    const handleResize = () => {
      resetView();
      drawMap();
    };
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
    });
  });

  // Redraw when state changes
  createEffect(() => {
    // Track all reactive dependencies
    props.zones;
    props.killLocations;
    props.deathLocations;
    props.path;
    scale();
    position();
    hoveredZone();
    showZones();
    showKills();
    showDeaths();
    showPath();
    imageLoaded();
    clusterDistance();

    // Redraw the map
    drawMap();
  });

  // Poll for Live GPS updates every 5 seconds (DISABLED - using direct props.liveUpdates instead)
  // createEffect(() => {
  //   if (!props.liveGPS || !showLiveGPS()) return;

  //   const interval = setInterval(() => {
  //     const updates = props.liveGPS!.getActiveUpdates();
  //     setLiveUpdates(updates);
  //   }, 5000);

  //   // Initial fetch
  //   const updates = props.liveGPS.getActiveUpdates();
  //   setLiveUpdates(updates);

  //   onCleanup(() => clearInterval(interval));
  // });

  // Sync liveUpdates from props if passed directly
  createEffect(() => {
    if (props.liveUpdates) {
      setLiveUpdates(props.liveUpdates);
    }
  });

  return (
    <div class="relative">
      <div
        ref={containerRef}
        class="relative overflow-hidden rounded-lg border border-primary/20 bg-background-card"
        style={{ height: props.height || "700px" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <Show when={isLoading()}>
          <div class="absolute inset-0 flex items-center justify-center bg-background-card">
            <div class="text-primary/60">Loading map...</div>
          </div>
        </Show>

        <Show when={!isLoading()}>
          <Show
            when={imageLoaded()}
            fallback={
              <div class="absolute inset-0 flex items-center justify-center bg-background-card">
                <div class="text-danger">Failed to load map image</div>
              </div>
            }
          >
            {/* Interactive canvas with map and overlays */}
            <canvas
              ref={canvasRef}
              class="absolute inset-0 w-full h-full"
              style={{
                cursor: isDragging()
                  ? "grabbing"
                  : hoveredZone()
                    ? "pointer"
                    : "grab",
              }}
              width={containerRef?.clientWidth || 800}
              height={containerRef?.clientHeight || 700}
            />

            {/* Zoom controls */}
            <div class="absolute top-4 left-4 flex flex-col gap-2 z-10">
              <button
                class="p-2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg hover:border-primary/40 hover:bg-background-card transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                onClick={(e) => {
                  e.stopPropagation();
                  zoomIn();
                }}
                title="Zoom In"
                aria-label="Zoom in"
              >
                <ZoomIn size={20} class="text-primary" />
              </button>
              <button
                class="p-2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg hover:border-primary/40 hover:bg-background-card transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                onClick={(e) => {
                  e.stopPropagation();
                  zoomOut();
                }}
                title="Zoom Out"
                aria-label="Zoom out"
              >
                <ZoomOut size={20} class="text-primary" />
              </button>
              <button
                class="p-2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg hover:border-primary/40 hover:bg-background-card transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                onClick={(e) => {
                  e.stopPropagation();
                  resetView();
                }}
                title="Reset View"
                aria-label="Reset view to default"
              >
                <Maximize2 size={20} class="text-primary" />
              </button>
            </div>

            {/* Layer controls */}
            <div class="absolute top-4 right-4 z-10">
              <button
                class="p-2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg hover:border-primary/40 hover:bg-background-card transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLayerPanel(!showLayerPanel());
                }}
                title="Toggle Layers"
                aria-label="Toggle layer controls panel"
                aria-expanded={showLayerPanel()}
              >
                <Layers size={20} class="text-primary" />
              </button>

              <Show when={showLayerPanel()}>
                <div class="mt-2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg p-3 space-y-2 text-sm min-w-[200px]">
                  <div class="font-semibold text-primary uppercase tracking-wide mb-3">
                    Layers
                  </div>

                  <label class="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={showZones()}
                      onChange={(e) => setShowZones(e.currentTarget.checked)}
                      class="w-4 h-4 rounded border-primary/20 bg-background-lighter text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-card"
                      aria-label="Toggle hunting zones visibility"
                    />
                    <span class="text-primary/80">
                      Hunting Zones ({props.zones.length})
                    </span>
                  </label>

                  <Show
                    when={props.killLocations && props.killLocations.length > 0}
                  >
                    <label class="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showKills()}
                        onChange={(e) => setShowKills(e.currentTarget.checked)}
                        class="w-4 h-4 rounded border-primary/20 bg-background-lighter text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-card"
                        aria-label="Toggle mob kill markers visibility"
                      />
                      <span class="text-primary/80">
                        Mob Kills ({props.killLocations!.length})
                      </span>
                    </label>
                  </Show>

                  <Show
                    when={
                      props.deathLocations && props.deathLocations.length > 0
                    }
                  >
                    <label class="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showDeaths()}
                        onChange={(e) => setShowDeaths(e.currentTarget.checked)}
                        class="w-4 h-4 rounded border-primary/20 bg-background-lighter text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-card"
                        aria-label="Toggle death markers visibility"
                      />
                      <span class="text-primary/80">
                        Deaths ({props.deathLocations!.length})
                      </span>
                    </label>
                  </Show>

                  <Show when={props.path && props.path.length > 0}>
                    <label class="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={showPath()}
                        onChange={(e) => setShowPath(e.currentTarget.checked)}
                        class="w-4 h-4 rounded border-primary/20 bg-background-lighter text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-card"
                        aria-label="Toggle GPS movement path visibility"
                      />
                      <span class="text-primary/80">GPS Path</span>
                    </label>
                  </Show>

                  {/* Cluster Settings */}
                  <Show
                    when={
                      showKills() &&
                      props.killLocations &&
                      props.killLocations.length > 0
                    }
                  >
                    <div class="pt-3 mt-3 border-t border-primary/10">
                      <div class="text-xs font-semibold text-primary/80 uppercase tracking-wide mb-2">
                        Cluster Settings
                      </div>

                      <div class="space-y-3">
                        <div>
                          <label class="flex justify-between text-xs text-primary/70 mb-1">
                            <span>Group Distance</span>
                            <span class="font-mono text-primary">
                              {clusterDistance()}m
                            </span>
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="2000"
                            step="50"
                            value={clusterDistance()}
                            onInput={(e) =>
                              setClusterDistance(
                                parseInt(e.currentTarget.value)
                              )
                            }
                            class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                            style={{
                              "accent-color": "#3b82f6",
                            }}
                            aria-label="Cluster distance in meters"
                            aria-valuemin="100"
                            aria-valuemax="2000"
                            aria-valuenow={clusterDistance()}
                          />
                          <div class="text-xs text-primary/50 mt-1">
                            Max distance to group kills
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Zoom indicator */}
            <div class="absolute bottom-4 left-4 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-2 text-sm z-10 pointer-events-none">
              <span class="text-primary/60 font-mono">
                {Math.round(scale() * 100)}%
              </span>
            </div>

            {/* Hover tooltip */}
            <Show when={hoveredZone() && mousePos()}>
              <div
                class="absolute bg-background-card border border-primary/20 rounded-lg p-3 pointer-events-none z-50 shadow-lg"
                style={{
                  left: `${mousePos()!.x + 15}px`,
                  top: `${mousePos()!.y + 15}px`,
                }}
              >
                <div class="text-sm font-semibold text-primary mb-1">
                  Hunting Zone
                </div>
                <div class="text-xs space-y-1">
                  <div class="flex justify-between gap-4">
                    <span class="text-primary/60">Location:</span>
                    <span class="text-white font-mono">
                      {hoveredZone()!.center.lon.toFixed(0)},{" "}
                      {hoveredZone()!.center.lat.toFixed(0)}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-primary/60">Sessions:</span>
                    <span class="text-white font-mono">
                      {hoveredZone()!.sessionCount}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-primary/60">Avg PED/h:</span>
                    <span
                      class={`font-mono font-bold ${
                        hoveredZone()!.avgProfitPerHour > 0
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {hoveredZone()!.avgProfitPerHour.toFixed(1)}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-primary/60">Total Profit:</span>
                    <span
                      class={`font-mono ${
                        hoveredZone()!.totalProfit > 0
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {hoveredZone()!.totalProfit.toFixed(2)} PED
                    </span>
                  </div>
                  <Show when={hoveredZone()!.deathCount > 0}>
                    <div class="flex justify-between gap-4">
                      <span class="text-primary/60">Deaths:</span>
                      <span class="text-danger font-mono">
                        {hoveredZone()!.deathCount}
                      </span>
                    </div>
                  </Show>
                </div>
                <div class="text-xs text-primary/40 mt-2">
                  Click for details
                </div>
              </div>
            </Show>

            {/* Live GPS Overlay */}
            <Show when={showLiveGPS() && props.liveGPS}>
              <LiveGPSOverlay
                updates={liveUpdates()}
                currentUserId={settings().userId}
                visible={showLiveGPS()}
                transform={{
                  translateX: position().x,
                  translateY: position().y,
                  scale: scale(),
                }}
                onUserClick={(userId) => {
                  console.log("[Map] Clicked user:", userId);
                }}
              />
            </Show>

            {/* Instructions overlay */}
            <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg px-4 py-2 text-xs text-primary/60 z-10 pointer-events-none">
              🖱️ Drag to pan • 🖱️ Scroll to zoom • Click zone for details
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

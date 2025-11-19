import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Coordinate, HuntingZone } from "@core/types/GPS";
import { coordsToPixels, CALYPSO_CONFIG } from "@core/utils/mapUtils";
import { XCircle } from "lucide-solid";

interface MapViewProps {
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
}

/**
 * Simple map visualization component for GPS Analytics
 * Displays hunting zones, mob kills, and death locations on Calypso map
 */
export function MapView(props: MapViewProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [hoveredZone, setHoveredZone] = createSignal<HuntingZone | null>(null);
  const [mousePos, setMousePos] = createSignal<{ x: number; y: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = createSignal(true);
  const [imageLoaded, setImageLoaded] = createSignal(false);

  // Draw the map overlay
  const drawMap = () => {
    if (!canvasRef || !imageLoaded()) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get container dimensions
    const container = containerRef;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate scale to fit map in container while maintaining aspect ratio
    const scaleX = containerWidth / CALYPSO_CONFIG.IMAGE_WIDTH;
    const scaleY = containerHeight / CALYPSO_CONFIG.IMAGE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    // Calculate offset to center the map
    const offsetX = (containerWidth - CALYPSO_CONFIG.IMAGE_WIDTH * scale) / 2;
    const offsetY = (containerHeight - CALYPSO_CONFIG.IMAGE_HEIGHT * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw path if provided
    if (props.path && props.path.length > 1) {
      ctx.strokeStyle = "rgba(96, 165, 250, 0.5)";
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      const firstPoint = coordsToPixels(props.path[0]!.lon, props.path[0]!.lat);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < props.path.length; i++) {
        const point = coordsToPixels(props.path[i]!.lon, props.path[i]!.lat);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw hunting zones as circles
    props.zones.forEach((zone) => {
      const center = coordsToPixels(zone.center.lon, zone.center.lat);

      // Determine color based on profitability
      const isProfitable = zone.avgProfitPerHour > 0;
      const fillColor = isProfitable
        ? `rgba(34, 197, 94, ${0.1 + Math.min(zone.avgProfitPerHour / 1000, 0.3)})`
        : `rgba(239, 68, 68, ${0.1 + Math.min(Math.abs(zone.avgProfitPerHour) / 500, 0.3)})`;
      const strokeColor = isProfitable ? "#22c55e" : "#ef4444";

      // Draw zone circle
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(center.x, center.y, zone.radius / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Highlight hovered zone
      if (hoveredZone() === zone) {
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 4 / scale;
        ctx.beginPath();
        ctx.arc(center.x, center.y, zone.radius / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw kill locations as small dots
    props.killLocations?.forEach((kill) => {
      const point = coordsToPixels(kill.location.lon, kill.location.lat);
      ctx.fillStyle = "rgba(251, 146, 60, 0.8)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 / scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw death locations as red X marks
    props.deathLocations?.forEach((death) => {
      const point = coordsToPixels(death.location.lon, death.location.lat);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3 / scale;
      const size = 8 / scale;
      ctx.beginPath();
      ctx.moveTo(point.x - size, point.y - size);
      ctx.lineTo(point.x + size, point.y + size);
      ctx.moveTo(point.x + size, point.y - size);
      ctx.lineTo(point.x - size, point.y + size);
      ctx.stroke();
    });

    ctx.restore();
  };

  // Handle mouse move to detect zone hover
  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef || !canvasRef) return;

    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    // Calculate scale and offset
    const containerWidth = containerRef.clientWidth;
    const containerHeight = containerRef.clientHeight;
    const scaleX = containerWidth / CALYPSO_CONFIG.IMAGE_WIDTH;
    const scaleY = containerHeight / CALYPSO_CONFIG.IMAGE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (containerWidth - CALYPSO_CONFIG.IMAGE_WIDTH * scale) / 2;
    const offsetY = (containerHeight - CALYPSO_CONFIG.IMAGE_HEIGHT * scale) / 2;

    // Convert mouse position to map coordinates
    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;

    // Check if hovering over any zone
    let foundZone: HuntingZone | null = null;
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

    setHoveredZone(foundZone);
  };

  const handleMouseLeave = () => {
    setHoveredZone(null);
    setMousePos(null);
  };

  const handleClick = () => {
    const zone = hoveredZone();
    if (zone && props.onZoneClick) {
      props.onZoneClick(zone);
    }
  };

  // Setup canvas and event listeners
  onMount(() => {
    // Load map image
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setIsLoading(false);
      drawMap();
    };
    img.onerror = () => {
      console.error("Failed to load map image");
      setIsLoading(false);
    };
    img.src = CALYPSO_CONFIG.MAP_IMAGE;

    // Redraw on window resize
    const handleResize = () => drawMap();
    window.addEventListener("resize", handleResize);

    onCleanup(() => {
      window.removeEventListener("resize", handleResize);
    });
  });

  // Redraw when data changes
  const redraw = () => {
    if (imageLoaded()) {
      drawMap();
    }
  };

  // Watch for prop changes
  const _ = () => {
    props.zones;
    props.killLocations;
    props.deathLocations;
    props.path;
    hoveredZone();
    redraw();
  };
  _();

  return (
    <div class="relative">
      <div
        ref={containerRef}
        class="relative overflow-hidden rounded-lg border border-primary/20 bg-background-card"
        style={{ height: props.height || "600px" }}
        onMouseMove={handleMouseMove}
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
            {/* Map background image */}
            <img
              src={CALYPSO_CONFIG.MAP_IMAGE}
              alt="Calypso Map"
              class="absolute inset-0 w-full h-full object-contain"
            />

            {/* Overlay canvas for zones and markers */}
            <canvas
              ref={canvasRef}
              class="absolute inset-0 w-full h-full cursor-pointer"
              width={containerRef?.clientWidth || 800}
              height={containerRef?.clientHeight || 600}
            />

            {/* Legend */}
            <div class="absolute top-4 right-4 bg-background-card/90 backdrop-blur-sm border border-primary/20 rounded-lg p-3 space-y-2 text-sm">
              <div class="font-semibold text-primary uppercase tracking-wide mb-2">
                Legend
              </div>
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-success/30 border-2 border-success"></div>
                <span class="text-primary/80">Profitable Zones</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-danger/30 border-2 border-danger"></div>
                <span class="text-primary/80">Loss Zones</span>
              </div>
              <Show
                when={props.killLocations && props.killLocations.length > 0}
              >
                <div class="flex items-center gap-2">
                  <div class="w-4 h-4 rounded-full bg-accent"></div>
                  <span class="text-primary/80">Mob Kills</span>
                </div>
              </Show>
              <Show
                when={props.deathLocations && props.deathLocations.length > 0}
              >
                <div class="flex items-center gap-2">
                  <XCircle size={16} class="text-danger" />
                  <span class="text-primary/80">Deaths</span>
                </div>
              </Show>
            </div>

            {/* Hover tooltip */}
            <Show when={hoveredZone() && mousePos()}>
              <div
                class="absolute bg-background-card border border-primary/20 rounded-lg p-3 pointer-events-none z-10 shadow-lg"
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
          </Show>
        </Show>
      </div>

      {/* Zone stats summary */}
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="bg-background-card border border-primary/10 rounded-lg p-3">
          <div class="text-xs text-primary/60 uppercase tracking-wide mb-1">
            Total Zones
          </div>
          <div class="text-2xl font-bold text-primary font-mono">
            {props.zones.length}
          </div>
        </div>
        <div class="bg-background-card border border-primary/10 rounded-lg p-3">
          <div class="text-xs text-primary/60 uppercase tracking-wide mb-1">
            Total Kills
          </div>
          <div class="text-2xl font-bold text-accent font-mono">
            {props.killLocations?.length || 0}
          </div>
        </div>
        <div class="bg-background-card border border-primary/10 rounded-lg p-3">
          <div class="text-xs text-primary/60 uppercase tracking-wide mb-1">
            Total Deaths
          </div>
          <div class="text-2xl font-bold text-danger font-mono">
            {props.deathLocations?.length || 0}
          </div>
        </div>
      </div>
    </div>
  );
}

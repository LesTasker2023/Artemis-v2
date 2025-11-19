/**
 * GPS Tracking Service
 * 
 * Tracks GPS coordinates from chat.log when user manually presses <,> in-game.
 * No keyboard automation - just monitoring and counting.
 */

export interface GPSTrackingStatus {
  isTracking: boolean;
  captureCount: number;
  lastCaptureTime: number | null;
}

export class GPSCaptureService {
  private status: GPSTrackingStatus = {
    isTracking: false,
    captureCount: 0,
    lastCaptureTime: null,
  };

  /**
   * Start tracking GPS (just enables the counter)
   */
  start(): GPSTrackingStatus {
    this.status.isTracking = true;
    console.log('[GPS] 📍 GPS tracking enabled - press <,> in-game to capture');
    return this.status;
  }

  /**
   * Stop tracking GPS
   */
  stop(): GPSTrackingStatus {
    this.status.isTracking = false;
    console.log('[GPS] GPS tracking disabled');
    return this.status;
  }

  /**
   * Increment GPS capture count (called by LogParser when GPS event detected)
   */
  recordCapture(): void {
    this.status.captureCount++;
    this.status.lastCaptureTime = Date.now();
    console.log(`[GPS] ✅ GPS captured #${this.status.captureCount}`);
  }

  /**
   * Get current status
   */
  getStatus(): GPSTrackingStatus {
    return { ...this.status };
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.status.captureCount = 0;
    this.status.lastCaptureTime = null;
  }
}

// Singleton instance
let gpsService: GPSCaptureService | null = null;

/**
 * Get or create the GPS tracking service
 */
export function getGPSCaptureService(): GPSCaptureService {
  if (!gpsService) {
    gpsService = new GPSCaptureService();
  }
  return gpsService;
}

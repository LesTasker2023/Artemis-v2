/**
 * Live GPS Service
 * Real-time location sharing via Discord webhooks
 */

import { LiveGPSUpdate, UserPresence } from '../types/User';
import { Coordinate } from '../types/GPS';

export interface LiveGPSConfig {
  discordWebhookUrl: string;
  updateInterval: number; // milliseconds
  ttl: number; // time-to-live for updates
}

export class LiveGPSService {
  private config: LiveGPSConfig;
  private localUpdates: Map<string, LiveGPSUpdate> = new Map();
  private updateTimer?: NodeJS.Timeout;
  private lastBroadcast: number = 0;

  constructor(config: LiveGPSConfig) {
    this.config = config;
  }

  /**
   * Start broadcasting local GPS updates
   */
  startBroadcasting(userId: string, username: string): void {
    console.log(`[LiveGPS] 📡 Starting GPS broadcast for ${username}`);
    
    if (this.updateTimer) {
      this.stopBroadcasting();
    }

    // Don't actually broadcast yet - wait for first GPS update
    // Timer will be started when first update is received
  }

  /**
   * Stop broadcasting GPS updates
   */
  async stopBroadcasting(): Promise<void> {
    console.log('[LiveGPS] 🛑 Stopping GPS broadcast');
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }

    // Send termination message to Discord
    await this.sendTerminationMessage();
  }

  /**
   * Send termination message to Discord
   */
  async sendTerminationMessage(userId?: string, username?: string): Promise<void> {
    if (!this.config.discordWebhookUrl) {
      return;
    }

    try {
      const payload = {
        username: 'ARTEMIS GPS Tracker',
        content: userId ? `GPS_OFFLINE:${userId}` : '🔴 GPS tracking stopped',
        embeds: [{
          title: username ? `📍 ${username} - Offline` : '📍 Hunter Offline',
          description: 'GPS tracking has been disabled',
          color: 0xef4444, // Red
          timestamp: new Date().toISOString(),
          footer: {
            text: 'ARTEMIS Live GPS',
          },
        }],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        await fetch(this.config.discordWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        console.log('[LiveGPS] ✅ Termination message sent to Discord');
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('[LiveGPS] ⚠️ Failed to send termination message:', error);
      // Don't throw - this is best-effort
    }
  }

  /**
   * Broadcast current GPS location to all users
   */
  async broadcastLocation(update: LiveGPSUpdate): Promise<void> {
    // Validate coordinates before broadcasting
    if (!this.isValidCoordinate(update.location)) {
      console.error('[LiveGPS] ❌ Invalid coordinates, aborting broadcast');
      return;
    }

    try {
      // Send to Discord webhook (no retries - they cause duplicates)
      await this.sendToDiscord(update);
    } catch (error) {
      console.error('[ARTEMIS] ❌ Failed to broadcast location:', error);
      // Don't retry - user can manually retry if needed
    }
  }
  
  /**
   * Receive GPS update from another user
   */
  receiveUpdate(update: LiveGPSUpdate): void {
    // Validate timestamp
    const now = Date.now();
    const age = now - update.timestamp;
    
    // Reject future timestamps (clock skew tolerance: 5 seconds)
    if (update.timestamp > now + 5000) {
      console.warn(`[LiveGPS] ⚠️ Rejecting future timestamp from ${update.username}`);
      return;
    }
    
    // Validate TTL
    if (age > update.ttl) {
      console.log(`[LiveGPS] ⏰ Ignoring expired update from ${update.username} (age: ${age}ms)`);
      return;
    }
    
    // Validate coordinates are within reasonable bounds
    if (!this.isValidCoordinate(update.location)) {
      console.warn(`[LiveGPS] ⚠️ Invalid coordinates from ${update.username}: ${update.location.lon}, ${update.location.lat}`);
      return;
    }

    console.log(`[LiveGPS] 📥 Received update from ${update.username}`);
    this.localUpdates.set(update.userId, update);

    // Clean up expired updates
    this.cleanExpiredUpdates();
  }
  
  /**
   * Validate coordinate bounds (Entropia Universe map bounds)
   */
  private isValidCoordinate(coord: Coordinate): boolean {
    // Entropia map roughly: 0-100000 for both lon/lat
    const isValid = 
      !isNaN(coord.lon) && 
      !isNaN(coord.lat) &&
      isFinite(coord.lon) && 
      isFinite(coord.lat) &&
      coord.lon >= 0 && coord.lon <= 100000 &&
      coord.lat >= 0 && coord.lat <= 100000;
    
    return isValid;
  }

  /**
   * Get all active GPS updates
   */
  getActiveUpdates(): LiveGPSUpdate[] {
    this.cleanExpiredUpdates();
    return Array.from(this.localUpdates.values());
  }

  /**
   * Get GPS update for specific user
   */
  getUserLocation(userId: string): LiveGPSUpdate | undefined {
    const update = this.localUpdates.get(userId);
    
    if (!update) return undefined;
    
    // Check if expired
    const age = Date.now() - update.timestamp;
    if (age > update.ttl) {
      this.localUpdates.delete(userId);
      return undefined;
    }
    
    return update;
  }

  /**
   * Get nearby users within radius (meters)
   */
  getNearbyUsers(center: Coordinate, radiusMeters: number): LiveGPSUpdate[] {
    this.cleanExpiredUpdates();
    
    return Array.from(this.localUpdates.values()).filter(update => {
      const distance = this.calculateDistance(center, update.location);
      return distance <= radiusMeters;
    });
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000; // Earth radius in meters (for real-world calculation)
    
    // For Entropia Universe, use simpler Euclidean distance
    // since the map is flat and coordinates are in meters
    const dx = coord2.lon - coord1.lon;
    const dy = coord2.lat - coord1.lat;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Remove expired updates from cache
   */
  private cleanExpiredUpdates(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [userId, update] of this.localUpdates.entries()) {
      const age = now - update.timestamp;
      if (age > update.ttl) {
        expiredKeys.push(userId);
      }
    }

    if (expiredKeys.length > 0) {
      console.log(`[LiveGPS] 🧹 Cleaning ${expiredKeys.length} expired updates`);
      expiredKeys.forEach(key => this.localUpdates.delete(key));
    }
  }

  /**
   * Send GPS update to Discord webhook
   */
  private async sendToDiscord(update: LiveGPSUpdate): Promise<void> {
    if (!this.config.discordWebhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    // Create Discord embed with GPS data
    const embed = {
      title: `📍 ${update.username} - Location Update`,
      color: 0x3b82f6, // Primary blue
      fields: [
        {
          name: 'Coordinates',
          value: `Lon: ${update.location.lon.toFixed(0)}, Lat: ${update.location.lat.toFixed(0)}`,
          inline: true,
        },
        {
          name: 'Status',
          value: update.status.charAt(0).toUpperCase() + update.status.slice(1),
          inline: true,
        },
        ...(update.loadoutName
          ? [{ name: 'Loadout', value: update.loadoutName, inline: true }]
          : []),
        ...(update.currentProfit !== undefined
          ? [{ name: 'Profit', value: `${update.currentProfit.toFixed(2)} PED`, inline: true }]
          : []),
        ...(update.killCount !== undefined
          ? [{ name: 'Kills', value: `${update.killCount}`, inline: true }]
          : []),
        ...(update.lastKill
          ? [{ name: 'Last Kill', value: `💀 ${update.lastKill}`, inline: true }]
          : []),
      ],
      timestamp: new Date(update.timestamp).toISOString(),
      footer: {
        text: 'ARTEMIS Live GPS',
      },
    };

    const payload = {
      username: 'ARTEMIS GPS Tracker',
      embeds: [embed],
      // Include raw data in content for parsing by other clients
      content: `GPS:${update.userId}:${update.location.lon}:${update.location.lat}:${update.timestamp}`,
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(this.config.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Discord webhook failed (${response.status}): ${errorText}`);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Discord webhook timeout after 10 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse GPS update from Discord message content
   */
  static parseDiscordMessage(content: string): Partial<LiveGPSUpdate> | null {
    // Sanitize input
    if (!content || typeof content !== 'string' || content.length > 500) {
      return null;
    }
    
    // Format: GPS:userId:lon:lat:timestamp
    const match = content.match(/^GPS:([^:]+):([^:]+):([^:]+):([^:]+)$/);
    
    if (!match) return null;

    const [, userId, lonStr, latStr, timestampStr] = match;
    
    // Validate and parse numbers
    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);
    const timestamp = parseInt(timestampStr, 10);
    
    // Validate parsed values
    if (isNaN(lon) || isNaN(lat) || isNaN(timestamp)) {
      console.warn('[LiveGPS] ⚠️ Invalid number values in GPS message');
      return null;
    }
    
    if (!userId || userId.length > 100) {
      console.warn('[LiveGPS] ⚠️ Invalid userId in GPS message');
      return null;
    }
    
    // Validate timestamp is reasonable (not too far in past or future)
    const now = Date.now();
    const age = now - timestamp;
    if (age < -60000 || age > 3600000) { // Max 1 hour old
      console.warn('[LiveGPS] ⚠️ Timestamp out of reasonable range');
      return null;
    }
    
    return {
      userId,
      location: { lon, lat },
      timestamp,
    };
  }

  /**
   * Create presence object from GPS update
   */
  static toPresence(update: LiveGPSUpdate): UserPresence {
    return {
      userId: update.userId,
      username: update.username,
      avatar: update.avatar,
      status: update.status === 'hunting' ? 'hunting' : 'online',
      currentSessionId: update.sessionId,
      lastLocation: {
        lon: update.location.lon,
        lat: update.location.lat,
        timestamp: update.timestamp,
      },
      lastSeen: update.timestamp,
      lastActive: update.timestamp,
    };
  }
}

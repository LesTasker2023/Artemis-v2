/**
 * Discord Integration Service
 * Handles Discord Rich Presence and webhook communication
 */

import { LiveGPSUpdate } from '../../core/types/User';
import { LiveGPSService } from '../../core/services/LiveGPSService';

export interface DiscordConfig {
  webhookUrl: string;
  channelId?: string;
  guildId?: string;
  clientId?: string; // For Rich Presence
}

export class DiscordIntegrationService {
  private config: DiscordConfig;
  private liveGPS: LiveGPSService;
  private pollInterval?: NodeJS.Timeout;
  private lastMessageId?: string;

  constructor(config: DiscordConfig, liveGPS: LiveGPSService) {
    this.config = config;
    this.liveGPS = liveGPS;
  }

  /**
   * Start listening for GPS updates from Discord channel
   */
  async startListening(pollIntervalMs: number = 10000): Promise<void> {
    console.log('[Discord] 👂 Starting to listen for GPS updates');

    // Poll Discord channel for new messages
    this.pollInterval = setInterval(async () => {
      await this.fetchRecentUpdates();
    }, pollIntervalMs);

    // Initial fetch
    await this.fetchRecentUpdates();
  }

  /**
   * Stop listening for updates
   */
  stopListening(): void {
    console.log('[Discord] 🛑 Stopping Discord listener');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  /**
   * Fetch recent GPS updates from Discord channel
   * Note: This is a simplified implementation
   * For production, use Discord bot with proper API access
   */
  private async fetchRecentUpdates(): Promise<void> {
    try {
      // This is a placeholder for Discord API integration
      // In production, you would:
      // 1. Use Discord bot with Message Content Intent
      // 2. Listen to MESSAGE_CREATE events via WebSocket Gateway
      // 3. Parse GPS messages and call liveGPS.receiveUpdate()

      // For now, this demonstrates the architecture
      console.log('[Discord] 🔄 Checking for new GPS updates...');
      
      // Example of what would happen when receiving a message:
      // const message = await this.fetchChannelMessages();
      // const gpsData = LiveGPSService.parseDiscordMessage(message.content);
      // if (gpsData) {
      //   this.liveGPS.receiveUpdate(gpsData as LiveGPSUpdate);
      // }
      
    } catch (error) {
      console.error('[Discord] ❌ Failed to fetch updates:', error);
    }
  }

  /**
   * Update Discord Rich Presence
   */
  async updateRichPresence(data: {
    details?: string;
    state?: string;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
  }): Promise<void> {
    // This would integrate with Discord RPC
    // For Electron app, we'd use discord-rpc package
    console.log('[Discord] 🎮 Updating Rich Presence:', data);
  }
}

/**
 * Simple WebSocket-based GPS relay server
 * This is an alternative to Discord for users who want a dedicated solution
 */
export class GPSRelayServer {
  private ws: WebSocket | null = null;
  private liveGPS: LiveGPSService;
  private reconnectTimer?: NodeJS.Timeout;
  private serverUrl: string;

  constructor(serverUrl: string, liveGPS: LiveGPSService) {
    this.serverUrl = serverUrl;
    this.liveGPS = liveGPS;
  }

  /**
   * Connect to GPS relay server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[GPSRelay] Already connected');
      return;
    }

    console.log(`[GPSRelay] 🔌 Connecting to ${this.serverUrl}`);

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[GPSRelay] ✅ Connected to relay server');
        this.clearReconnectTimer();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[GPSRelay] ❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[GPSRelay] 🔌 Disconnected from relay server');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[GPSRelay] ❌ Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from relay server
   */
  disconnect(): void {
    console.log('[GPSRelay] 🛑 Disconnecting from relay server');
    
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send GPS update to relay server
   */
  broadcast(update: LiveGPSUpdate): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GPSRelay] ⚠️ Cannot broadcast - not connected');
      return;
    }

    const message = JSON.stringify({
      type: 'gps_update',
      data: update,
    });

    this.ws.send(message);
    console.log(`[GPSRelay] 📡 Broadcast location for ${update.username}`);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.type === 'gps_update') {
        const update = message.data as LiveGPSUpdate;
        this.liveGPS.receiveUpdate(update);
        console.log(`[GPSRelay] 📥 Received update from ${update.username}`);
      } else if (message.type === 'user_list') {
        console.log(`[GPSRelay] 👥 ${message.data.length} users online`);
      }
    } catch (error) {
      console.error('[GPSRelay] ❌ Failed to parse message:', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log('[GPSRelay] ⏰ Reconnecting in 5 seconds...');
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 5000);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}

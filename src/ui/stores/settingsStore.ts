/**
 * User Settings Store
 * Manages user preferences and configuration
 */

import { createSignal } from 'solid-js';
import { DiscordConfig } from '../../config/discord';

export interface UserSettings {
  // User identity
  userId: string;
  username: string;
  
  // Live GPS settings
  liveGPS: {
    enabled: boolean;
    visibility: 'public' | 'friends' | 'off';
    shareSessionStats: boolean;
    updateInterval: number; // milliseconds
    discordWebhookUrl: string;
    discordBotToken: string;
    discordChannelId: string;
  };
}

// Default settings
const defaultSettings: UserSettings = {
  userId: crypto.randomUUID(),
  username: 'Hunter',
  liveGPS: {
    enabled: false, // GPS OFF by default
    visibility: 'off',
    shareSessionStats: true,
    updateInterval: 30000, // 30 seconds
    discordWebhookUrl: DiscordConfig.webhookUrl,
    discordBotToken: DiscordConfig.botToken,
    discordChannelId: DiscordConfig.channelId,
  },
};

// Load from localStorage
function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem('artemis-user-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Deep merge to ensure new fields like discordBotToken are included
      const merged = {
        ...defaultSettings,
        ...parsed,
        liveGPS: {
          ...defaultSettings.liveGPS,
          ...(parsed.liveGPS || {}),
          enabled: false, // Force GPS OFF on load (user must manually enable)
          // Always use latest Discord credentials from defaultSettings (don't persist in localStorage)
          discordWebhookUrl: defaultSettings.liveGPS.discordWebhookUrl,
          discordBotToken: defaultSettings.liveGPS.discordBotToken,
          discordChannelId: defaultSettings.liveGPS.discordChannelId,
        },
      };
      return merged;
    }
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
  }
  return defaultSettings;
}

// Save to localStorage
function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem('artemis-user-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
  }
}

// Global settings signal
const [settings, setSettings] = createSignal<UserSettings>(loadSettings());

// Update settings and persist
export function updateSettings(partial: Partial<UserSettings>): void {
  setSettings(prev => {
    const updated = { ...prev, ...partial };
    saveSettings(updated);
    return updated;
  });
}

// Update nested liveGPS settings
export function updateLiveGPSSettings(partial: Partial<UserSettings['liveGPS']>): void {
  setSettings(prev => {
    const updated = {
      ...prev,
      liveGPS: { ...prev.liveGPS, ...partial },
    };
    saveSettings(updated);
    return updated;
  });
}

// Export settings accessor
export { settings };

// Initialize user if needed
if (!loadSettings().userId) {
  updateSettings({
    userId: crypto.randomUUID(),
    username: `Hunter${Math.floor(Math.random() * 9999)}`,
  });
}

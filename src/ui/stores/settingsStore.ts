/**
 * User Settings Store
 * Manages user preferences and configuration
 */

import { createSignal } from 'solid-js';

export interface UserSettings {
  // User identity
  userId: string;
  username: string;
  
  // Live GPS settings
  liveGPS: {
    enabled: boolean;
    discordWebhookUrl: string;
    discordBotToken: string; // Bot token for reading messages
    discordChannelId: string; // Channel ID to read messages from
    visibility: 'public' | 'friends' | 'off';
    shareSessionStats: boolean;
    updateInterval: number; // milliseconds
  };
}

// Default settings
const defaultSettings: UserSettings = {
  userId: crypto.randomUUID(),
  username: 'Hunter',
  liveGPS: {
    enabled: false, // GPS OFF by default
    discordWebhookUrl: 'https://discord.com/api/webhooks/1437230958221988024/UJaRA7H6mpIqDrMdYXELrgHtptHJNV6JVDkosqgVR5vZ-m43LHySH3uNjrORzseTeeB9',
    discordBotToken: 'MTQyNTE4MjI1NjE3NDk5MzUwOA.Ga560B.8mouqeqGLCxabeeePUE9pPhlyKEJq84N2i8OYU',
    discordChannelId: '1439679193481871510',
    visibility: 'off',
    shareSessionStats: true,
    updateInterval: 30000, // 30 seconds
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

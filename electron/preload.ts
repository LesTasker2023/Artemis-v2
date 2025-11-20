import { contextBridge, ipcRenderer } from 'electron';
import type { Session } from '../src/core/types/Session';
import type { Loadout } from '../src/core/types/Loadout';
import type { SessionEvent } from '../src/core/types/Events';
import type { EquipmentSearchResult, EquipmentType } from '../src/core/services/EquipmentDataService';

// Expose safe IPC methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Session database operations
  session: {
    save: (session: Session) => ipcRenderer.invoke('session:save', session),
    findById: (id: string) => ipcRenderer.invoke('session:findById', id),
    findActive: (userId?: string) => ipcRenderer.invoke('session:findActive', userId),
    findAll: (userId?: string) => ipcRenderer.invoke('session:findAll', userId),
    delete: (id: string) => ipcRenderer.invoke('session:delete', id),
    deleteAll: () => ipcRenderer.invoke('session:deleteAll'),
    count: (userId?: string) => ipcRenderer.invoke('session:count', userId),
  },

  // Migration operations
  migration: {
    importV1Sessions: (basePath?: string) => 
      ipcRenderer.invoke('migration:importV1Sessions', basePath),
  },

  // Log watcher operations
  logWatcher: {
    detectPath: () => ipcRenderer.invoke('logwatcher:detectPath'),
    browsePath: () => ipcRenderer.invoke('logwatcher:browsePath'),
    start: (config: { logPath?: string; sessionId: string; userId: string }) =>
      ipcRenderer.invoke('logwatcher:start', config),
    stop: () => ipcRenderer.invoke('logwatcher:stop'),
    status: () => ipcRenderer.invoke('logwatcher:status'),
    
    // Event listeners
    onEvent: (callback: (event: SessionEvent) => void) => {
      ipcRenderer.on('logwatcher:event', (_e, event) => callback(event));
    },
    onEvents: (callback: (events: SessionEvent[]) => void) => {
      ipcRenderer.on('logwatcher:events', (_e, events) => callback(events));
    },
    onError: (callback: (error: string) => void) => {
      ipcRenderer.on('logwatcher:error', (_e, error) => callback(error));
    },
    onTruncated: (callback: () => void) => {
      ipcRenderer.on('logwatcher:truncated', () => callback());
    },
  },

  // GPS tracking operations
  gps: {
    start: () => ipcRenderer.invoke('gps:start'),
    stop: () => ipcRenderer.invoke('gps:stop'),
    status: () => ipcRenderer.invoke('gps:status'),
  },

  // User operations
  user: {
    getCurrent: () => ipcRenderer.invoke('user:getCurrent'),
    update: (user: any) => ipcRenderer.invoke('user:update', user),
    updateWebhook: (userId: string, webhookUrl: string | null) => 
      ipcRenderer.invoke('user:updateWebhook', userId, webhookUrl),
    updateGPSSettings: (userId: string, shareGPS: boolean, gpsVisibility: 'public' | 'friends' | 'off') => 
      ipcRenderer.invoke('user:updateGPSSettings', userId, shareGPS, gpsVisibility),
  },

  // Loadout operations
  loadout: {
    create: (loadout: Loadout) => ipcRenderer.invoke('loadout:save', loadout),
    update: (loadout: Loadout) => ipcRenderer.invoke('loadout:save', loadout),
    save: (loadout: Loadout) => ipcRenderer.invoke('loadout:save', loadout),
    findById: (id: string) => ipcRenderer.invoke('loadout:findById', id),
    findAll: (userId?: string) => ipcRenderer.invoke('loadout:findAll', userId),
    delete: (id: string) => ipcRenderer.invoke('loadout:delete', id),
    count: (userId?: string) => ipcRenderer.invoke('loadout:count', userId),
  },

  // Equipment data operations
  equipment: {
    search: (query: string, type?: EquipmentType, limit?: number) => 
      ipcRenderer.invoke('equipment:search', query, type, limit),
    getById: (id: number, type: EquipmentType) => 
      ipcRenderer.invoke('equipment:getById', id, type),
    getByName: (name: string, type?: EquipmentType) => 
      ipcRenderer.invoke('equipment:getByName', name, type),
    getAllByType: (type: EquipmentType) => 
      ipcRenderer.invoke('equipment:getAllByType', type),
    getStats: () => ipcRenderer.invoke('equipment:getStats'),
    isReady: () => ipcRenderer.invoke('equipment:isReady'),
  },

  // Discord API proxy (bypass CORS)
  discord: {
    getChannelMessages: (channelId: string, botToken: string, limit?: number) =>
      ipcRenderer.invoke('discord:getChannelMessages', channelId, botToken, limit),
  },

  // Keyboard automation (Windows only)
  keyboard: {
    sendKeys: (keys: string) => ipcRenderer.invoke('keyboard:sendKeys', keys),
    triggerLocationPing: () => ipcRenderer.invoke('keyboard:triggerLocationPing'),
  },

  // HUD Window Management
  hud: {
    show: () => ipcRenderer.invoke('hud:show'),
    hide: () => ipcRenderer.invoke('hud:hide'),
    close: () => ipcRenderer.invoke('hud:close'),
    toggle: () => ipcRenderer.invoke('hud:toggle'),
    resize: (width: number, height: number, animate?: boolean) => 
      ipcRenderer.invoke('hud:resize', width, height, animate),
    
    // Send live session updates to HUD
    updateSession: (session: Session | null, loadout?: Loadout | null) => 
      ipcRenderer.send('hud:updateSession', session, loadout),
    
    // Listen for session updates in HUD window
    onSessionUpdate: (callback: (session: Session | null, loadout?: Loadout | null) => void) => {
      ipcRenderer.on('hud:sessionUpdate', (_e, session, loadout) => callback(session, loadout));
    },
  },
  
  // Entropia Database operations
  entropiaDB: {
    init: () => ipcRenderer.invoke('entropia-db:init'),
    identifyMob: (estimatedHealth: number, location: { lon: number; lat: number }, lootItems?: string[]) =>
      ipcRenderer.invoke('entropia-db:identify-mob', estimatedHealth, location, lootItems),
    identifyMobBySpawn: (location: { lon: number; lat: number }, estimatedHealth: number) =>
      ipcRenderer.invoke('entropia-db:identify-by-spawn', location, estimatedHealth),
    findByHealth: (estimatedHealth: number, tolerance?: number) =>
      ipcRenderer.invoke('entropia-db:find-by-health', estimatedHealth, tolerance),
    findByLocation: (location: { lon: number; lat: number }, radiusMeters?: number) =>
      ipcRenderer.invoke('entropia-db:find-by-location', location, radiusMeters),
    findByName: (name: string, maturity?: string) =>
      ipcRenderer.invoke('entropia-db:find-by-name', name, maturity),
  },

  // File system operations (to be added)
  // readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  // writeFile: (path: string, data: string) => ipcRenderer.invoke('write-file', path, data),

  // Discord integration (to be added)
  // sendDiscordGPS: (data: any) => ipcRenderer.invoke('discord-send-gps', data),
});

// Type definitions for renderer
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  session: {
    save: (session: Session) => Promise<{ success: boolean }>;
    findById: (id: string) => Promise<Session | null>;
    findActive: (userId?: string) => Promise<Session | null>;
    findAll: (userId?: string) => Promise<Session[]>;
    delete: (id: string) => Promise<{ success: boolean }>;
    count: (userId?: string) => Promise<number>;
  };
  migration: {
    importV1Sessions: (basePath?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  };
  logWatcher: {
    detectPath: () => Promise<{ success: boolean; path: string | null; error?: string }>;
    browsePath: () => Promise<{ success: boolean; path: string | null; error?: string }>;
    start: (config: { logPath?: string; sessionId: string; userId: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    status: () => Promise<{ isRunning: boolean; position: number }>;
    onEvent: (callback: (event: SessionEvent) => void) => void;
    onEvents: (callback: (events: SessionEvent[]) => void) => void;
    onError: (callback: (error: string) => void) => void;
    onTruncated: (callback: () => void) => void;
  };
  gps: {
    start: () => Promise<{ 
      success: boolean; 
      status?: {
        isTracking: boolean;
        lastCaptureTime: number | null;
        captureCount: number;
      };
      error?: string;
    }>;
    stop: () => Promise<{ success: boolean; status?: any; error?: string }>;
    status: () => Promise<{ 
      success: boolean; 
      status?: {
        isTracking: boolean;
        lastCaptureTime: number | null;
        captureCount: number;
      };
      error?: string;
    }>;
  };
  user: {
    getCurrent: () => Promise<any>;
    update: (user: any) => Promise<void>;
    updateWebhook: (userId: string, webhookUrl: string | null) => Promise<void>;
    updateGPSSettings: (userId: string, shareGPS: boolean, gpsVisibility: 'public' | 'friends' | 'off') => Promise<void>;
  };
  loadout: {
    save: (loadout: Loadout) => Promise<{ success: boolean; error?: string }>;
    findById: (id: string) => Promise<Loadout | null>;
    findAll: (userId?: string) => Promise<Loadout[]>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    count: (userId?: string) => Promise<number>;
  };
  equipment: {
    search: (query: string, type?: EquipmentType, limit?: number) => Promise<EquipmentSearchResult[]>;
    getById: (id: number, type: EquipmentType) => Promise<EquipmentSearchResult | null>;
    getByName: (name: string, type?: EquipmentType) => Promise<EquipmentSearchResult | null>;
    getAllByType: (type: EquipmentType) => Promise<EquipmentSearchResult[]>;
    getStats: () => Promise<Record<EquipmentType, number>>;
    isReady: () => Promise<boolean>;
  };
  discord: {
    getChannelMessages: (channelId: string, botToken: string, limit?: number) => Promise<{
      success: boolean;
      messages?: any[];
      error?: string;
    }>;
  };
  keyboard: {
    sendKeys: (keys: string) => Promise<{ success: boolean; error?: string }>;
  };
  hud: {
    show: () => Promise<{ success: boolean }>;
    hide: () => Promise<{ success: boolean }>;
    close: () => Promise<{ success: boolean }>;
    toggle: () => Promise<{ success: boolean; visible: boolean }>;
    resize: (width: number, height: number, animate?: boolean) => Promise<{ success: boolean; error?: string }>;
    updateSession: (session: Session | null, loadout?: Loadout | null) => void;
    onSessionUpdate: (callback: (session: Session | null, loadout?: Loadout | null) => void) => void;
  };
  entropiaDB: {
    init: () => Promise<{ success: boolean; error?: string }>;
    identifyMob: (estimatedHealth: number, location: { lon: number; lat: number }, lootItems?: string[]) => Promise<{
      success: boolean;
      data?: {
        id: number;
        name: string;
        maturity: string;
        hp: number;
        species: string;
        distance: number;
      };
      error?: string;
    }>;
    identifyMobBySpawn: (location: { lon: number; lat: number }, estimatedHealth: number) => Promise<{
      success: boolean;
      data?: {
        mobName: string;
        distance: number;
        confidence: 'high' | 'medium' | 'low';
      } | null;
      error?: string;
    }>;
    findByHealth: (estimatedHealth: number, tolerance?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    findByLocation: (location: { lon: number; lat: number }, radiusMeters?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    findByName: (name: string, maturity?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}

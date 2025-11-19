/**
 * Electron IPC Handlers
 * Exposes database operations to renderer process
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import { initializeDatabase } from '../db/connection';
import { SessionRepository } from '../storage/SessionRepository';
import { LoadoutRepository } from '../storage/LoadoutRepository';
import { UserRepository } from '../storage/UserRepository';
import { Session } from '../../core/types/Session';
import { Loadout } from '../../core/types/Loadout';
import { SessionEvent } from '../../core/types/Events';
import { LegacyMigrator } from '../migration/LegacyMigrator';
import { LogWatcher } from '../logwatcher/LogWatcher';
import { getGPSCaptureService } from '../automation/GPSCaptureService';
import { getUserDataPath } from '../db/connection';
import { getEquipmentDataService, EquipmentType } from '../../core/services/EquipmentDataService';
import { KeyboardService } from '../automation/KeyboardService';
import path from 'path';

// Global log watcher instance
let logWatcher: LogWatcher | null = null;

// Global loadout repository instance
let loadoutRepository: LoadoutRepository | null = null;

function getLoadoutRepository(): LoadoutRepository {
  if (!loadoutRepository) {
    const dbPath = path.join(getUserDataPath(), 'artemis.db');
    loadoutRepository = new LoadoutRepository(dbPath);
  }
  return loadoutRepository;
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  // Initialize database on startup
  initializeDatabase().catch(console.error);

  // Initialize equipment data service
  const equipmentService = getEquipmentDataService();
  // Get the app root directory and go up one level to ARTEMIS folder
  const appPath = app.getAppPath();
  const dataPath = path.join(appPath, '..', 'data');
  console.log('[IPC] App path:', appPath);
  console.log('[IPC] Loading equipment data from:', dataPath);
  equipmentService.loadData(dataPath).catch(error => {
    console.error('[IPC] Failed to load equipment data:', error);
  });

  // Session operations
  ipcMain.handle('session:save', async (_event, session: Session) => {
    await SessionRepository.save(session);
    return { success: true };
  });

  ipcMain.handle('session:findById', async (_event, id: string) => {
    const session = await SessionRepository.findById(id);
    return session;
  });

  ipcMain.handle('session:findActive', async (_event, userId?: string) => {
    const session = await SessionRepository.findActive(userId);
    return session;
  });

  ipcMain.handle('session:findAll', async (_event, userId?: string) => {
    const sessions = await SessionRepository.findAll(userId);
    return sessions;
  });

  ipcMain.handle('session:delete', async (_event, id: string) => {
    await SessionRepository.delete(id);
    return { success: true };
  });

  ipcMain.handle('session:deleteAll', async () => {
    await SessionRepository.deleteAll();
    return { success: true };
  });

  ipcMain.handle('session:count', async (_event, userId?: string) => {
    const count = await SessionRepository.count(userId);
    return count;
  });

  // Migration operations
  ipcMain.handle('migration:importV1Sessions', async (_event, basePath?: string) => {
    try {
      const sessions = LegacyMigrator.migrateAll(basePath);
      
      // Save all migrated sessions to database
      for (const session of sessions) {
        await SessionRepository.save(session);
      }
      
      return { success: true, count: sessions.length };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // ==================== User Operations ====================

  // Get current user
  ipcMain.handle('user:getCurrent', async () => {
    try {
      return await UserRepository.getCurrentUser();
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  });

  // Update user profile
  ipcMain.handle('user:update', async (_event, user) => {
    try {
      await UserRepository.save(user);
    } catch (error) {
      console.error('Update user failed:', error);
      throw error;
    }
  });

  // Update Discord webhook
  ipcMain.handle('user:updateWebhook', async (_event, userId: string, webhookUrl: string | null) => {
    try {
      await UserRepository.updateDiscordWebhook(userId, webhookUrl);
    } catch (error) {
      console.error('Update webhook failed:', error);
      throw error;
    }
  });

  // Update GPS settings
  ipcMain.handle('user:updateGPSSettings', async (_event, userId: string, shareGPS: boolean, gpsVisibility: 'public' | 'friends' | 'off') => {
    try {
      await UserRepository.updateGPSSettings(userId, shareGPS, gpsVisibility);
    } catch (error) {
      console.error('Update GPS settings failed:', error);
      throw error;
    }
  });

  // ==================== Log Watcher Operations ====================

  // Auto-detect chat.log path
  ipcMain.handle('logwatcher:detectPath', async () => {
    try {
      const path = LogWatcher.detectLogPath();
      return { success: true, path };
    } catch (error) {
      console.error('Failed to detect log path:', error);
      return { success: false, error: String(error) };
    }
  });

  // Start watching chat.log
  ipcMain.handle('logwatcher:start', async (_event, config: { logPath?: string; sessionId: string; userId: string }) => {
    try {
      // Stop existing watcher if any
      if (logWatcher) {
        logWatcher.stop();
      }

      // Create new watcher (will auto-detect if logPath not provided)
      console.log('[IPC] 🔧 Creating LogWatcher with config:', config);
      logWatcher = new LogWatcher(config);
      console.log('[IPC] ✅ LogWatcher created successfully');

      // Forward events to renderer
      const mainWindow = BrowserWindow.getAllWindows()[0];
      console.log('[IPC] 📺 Main window:', mainWindow ? 'found' : 'NOT FOUND');
      if (mainWindow) {
        console.log('[IPC] 🔗 Attaching event listeners to LogWatcher...');
        
        logWatcher.on('event', (event: SessionEvent) => {
          console.log('[IPC] 📤 Sending single event via IPC:', event.type);
          mainWindow.webContents.send('logwatcher:event', event);
        });

        logWatcher.on('events', (events: SessionEvent[]) => {
          console.log(`[IPC] 📤 Sending ${events.length} events via IPC:`, events.map(e => e.type).join(', '));
          mainWindow.webContents.send('logwatcher:events', events);
        });

        logWatcher.on('error', (error: Error) => {
          console.log('[IPC] ❌ Sending error via IPC:', error.message);
          mainWindow.webContents.send('logwatcher:error', error.message);
        });

        logWatcher.on('truncated', () => {
          console.log('[IPC] ⚠️ Sending truncated signal via IPC');
          mainWindow.webContents.send('logwatcher:truncated');
        });
        
        console.log('[IPC] ✅ All event listeners attached');
      }

      // Start watching
      console.log('[IPC] 🚀 Starting LogWatcher...');
      logWatcher.start();
      console.log('[IPC] ✅ LogWatcher started successfully');

      return { success: true, path: logWatcher.getPosition() };
    } catch (error) {
      console.error('Failed to start log watcher:', error);
      return { success: false, error: String(error) };
    }
  });

  // Stop watching chat.log
  ipcMain.handle('logwatcher:stop', async () => {
    try {
      if (logWatcher) {
        logWatcher.stop();
        logWatcher = null;
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to stop log watcher:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get watcher status
  ipcMain.handle('logwatcher:status', async () => {
    return {
      isRunning: logWatcher?.isRunning() ?? false,
      position: logWatcher?.getPosition() ?? 0,
    };
  });

  // ==================== GPS Tracking Operations ====================

  // Start GPS tracking
  ipcMain.handle('gps:start', async () => {
    try {
      const gpsService = getGPSCaptureService();
      const status = gpsService.start();
      return { success: true, status };
    } catch (error) {
      console.error('Failed to start GPS tracking:', error);
      return { success: false, error: String(error) };
    }
  });

  // Stop GPS tracking
  ipcMain.handle('gps:stop', async () => {
    try {
      const gpsService = getGPSCaptureService();
      const status = gpsService.stop();
      return { success: true, status };
    } catch (error) {
      console.error('Failed to stop GPS tracking:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get GPS tracking status
  ipcMain.handle('gps:status', async () => {
    try {
      const gpsService = getGPSCaptureService();
      const status = gpsService.getStatus();
      return { success: true, status };
    } catch (error) {
      console.error('Failed to get GPS status:', error);
      return { success: false, error: String(error) };
    }
  });

  // ==================== Loadout Operations ====================

  // Save loadout
  ipcMain.handle('loadout:save', async (_event, loadout: Loadout) => {
    try {
      const repo = getLoadoutRepository();
      await repo.save(loadout);
      return { success: true };
    } catch (error) {
      console.error('Failed to save loadout:', error);
      return { success: false, error: String(error) };
    }
  });

  // Find loadout by ID
  ipcMain.handle('loadout:findById', async (_event, id: string) => {
    try {
      const repo = getLoadoutRepository();
      const loadout = await repo.findById(id);
      return loadout;
    } catch (error) {
      console.error('Failed to find loadout:', error);
      return null;
    }
  });

  // Find all loadouts
  ipcMain.handle('loadout:findAll', async (_event, userId?: string) => {
    try {
      const repo = getLoadoutRepository();
      const loadouts = await repo.findAll(userId);
      return loadouts;
    } catch (error) {
      console.error('Failed to find loadouts:', error);
      return [];
    }
  });

  // Delete loadout
  ipcMain.handle('loadout:delete', async (_event, id: string) => {
    try {
      const repo = getLoadoutRepository();
      await repo.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete loadout:', error);
      return { success: false, error: String(error) };
    }
  });

  // Count loadouts
  ipcMain.handle('loadout:count', async (_event, userId?: string) => {
    try {
      const repo = getLoadoutRepository();
      const count = await repo.count(userId);
      return count;
    } catch (error) {
      console.error('Failed to count loadouts:', error);
      return 0;
    }
  });

  // ==================== Equipment Data Operations ====================

  // Search equipment
  ipcMain.handle('equipment:search', async (_event, query: string, type?: EquipmentType, limit?: number) => {
    try {
      const equipmentService = getEquipmentDataService();
      const results = equipmentService.search(query, type, limit);
      return results;
    } catch (error) {
      console.error('Failed to search equipment:', error);
      return [];
    }
  });

  // Get equipment by ID
  ipcMain.handle('equipment:getById', async (_event, id: number, type: EquipmentType) => {
    try {
      const equipmentService = getEquipmentDataService();
      const result = equipmentService.getById(id, type);
      return result;
    } catch (error) {
      console.error('Failed to get equipment by ID:', error);
      return null;
    }
  });

  // Get equipment by name
  ipcMain.handle('equipment:getByName', async (_event, name: string, type?: EquipmentType) => {
    try {
      const equipmentService = getEquipmentDataService();
      const result = equipmentService.getByName(name, type);
      return result;
    } catch (error) {
      console.error('Failed to get equipment by name:', error);
      return null;
    }
  });

  // Get all equipment by type
  ipcMain.handle('equipment:getAllByType', async (_event, type: EquipmentType) => {
    try {
      const equipmentService = getEquipmentDataService();
      const results = equipmentService.getAllByType(type);
      return results;
    } catch (error) {
      console.error('Failed to get equipment by type:', error);
      return [];
    }
  });

  // Get equipment stats
  ipcMain.handle('equipment:getStats', async () => {
    try {
      const equipmentService = getEquipmentDataService();
      const stats = equipmentService.getStats();
      return stats;
    } catch (error) {
      console.error('Failed to get equipment stats:', error);
      return {};
    }
  });

  // Check if equipment service is ready
  ipcMain.handle('equipment:isReady', async () => {
    try {
      const equipmentService = getEquipmentDataService();
      return equipmentService.isReady();
    } catch (error) {
      console.error('Failed to check equipment status:', error);
      return false;
    }
  });

  // Discord API proxy (bypass CORS)
  ipcMain.handle('discord:getChannelMessages', async (_event, channelId: string, botToken: string, limit: number = 50) => {
    try {
      const messagesUrl = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(messagesUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`Discord API returned ${response.status}`);
      }

      const messages = await response.json();
      return { success: true, messages };
    } catch (error) {
      console.error('[IPC] Discord API error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Keyboard automation handler (Windows only - uses low-level keyboard input)
  ipcMain.handle('keyboard:sendKeys', async (_event, keys: string) => {
    console.log(`[IPC] 🎹 Keyboard automation requested - keys: "${keys}"`);
    
    // For now, only comma is supported (location ping)
    if (keys === ',') {
      return await KeyboardService.triggerLocationPing();
    }
    
    console.warn(`[IPC] ⚠️ Unsupported key: "${keys}"`);
    return { success: false, error: `Unsupported key: ${keys}` };
  });

  // Direct IPC handler for triggering location ping
  ipcMain.handle('keyboard:triggerLocationPing', async () => {
    console.log('[IPC] 🎯 Triggering location ping');
    return await KeyboardService.triggerLocationPing();
  });
}


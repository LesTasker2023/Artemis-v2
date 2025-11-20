/**
 * Entropia Database IPC Handler
 * Exposes entropia.db queries to renderer process
 */

import { ipcMain } from 'electron';
import { EntropiaDBService } from '../db/EntropiaDBService';
import type { Coordinate } from '../../core/types/GPS';

let entropiaDB: EntropiaDBService | null = null;

export function registerEntropiaDBHandlers() {
  // Initialize database service
  ipcMain.handle('entropia-db:init', async () => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      return { success: true };
    } catch (error: any) {
      console.error('[Entropia DB] Initialization failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Find mobs by health
  ipcMain.handle('entropia-db:find-by-health', async (_event, estimatedHealth: number, tolerance: number = 0.2) => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      const mobs = entropiaDB.findMobsByHealth(estimatedHealth, tolerance);
      return { success: true, data: mobs };
    } catch (error: any) {
      console.error('[Entropia DB] Find by health failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Find mobs by location
  ipcMain.handle('entropia-db:find-by-location', async (_event, location: Coordinate, radiusMeters: number = 5000) => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      const mobs = entropiaDB.findMobsByLocation(location, radiusMeters);
      return { success: true, data: mobs };
    } catch (error: any) {
      console.error('[Entropia DB] Find by location failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Identify mob (cross-reference health + location + loot)
  ipcMain.handle('entropia-db:identify-mob', async (
    _event,
    estimatedHealth: number,
    location: Coordinate,
    lootItems?: string[]
  ) => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      const mob = entropiaDB.identifyMob(estimatedHealth, location, lootItems);
      return { success: true, data: mob };
    } catch (error: any) {
      console.error('[Entropia DB] Identify mob failed:', error);
      return { success: false, error: error.message };
    }
  });

  // NEW: Identify mob by spawn (spawn-first approach)
  ipcMain.handle('entropia-db:identify-by-spawn', async (
    _event,
    location: Coordinate,
    estimatedHealth: number
  ) => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      const identification = await entropiaDB.identifyMobBySpawn(location, estimatedHealth);
      return { success: true, data: identification };
    } catch (error: any) {
      console.error('[Entropia DB] Identify by spawn failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Get mob by name
  ipcMain.handle('entropia-db:find-by-name', async (_event, name: string, maturity?: string) => {
    try {
      if (!entropiaDB) {
        entropiaDB = new EntropiaDBService();
      }
      const mob = entropiaDB.findMobByName(name, maturity);
      return { success: true, data: mob };
    } catch (error: any) {
      console.error('[Entropia DB] Find by name failed:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[Entropia DB] IPC handlers registered');
}

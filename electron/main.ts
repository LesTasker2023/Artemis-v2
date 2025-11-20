const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// IPC handlers will be bundled by esbuild
import { registerIpcHandlers } from '../src/infra/ipc/handlers';
import { registerEntropiaDBHandlers } from '../src/infra/ipc/entropia-db-handlers';

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Electron app lifecycle
let mainWindow: typeof BrowserWindow | null = null;
let hudWindow: typeof BrowserWindow | null = null;
let splashWindow: typeof BrowserWindow | null = null;

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, '../splash.html'));
  splashWindow.center();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#111827', // gray-900 from Tailwind
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Show after ready to avoid flicker
  });

  // Load app - dev server or production build
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Dev tools disabled by default - press F12 to open manually
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready and close splash
  mainWindow.once('ready-to-show', () => {
    // Close splash screen
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close HUD window when main window closes
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.close();
    }
  });
}

function createHUDWindow() {
  // Don't create if already exists
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show();
    hudWindow.focus();
    return;
  }

  hudWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 320,
    minHeight: 75,
    frame: false, // Frameless for custom drag
    transparent: true, // Transparent background
    alwaysOnTop: true, // Always on top of other windows
    skipTaskbar: true, // Don't show in taskbar
    resizable: true,
    backgroundColor: '#00000000', // Fully transparent
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Ensure it stays always on top
  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // Load the HUD route
  if (process.env.VITE_DEV_SERVER_URL) {
    hudWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '#/hud');
  } else {
    hudWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/hud' });
  }

  hudWindow.once('ready-to-show', () => {
    hudWindow?.show();
  });

  hudWindow.on('closed', () => {
    hudWindow = null;
  });

  // Prevent HUD from being minimized
  hudWindow.on('minimize', (event) => {
    event.preventDefault();
  });

  // Prevent HUD from losing focus and closing
  hudWindow.on('blur', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
}

// Auto-update event listeners
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for updates...');
  console.log('   Current version:', app.getVersion());
  console.log('   Feed URL:', autoUpdater.getFeedURL());
});

autoUpdater.on('update-available', (info) => {
  console.log('📦 Update available:', info.version);
  console.log('   Release date:', info.releaseDate);
  console.log('   Download URL:', info.files?.[0]?.url);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('✅ App is up to date:', info.version);
  console.log('   Current version:', app.getVersion());
});

autoUpdater.on('error', (err) => {
  console.error('❌ Update error:', err);
  console.error('   Message:', err.message);
  console.error('   Stack:', err.stack);
});

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  console.log(`⬇️  Downloading update: ${percent}%`);
  // Send progress to renderer if needed
  mainWindow?.webContents.send('update-progress', percent);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded:', info.version);
  
  // Notify user
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: `ARTEMIS v${info.version} has been downloaded.`,
    detail: 'The update will be installed when you restart the app. Restart now?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

// App lifecycle events
app.whenReady().then(() => {
  registerIpcHandlers();
  registerEntropiaDBHandlers(); // Register entropia database handlers
  createSplashScreen(); // Show splash first
  
  // Wait a moment then create main window
  setTimeout(() => {
    createWindow();
  }, 500);

  // Check for updates after window is ready (skip in dev mode)
  if (!process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000); // Wait 3 seconds after startup
    
    // Check for updates every hour
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3600000);
  }

  app.on('activate', () => {
    // macOS: Re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS: Keep app running even when all windows closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers (add more as needed)
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// HUD Window Management
ipcMain.handle('hud:show', () => {
  createHUDWindow();
  return { success: true };
});

ipcMain.handle('hud:hide', () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.hide();
  }
  return { success: true };
});

ipcMain.handle('hud:close', () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close();
  }
  return { success: true };
});

ipcMain.handle('hud:toggle', () => {
  if (!hudWindow || hudWindow.isDestroyed()) {
    createHUDWindow();
    return { success: true, visible: true };
  } else if (hudWindow.isVisible()) {
    hudWindow.hide();
    return { success: true, visible: false };
  } else {
    hudWindow.show();
    return { success: true, visible: true };
  }
});

ipcMain.handle('hud:resize', (_event, width: number, height: number, animate = true) => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    if (animate) {
      hudWindow.setBounds({ width, height }, true);
    } else {
      hudWindow.setSize(width, height);
    }
    return { success: true };
  }
  return { success: false, error: 'HUD window not available' };
});

// Forward session updates from main window to HUD window
ipcMain.on('hud:updateSession', (_event, session, loadout) => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.webContents.send('hud:sessionUpdate', session, loadout);
  }
});
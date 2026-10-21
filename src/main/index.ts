import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupPlayerIPC, cleanupMpv } from './player';
import { setupYTMusicIPC } from './ytmusic';
import { setupLibraryIPC } from './library';
import { setupLyricsIPC } from './lyrics';
import { setupScrobbleIPC } from './scrobble';
import { setupSpotifyIPC } from './spotify';

// Ensure rock-solid stability and instant cold-boot across all Linux drivers (Intel/AMD/Nvidia).
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer', 'false');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Single instance lock to prevent duplicate conflicting instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

let cachedIconPath: string | null = null;
function resolveIconPath(): string {
  if (cachedIconPath) return cachedIconPath;
  const candidates = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(process.resourcesPath, 'assets/icon.png'),
    path.join(app.getAppPath(), 'assets/icon.png'),
    '/home/hariom_joshi/.local/share/icons/hicolor/256x256/apps/archivetune.png',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedIconPath = candidate;
      return candidate;
    }
  }
  return '';
}

function createWindow() {
  const iconPath = resolveIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#141218',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Required for streaming audio URLs
    },
    icon: iconPath || undefined,
  });

  // Fast display: show immediately once ready, or after 150ms max to prevent perceived delay
  let shown = false;
  const showWindow = () => {
    if (!shown && mainWindow && !mainWindow.isDestroyed()) {
      shown = true;
      mainWindow.show();
    }
  };

  mainWindow.once('ready-to-show', showWindow);
  setTimeout(showWindow, 150);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle second instance activation: instantly bring to front
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Crash resilience
app.on('child-process-gone', (_event, details) => {
  console.warn('Child process gone:', details.type, details.reason);
});

process.on('uncaughtException', (err) => {
  console.error('ArchiveTune Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('ArchiveTune Unhandled Rejection:', reason);
});

app.whenReady().then(() => {
  createWindow();

  // Register all IPC handlers
  setupPlayerIPC();
  setupYTMusicIPC();
  setupLibraryIPC();
  setupLyricsIPC();
  setupScrobbleIPC();
  setupSpotifyIPC();

  // Window control handlers
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // File pickers
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'wma'] },
      ],
    });
    return result.filePaths;
  });

  // Open external URL in default browser
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  cleanupMpv();
});

app.on('will-quit', () => {
  cleanupMpv();
});

app.on('window-all-closed', () => {
  cleanupMpv();
  if (process.platform !== 'darwin') app.quit();
});

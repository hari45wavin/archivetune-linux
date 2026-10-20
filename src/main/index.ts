import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupPlayerIPC } from './player';
import { setupYTMusicIPC } from './ytmusic';
import { setupLibraryIPC } from './library';
import { setupLyricsIPC } from './lyrics';
import { setupScrobbleIPC } from './scrobble';
import { setupSpotifyIPC } from './spotify';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../../assets/icon.png'))
    ? path.join(__dirname, '../../assets/icon.png')
    : fs.existsSync(path.join(process.resourcesPath, 'assets/icon.png'))
    ? path.join(process.resourcesPath, 'assets/icon.png')
    : path.join('/home/hariom_joshi/.local/share/icons/hicolor/256x256/apps/archivetune.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // needed for yt-dlp stream URLs
    },
    icon: iconPath,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

  // File picker
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

  // Open external URL in browser
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

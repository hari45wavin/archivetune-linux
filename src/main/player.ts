/**
 * player.ts — mpv-based audio player via IPC socket
 *
 * Uses mpv in idle mode with an IPC JSON socket for real-time control.
 * Falls back to a simple stdin command approach if socket fails.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SOCKET_PATH = path.join(os.tmpdir(), 'archivetune-mpv.sock');

let mpvProcess: ChildProcess | null = null;
let mpvSocket: net.Socket | null = null;
let currentProgress = 0;
let currentDuration = 0;
let isPlaying = false;
let progressInterval: NodeJS.Timer | null = null;

function sendMpvCommand(command: object): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!mpvSocket || mpvSocket.destroyed) {
      reject(new Error('mpv socket not connected'));
      return;
    }
    const msg = JSON.stringify(command) + '\n';
    mpvSocket.write(msg, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function connectSocket(retries = 10): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const tryConnect = (n: number) => {
      const socket = net.createConnection(SOCKET_PATH);
      socket.on('connect', () => resolve(socket));
      socket.on('error', () => {
        if (n > 0) setTimeout(() => tryConnect(n - 1), 300);
        else reject(new Error('Could not connect to mpv socket'));
      });
    };
    tryConnect(retries);
  });
}

async function startMpv(): Promise<void> {
  if (mpvProcess) {
    mpvProcess.kill();
    mpvProcess = null;
  }
  if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

  mpvProcess = spawn('mpv', [
    '--idle',
    '--no-video',
    '--no-terminal',
    `--input-ipc-server=${SOCKET_PATH}`,
    '--audio-display=no',
    '--gapless-audio=yes',
  ], { stdio: 'ignore' });

  mpvProcess.on('exit', () => {
    mpvProcess = null;
    mpvSocket = null;
    isPlaying = false;
  });

  mpvSocket = await connectSocket();

  // Listen for mpv events on socket
  mpvSocket.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.event === 'end-file') {
          isPlaying = false;
          BrowserWindow.getAllWindows()[0]?.webContents.send('player:ended');
        }
        if (event.event === 'playback-restart') {
          isPlaying = true;
        }
      } catch { /* ignore parse errors */ }
    }
  });
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval as unknown as NodeJS.Timeout);
  progressInterval = setInterval(async () => {
    if (!isPlaying || !mpvSocket) return;
    try {
      // Query time-pos and duration via mpv IPC
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return;
      await sendMpvCommand({ command: ['observe_property', 1, 'time-pos'] });
      await sendMpvCommand({ command: ['observe_property', 2, 'duration'] });
      win.webContents.send('player:progress', {
        position: currentProgress,
        duration: currentDuration,
        isPlaying,
      });
    } catch { /* ignore */ }
  }, 500);
}

export function setupPlayerIPC() {
  ipcMain.handle('player:play', async (_e, url: string, _meta: object) => {
    try {
      if (!mpvProcess) await startMpv();
      await sendMpvCommand({ command: ['loadfile', url, 'replace'] });
      isPlaying = true;
      currentProgress = 0;
      startProgressPolling();
      return { ok: true };
    } catch (err) {
      // Fallback: start fresh mpv
      await startMpv();
      await sendMpvCommand({ command: ['loadfile', url, 'replace'] });
      isPlaying = true;
      startProgressPolling();
      return { ok: true };
    }
  });

  ipcMain.handle('player:pause', async () => {
    await sendMpvCommand({ command: ['set_property', 'pause', true] });
    isPlaying = false;
    return { ok: true };
  });

  ipcMain.handle('player:resume', async () => {
    await sendMpvCommand({ command: ['set_property', 'pause', false] });
    isPlaying = true;
    return { ok: true };
  });

  ipcMain.handle('player:stop', async () => {
    await sendMpvCommand({ command: ['stop'] });
    isPlaying = false;
    currentProgress = 0;
    return { ok: true };
  });

  ipcMain.handle('player:seek', async (_e, seconds: number) => {
    await sendMpvCommand({ command: ['seek', seconds, 'absolute'] });
    return { ok: true };
  });

  ipcMain.handle('player:setVolume', async (_e, vol: number) => {
    await sendMpvCommand({ command: ['set_property', 'volume', Math.round(vol * 100)] });
    return { ok: true };
  });

  ipcMain.handle('player:getStatus', () => ({
    isPlaying,
    position: currentProgress,
    duration: currentDuration,
  }));
}

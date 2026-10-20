/**
 * player.ts — mpv-based audio player via IPC socket
 *
 * Full real-time control via JSON IPC socket with:
 * - Accurate time-pos and duration updates (slider and lyrics sync)
 * - Pause, resume, seek, volume, speed adjustment (0.5x - 2.0x)
 * - Audio normalization (dynaudnorm)
 * - Track downloading via yt-dlp into ~/Music/
 */

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess, execFile } from 'child_process';
import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const SOCKET_PATH = path.join(os.tmpdir(), `archivetune-mpv-${process.pid}.sock`);

let mpvProcess: ChildProcess | null = null;
let mpvSocket: net.Socket | null = null;
let currentProgress = 0;
let currentDuration = 0;
let isPlaying = false;
let progressInterval: NodeJS.Timeout | null = null;
let socketBuffer = '';

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

function connectSocket(retries = 15): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const tryConnect = (n: number) => {
      const socket = net.createConnection(SOCKET_PATH);
      socket.on('connect', () => resolve(socket));
      socket.on('error', () => {
        if (n > 0) setTimeout(() => tryConnect(n - 1), 200);
        else reject(new Error('Could not connect to mpv socket'));
      });
    };
    tryConnect(retries);
  });
}

function notifyProgress() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('player:progress', {
      position: currentProgress,
      duration: currentDuration,
      isPlaying,
    });
  }
}

async function startMpv(): Promise<void> {
  if (mpvProcess) {
    try { mpvProcess.kill('SIGKILL'); } catch { /* ignore */ }
    mpvProcess = null;
  }
  if (fs.existsSync(SOCKET_PATH)) {
    try { fs.unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
  }

  mpvProcess = spawn('mpv', [
    '--idle=yes',
    '--no-video',
    '--no-terminal',
    `--input-ipc-server=${SOCKET_PATH}`,
    '--audio-display=no',
    '--gapless-audio=yes',
    '--demuxer-max-bytes=10M',
    '--demuxer-max-back-bytes=5M',
  ], { stdio: 'ignore' });

  mpvProcess.on('exit', () => {
    mpvProcess = null;
    mpvSocket = null;
    isPlaying = false;
  });

  mpvSocket = await connectSocket();

  // Register property observers once connected
  await sendMpvCommand({ command: ['observe_property', 1, 'time-pos'] });
  await sendMpvCommand({ command: ['observe_property', 2, 'duration'] });
  await sendMpvCommand({ command: ['observe_property', 3, 'pause'] });

  socketBuffer = '';
  mpvSocket.on('data', (data: Buffer) => {
    socketBuffer += data.toString('utf-8');
    const lines = socketBuffer.split('\n');
    socketBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);

        // 1. Property changes from observe_property
        if (msg.event === 'property-change') {
          if (msg.name === 'time-pos' && typeof msg.data === 'number') {
            currentProgress = msg.data;
            notifyProgress();
          } else if (msg.name === 'duration' && typeof msg.data === 'number') {
            currentDuration = msg.data;
            notifyProgress();
          } else if (msg.name === 'pause' && typeof msg.data === 'boolean') {
            isPlaying = !msg.data;
            notifyProgress();
          }
        }

        // 2. Query response from get_property
        if (msg.request_id === 101 && typeof msg.data === 'number') {
          currentProgress = msg.data;
          notifyProgress();
        } else if (msg.request_id === 102 && typeof msg.data === 'number') {
          currentDuration = msg.data;
          notifyProgress();
        }

        // 3. Playback lifecycle events
        if (msg.event === 'end-file') {
          isPlaying = false;
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('player:ended');
        }
        if (msg.event === 'playback-restart') {
          isPlaying = true;
          notifyProgress();
        }
      } catch {
        /* ignore incomplete JSON lines */
      }
    }
  });
}

function startProgressPolling() {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(async () => {
    if (!isPlaying || !mpvSocket || mpvSocket.destroyed) return;
    try {
      await sendMpvCommand({ command: ['get_property', 'time-pos'], request_id: 101 });
      if (currentDuration <= 0) {
        await sendMpvCommand({ command: ['get_property', 'duration'], request_id: 102 });
      }
    } catch {
      /* ignore */
    }
  }, 250);
}

export function setupPlayerIPC() {
  ipcMain.handle('player:play', async (_e, url: string, _meta: object) => {
    try {
      if (!mpvProcess || !mpvSocket || mpvSocket.destroyed) {
        await startMpv();
      }
      await sendMpvCommand({ command: ['loadfile', url, 'replace'] });
      isPlaying = true;
      currentProgress = 0;
      startProgressPolling();
      return { ok: true };
    } catch {
      await startMpv();
      await sendMpvCommand({ command: ['loadfile', url, 'replace'] });
      isPlaying = true;
      startProgressPolling();
      return { ok: true };
    }
  });

  ipcMain.handle('player:pause', async () => {
    try {
      await sendMpvCommand({ command: ['set_property', 'pause', true] });
      isPlaying = false;
      notifyProgress();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:resume', async () => {
    try {
      await sendMpvCommand({ command: ['set_property', 'pause', false] });
      isPlaying = true;
      notifyProgress();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:stop', async () => {
    try {
      await sendMpvCommand({ command: ['stop'] });
      isPlaying = false;
      currentProgress = 0;
      notifyProgress();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:seek', async (_e, seconds: number) => {
    try {
      await sendMpvCommand({ command: ['seek', seconds, 'absolute'] });
      currentProgress = seconds;
      notifyProgress();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:setVolume', async (_e, vol: number) => {
    try {
      await sendMpvCommand({ command: ['set_property', 'volume', Math.round(vol * 100)] });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:setSpeed', async (_e, speed: number) => {
    try {
      await sendMpvCommand({ command: ['set_property', 'speed', speed] });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:setNormalization', async (_e, enabled: boolean) => {
    try {
      if (enabled) {
        await sendMpvCommand({ command: ['af', 'set', 'lavfi=[dynaudnorm=f=500:g=31:p=0.95:m=10.0:r=0.9]'] });
      } else {
        await sendMpvCommand({ command: ['af', 'clr', ''] });
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('player:getStatus', () => ({
    isPlaying,
    position: currentProgress,
    duration: currentDuration,
  }));

  // Download track to ~/Music
  ipcMain.handle('player:downloadTrack', async (_e, track: { title: string; artist: string; id: string }) => {
    try {
      const musicDir = path.join(os.homedir(), 'Music');
      if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

      const safeTitle = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, '_');
      const outPath = path.join(musicDir, `${safeTitle}.%(ext)s`);

      const targetUrl = track.id.startsWith('http')
        ? track.id
        : `https://www.youtube.com/watch?v=${track.id}`;

      await execFileAsync('yt-dlp', [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-thumbnail',
        '--add-metadata',
        '-o', outPath,
        '--no-playlist',
        targetUrl,
      ], { timeout: 120000 });

      return { ok: true, path: musicDir };
    } catch (err: any) {
      console.error('Download error', err);
      return { ok: false, error: err.message || String(err) };
    }
  });
}

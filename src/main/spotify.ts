/**
 * spotify.ts — Spotify integration matching ArchiveTune's SpotifyCore
 *
 * Supports:
 * - One-click Web Login via Electron BrowserWindow (intercepts official Bearer session token & sp_dc cookie)
 * - Automatic background token refresh using persistent session
 * - Direct Spotify Access Token and sp_dc cookie manual connection
 * - Liked Songs, User Playlists, and Playlist Tracks retrieval
 * - SpotifyPlaybackResolver: Resolves Spotify tracks to YouTube Music audio streams for high-fidelity playback
 */

import { app, ipcMain, BrowserWindow, session } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function getConfigPath(): string {
  try {
    return path.join(app.getPath('userData'), 'spotify.json');
  } catch {
    return path.join(os.homedir(), '.config', 'archivetune-linux', 'spotify.json');
  }
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface StoredConfig {
  spDc?: string;
  accessToken?: string;
  expiresAt?: number;
  user?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    product?: string;
  };
}

let storedConfig: StoredConfig | null = null;

function getStoredConfig(): StoredConfig {
  if (!storedConfig) {
    storedConfig = loadConfig();
  }
  return storedConfig;
}

function loadConfig(): StoredConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(cfg: StoredConfig) {
  try {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
    storedConfig = cfg;
  } catch { /* ignore */ }
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      u,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'App-Platform': 'WebPlayer',
          'Origin': 'https://open.spotify.com',
          'Referer': 'https://open.spotify.com/',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

/**
 * Silently refresh Spotify access token using the stored web session in background
 */
async function refreshWebTokenSilently(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authSession = session.fromPartition('persist:spotify', { cache: true });
    let resolved = false;

    const bgWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: authSession,
      },
    });

    const cleanup = () => {
      try {
        authSession.webRequest.onBeforeSendHeaders(null);
      } catch { /* ignore */ }
      if (!bgWindow.isDestroyed()) bgWindow.close();
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Spotify session refresh timed out. Please reconnect Spotify.'));
      }
    }, 15000);

    const onTokenSuccess = (token: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      saveConfig({
        ...getStoredConfig(),
        accessToken: token,
        expiresAt: Date.now() + 3600 * 1000,
      });
      cleanup();
      resolve(token);
    };

    const onHeader = (details: any, callback: any) => {
      const auth = details.requestHeaders['Authorization'] || details.requestHeaders['authorization'];
      if (auth && auth.startsWith('Bearer ') && auth.length > 30) {
        const token = auth.substring(7);
        onTokenSuccess(token);
      }
      callback({ requestHeaders: details.requestHeaders });
    };

    authSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://api.spotify.com/v1/*', 'https://spclient.wg.spotify.com/*'] },
      onHeader
    );

    bgWindow.webContents.on('did-finish-load', async () => {
      try {
        const token = await bgWindow.webContents.executeJavaScript(`
          fetch('/get_access_token?reason=transport&productType=web_player')
            .then(r => r.json())
            .then(d => (d && d.accessToken && d.isAnonymous === false) ? d.accessToken : null)
            .catch(() => null)
        `);
        if (token && typeof token === 'string' && token.length > 30) {
          onTokenSuccess(token);
        }
      } catch { /* ignore */ }
    });

    bgWindow.loadURL('https://open.spotify.com/');
  });
}

async function getValidToken(): Promise<string> {
  const cfg = getStoredConfig();
  if (cfg.accessToken && cfg.expiresAt && Date.now() < cfg.expiresAt - 60000) {
    return cfg.accessToken;
  }

  // Attempt silent refresh if we have a session or sp_dc
  try {
    const token = await refreshWebTokenSilently();
    return token;
  } catch (err) {
    // If we have an existing accessToken, fall back to it
    if (cfg.accessToken) {
      return cfg.accessToken;
    }
    throw new Error('Spotify is not connected. Please log in or provide your access token.');
  }
}

async function spotifyApi(endpoint: string, retries = 2): Promise<any> {
  const token = await getValidToken();
  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;
  try {
    const res = await httpGet(url, {
      Authorization: `Bearer ${token}`,
    });
    return JSON.parse(res);
  } catch (err: any) {
    if (retries > 0 && err.message && (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))) {
      console.warn(`Spotify rate limited on ${endpoint}, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      return spotifyApi(endpoint, retries - 1);
    }
    throw err;
  }
}

/**
 * SpotifyPlaybackResolver:
 * Resolves a Spotify track (title, artist) to a YouTube Music stream URL via yt-dlp
 */
export async function resolveSpotifyTrackToStream(track: { title: string; artist: string }): Promise<{ url: string; id: string }> {
  const query = `ytsearch1:${track.artist} - ${track.title} official audio`;

  const searchOut = await execFileAsync('yt-dlp', [
    query,
    '--dump-json',
    '--default-search',
    'ytsearch',
    '--no-playlist',
    '--quiet',
  ], { timeout: 30000 });

  const info = JSON.parse(searchOut.stdout);
  const videoId = info.id;
  if (!videoId) throw new Error('Could not match Spotify track on YouTube');

  const urlOut = await execFileAsync('yt-dlp', [
    '-f',
    'bestaudio[ext=m4a]/bestaudio',
    '--get-url',
    '--quiet',
    `https://www.youtube.com/watch?v=${videoId}`,
  ], { timeout: 30000 });

  return {
    url: urlOut.stdout.trim(),
    id: videoId,
  };
}

export function setupSpotifyIPC() {
  ipcMain.handle('spotify:getStatus', () => {
    const cfg = getStoredConfig();
    return {
      connected: !!(cfg.accessToken || cfg.spDc),
      user: cfg.user ?? null,
    };
  });

  // Login via dedicated authentication window
  ipcMain.handle('spotify:login', async () => {
    return new Promise((resolve) => {
      let resolved = false;

      const authSession = session.fromPartition('persist:spotify', { cache: true });

      const authWindow = new BrowserWindow({
        width: 580,
        height: 750,
        title: 'Connect Spotify — ArchiveTune',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          session: authSession,
        },
      });

      const cleanup = () => {
        try {
          authSession.webRequest.onBeforeSendHeaders(null);
        } catch { /* ignore */ }
      };

      const handleTokenSuccess = async (token: string, spDcCookie?: string) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        try {
          let userData: any = null;

          // Attempt to validate token directly inside the open.spotify.com browser context
          // This uses Chromium's origin and credentials so Spotify NEVER triggers 429 quota limits!
          if (!authWindow.isDestroyed()) {
            try {
              userData = await authWindow.webContents.executeJavaScript(`
                fetch('https://api.spotify.com/v1/me', {
                  headers: { 'Authorization': 'Bearer ${token}' }
                }).then(r => r.ok ? r.json() : null).catch(() => null)
              `);
            } catch { /* ignore */ }
          }

          // Fallback to httpGet if in-page fetch was not available
          if (!userData || !userData.id) {
            try {
              const userRes = await httpGet('https://api.spotify.com/v1/me', {
                Authorization: `Bearer ${token}`,
              });
              userData = JSON.parse(userRes);
            } catch {
              userData = { id: 'spotify_user', display_name: 'Spotify User' };
            }
          }

          // Retrieve sp_dc cookie from session if available
          let finalSpDc = spDcCookie || getStoredConfig().spDc;
          if (!finalSpDc) {
            try {
              const cookies = await authSession.cookies.get({ domain: '.spotify.com', name: 'sp_dc' });
              if (cookies.length > 0) finalSpDc = cookies[0].value;
            } catch { /* ignore */ }
          }

          saveConfig({
            spDc: finalSpDc,
            accessToken: token,
            expiresAt: Date.now() + 3600 * 1000,
            user: {
              id: userData.id,
              displayName: userData.display_name || userData.id,
              avatarUrl: userData.images?.[0]?.url,
              product: userData.product,
            },
          });

          setTimeout(() => {
            if (!authWindow.isDestroyed()) authWindow.close();
          }, 600);

          resolve({ ok: true, user: getStoredConfig().user });
        } catch (err: any) {
          if (!authWindow.isDestroyed()) authWindow.close();
          resolve({ ok: false, error: err.message || 'Failed to authenticate with Spotify' });
        }
      };

      // 1. Intercept Authorization Bearer header ONLY when open.spotify.com is active
      // NEVER intercept while on accounts.spotify.com (which causes premature window close & 429)
      authSession.webRequest.onBeforeSendHeaders(
        { urls: ['https://api.spotify.com/v1/*', 'https://spclient.wg.spotify.com/*'] },
        (details: any, callback: any) => {
          try {
            const currentUrl = authWindow.isDestroyed() ? '' : authWindow.webContents.getURL();
            if (currentUrl.includes('open.spotify.com')) {
              const auth = details.requestHeaders['Authorization'] || details.requestHeaders['authorization'];
              if (auth && auth.startsWith('Bearer ') && auth.length > 40) {
                const token = auth.substring(7);
                if (token.startsWith('BQ') || token.startsWith('AQ') || token.length > 80) {
                  handleTokenSuccess(token);
                }
              }
            }
          } catch { /* ignore */ }
          callback({ requestHeaders: details.requestHeaders });
        }
      );

      // 2. Poll for token once user navigates to open.spotify.com
      const checkWebPlayerToken = async () => {
        if (resolved || authWindow.isDestroyed()) return;
        const currentUrl = authWindow.webContents.getURL();
        if (currentUrl.includes('open.spotify.com')) {
          try {
            const token = await authWindow.webContents.executeJavaScript(`
              (async () => {
                try {
                  const res = await fetch('/get_access_token?reason=transport&productType=web_player');
                  if (!res.ok) return null;
                  const data = await res.json();
                  if (data && data.accessToken && data.isAnonymous === false) {
                    return data.accessToken;
                  }
                } catch (e) {}
                try {
                  for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    const val = sessionStorage.getItem(key);
                    if (val && val.includes('accessToken')) {
                      const parsed = JSON.parse(val);
                      if (parsed.accessToken) return parsed.accessToken;
                    }
                  }
                } catch (e) {}
                return null;
              })()
            `);
            if (token && typeof token === 'string' && token.length > 30) {
              handleTokenSuccess(token);
            }
          } catch { /* ignore */ }
        }
      };

      authWindow.webContents.on('did-finish-load', () => {
        checkWebPlayerToken();
      });

      authWindow.webContents.on('did-navigate', (_e, url) => {
        if (url.includes('open.spotify.com')) {
          setTimeout(checkWebPlayerToken, 1200);
          setTimeout(checkWebPlayerToken, 3000);
        }
      });

      // Load Spotify login page with redirect to Web Player
      authWindow.loadURL('https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F');

      authWindow.on('closed', () => {
        cleanup();
        if (!resolved) {
          resolve({ ok: false, error: 'Login window was closed before completing login' });
        }
      });
    });
  });

  // Manual connection: accepts Bearer access token OR sp_dc cookie
  ipcMain.handle('spotify:connectManual', async (_e, rawInput: string) => {
    const input = rawInput.trim();
    if (!input) return { ok: false, error: 'Please enter a valid Spotify token or cookie.' };

    // Case A: Direct Spotify Bearer access token (starts with BQ or contains token characters)
    if (input.startsWith('BQ') || (input.length > 100 && !input.startsWith('AQ') && !input.startsWith('sp_dc='))) {
      try {
        const userRes = await httpGet('https://api.spotify.com/v1/me', {
          Authorization: `Bearer ${input}`,
        });
        const userData = JSON.parse(userRes);

        saveConfig({
          accessToken: input,
          expiresAt: Date.now() + 3600 * 1000,
          user: {
            id: userData.id,
            displayName: userData.display_name || userData.id,
            avatarUrl: userData.images?.[0]?.url,
            product: userData.product,
          },
        });

        return { ok: true, user: getStoredConfig().user };
      } catch (err: any) {
        return { ok: false, error: `Invalid access token: ${err.message}` };
      }
    }

    // Case B: sp_dc cookie
    const cleanCookie = input.replace(/^sp_dc=/, '').trim();
    try {
      const authSession = session.fromPartition('persist:spotify', { cache: true });
      await authSession.cookies.set({
        url: 'https://open.spotify.com',
        domain: '.spotify.com',
        name: 'sp_dc',
        value: cleanCookie,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'no_restriction',
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
      });

      const currentCfg = getStoredConfig();
      currentCfg.spDc = cleanCookie;
      saveConfig(currentCfg);

      // Trigger silent background web session with the new cookie to capture Bearer token
      const token = await refreshWebTokenSilently();
      const userRes = await httpGet('https://api.spotify.com/v1/me', {
        Authorization: `Bearer ${token}`,
      });
      const userData = JSON.parse(userRes);

      saveConfig({
        spDc: cleanCookie,
        accessToken: token,
        expiresAt: Date.now() + 3600 * 1000,
        user: {
          id: userData.id,
          displayName: userData.display_name || userData.id,
          avatarUrl: userData.images?.[0]?.url,
          product: userData.product,
        },
      });

      return { ok: true, user: getStoredConfig().user };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to authenticate sp_dc cookie with Spotify' };
    }
  });

  // Disconnect
  ipcMain.handle('spotify:disconnect', async () => {
    saveConfig({});
    try {
      const authSession = session.fromPartition('persist:spotify');
      await authSession.clearStorageData();
    } catch { /* ignore */ }
    return { ok: true };
  });

  // Fetch Liked Songs
  ipcMain.handle('spotify:getLikedSongs', async (_e, limit = 50, offset = 0) => {
    try {
      const data = await spotifyApi(`/me/tracks?limit=${limit}&offset=${offset}`);
      return (data.items || []).map((item: any) => ({
        id: `spotify:${item.track.id}`,
        title: item.track.name,
        artist: item.track.artists.map((a: any) => a.name).join(', '),
        album: item.track.album?.name,
        duration: Math.round(item.track.duration_ms / 1000),
        thumbnail: item.track.album?.images?.[0]?.url,
        source: 'spotify',
      }));
    } catch (err) {
      console.error('spotify:getLikedSongs error', err);
      return [];
    }
  });

  // Fetch User Playlists
  ipcMain.handle('spotify:getPlaylists', async (_e, limit = 50) => {
    try {
      const data = await spotifyApi(`/me/playlists?limit=${limit}`);
      return (data.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        trackCount: p.tracks?.total || 0,
        thumbnail: p.images?.[0]?.url,
      }));
    } catch (err) {
      console.error('spotify:getPlaylists error', err);
      return [];
    }
  });

  // Fetch Tracks for a Playlist
  ipcMain.handle('spotify:getPlaylistTracks', async (_e, playlistId: string) => {
    try {
      const data = await spotifyApi(`/playlists/${playlistId}/tracks?limit=100`);
      return (data.items || [])
        .filter((item: any) => item.track)
        .map((item: any) => ({
          id: `spotify:${item.track.id}`,
          title: item.track.name,
          artist: item.track.artists.map((a: any) => a.name).join(', '),
          album: item.track.album?.name,
          duration: Math.round(item.track.duration_ms / 1000),
          thumbnail: item.track.album?.images?.[0]?.url,
          source: 'spotify',
        }));
    } catch (err) {
      console.error('spotify:getPlaylistTracks error', err);
      return [];
    }
  });

  // Resolve Spotify Track to playable stream URL
  ipcMain.handle('spotify:resolveTrack', async (_e, track: { title: string; artist: string }) => {
    try {
      return await resolveSpotifyTrackToStream(track);
    } catch (err) {
      console.error('spotify:resolveTrack error', err);
      return { url: null, id: null };
    }
  });
}

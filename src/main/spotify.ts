/**
 * spotify.ts — Spotify integration matching ArchiveTune's SpotifyCore
 *
 * Supports:
 * - One-click Web Login via Electron BrowserWindow (intercepts sp_dc session cookie)
 * - TOTP-based internal access token generation (RFC 6238 HMAC-SHA1 from sonic-liberation nuances)
 * - Fetching Liked Songs, User Playlists, and Playlist Tracks
 * - SpotifyPlaybackResolver: Resolves Spotify tracks to YouTube Music audio streams for high-fidelity playback
 */

import { ipcMain, BrowserWindow, session } from 'electron';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CONFIG_FILE = path.join(os.homedir(), '.config', 'archivetune', 'spotify.json');

const NUANCE_URL = 'https://gist.githubusercontent.com/sonic-liberation/22ed9c6ba463899e933427f7de1f0eef/raw/nuances.json';
const SERVER_TIME_URL = 'https://open.spotify.com/api/server-time';
const TOKEN_URL = 'https://open.spotify.com/api/token';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface SpotifyToken {
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
}

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

let storedConfig: StoredConfig = loadConfig();

function loadConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(cfg: StoredConfig) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    storedConfig = cfg;
  } catch { /* ignore */ }
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/=/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const c of cleaned) {
    const val = alphabet.indexOf(c);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, serverTimeSec: number): string {
  const key = base32Decode(secret);
  const timeStep = Math.floor(serverTimeSec / 30);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/plain, */*',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchAccessToken(spDc: string): Promise<SpotifyToken> {
  const nuancesStr = await httpGet(NUANCE_URL);
  const nuances: Array<{ s: string; v: number }> = JSON.parse(nuancesStr);
  const latest = nuances.sort((a, b) => b.v - a.v)[0];
  if (!latest) throw new Error('No valid Spotify TOTP secret found');

  let serverTimeSec = Math.floor(Date.now() / 1000);
  try {
    const timeStr = await httpGet(SERVER_TIME_URL);
    const timeJson = JSON.parse(timeStr);
    if (timeJson.serverTime) serverTimeSec = Math.floor(timeJson.serverTime / 1000);
  } catch { /* fallback to local time */ }

  const totp = generateTotp(latest.s, serverTimeSec);
  const tokenUrl = `${TOKEN_URL}?reason=transport&productType=web-player&totp=${totp}&totpServer=${totp}&totpVer=${latest.v}`;

  const resBody = await httpGet(tokenUrl, {
    Cookie: `sp_dc=${spDc}`,
  });

  const parsed = JSON.parse(resBody);
  if (!parsed.accessToken || parsed.isAnonymous) {
    throw new Error('Received anonymous token — sp_dc cookie may be invalid or expired');
  }

  return parsed as SpotifyToken;
}

async function getValidToken(): Promise<string> {
  if (storedConfig.accessToken && storedConfig.expiresAt && Date.now() < storedConfig.expiresAt - 60000) {
    return storedConfig.accessToken;
  }
  if (!storedConfig.spDc) {
    throw new Error('Spotify not connected. Please log in or provide sp_dc cookie.');
  }

  const tok = await fetchAccessToken(storedConfig.spDc);
  saveConfig({
    ...storedConfig,
    accessToken: tok.accessToken,
    expiresAt: tok.accessTokenExpirationTimestampMs,
  });
  return tok.accessToken;
}

async function spotifyApi(endpoint: string): Promise<any> {
  const token = await getValidToken();
  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;
  const res = await httpGet(url, {
    Authorization: `Bearer ${token}`,
  });
  return JSON.parse(res);
}

/**
 * SpotifyPlaybackResolver:
 * Resolves a Spotify track (title, artist) to a YouTube Music stream URL via yt-dlp
 */
export async function resolveSpotifyTrackToStream(track: { title: string; artist: string }): Promise<{ url: string; id: string }> {
  const query = `ytsearch1:${track.artist} - ${track.title} official audio`;
  const { stdout } = await execFileAsync('yt-dlp', [
    '--dump-json',
    '--no-warnings',
    '--quiet',
    query,
  ], { timeout: 30000 });

  const firstLine = stdout.trim().split('\n')[0];
  const info = JSON.parse(firstLine);
  const videoId = info.id;

  const urlOut = await execFileAsync('yt-dlp', [
    '--no-playlist',
    '--format', 'bestaudio[ext=webm]/bestaudio/best',
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
  // Check connection status
  ipcMain.handle('spotify:getStatus', () => {
    return {
      connected: !!storedConfig.spDc,
      user: storedConfig.user ?? null,
    };
  });

  // Connect via webview popup login
  ipcMain.handle('spotify:login', async () => {
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 480,
        height: 680,
        parent: BrowserWindow.getAllWindows()[0],
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL('https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F');

      const checkCookies = async () => {
        try {
          const cookies = await session.defaultSession.cookies.get({ domain: '.spotify.com' });
          const spDcCookie = cookies.find((c) => c.name === 'sp_dc');
          if (spDcCookie && spDcCookie.value) {
            const spDc = spDcCookie.value;
            authWindow.close();

            // Fetch token and user profile
            const token = await fetchAccessToken(spDc);
            const userRes = await httpGet('https://api.spotify.com/v1/me', {
              Authorization: `Bearer ${token.accessToken}`,
            });
            const userData = JSON.parse(userRes);

            saveConfig({
              spDc,
              accessToken: token.accessToken,
              expiresAt: token.accessTokenExpirationTimestampMs,
              user: {
                id: userData.id,
                displayName: userData.display_name || userData.id,
                avatarUrl: userData.images?.[0]?.url,
                product: userData.product,
              },
            });

            resolve({ ok: true, user: storedConfig.user });
            return true;
          }
        } catch (err) {
          console.error('Error during Spotify cookie check', err);
        }
        return false;
      };

      authWindow.webContents.on('did-navigate', async (_e, url) => {
        if (url.includes('open.spotify.com')) {
          await checkCookies();
        }
      });

      authWindow.on('closed', async () => {
        const found = await checkCookies();
        if (!found) resolve({ ok: false, error: 'Login closed' });
      });
    });
  });

  // Manual sp_dc cookie connection
  ipcMain.handle('spotify:connectManual', async (_e, spDc: string) => {
    try {
      const token = await fetchAccessToken(spDc.trim());
      const userRes = await httpGet('https://api.spotify.com/v1/me', {
        Authorization: `Bearer ${token.accessToken}`,
      });
      const userData = JSON.parse(userRes);

      saveConfig({
        spDc: spDc.trim(),
        accessToken: token.accessToken,
        expiresAt: token.accessTokenExpirationTimestampMs,
        user: {
          id: userData.id,
          displayName: userData.display_name || userData.id,
          avatarUrl: userData.images?.[0]?.url,
          product: userData.product,
        },
      });

      return { ok: true, user: storedConfig.user };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  // Disconnect Spotify
  ipcMain.handle('spotify:disconnect', () => {
    saveConfig({});
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

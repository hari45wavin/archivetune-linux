/**
 * scrobble.ts — Last.fm Audioscrobbler 2.0 scrobbling
 */

import { ipcMain } from 'electron';
import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';

interface ScrobbleConfig {
  apiKey: string;
  apiSecret: string;
  sessionKey: string;
}

let config: ScrobbleConfig | null = null;

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('');
  return md5(sorted + secret);
}

function postLastfm(params: Record<string, string>): Promise<object> {
  return new Promise((resolve, reject) => {
    const body = querystring.stringify(params);
    const req = https.request({
      hostname: 'ws.audioscrobbler.com',
      path: '/2.0/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'ArchiveTune-Linux/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function setupScrobbleIPC() {
  ipcMain.handle('scrobble:configure', (_e, apiKey: string, apiSecret: string, sessionKey: string) => {
    config = { apiKey, apiSecret, sessionKey };
    return { ok: true };
  });

  ipcMain.handle('scrobble:nowPlaying', async (_e, track: { artist: string; title: string; album?: string; duration?: number }) => {
    if (!config) return { ok: false, error: 'not configured' };
    const params: Record<string, string> = {
      method: 'track.updateNowPlaying',
      artist: track.artist,
      track: track.title,
      api_key: config.apiKey,
      sk: config.sessionKey,
      format: 'json',
    };
    if (track.album) params.album = track.album;
    if (track.duration) params.duration = String(Math.round(track.duration));
    params.api_sig = sign(params, config.apiSecret);
    try {
      await postLastfm(params);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('scrobble:scrobble', async (_e, track: { artist: string; title: string; album?: string; timestamp: number; duration?: number }) => {
    if (!config) return { ok: false, error: 'not configured' };
    const params: Record<string, string> = {
      method: 'track.scrobble',
      artist: track.artist,
      track: track.title,
      timestamp: String(track.timestamp),
      api_key: config.apiKey,
      sk: config.sessionKey,
      format: 'json',
    };
    if (track.album) params.album = track.album;
    if (track.duration) params.duration = String(Math.round(track.duration));
    params.api_sig = sign(params, config.apiSecret);
    try {
      await postLastfm(params);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}

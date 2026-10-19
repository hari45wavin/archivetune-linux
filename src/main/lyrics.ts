/**
 * lyrics.ts — Multi-source synced lyrics fetcher
 *
 * Waterfall: LRCLib → LRCX → plain text fallback
 * Returns LRC-format timestamped lines for the renderer to sync.
 */

import { ipcMain } from 'electron';
import https from 'https';

interface LyricLine {
  time: number; // seconds
  text: string;
}

interface LyricsResult {
  synced: LyricLine[];
  plain: string;
  source: string;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ArchiveTune-Linux/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  for (const line of lrc.split('\n')) {
    const m = line.match(re);
    if (m) {
      const mins = parseInt(m[1], 10);
      const secs = parseInt(m[2], 10);
      const ms = parseInt(m[3].padEnd(3, '0'), 10);
      const text = m[4].trim();
      if (text) {
        lines.push({ time: mins * 60 + secs + ms / 1000, text });
      }
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function fetchLRCLib(title: string, artist: string, duration: number): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(Math.round(duration)) });
    const data = await httpsGet(`https://lrclib.net/api/get?${params}`);
    const json = JSON.parse(data);
    if (json.syncedLyrics) {
      return {
        synced: parseLRC(json.syncedLyrics),
        plain: json.plainLyrics ?? '',
        source: 'LRCLib',
      };
    }
    if (json.plainLyrics) {
      return { synced: [], plain: json.plainLyrics, source: 'LRCLib' };
    }
  } catch { /* fall through */ }
  return null;
}

async function fetchLRCLibSearch(title: string, artist: string): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({ q: `${artist} ${title}` });
    const data = await httpsGet(`https://lrclib.net/api/search?${params}`);
    const results = JSON.parse(data);
    if (Array.isArray(results) && results.length > 0) {
      const best = results[0];
      if (best.syncedLyrics) {
        return { synced: parseLRC(best.syncedLyrics), plain: best.plainLyrics ?? '', source: 'LRCLib' };
      }
      if (best.plainLyrics) {
        return { synced: [], plain: best.plainLyrics, source: 'LRCLib' };
      }
    }
  } catch { /* fall through */ }
  return null;
}

export function setupLyricsIPC() {
  ipcMain.handle('lyrics:get', async (_e, title: string, artist: string, duration: number) => {
    // Try exact match first, then search
    const result = (await fetchLRCLib(title, artist, duration)) ?? (await fetchLRCLibSearch(title, artist));
    if (result) return result;
    return { synced: [], plain: '', source: 'none' };
  });
}

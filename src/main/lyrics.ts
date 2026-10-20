/**
 * lyrics.ts — Multi-source synced lyrics fetcher with smart title cleanup
 *
 * Waterfall: LRCLib (Cleaned Exact Match) → LRCLib (Fuzzy Search) → Raw Fallback
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
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'ArchiveTune-Linux/1.0 (https://github.com/hari45wavin/archivetune-linux)',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
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

function cleanTitle(rawTitle: string): string {
  let t = rawTitle
    .replace(/\s*[\(\[](?:Official\s*(?:Music\s*)?(?:Video|Audio|Visualizer|Lyric\s*Video)?|Lyrics|HD|HQ|Remastered|4K|Full\s*Song|Video|Audio)[\)\]]/gi, '')
    .replace(/\s*[\(\[]From\s*["'].*?["'][\)\]]/gi, '')
    .replace(/\s*[\(\[]feat\..*?[\)\]]/gi, '')
    .replace(/\|\s*.*$/g, '')
    .trim();

  // If title is "Artist - Title", extract title
  const parts = t.split(/\s*[-–—]\s*/);
  if (parts.length > 1) {
    t = parts[parts.length - 1].trim();
  }
  return t;
}

function cleanArtist(rawArtist: string): string {
  return rawArtist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*Official$/i, '')
    .replace(/\s*and\s*\d+\s*more$/i, '')
    .trim();
}

async function fetchLRCLib(title: string, artist: string, duration: number): Promise<LyricsResult | null> {
  const cleanT = cleanTitle(title);
  const cleanA = cleanArtist(artist);

  // 1. Try cleaned exact match
  try {
    const params = new URLSearchParams({
      track_name: cleanT,
      artist_name: cleanA,
    });
    if (duration > 0) params.append('duration', String(Math.round(duration)));

    const data = await httpsGet(`https://lrclib.net/api/get?${params}`);
    const json = JSON.parse(data);
    if (json.syncedLyrics) {
      return {
        synced: parseLRC(json.syncedLyrics),
        plain: json.plainLyrics ?? '',
        source: 'LRCLib Synced',
      };
    }
    if (json.plainLyrics) {
      return { synced: [], plain: json.plainLyrics, source: 'LRCLib Plain' };
    }
  } catch { /* fall through */ }

  // 2. Try search with cleaned title + artist
  try {
    const params = new URLSearchParams({ q: `${cleanA} ${cleanT}` });
    const data = await httpsGet(`https://lrclib.net/api/search?${params}`);
    const results = JSON.parse(data);
    if (Array.isArray(results) && results.length > 0) {
      // Find item with closest duration or first synced
      const syncedBest = results.find((r: any) => r.syncedLyrics);
      const best = syncedBest || results[0];
      if (best.syncedLyrics) {
        return {
          synced: parseLRC(best.syncedLyrics),
          plain: best.plainLyrics ?? '',
          source: 'LRCLib Synced',
        };
      }
      if (best.plainLyrics) {
        return { synced: [], plain: best.plainLyrics, source: 'LRCLib Plain' };
      }
    }
  } catch { /* fall through */ }

  return null;
}

export function setupLyricsIPC() {
  ipcMain.handle('lyrics:get', async (_e, title: string, artist: string, duration: number) => {
    try {
      const result = await fetchLRCLib(title, artist, duration);
      if (result) return result;
    } catch (err) {
      console.error('lyrics:get error', err);
    }
    return { synced: [], plain: '', source: 'none' };
  });
}

/**
 * ytmusic.ts — YouTube Music Live Integration via yt-dlp & InnerTube
 *
 * Provides real-time live songs from YouTube Music:
 * - Dynamic Live Trending Charts
 * - Curated Categories (Global Top 50, Bollywood/Hindi, Top Mixes, Pop Hits, Lo-Fi, Romantic, Hip Hop)
 * - Live Search
 * - Fast stream URL extraction
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const YT_DLP = 'yt-dlp';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  album?: string;
}

const CATEGORY_QUERIES: Record<string, string[]> = {
  trending: [
    'https://www.youtube.com/playlist?list=PL4fGSI1pDJn5kI81J1fYWK5eZRl1zJ5kM',
    'ytsearch30:trending music songs hits official audio 2026 -jukebox -mashup',
    'ytsearch30:top trending songs music 2026',
  ],
  global_top: [
    'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEoN9oe32PUTrNwZ3',
    'ytsearch30:top 50 global hits music songs 2026 -jukebox',
  ],
  hindi: [
    'ytsearch30:latest hindi songs bollywood 2026 single official audio -jukebox -mashup',
    'ytsearch30:top bollywood romantic hits 2026 audio -jukebox',
  ],
  mixes: [
    'ytsearch30:top music mix jukebox bollywood chill 2026',
    'ytsearch30:hindi acoustic lofi mix songs 2026',
  ],
  pop: [
    'ytsearch30:top pop music hits songs official audio 2026 -jukebox',
  ],
  lofi: [
    'ytsearch30:lofi vibe hindi chill relax songs 2026',
    'ytsearch30:chill lofi hip hop beats to study relax to',
  ],
  romantic: [
    'ytsearch30:best romantic love songs hindi english 2026 -jukebox',
  ],
  hiphop: [
    'ytsearch30:top hip hop rap hits 2026 official audio -jukebox',
  ],
};

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[([{\u3010\uff08].*?(Official|Music Video|Video|Audio|Lyric|4K|HD|Full Song|Visualizer|Teaser|Remastered).*?[)\]}\u3011\uff09]/gi, '')
    .replace(/\|\s*@.*$/g, '')
    .replace(/\|\s*Full Video.*$/gi, '')
    .replace(/\|\s*Official Music Video.*$/gi, '')
    .trim() || raw;
}

function cleanArtist(raw: string): string {
  return raw
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official$/i, '')
    .trim() || raw;
}

async function parseYtdlpOutput(stdout: string, filterDuration = true): Promise<SearchResult[]> {
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    try {
      const item = JSON.parse(line);
      if (!item.id) return null;

      // Filter out compilations / hour-long videos for single track lists
      if (filterDuration && item.duration && item.duration > 700) {
        return null;
      }

      let thumb = item.thumbnail;
      if (!thumb && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
        // Pick largest resolution thumbnail
        const sorted = [...item.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
        thumb = sorted[0]?.url;
      }
      if (!thumb) {
        thumb = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
      }

      return {
        id: item.id,
        title: cleanTitle(item.title ?? 'Unknown Title'),
        artist: cleanArtist(item.uploader ?? item.channel ?? item.artist ?? 'YouTube Music'),
        thumbnail: thumb,
        duration: item.duration ?? 0,
        album: item.album ?? undefined,
      } as SearchResult;
    } catch {
      return null;
    }
  }).filter(Boolean) as SearchResult[];
}

const categoryCache = new Map<string, { data: SearchResult[]; timestamp: number }>();
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes live cache

async function fetchCategoryOnline(category: string): Promise<SearchResult[]> {
  const queries = CATEGORY_QUERIES[category] || [`ytsearch30:${category} top songs 2026 -jukebox`];
  const filterDuration = category !== 'mixes';

  for (const target of queries) {
    const isPlaylist = target.startsWith('http');
    const args = [
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      '--quiet',
    ];

    if (isPlaylist) {
      args.push('--playlist-end', '30', target);
    } else {
      args.push(target);
    }

    try {
      const { stdout } = await execFileAsync(YT_DLP, args, { timeout: 35000, maxBuffer: 15 * 1024 * 1024 });
      const results = await parseYtdlpOutput(stdout, filterDuration);
      if (results.length > 0) {
        categoryCache.set(category, { data: results, timestamp: Date.now() });
        return results;
      }
    } catch (err) {
      console.warn(`Query ${target} failed, trying next...`);
    }
  }

  return [];
}

export async function getLiveCategory(category = 'trending', forceRefresh = false): Promise<SearchResult[]> {
  const cached = categoryCache.get(category);
  if (!forceRefresh && cached && cached.data.length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const live = await fetchCategoryOnline(category);
  if (live.length > 0) {
    return live;
  }

  // If live fetch failed but we have cached data, fallback to cache
  if (cached && cached.data.length > 0) {
    return cached.data;
  }

  return [];
}

export async function searchYouTubeMusic(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const { stdout } = await execFileAsync(YT_DLP, [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
    `ytsearch30:${query.trim()}`,
  ], { timeout: 30000, maxBuffer: 15 * 1024 * 1024 });

  return await parseYtdlpOutput(stdout);
}

export async function getStreamUrl(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { stdout } = await execFileAsync(YT_DLP, [
    '--no-playlist',
    '--format', 'bestaudio[ext=webm]/bestaudio/best',
    '--get-url',
    '--quiet',
    url,
  ], { timeout: 30000 });

  const streamUrl = stdout.trim().split('\n')[0];
  if (!streamUrl) throw new Error('Failed to resolve audio stream URL');
  return streamUrl;
}

export function setupYTMusicIPC() {
  ipcMain.handle('ytmusic:getHome', async () => {
    try {
      const trending = await getLiveCategory('trending');
      return { trending };
    } catch (err) {
      console.error('ytmusic:getHome error', err);
      return { trending: [] };
    }
  });

  ipcMain.handle('ytmusic:getCategory', async (_e, category: string, forceRefresh = false) => {
    try {
      return await getLiveCategory(category, forceRefresh);
    } catch (err) {
      console.error('ytmusic:getCategory error', err);
      return [];
    }
  });

  ipcMain.handle('ytmusic:search', async (_e, query: string) => {
    try {
      return await searchYouTubeMusic(query);
    } catch (err) {
      console.error('ytmusic:search error', err);
      return [];
    }
  });

  ipcMain.handle('ytmusic:getStreamUrl', async (_e, videoId: string) => {
    try {
      const url = await getStreamUrl(videoId);
      return { url, ok: true };
    } catch (err: any) {
      console.error('ytmusic:getStreamUrl error', err);
      return { url: null, ok: false, error: err.message || String(err) };
    }
  });
}

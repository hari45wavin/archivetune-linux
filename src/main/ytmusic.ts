/**
 * ytmusic.ts — YouTube Music Live Integration via yt-dlp & InnerTube
 *
 * Provides real-time live songs from YouTube Music:
 * - Live Trending Charts
 * - Curated Categories (Global Top 50, Bollywood/Hindi, Pop Hits, Lo-Fi, Hip Hop)
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

const CATEGORY_QUERIES: Record<string, string> = {
  trending: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn5kI81J1fYWK5eZRl1zJ5kM',
  global_top: 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jXS_PEoN9oe32PUTrNwZ3',
  hindi: 'ytsearch25:latest hindi songs bollywood 2026',
  pop: 'ytsearch25:top pop music hits songs',
  lofi: 'ytsearch25:chill lofi hip hop beats to study relax to',
  hiphop: 'ytsearch25:top hip hop rap hits',
};

async function parseYtdlpOutput(stdout: string): Promise<SearchResult[]> {
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    try {
      const item = JSON.parse(line);
      if (!item.id) return null;
      return {
        id: item.id,
        title: item.title ?? 'Unknown Title',
        artist: item.uploader ?? item.channel ?? item.artist ?? 'YouTube Music',
        thumbnail: item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        duration: item.duration ?? 0,
        album: item.album ?? undefined,
      } as SearchResult;
    } catch {
      return null;
    }
  }).filter(Boolean) as SearchResult[];
}

export async function getLiveCategory(category = 'trending'): Promise<SearchResult[]> {
  const target = CATEGORY_QUERIES[category] || `ytsearch25:${category} songs`;
  const isPlaylist = target.startsWith('http');

  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
  ];

  if (isPlaylist) {
    args.push('--playlist-end', '25', target);
  } else {
    args.push(target);
  }

  try {
    const { stdout } = await execFileAsync(YT_DLP, args, { timeout: 35000, maxBuffer: 10 * 1024 * 1024 });
    const results = await parseYtdlpOutput(stdout);
    if (results.length > 0) return results;
  } catch (err) {
    console.warn(`Category fetch ${category} failed, falling back to search`, err);
  }

  // Fallback search query
  try {
    const { stdout } = await execFileAsync(YT_DLP, [
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      '--quiet',
      `ytsearch20:${category} top songs`,
    ], { timeout: 25000, maxBuffer: 10 * 1024 * 1024 });
    return await parseYtdlpOutput(stdout);
  } catch {
    return [];
  }
}

export async function searchYouTubeMusic(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const { stdout } = await execFileAsync(YT_DLP, [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
    `ytsearch25:${query.trim()}`,
  ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

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

  ipcMain.handle('ytmusic:getCategory', async (_e, category: string) => {
    try {
      return await getLiveCategory(category);
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

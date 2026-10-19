/**
 * ytmusic.ts — YouTube Music integration via yt-dlp
 *
 * Uses yt-dlp for stream URL extraction and ytmusicapi (Python) for metadata.
 * Falls back to yt-dlp JSON metadata when Python bridge is unavailable.
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const YT_DLP = 'yt-dlp';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  album?: string;
}

async function ytdlpJson(args: string[]): Promise<object> {
  const { stdout } = await execFileAsync(YT_DLP, args, { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function getStreamUrl(videoId: string): Promise<string> {
  const url = `https://music.youtube.com/watch?v=${videoId}`;
  const { stdout } = await execFileAsync(YT_DLP, [
    '--no-playlist',
    '--format', 'bestaudio[ext=webm]/bestaudio/best',
    '--get-url',
    '--quiet',
    url,
  ], { timeout: 30000 });
  return stdout.trim();
}

async function searchYT(query: string): Promise<SearchResult[]> {
  // Use YouTube Music search via yt-dlp
  const searchUrl = `ytmsearch10:${query}`;
  const { stdout } = await execFileAsync(YT_DLP, [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
    searchUrl,
  ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });

  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    try {
      const item = JSON.parse(line);
      return {
        id: item.id ?? '',
        title: item.title ?? 'Unknown',
        artist: item.uploader ?? item.channel ?? 'Unknown Artist',
        thumbnail: item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
        duration: item.duration ?? 0,
        album: item.album ?? undefined,
      } as SearchResult;
    } catch {
      return null;
    }
  }).filter(Boolean) as SearchResult[];
}

async function getHome(): Promise<{ trending: SearchResult[] }> {
  // Return trending music from YouTube Music
  const { stdout } = await execFileAsync(YT_DLP, [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
    '--playlist-end', '20',
    'https://music.youtube.com/playlist?list=RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ns7t5w14Ph-yfA', // Trending music playlist
  ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });

  const lines = stdout.trim().split('\n').filter(Boolean);
  const trending = lines.map((line) => {
    try {
      const item = JSON.parse(line);
      return {
        id: item.id ?? '',
        title: item.title ?? 'Unknown',
        artist: item.uploader ?? item.channel ?? 'Unknown Artist',
        thumbnail: item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
        duration: item.duration ?? 0,
      } as SearchResult;
    } catch {
      return null;
    }
  }).filter(Boolean) as SearchResult[];

  return { trending };
}

async function getSuggested(videoId: string): Promise<SearchResult[]> {
  const url = `https://music.youtube.com/watch?v=${videoId}`;
  const { stdout } = await execFileAsync(YT_DLP, [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
    '--playlist-end', '10',
    `ytsearch10:related:${url}`,
  ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }).catch(() => ({ stdout: '' }));

  if (!stdout) return [];
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    try {
      const item = JSON.parse(line);
      return {
        id: item.id ?? '',
        title: item.title ?? 'Unknown',
        artist: item.uploader ?? 'Unknown Artist',
        thumbnail: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
        duration: item.duration ?? 0,
      } as SearchResult;
    } catch {
      return null;
    }
  }).filter(Boolean) as SearchResult[];
}

export function setupYTMusicIPC() {
  ipcMain.handle('ytmusic:search', async (_e, query: string) => {
    try {
      return await searchYT(query);
    } catch (err) {
      console.error('ytmusic:search error', err);
      return [];
    }
  });

  ipcMain.handle('ytmusic:getStreamUrl', async (_e, videoId: string) => {
    try {
      const url = await getStreamUrl(videoId);
      return { url, ok: true };
    } catch (err) {
      console.error('ytmusic:getStreamUrl error', err);
      return { url: null, ok: false, error: String(err) };
    }
  });

  ipcMain.handle('ytmusic:getHome', async () => {
    try {
      return await getHome();
    } catch (err) {
      console.error('ytmusic:getHome error', err);
      return { trending: [] };
    }
  });

  ipcMain.handle('ytmusic:getSuggested', async (_e, videoId: string) => {
    try {
      return await getSuggested(videoId);
    } catch (err) {
      console.error('ytmusic:getSuggested error', err);
      return [];
    }
  });

  ipcMain.handle('ytmusic:getAlbum', async (_e, albumId: string) => {
    try {
      const { stdout } = await execFileAsync(YT_DLP, [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--quiet',
        `https://music.youtube.com/playlist?list=${albumId}`,
      ], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
      const lines = stdout.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch (err) {
      console.error('ytmusic:getAlbum error', err);
      return [];
    }
  });

  ipcMain.handle('ytmusic:getPlaylist', async (_e, playlistId: string) => {
    try {
      const { stdout } = await execFileAsync(YT_DLP, [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--quiet',
        `https://music.youtube.com/playlist?list=${playlistId}`,
      ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
      const lines = stdout.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch (err) {
      console.error('ytmusic:getPlaylist error', err);
      return [];
    }
  });
}

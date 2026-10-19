/**
 * library.ts — Local music library scanner
 *
 * Scans directories recursively for audio files, reads ID3/FLAC tags,
 * and provides fast lookup for the renderer's Library page.
 */

import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma', '.ape', '.mpc',
]);

export interface TrackMeta {
  path: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNumber: number;
  duration: number;
  year: number;
  thumbnail?: string; // base64 or null
  format: string;
}

function scanDirectory(dirPath: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDirectory(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

async function getMetadata(filePath: string): Promise<TrackMeta> {
  // Use ffprobe to read metadata (always available alongside mpv installs)
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ], { timeout: 10000 });

    const data = JSON.parse(stdout);
    const tags = data.format?.tags ?? {};
    const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio') ?? {};

    const duration = parseFloat(data.format?.duration ?? audioStream.duration ?? '0');
    const title = tags.title ?? tags.TITLE ?? path.basename(filePath, path.extname(filePath));
    const artist = tags.artist ?? tags.ARTIST ?? tags.album_artist ?? 'Unknown Artist';
    const album = tags.album ?? tags.ALBUM ?? 'Unknown Album';
    const albumArtist = tags.album_artist ?? tags.ALBUMARTIST ?? artist;
    const trackNumber = parseInt(tags.track ?? tags.TRACK ?? '0', 10);
    const year = parseInt(tags.date ?? tags.DATE ?? tags.year ?? tags.YEAR ?? '0', 10);

    return {
      path: filePath,
      title,
      artist,
      album,
      albumArtist,
      trackNumber,
      duration,
      year,
      format: path.extname(filePath).slice(1).toUpperCase(),
    };
  } catch {
    // Fallback: minimal metadata from filename
    return {
      path: filePath,
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      albumArtist: 'Unknown Artist',
      trackNumber: 0,
      duration: 0,
      year: 0,
      format: path.extname(filePath).slice(1).toUpperCase(),
    };
  }
}

export function setupLibraryIPC() {
  ipcMain.handle('library:scan', async (_e, dirPath: string) => {
    if (!fs.existsSync(dirPath)) return [];
    const files = scanDirectory(dirPath);
    // Read metadata for all files (batched for performance)
    const BATCH = 20;
    const results: TrackMeta[] = [];
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      const metas = await Promise.all(batch.map(getMetadata));
      results.push(...metas);
    }
    return results;
  });

  ipcMain.handle('library:getMetadata', async (_e, filePath: string) => {
    return getMetadata(filePath);
  });
}

import React, { useCallback } from 'react';
import { FolderOpen, RefreshCw, Music2 } from 'lucide-react';
import { useLibraryStore } from '../store';
import TrackRow from '../components/TrackRow';
import { Track } from '../store';

export default function LibraryPage() {
  const { tracks, directories, isScanning, addDirectory, setTracks, setIsScanning } = useLibraryStore();

  const handleAddDirectory = useCallback(async () => {
    const dirPath = await window.electronAPI?.library.addDirectory();
    if (!dirPath) return;
    addDirectory(dirPath);
    await scanDirectory(dirPath);
  }, [addDirectory]);

  const scanDirectory = useCallback(async (dirPath: string) => {
    setIsScanning(true);
    try {
      const scanned = await window.electronAPI?.library.scan(dirPath) ?? [];
      const libTracks: Track[] = scanned.map((meta: { path: string; title: string; artist: string; album: string; albumArtist: string; duration: number; thumbnail?: string }) => ({
        id: meta.path,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        duration: meta.duration,
        thumbnail: meta.thumbnail,
        source: 'local' as const,
        path: meta.path,
      }));
      setTracks([...useLibraryStore.getState().tracks, ...libTracks]);
    } finally {
      setIsScanning(false);
    }
  }, [setTracks, setIsScanning]);

  const handleRescan = useCallback(async () => {
    setTracks([]);
    for (const dir of directories) {
      await scanDirectory(dir);
    }
  }, [directories, scanDirectory, setTracks]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Library</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {tracks.length} songs{directories.length > 0 ? ` from ${directories.length} folder${directories.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {directories.length > 0 && (
            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
              Rescan
            </button>
          )}
          <button
            onClick={handleAddDirectory}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity text-sm"
          >
            <FolderOpen size={16} />
            Add Folder
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isScanning && (
        <div className="flex items-center gap-3 text-on-surface-variant bg-surface-container rounded-xl p-4">
          <RefreshCw size={16} className="animate-spin text-primary" />
          <span className="text-sm">Scanning library…</span>
        </div>
      )}

      {/* Tracks */}
      {tracks.length > 0 ? (
        <div className="space-y-1">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} showIndex queue={tracks} />
          ))}
        </div>
      ) : !isScanning ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant gap-4">
          <Music2 size={48} className="text-primary/40" />
          <div className="text-center">
            <p className="text-base font-medium">Your library is empty</p>
            <p className="text-sm mt-1">Add a folder containing your music files</p>
          </div>
          <button
            onClick={handleAddDirectory}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary hover:opacity-90 transition-opacity text-sm font-medium"
          >
            <FolderOpen size={18} />
            Choose Music Folder
          </button>
        </div>
      ) : null}
    </div>
  );
}

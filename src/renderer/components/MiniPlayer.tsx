import React, { useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronUp } from 'lucide-react';
import { usePlayerStore } from '../store';
import { usePlayer } from '../lib/usePlayer';
import { useUIStore } from '../store';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const { currentTrack, isPlaying, position, duration, volume } = usePlayerStore();
  const { pause, resume, seek, skipNext, skipPrev } = usePlayer();
  const { setShowNowPlaying } = useUIStore();

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  }, [seek]);

  const handleVolume = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    usePlayerStore.getState().setVolume(vol);
    await window.electronAPI?.player.setVolume(vol);
  }, []);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="shrink-0 bg-surface-container border-t border-outline-variant">
      {/* Progress bar (thin, at top) */}
      <div className="relative h-1 bg-surface-container-high group cursor-pointer">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={position}
          onChange={handleSeek}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-4 px-4 h-16">
        {/* Thumbnail + info */}
        <button
          onClick={() => setShowNowPlaying(true)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-container-high overflow-hidden shrink-0">
            {currentTrack.thumbnail ? (
              <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary">♪</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface truncate">{currentTrack.title}</p>
            <p className="text-xs text-on-surface-variant truncate">{currentTrack.artist}</p>
          </div>
          <ChevronUp size={16} className="text-on-surface-variant shrink-0 ml-1" />
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={skipPrev} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <SkipBack size={18} />
          </button>

          <button
            onClick={isPlaying ? pause : resume}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>

          <button onClick={skipNext} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <SkipForward size={18} />
          </button>
        </div>

        {/* Time */}
        <div className="text-xs text-on-surface-variant shrink-0 w-20 text-right tabular-nums">
          {formatTime(position)} / {formatTime(duration)}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 shrink-0">
          <Volume2 size={14} className="text-on-surface-variant" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="w-20 accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

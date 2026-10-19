import React from 'react';
import { Play, Plus } from 'lucide-react';
import { Track } from '../store';
import { usePlayer } from '../lib/usePlayer';
import { usePlayerStore } from '../store';

interface TrackRowProps {
  track: Track;
  index?: number;
  showIndex?: boolean;
  queue?: Track[];
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackRow({ track, index, showIndex = false, queue }: TrackRowProps) {
  const { playTrack } = usePlayer();
  const { currentTrack, isPlaying, addToQueue, setQueue } = usePlayerStore();
  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (queue) {
      const startIdx = queue.findIndex((t) => t.id === track.id);
      setQueue(queue, startIdx >= 0 ? startIdx : 0);
    }
    playTrack(track);
  };

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer ${
        isCurrentTrack ? 'bg-primary-container/40' : ''
      }`}
      onDoubleClick={handlePlay}
    >
      {/* Index or thumbnail */}
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        <span className={`text-sm tabular-nums group-hover:hidden ${isCurrentTrack ? 'text-primary' : 'text-on-surface-variant'}`}>
          {showIndex && index !== undefined ? index + 1 : null}
        </span>
        <button
          onClick={handlePlay}
          className="hidden group-hover:flex w-8 h-8 items-center justify-center rounded-full hover:bg-primary hover:text-on-primary text-on-surface transition-colors"
        >
          <Play size={14} fill="currentColor" />
        </button>
      </div>

      {/* Thumbnail (if not showing index) */}
      {!showIndex && (
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-high">
          {track.thumbnail ? (
            <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary text-lg">♪</div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrentTrack ? 'text-primary' : 'text-on-surface'}`}>
          {track.title}
        </p>
        <p className="text-xs text-on-surface-variant truncate">{track.artist}</p>
      </div>

      {/* Album */}
      {track.album && (
        <span className="text-xs text-on-surface-variant hidden md:block truncate max-w-[120px]">{track.album}</span>
      )}

      {/* Duration */}
      <span className="text-xs text-on-surface-variant tabular-nums w-10 text-right">{formatDuration(track.duration)}</span>

      {/* Add to queue button */}
      <button
        onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
        className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest text-on-surface-variant transition-all"
        title="Add to queue"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

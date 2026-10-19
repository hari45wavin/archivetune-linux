import React, { useEffect, useState, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore, useUIStore } from '../store';
import { usePlayer } from '../lib/usePlayer';

interface LyricLine {
  time: number;
  text: string;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingOverlay() {
  const { currentTrack, isPlaying, position, duration, repeat, shuffle } = usePlayerStore();
  const { setShowNowPlaying } = useUIStore();
  const { pause, resume, seek, skipNext, skipPrev } = usePlayer();
  const { setRepeat, toggleShuffle } = usePlayerStore();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsSource, setLyricsSource] = useState('');
  const [showQueue, setShowQueue] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Find active lyric line
  const activeIndex = lyrics.reduce((acc, line, i) => {
    if (line.time <= position) return i;
    return acc;
  }, -1);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setLyrics([]);
    window.electronAPI?.lyrics
      .get(currentTrack.title, currentTrack.artist, currentTrack.duration)
      .then((res) => {
        setLyrics(res.synced);
        setLyricsSource(res.source);
      })
      .catch(() => {});
  }, [currentTrack?.id]);

  // Auto-scroll lyrics
  useEffect(() => {
    activeLyricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  const nextRepeat = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    setRepeat(modes[(idx + 1) % modes.length]);
  };

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 z-50 flex bg-surface"
    >
      {/* Album art section */}
      <div
        className="w-1/2 flex items-center justify-center p-12 bg-surface-container relative"
        style={{
          backgroundImage: currentTrack.thumbnail ? `url(${currentTrack.thumbnail})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-3xl" />
        <div className="relative z-10 w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl now-playing-glow">
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-container-highest flex items-center justify-center text-8xl">🎵</div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="w-1/2 flex flex-col p-8 relative">
        {/* Close button */}
        <button
          onClick={() => setShowNowPlaying(false)}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <X size={20} />
        </button>

        {/* Track info */}
        <div className="mt-8 mb-6">
          <h1 className="text-2xl font-bold text-on-surface mb-1 truncate">{currentTrack.title}</h1>
          <p className="text-base text-on-surface-variant">{currentTrack.artist}</p>
          {currentTrack.album && (
            <p className="text-sm text-on-surface-variant mt-0.5">{currentTrack.album}</p>
          )}
        </div>

        {/* Seek bar */}
        <div className="mb-2">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={position}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-on-surface-variant mt-1 tabular-nums">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 my-4">
          <button
            onClick={toggleShuffle}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${shuffle ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <Shuffle size={18} />
          </button>
          <button onClick={skipPrev} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface transition-colors">
            <SkipBack size={24} />
          </button>
          <button
            onClick={isPlaying ? pause : resume}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90 shadow-lg"
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
          </button>
          <button onClick={skipNext} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface transition-colors">
            <SkipForward size={24} />
          </button>
          <button
            onClick={nextRepeat}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative ${repeat !== 'none' ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <Repeat size={18} />
            {repeat === 'one' && (
              <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center">1</span>
            )}
          </button>
        </div>

        {/* Lyrics / Queue toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowQueue(false)}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${!showQueue ? 'bg-secondary-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            Lyrics
          </button>
          <button
            onClick={() => setShowQueue(true)}
            className={`text-sm px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${showQueue ? 'bg-secondary-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <List size={14} /> Queue
          </button>
          {lyricsSource && !showQueue && (
            <span className="text-xs text-on-surface-variant ml-auto">{lyricsSource}</span>
          )}
        </div>

        {/* Lyrics view */}
        {!showQueue && (
          <div ref={lyricsRef} className="flex-1 overflow-y-auto lyrics-container">
            {lyrics.length > 0 ? (
              <div className="space-y-3 pb-8">
                {lyrics.map((line, i) => (
                  <div
                    key={i}
                    ref={i === activeIndex ? activeLyricRef : null}
                    onClick={() => seek(line.time)}
                    className={`text-base leading-relaxed cursor-pointer transition-all duration-300 rounded-lg px-2 py-1 ${
                      i === activeIndex
                        ? 'text-on-surface font-semibold text-lg scale-105 text-primary'
                        : i < activeIndex
                        ? 'text-on-surface-variant/50'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {line.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">
                No lyrics available
              </div>
            )}
          </div>
        )}

        {/* Queue view */}
        {showQueue && (
          <div className="flex-1 overflow-y-auto">
            <QueueList />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function QueueList() {
  const { queue, queueIndex } = usePlayerStore();
  const { playTrack } = usePlayer();

  return (
    <div className="space-y-1 pb-8">
      {queue.map((track, i) => (
        <button
          key={`${track.id}-${i}`}
          onClick={() => {
            usePlayerStore.getState().setQueue(queue, i);
            playTrack(track);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
            i === queueIndex
              ? 'bg-primary-container text-on-primary-container'
              : 'hover:bg-surface-container-high text-on-surface-variant'
          }`}
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-high">
            {track.thumbnail ? (
              <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary">♪</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{track.title}</p>
            <p className="text-xs truncate opacity-70">{track.artist}</p>
          </div>
        </button>
      ))}
      {queue.length === 0 && (
        <p className="text-center text-on-surface-variant text-sm py-8">Queue is empty</p>
      )}
    </div>
  );
}

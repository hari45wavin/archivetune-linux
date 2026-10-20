import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  List,
  Moon,
  Download,
  Gauge,
  Sliders,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  Check,
  Music2,
  Sparkles,
} from 'lucide-react';
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

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_TIMER_OPTIONS: Array<{ label: string; value: number | 'track' | null }> = [
  { label: 'Off', value: null },
  { label: '15 Minutes', value: 15 },
  { label: '30 Minutes', value: 30 },
  { label: '45 Minutes', value: 45 },
  { label: '60 Minutes', value: 60 },
  { label: 'End of Song', value: 'track' },
];

export default function NowPlayingOverlay() {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    repeat,
    shuffle,
    speed,
    normalization,
    sleepTimer,
    lyricsOffset,
    lyricsFontSize,
    queue,
    setRepeat,
    toggleShuffle,
    setSleepTimer,
    setLyricsOffset,
    setLyricsFontSize,
  } = usePlayerStore();

  const { setShowNowPlaying } = useUIStore();
  const {
    pause,
    resume,
    seek,
    skipNext,
    skipPrev,
    changeSpeed,
    toggleNormalization,
    downloadCurrentTrack,
  } = usePlayer();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsSource, setLyricsSource] = useState('');
  const [showQueue, setShowQueue] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [downloadMsg, setDownloadMsg] = useState('');

  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);

  // Calculate active lyric with lyrics sync offset
  const effectivePosition = position + (lyricsOffset / 1000);
  const activeIndex = lyrics.reduce((acc, line, i) => {
    if (line.time <= effectivePosition) return i;
    return acc;
  }, -1);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setLyrics([]);
    setLyricsSource('');
    window.electronAPI?.lyrics
      .get(currentTrack.title, currentTrack.artist, currentTrack.duration)
      .then((res) => {
        setLyrics(res.synced || []);
        setLyricsSource(res.source || '');
      })
      .catch(() => {});
  }, [currentTrack?.id, currentTrack?.title]);

  // Auto-scroll lyrics smoothly to center
  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  const nextRepeat = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    setRepeat(modes[(idx + 1) % modes.length]);
  };

  const handleDownload = async () => {
    if (downloadState === 'downloading' || !currentTrack) return;
    setDownloadState('downloading');
    setDownloadMsg('Downloading to ~/Music...');
    try {
      const res = await downloadCurrentTrack();
      if (res?.ok) {
        setDownloadState('done');
        setDownloadMsg('Saved to ~/Music');
        setTimeout(() => setDownloadState('idle'), 4000);
      } else {
        setDownloadState('error');
        setDownloadMsg(res?.error || 'Download failed');
        setTimeout(() => setDownloadState('idle'), 4000);
      }
    } catch {
      setDownloadState('error');
      setDownloadMsg('Download failed');
      setTimeout(() => setDownloadState('idle'), 4000);
    }
  };

  if (!currentTrack) return null;

  const fontSizes = {
    small: 'text-sm leading-relaxed',
    medium: 'text-base leading-relaxed',
    large: 'text-xl leading-relaxed',
  };

  const activeFontSizes = {
    small: 'text-base font-semibold',
    medium: 'text-xl font-bold',
    large: 'text-2xl font-black',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed inset-0 z-50 flex bg-surface"
    >
      {/* Left section: Album art & background glow */}
      <div
        className="w-1/2 flex items-center justify-center p-12 bg-surface-container relative overflow-hidden"
        style={{
          backgroundImage: currentTrack.thumbnail ? `url(${currentTrack.thumbnail})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-surface/85 backdrop-blur-3xl" />
        <div className="relative z-10 w-full max-w-sm aspect-square rounded-3xl overflow-hidden shadow-2xl now-playing-glow border border-outline-variant/30">
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface-container-highest flex items-center justify-center text-8xl">🎵</div>
          )}
        </div>
      </div>

      {/* Right section: Controls, Lyrics, Queue */}
      <div className="w-1/2 flex flex-col p-8 relative overflow-hidden">
        {/* Top actions bar */}
        <div className="flex items-center justify-between mb-4 z-20">
          <div className="flex items-center gap-2">
            {/* Sleep Timer */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSleepMenu(!showSleepMenu);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  sleepTimer !== null
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
                title="Sleep Timer"
              >
                <Moon size={14} />
                <span>{sleepTimer === null ? 'Timer' : sleepTimer === 'track' ? 'End Song' : `${sleepTimer}m`}</span>
              </button>

              {showSleepMenu && (
                <div className="absolute top-10 left-0 w-40 bg-surface-container-highest rounded-2xl shadow-2xl p-2 z-50 border border-outline-variant/40 space-y-1">
                  <div className="text-[11px] font-semibold text-on-surface-variant px-2 py-1">Sleep Timer</div>
                  {SLEEP_TIMER_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setSleepTimer(opt.value);
                        setShowSleepMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        sleepTimer === opt.value
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {opt.label}
                      {sleepTimer === opt.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Speed */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowSleepMenu(false);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  speed !== 1.0
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
                title="Playback Speed"
              >
                <Gauge size={14} />
                <span>{speed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute top-10 left-0 w-32 bg-surface-container-highest rounded-2xl shadow-2xl p-2 z-50 border border-outline-variant/40 space-y-1">
                  <div className="text-[11px] font-semibold text-on-surface-variant px-2 py-1">Playback Speed</div>
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        changeSpeed(s);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        speed === s
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {s}x
                      {speed === s && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Normalization */}
            <button
              onClick={toggleNormalization}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                normalization
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
              title="Volume Normalization (dynaudnorm)"
            >
              <Sparkles size={14} />
              <span>Norm</span>
            </button>

            {/* Download Track */}
            <button
              onClick={handleDownload}
              disabled={downloadState === 'downloading'}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                downloadState === 'done'
                  ? 'bg-[#1DB954] text-black font-semibold'
                  : downloadState === 'error'
                  ? 'bg-error/20 text-error'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
              title="Download Track to ~/Music"
            >
              {downloadState === 'downloading' ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : downloadState === 'done' ? (
                <Check size={14} />
              ) : (
                <Download size={14} />
              )}
              <span>
                {downloadState === 'downloading'
                  ? 'Saving...'
                  : downloadState === 'done'
                  ? 'Downloaded'
                  : 'Download'}
              </span>
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowNowPlaying(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {downloadMsg && (
          <div className="text-xs text-primary bg-primary-container/20 px-3 py-1 rounded-lg mb-2">
            {downloadMsg}
          </div>
        )}

        {/* Track Title and Artist */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-on-surface mb-1 truncate">{currentTrack.title}</h1>
          <p className="text-base text-on-surface-variant truncate">{currentTrack.artist}</p>
          {currentTrack.album && (
            <p className="text-xs text-on-surface-variant/80 mt-0.5 truncate">{currentTrack.album}</p>
          )}
        </div>

        {/* Seek slider & Times */}
        <div className="mb-2">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={position}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-xs text-on-surface-variant mt-1 tabular-nums">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 my-2">
          <button
            onClick={toggleShuffle}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              shuffle ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
            title={shuffle ? 'Shuffle On (Click to Undo)' : 'Shuffle Off'}
          >
            <Shuffle size={18} />
          </button>
          <button
            onClick={skipPrev}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface transition-colors"
          >
            <SkipBack size={22} />
          </button>
          <button
            onClick={isPlaying ? pause : resume}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90 shadow-xl transition-all"
          >
            {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <button
            onClick={skipNext}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface transition-colors"
          >
            <SkipForward size={22} />
          </button>
          <button
            onClick={nextRepeat}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative ${
              repeat !== 'none' ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
            title={`Repeat: ${repeat}`}
          >
            <Repeat size={18} />
            {repeat === 'one' && (
              <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center">
                1
              </span>
            )}
          </button>
        </div>

        {/* Lyrics / Queue toggle bar */}
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 mb-3 mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQueue(false)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                !showQueue
                  ? 'bg-secondary-container text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Synced Lyrics
            </button>
            <button
              onClick={() => setShowQueue(true)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                showQueue
                  ? 'bg-secondary-container text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <List size={14} /> Queue ({queue.length})
            </button>
          </div>

          {!showQueue && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              {/* Lyrics Font Size */}
              <div className="flex items-center bg-surface-container-high rounded-lg p-0.5">
                {(['small', 'medium', 'large'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setLyricsFontSize(sz)}
                    className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md transition-colors ${
                      lyricsFontSize === sz
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {sz[0]}
                  </button>
                ))}
              </div>

              {/* Lyrics Offset Adjuster */}
              <div className="flex items-center gap-1 bg-surface-container-high rounded-lg px-2 py-0.5">
                <button
                  onClick={() => setLyricsOffset(lyricsOffset - 250)}
                  className="hover:text-primary px-1 font-bold"
                  title="Shift 250ms earlier"
                >
                  -
                </button>
                <span className="tabular-nums text-[11px] font-mono">
                  {lyricsOffset > 0 ? `+${lyricsOffset}ms` : `${lyricsOffset}ms`}
                </span>
                <button
                  onClick={() => setLyricsOffset(lyricsOffset + 250)}
                  className="hover:text-primary px-1 font-bold"
                  title="Shift 250ms later"
                >
                  +
                </button>
                {lyricsOffset !== 0 && (
                  <button
                    onClick={() => setLyricsOffset(0)}
                    className="hover:text-primary ml-1"
                    title="Reset offset to 0ms"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content area: Lyrics */}
        {!showQueue && (
          <div ref={lyricsRef} className="flex-1 overflow-y-auto lyrics-container pr-2">
            {lyrics.length > 0 ? (
              <div className="space-y-4 py-8">
                {lyrics.map((line, i) => (
                  <div
                    key={i}
                    ref={i === activeIndex ? activeLyricRef : null}
                    onClick={() => seek(line.time)}
                    className={`cursor-pointer transition-all duration-300 rounded-xl px-3 py-1.5 ${
                      i === activeIndex
                        ? `${activeFontSizes[lyricsFontSize]} text-primary scale-[1.03] shadow-sm bg-primary/10 font-bold`
                        : i < activeIndex
                        ? `${fontSizes[lyricsFontSize]} text-on-surface-variant/40`
                        : `${fontSizes[lyricsFontSize]} text-on-surface-variant hover:text-on-surface`
                    }`}
                  >
                    {line.text}
                  </div>
                ))}
                {lyricsSource && (
                  <div className="text-[11px] text-on-surface-variant/60 pt-6 text-center italic">
                    Lyrics provided via {lyricsSource}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 h-full flex flex-col items-center justify-center text-on-surface-variant gap-2">
                <Music2 size={36} className="text-primary/40" />
                <p className="text-sm">No synced lyrics found for this track</p>
                <p className="text-xs text-on-surface-variant/60">Searching LRCLib & YouTube Music</p>
              </div>
            )}
          </div>
        )}

        {/* Content area: Queue */}
        {showQueue && (
          <div className="flex-1 overflow-y-auto pr-1">
            <QueueList />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function QueueList() {
  const { queue, queueIndex, setQueue, reorderQueue, removeFromQueue, clearQueue } = usePlayerStore();
  const { playTrack } = usePlayer();

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant text-sm py-12 gap-2">
        <List size={32} className="text-primary/40" />
        <p>Your queue is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pb-8">
      <div className="flex items-center justify-between pb-2 px-1">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Playing Next ({queue.length})
        </span>
        <button
          onClick={clearQueue}
          className="text-xs text-error hover:underline flex items-center gap-1"
        >
          <Trash2 size={12} /> Clear Queue
        </button>
      </div>

      {queue.map((track, i) => {
        const isCurrent = i === queueIndex;
        return (
          <div
            key={`${track.id}-${i}`}
            className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              isCurrent
                ? 'bg-primary-container text-on-primary-container font-medium'
                : 'hover:bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {/* Play indicator / Thumbnail */}
            <button
              onClick={() => {
                setQueue(queue, i);
                playTrack(track);
              }}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-high relative">
                {track.thumbnail ? (
                  <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary">♪</div>
                )}
                {isCurrent && (
                  <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate text-on-surface">{track.title}</p>
                <p className="text-xs truncate opacity-70">{track.artist}</p>
              </div>
            </button>

            {/* Reorder & Delete Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                disabled={i === 0}
                onClick={() => reorderQueue(i, i - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-highest text-on-surface-variant disabled:opacity-30"
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                disabled={i === queue.length - 1}
                onClick={() => reorderQueue(i, i + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-highest text-on-surface-variant disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={() => removeFromQueue(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-error/20 hover:text-error text-on-surface-variant"
                title="Remove from queue"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  duration: number;
  source: 'youtube' | 'local' | 'spotify';
  path?: string; // for local files
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[]; // for shuffle undo (fixes #1317)
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  repeat: 'none' | 'one' | 'all';
  shuffle: boolean;
  loading: boolean;
  speed: number;
  normalization: boolean;
  crossfade: number; // 0 to 20 seconds (fixes #504)
  sleepTimer: number | 'track' | null; // minutes remaining, 'track' for end-of-song, or null if off
  history: Track[]; // recently played
  lyricsOffset: number; // in milliseconds (-5000 to +5000, fixes #987)
  lyricsFontSize: 'small' | 'medium' | 'large';

  // Actions
  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  setRepeat: (mode: 'none' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setLoading: (loading: boolean) => void;
  setSpeed: (speed: number) => void;
  setNormalization: (norm: boolean) => void;
  setCrossfade: (seconds: number) => void;
  setSleepTimer: (minutes: number | 'track' | null) => void;
  setLyricsOffset: (offset: number) => void;
  setLyricsFontSize: (size: 'small' | 'medium' | 'large') => void;
  addToHistory: (track: Track) => void;
  nextTrack: () => Track | null;
  prevTrack: () => Track | null;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  queueIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  repeat: 'none',
  shuffle: false,
  loading: false,
  speed: 1.0,
  normalization: false,
  crossfade: 0,
  sleepTimer: null,
  history: [],
  lyricsOffset: 0,
  lyricsFontSize: 'medium',

  setCurrentTrack: (track) => {
    set({ currentTrack: track });
    get().addToHistory(track);
  },
  setQueue: (tracks, startIndex = 0) =>
    set({ queue: [...tracks], originalQueue: [...tracks], queueIndex: startIndex }),
  addToQueue: (track) =>
    set((s) => ({ queue: [...s.queue, track], originalQueue: [...s.originalQueue, track] })),
  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index);
      const newIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      return { queue: newQueue, queueIndex: Math.max(0, newIndex) };
    }),
  reorderQueue: (fromIndex, toIndex) =>
    set((s) => {
      const newQueue = [...s.queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      return { queue: newQueue };
    }),
  clearQueue: () => set({ queue: [], originalQueue: [], queueIndex: 0 }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setRepeat: (repeat) => set({ repeat }),
  toggleShuffle: () =>
    set((s) => {
      if (!s.shuffle) {
        // Turning shuffle ON: keep current track at index 0, shuffle the rest
        const current = s.queue[s.queueIndex];
        const others = s.queue.filter((_, i) => i !== s.queueIndex);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        return {
          shuffle: true,
          queue: current ? [current, ...others] : others,
          queueIndex: 0,
        };
      } else {
        // Turning shuffle OFF (Shuffle Undo): restore original order!
        const current = s.queue[s.queueIndex];
        const originalIdx = current ? s.originalQueue.findIndex((t) => t.id === current.id) : 0;
        return {
          shuffle: false,
          queue: [...s.originalQueue],
          queueIndex: Math.max(0, originalIdx),
        };
      }
    }),
  setLoading: (loading) => set({ loading }),
  setSpeed: (speed) => set({ speed }),
  setNormalization: (normalization) => set({ normalization }),
  setCrossfade: (crossfade) => set({ crossfade }),
  setSleepTimer: (sleepTimer) => set({ sleepTimer }),
  setLyricsOffset: (lyricsOffset) => set({ lyricsOffset }),
  setLyricsFontSize: (lyricsFontSize) => set({ lyricsFontSize }),
  addToHistory: (track) =>
    set((s) => {
      const filtered = s.history.filter((t) => t.id !== track.id);
      return { history: [track, ...filtered].slice(0, 30) };
    }),

  nextTrack: () => {
    const { queue, queueIndex, repeat, shuffle } = get();
    if (queue.length === 0) return null;
    if (repeat === 'one') return queue[queueIndex];
    let next: number;
    if (shuffle) {
      next = Math.floor(Math.random() * queue.length);
    } else {
      next = queueIndex + 1;
    }
    if (next >= queue.length) {
      if (repeat === 'all') next = 0;
      else return null;
    }
    set({ queueIndex: next });
    return queue[next];
  },

  prevTrack: () => {
    const { queue, queueIndex, position } = get();
    if (queue.length === 0) return null;
    // If more than 3s in, restart current track
    if (position > 3) return queue[queueIndex];
    const prev = Math.max(0, queueIndex - 1);
    set({ queueIndex: prev });
    return queue[prev];
  },
}));

interface UIState {
  page: string;
  showNowPlaying: boolean;
  showLyrics: boolean;
  theme: 'dark' | 'light' | 'amoled';
  seedColor: string;

  setPage: (page: string) => void;
  setShowNowPlaying: (show: boolean) => void;
  setShowLyrics: (show: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'amoled') => void;
  setSeedColor: (color: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  page: 'home',
  showNowPlaying: false,
  showLyrics: false,
  theme: 'dark',
  seedColor: '#cbb9f5',

  setPage: (page) => set({ page }),
  setShowNowPlaying: (showNowPlaying) => set({ showNowPlaying }),
  setShowLyrics: (showLyrics) => set({ showLyrics }),
  setTheme: (theme) => {
    set({ theme });
    if (theme === 'amoled') {
      document.documentElement.style.setProperty('--md-surface', '#000000');
      document.documentElement.style.setProperty('--md-surface-container', '#0a0a0c');
      document.documentElement.style.setProperty('--md-surface-container-high', '#141418');
      document.documentElement.style.setProperty('--md-surface-container-highest', '#1e1e24');
    } else if (theme === 'light') {
      document.documentElement.style.setProperty('--md-surface', '#fdf7ff');
      document.documentElement.style.setProperty('--md-surface-container', '#f3ecf6');
      document.documentElement.style.setProperty('--md-surface-container-high', '#eee6f0');
      document.documentElement.style.setProperty('--md-surface-container-highest', '#e8e0ea');
      document.documentElement.style.setProperty('--md-on-surface', '#1d1a20');
      document.documentElement.style.setProperty('--md-on-surface-variant', '#49454e');
    } else {
      document.documentElement.style.setProperty('--md-surface', '#141218');
      document.documentElement.style.setProperty('--md-surface-container', '#1e1b22');
      document.documentElement.style.setProperty('--md-surface-container-high', '#2b2831');
      document.documentElement.style.setProperty('--md-surface-container-highest', '#36343b');
      document.documentElement.style.setProperty('--md-on-surface', '#e6e1e5');
      document.documentElement.style.setProperty('--md-on-surface-variant', '#cac4d0');
    }
  },
  setSeedColor: (seedColor) => {
    set({ seedColor });
    document.documentElement.style.setProperty('--md-primary', seedColor);
  },
}));

interface LibraryState {
  tracks: Track[];
  directories: string[];
  isScanning: boolean;

  setTracks: (tracks: Track[]) => void;
  addDirectory: (dir: string) => void;
  setIsScanning: (scanning: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  directories: [],
  isScanning: false,

  setTracks: (tracks) => set({ tracks }),
  addDirectory: (dir) => set((s) => ({ directories: [...new Set([...s.directories, dir])] })),
  setIsScanning: (isScanning) => set({ isScanning }),
}));

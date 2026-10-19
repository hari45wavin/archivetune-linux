import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  duration: number;
  source: 'youtube' | 'local';
  path?: string; // for local files
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  repeat: 'none' | 'one' | 'all';
  shuffle: boolean;
  loading: boolean;

  // Actions
  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (vol: number) => void;
  setRepeat: (mode: 'none' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setLoading: (loading: boolean) => void;
  nextTrack: () => Track | null;
  prevTrack: () => Track | null;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  repeat: 'none',
  shuffle: false,
  loading: false,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setQueue: (tracks, startIndex = 0) => set({ queue: tracks, queueIndex: startIndex }),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) => set((s) => {
    const newQueue = s.queue.filter((_, i) => i !== index);
    const newIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
    return { queue: newQueue, queueIndex: Math.max(0, newIndex) };
  }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setRepeat: (repeat) => set({ repeat }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setLoading: (loading) => set({ loading }),

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
  setTheme: (theme) => set({ theme }),
  setSeedColor: (seedColor) => set({ seedColor }),
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

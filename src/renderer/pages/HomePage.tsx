import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Globe2, Music, Sparkles, Coffee, Radio, Play, RefreshCw, History, Heart, Disc3 } from 'lucide-react';
import TrackRow from '../components/TrackRow';
import { Track } from '../store';
import { usePlayer } from '../lib/usePlayer';
import { usePlayerStore } from '../store';

const CATEGORIES = [
  { id: 'trending', label: 'Trending Now', icon: Flame },
  { id: 'mixes', label: 'Top Mixes', icon: Radio },
  { id: 'hindi', label: 'Bollywood & Chill', icon: Music },
  { id: 'global_top', label: 'Global Top 50', icon: Globe2 },
  { id: 'pop', label: 'Pop Hits', icon: Sparkles },
  { id: 'lofi', label: 'Chill Lo-Fi', icon: Coffee },
  { id: 'romantic', label: 'Love & Romance', icon: Heart },
  { id: 'hiphop', label: 'Hip-Hop / Rap', icon: Disc3 },
];

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { playTrack } = usePlayer();
  const { setQueue, history } = usePlayerStore();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const { data: tracks = [], isLoading, isFetching } = useQuery<Track[]>({
    queryKey: ['liveCategory', selectedCategory],
    queryFn: async () => {
      const res = await window.electronAPI?.ytmusic.getCategory(selectedCategory, false);
      return (res || []).map((t: any) => ({
        ...t,
        source: 'youtube' as const,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await window.electronAPI?.ytmusic.getCategory(selectedCategory, true);
      const freshTracks = (res || []).map((t: any) => ({
        ...t,
        source: 'youtube' as const,
      }));
      queryClient.setQueryData(['liveCategory', selectedCategory], freshTracks);
    } catch (err) {
      console.error('Refresh error', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const quickPicks = tracks.slice(0, 6);
  const featured = tracks.slice(0, 5);

  const handlePlayTrack = (track: Track, index: number) => {
    setQueue(tracks, index);
    playTrack(track);
  };

  return (
    <div className="p-6 space-y-8 pb-24">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tight mb-1">
            {greeting} 🌸
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Live dynamic charts & curated playlists from YouTube Music
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isFetching}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-all active:scale-95 disabled:opacity-50 border border-outline-variant/20 shadow-sm"
        >
          <RefreshCw size={14} className={isRefreshing || isFetching ? 'animate-spin text-primary' : ''} />
          <span>{isRefreshing ? 'Fetching...' : 'Refresh Live'}</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = selectedCategory === id;
          return (
            <button
              key={id}
              onClick={() => setSelectedCategory(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-105'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Quick Picks 2-Column Grid (Spotify Style) */}
      {quickPicks.length > 0 && !isLoading && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickPicks.map((track, i) => (
              <div
                key={`quick-${track.id}-${i}`}
                onClick={() => handlePlayTrack(track, i)}
                className="group flex items-center gap-3 p-2 rounded-xl bg-surface-container/70 hover:bg-surface-container-high/90 transition-all duration-200 cursor-pointer shadow-sm overflow-hidden"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-container-highest shrink-0 shadow">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">🎵</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface truncate">{track.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{track.artist}</p>
                </div>
                <div className="mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
                    <Play size={14} fill="currentColor" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Played */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-primary" />
            <h2 className="text-lg font-bold text-on-surface tracking-tight">Recently Played</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {history.map((track, i) => (
              <div
                key={`hist-${track.id}-${i}`}
                onClick={() => {
                  setQueue(history, i);
                  playTrack(track);
                }}
                className="group w-36 shrink-0 p-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all duration-200 cursor-pointer flex flex-col gap-2 shadow-sm"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-highest">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg">
                      <Play size={16} fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface truncate">{track.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Top Picks Carousel/Grid */}
      {featured.length > 0 && !isLoading && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-on-surface tracking-tight">Curated Highlights</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {featured.map((track, i) => (
              <div
                key={`feat-${track.id}-${i}`}
                onClick={() => handlePlayTrack(track, i)}
                className="group relative p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all duration-200 cursor-pointer flex flex-col gap-2.5 shadow-sm hover:shadow-lg"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-highest">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Play size={20} fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{track.title}</p>
                  <p className="text-xs text-on-surface-variant truncate mt-0.5">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Songs List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface tracking-tight">
            {CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Songs'} ({tracks.length})
          </h2>
          {tracks.length > 0 && (
            <button
              onClick={() => handlePlayTrack(tracks[0], 0)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Play size={12} fill="currentColor" /> Play All
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-container rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-surface-container-high shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-surface-container-high rounded w-2/5" />
                  <div className="h-3 bg-surface-container-high rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length > 0 ? (
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <TrackRow key={`${track.id}-${i}`} track={track} index={i} showIndex queue={tracks} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-3">
            <Radio size={40} className="text-primary/50" />
            <p className="text-sm">Fetching live songs from YouTube Music...</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

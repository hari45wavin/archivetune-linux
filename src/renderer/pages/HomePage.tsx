import React from 'react';
import { useQuery } from '@tanstack/react-query';
import TrackRow from '../components/TrackRow';
import { Track } from '../store';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2">
      <div className="skeleton aspect-square rounded-xl w-full" />
      <div className="skeleton h-3 rounded w-3/4" />
      <div className="skeleton h-3 rounded w-1/2" />
    </div>
  );
}

function TrackCard({ track }: { track: Track }) {
  const { playTrack } = { playTrack: (t: Track) => window.electronAPI?.player.play('', t) };
  return (
    <div className="group flex flex-col gap-2 cursor-pointer" onDoubleClick={() => {}}>
      <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-high">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🎵</div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <span className="text-on-primary text-xl">▶</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-on-surface truncate">{track.title}</p>
        <p className="text-xs text-on-surface-variant truncate">{track.artist}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: () => window.electronAPI?.ytmusic.getHome() ?? Promise.resolve({ trending: [] }),
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-on-surface mb-1">Good evening 🌸</h1>
        <p className="text-sm text-on-surface-variant">Your music, your way.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-on-surface mb-4">Trending Now</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="space-y-1">
            {(data?.trending ?? []).map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} queue={data?.trending} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

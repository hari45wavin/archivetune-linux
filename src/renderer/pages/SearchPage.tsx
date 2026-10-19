import React, { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import TrackRow from '../components/TrackRow';
import { Track } from '../store';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: results = [], isLoading, isFetching } = useQuery<Track[]>({
    queryKey: ['search', submitted],
    queryFn: () =>
      submitted
        ? window.electronAPI?.ytmusic.search(submitted) ?? Promise.resolve([])
        : Promise.resolve([]),
    enabled: submitted.length > 0,
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(query.trim());
  }, [query]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-on-surface">Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Songs, artists, albums…"
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface-container text-on-surface placeholder-on-surface-variant outline-none focus:ring-2 focus:ring-primary transition-shadow text-sm"
          autoFocus
        />
      </form>

      {/* Results */}
      {isLoading || isFetching ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 rounded w-2/3" />
                <div className="skeleton h-3 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-on-surface-variant mb-3">{results.length} results for "{submitted}"</p>
          {results.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} queue={results} />
          ))}
        </div>
      ) : submitted ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="text-5xl mb-4">🔍</span>
          <p className="text-base">No results for "{submitted}"</p>
          <p className="text-sm mt-1">Try different keywords</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="text-5xl mb-4">🎵</span>
          <p className="text-base">Search YouTube Music</p>
          <p className="text-sm mt-1">Find songs, artists, and albums</p>
        </div>
      )}
    </div>
  );
}

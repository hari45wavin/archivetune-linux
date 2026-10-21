import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, ListMusic, LogIn, LogOut, Key, CheckCircle2, AlertCircle, Play, ChevronLeft } from 'lucide-react';
import TrackRow from '../components/TrackRow';
import { Track } from '../store';
import { usePlayer } from '../lib/usePlayer';
import { usePlayerStore } from '../store';

export default function SpotifyPage() {
  const queryClient = useQueryClient();
  const { playTrack } = usePlayer();
  const { setQueue } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<'liked' | 'playlists'>('liked');
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string } | null>(null);
  const [showManualCookie, setShowManualCookie] = useState(false);
  const [spDcInput, setSpDcInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status query
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['spotifyStatus'],
    queryFn: () => window.electronAPI?.spotify.getStatus() ?? Promise.resolve({ connected: false }),
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const res = await window.electronAPI?.spotify.login();
      if (!res.ok) throw new Error(res.error || 'Login canceled or failed');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotifyStatus'] });
      queryClient.invalidateQueries({ queryKey: ['spotifyLiked'] });
      queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Login failed');
    },
  });

  // Manual connect mutation
  const manualMutation = useMutation({
    mutationFn: async (cookie: string) => {
      setErrorMessage(null);
      const res = await window.electronAPI?.spotify.connectManual(cookie);
      if (!res.ok) throw new Error(res.error || 'Invalid sp_dc cookie');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotifyStatus'] });
      queryClient.invalidateQueries({ queryKey: ['spotifyLiked'] });
      queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
      setShowManualCookie(false);
      setSpDcInput('');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Connection failed');
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => window.electronAPI?.spotify.disconnect() ?? Promise.resolve({ ok: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotifyStatus'] });
      setSelectedPlaylist(null);
    },
  });

  // Liked songs query
  const { data: likedSongs = [], isLoading: likedLoading } = useQuery<Track[]>({
    queryKey: ['spotifyLiked'],
    queryFn: () => window.electronAPI?.spotify.getLikedSongs(50) ?? Promise.resolve([]),
    enabled: !!status?.connected,
  });

  // Playlists query
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['spotifyPlaylists'],
    queryFn: () => window.electronAPI?.spotify.getPlaylists(50) ?? Promise.resolve([]),
    enabled: !!status?.connected,
  });

  // Selected playlist tracks query
  const { data: playlistTracks = [], isLoading: playlistTracksLoading } = useQuery<Track[]>({
    queryKey: ['spotifyPlaylistTracks', selectedPlaylist?.id],
    queryFn: () =>
      selectedPlaylist
        ? window.electronAPI?.spotify.getPlaylistTracks(selectedPlaylist.id) ?? Promise.resolve([])
        : Promise.resolve([]),
    enabled: !!selectedPlaylist,
  });

  const handlePlayAll = (trackList: Track[], startIndex = 0) => {
    if (trackList.length > 0) {
      setQueue(trackList, startIndex);
      playTrack(trackList[startIndex]);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full text-on-surface-variant">
        Loading Spotify status...
      </div>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center mx-auto text-3xl">
            <ListMusic size={32} />
          </div>
          <h1 className="text-3xl font-bold text-on-surface">Connect to Spotify</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Link your Spotify account to import your Liked Songs and Playlists directly into ArchiveTune.
            Songs are resolved and played via high-quality audio streams without requiring Spotify Premium.
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-error/20 border border-error/30 text-error rounded-xl text-xs">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-surface-container rounded-2xl p-6 space-y-4 border border-outline-variant/30">
          <button
            onClick={() => loginMutation.mutate()}
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm transition-all shadow-md disabled:opacity-50"
          >
            <LogIn size={18} />
            {loginMutation.isPending ? 'Logging in... Check Spotify login window' : 'Connect with Spotify (Web Login)'}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-outline-variant/30" />
            <span className="flex-shrink mx-4 text-xs text-on-surface-variant">or</span>
            <div className="flex-grow border-t border-outline-variant/30" />
          </div>

          {!showManualCookie ? (
            <button
              onClick={() => setShowManualCookie(true)}
              className="w-full py-2.5 text-xs font-medium text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-2 transition-colors"
            >
              <Key size={14} /> Enter `sp_dc` Session Cookie or Access Token Manually
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (spDcInput.trim()) manualMutation.mutate(spDcInput.trim());
              }}
              className="space-y-3 pt-1"
            >
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">
                  Spotify `sp_dc` Cookie or Bearer Access Token:
                </label>
                <input
                  type="password"
                  value={spDcInput}
                  onChange={(e) => setSpDcInput(e.target.value)}
                  placeholder="AQB... (sp_dc cookie) or BQ... (access token)"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-surface-container-high text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-on-surface-variant/70 mt-1.5">
                  You can paste your <code className="text-primary font-mono">sp_dc</code> cookie from browser Developer Tools (Application &rarr; Cookies &rarr; https://open.spotify.com) or a direct Bearer access token.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={manualMutation.isPending || !spDcInput.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {manualMutation.isPending ? 'Connecting...' : 'Connect'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualCookie(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-on-surface-variant pt-2">
          <div className="p-3 bg-surface-container/60 rounded-xl flex items-start gap-2">
            <CheckCircle2 size={16} className="text-[#1DB954] shrink-0 mt-0.5" />
            <span>Automatic Song Matching with YouTube Music</span>
          </div>
          <div className="p-3 bg-surface-container/60 rounded-xl flex items-start gap-2">
            <CheckCircle2 size={16} className="text-[#1DB954] shrink-0 mt-0.5" />
            <span>Synced Waterfall Lyrics via LRCLib</span>
          </div>
        </div>
      </div>
    );
  }

  // Connected state: User Profile Header + Tabs
  return (
    <div className="p-6 space-y-6 pb-20">
      {/* Profile Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container border border-outline-variant/30">
        <div className="flex items-center gap-3">
          {status.user?.avatarUrl ? (
            <img src={status.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-[#1DB954]" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center font-bold">
              {status.user?.displayName?.[0] || 'S'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface">{status.user?.displayName || 'Spotify User'}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1DB954]/20 text-[#1DB954] uppercase tracking-wider">
                Connected
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">Spotify Library Synced</p>
          </div>
        </div>

        <button
          onClick={() => disconnectMutation.mutate()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-error/20 hover:text-error text-xs font-medium text-on-surface-variant transition-colors"
        >
          <LogOut size={14} /> Disconnect
        </button>
      </div>

      {/* Detail view for selected playlist */}
      {selectedPlaylist ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-on-surface">{selectedPlaylist.name}</h2>
              <p className="text-xs text-on-surface-variant">{playlistTracks.length} tracks</p>
            </div>
            {playlistTracks.length > 0 && (
              <button
                onClick={() => handlePlayAll(playlistTracks, 0)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 shadow"
              >
                <Play size={14} fill="currentColor" /> Play Playlist
              </button>
            )}
          </div>

          {playlistTracksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-surface-container rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {playlistTracks.map((track, i) => (
                <TrackRow key={`${track.id}-${i}`} track={track} index={i} showIndex queue={playlistTracks} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Tabs: Liked Songs vs Playlists */
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'liked'
                  ? 'bg-secondary-container text-on-surface shadow'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Heart size={14} className={activeTab === 'liked' ? 'fill-current text-primary' : ''} />
              Liked Songs ({likedSongs.length})
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'playlists'
                  ? 'bg-secondary-container text-on-surface shadow'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <ListMusic size={14} />
              Playlists ({playlists.length})
            </button>
          </div>

          {/* Liked Songs Tab */}
          {activeTab === 'liked' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-on-surface-variant">Your Spotify Liked Songs</p>
                {likedSongs.length > 0 && (
                  <button
                    onClick={() => handlePlayAll(likedSongs, 0)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Play size={12} fill="currentColor" /> Play All Liked
                  </button>
                )}
              </div>

              {likedLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 bg-surface-container rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : likedSongs.length > 0 ? (
                <div className="space-y-1">
                  {likedSongs.map((track, i) => (
                    <TrackRow key={`${track.id}-${i}`} track={track} index={i} showIndex queue={likedSongs} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-on-surface-variant text-sm">
                  No liked songs found on your Spotify account.
                </div>
              )}
            </div>
          )}

          {/* Playlists Tab */}
          {activeTab === 'playlists' && (
            <div>
              {playlistsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-surface-container rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : playlists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {playlists.map((pl: any) => (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPlaylist({ id: pl.id, name: pl.name })}
                      className="group p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer flex flex-col gap-2.5 shadow-sm hover:shadow-lg"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-highest">
                        {pl.thumbnail ? (
                          <img src={pl.thumbnail} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">📁</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{pl.name}</p>
                        <p className="text-xs text-on-surface-variant truncate">{pl.trackCount} tracks</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-on-surface-variant text-sm">
                  No playlists found.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

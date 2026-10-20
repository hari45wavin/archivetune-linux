import React, { useState } from 'react';
import { Palette, Radio, Disc3, Shield, Info, ExternalLink, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store';

const SEED_COLORS = [
  { name: 'Lavender', hex: '#cbb9f5' },
  { name: 'Sakura Pink', hex: '#f0b8c6' },
  { name: 'Ocean Cyan', hex: '#a6e3e9' },
  { name: 'Mint Green', hex: '#a8e6cf' },
  { name: 'Amber Gold', hex: '#ffd3b6' },
  { name: 'Ruby Red', hex: '#ffaaa5' },
  { name: 'Violet Dark', hex: '#a29bfe' },
  { name: 'Sky Blue', hex: '#74b9ff' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme, seedColor, setSeedColor } = useUIStore();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [scrobbleStatus, setScrobbleStatus] = useState<string | null>(null);

  const handleSaveScrobble = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.electronAPI?.scrobble.configure(apiKey, apiSecret, sessionKey);
      if (res?.ok) {
        setScrobbleStatus('Last.fm credentials configured successfully!');
      } else {
        setScrobbleStatus('Failed to configure Last.fm.');
      }
    } catch {
      setScrobbleStatus('Error configuring Last.fm credentials.');
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-on-surface mb-1">Settings</h1>
        <p className="text-sm text-on-surface-variant">Customize your ArchiveTune experience on Linux.</p>
      </div>

      {/* Theme & Material You */}
      <section className="bg-surface-container rounded-2xl p-5 space-y-5 border border-outline-variant/30">
        <div className="flex items-center gap-3">
          <Palette className="text-primary" size={22} />
          <div>
            <h2 className="text-base font-semibold text-on-surface">Material You Dynamic Theming</h2>
            <p className="text-xs text-on-surface-variant">Choose your accent palette and appearance mode</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-on-surface-variant mb-2 block">Theme Mode</label>
          <div className="flex gap-2">
            {(['dark', 'amoled', 'light'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                  theme === mode
                    ? 'bg-primary text-on-primary shadow'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-on-surface-variant mb-2 block">Seed Accent Color</label>
          <div className="flex flex-wrap gap-3">
            {SEED_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setSeedColor(c.hex)}
                className={`w-9 h-9 rounded-full transition-transform flex items-center justify-center ${
                  seedColor === c.hex ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Audio Engine */}
      <section className="bg-surface-container rounded-2xl p-5 space-y-4 border border-outline-variant/30">
        <div className="flex items-center gap-3">
          <Disc3 className="text-primary" size={22} />
          <div>
            <h2 className="text-base font-semibold text-on-surface">Audio Engine</h2>
            <p className="text-xs text-on-surface-variant">Configured for high-fidelity native Linux playback</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-surface-container-high flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant">Backend Engine</span>
            <span className="font-medium text-on-surface">mpv (JSON IPC Socket)</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-high flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant">Stream Resolver</span>
            <span className="font-medium text-on-surface">yt-dlp (Opus / WebM 160kbps+)</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-high flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant">Gapless Playback</span>
            <span className="font-medium text-on-surface">Enabled (--gapless-audio=yes)</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-high flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant">Lyrics Engine</span>
            <span className="font-medium text-on-surface">LRCLib API (Waterfall Synced)</span>
          </div>
        </div>
      </section>

      {/* Spotify Integration */}
      <section className="bg-surface-container rounded-2xl p-5 space-y-4 border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListMusic className="text-[#1DB954]" size={22} />
            <div>
              <h2 className="text-base font-semibold text-on-surface">Spotify Integration</h2>
              <p className="text-xs text-on-surface-variant">Sync your Spotify Liked Songs & Playlists into ArchiveTune</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/spotify')}
            className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs transition-colors shadow"
          >
            Open Spotify Connect
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Matches ArchiveTune's SpotifyCore resolver — streams Spotify music via high-fidelity YouTube Music audio streams with synced lyrics.
        </p>
      </section>

      {/* Last.fm Scrobbler */}
      <section className="bg-surface-container rounded-2xl p-5 space-y-4 border border-outline-variant/30">
        <div className="flex items-center gap-3">
          <Radio className="text-primary" size={22} />
          <div>
            <h2 className="text-base font-semibold text-on-surface">Last.fm Scrobbler</h2>
            <p className="text-xs text-on-surface-variant">Scrobble played tracks and send live Now Playing status</p>
          </div>
        </div>

        <form onSubmit={handleSaveScrobble} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Last.fm API Key"
                className="w-full px-3 py-2 text-sm rounded-xl bg-surface-container-high text-on-surface border border-outline-variant/20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Shared Secret"
                className="w-full px-3 py-2 text-sm rounded-xl bg-surface-container-high text-on-surface border border-outline-variant/20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">Session Key</label>
              <input
                type="password"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                placeholder="Session Key"
                className="w-full px-3 py-2 text-sm rounded-xl bg-surface-container-high text-on-surface border border-outline-variant/20 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Save Credentials
          </button>
          {scrobbleStatus && (
            <p className="text-xs text-primary mt-2">{scrobbleStatus}</p>
          )}
        </form>
      </section>

      {/* About */}
      <section className="bg-surface-container rounded-2xl p-5 space-y-3 border border-outline-variant/30">
        <div className="flex items-center gap-3">
          <Info className="text-primary" size={22} />
          <div>
            <h2 className="text-base font-semibold text-on-surface">About ArchiveTune for Linux</h2>
            <p className="text-xs text-on-surface-variant">Version 1.0.0 Desktop Port</p>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          ArchiveTune for Linux is an open-source native desktop audio client replicating the features of ArchiveTune
          (Material You theming, synced lyrics, local library, YouTube Music streaming via yt-dlp & mpv, Last.fm scrobbling).
        </p>

        <div className="flex gap-4 pt-2">
          <button
            onClick={() => window.electronAPI?.openExternal('https://github.com/rukamori/ArchiveTune')}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Upstream ArchiveTune <ExternalLink size={12} />
          </button>
          <button
            onClick={() => window.electronAPI?.openExternal('https://github.com/hari45wavin/archivetune-linux')}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Linux Client Repository <ExternalLink size={12} />
          </button>
        </div>
      </section>
    </div>
  );
}

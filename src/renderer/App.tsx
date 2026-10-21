import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import MiniPlayer from './components/MiniPlayer';
import NowPlayingOverlay from './components/NowPlayingOverlay';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import SpotifyPage from './pages/SpotifyPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import { useUIStore } from './store';
import { usePlayer, usePlayerEvents } from './lib/usePlayer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function AppContent() {
  usePlayerEvents();
  const { showNowPlaying } = useUIStore();
  const { currentTrack } = usePlayer();

  return (
    <div className="flex flex-col h-full bg-surface text-on-surface overflow-hidden select-none">
      {/* Custom Titlebar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/spotify" element={<SpotifyPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Mini Player (bottom bar) */}
      {currentTrack && <MiniPlayer />}

      {/* Full Now Playing Overlay */}
      {showNowPlaying && <NowPlayingOverlay />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </QueryClientProvider>
  );
}

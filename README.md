# 🌸 ArchiveTune for Linux

> **The Cutest Music Player With Support for Local Files & YouTube Music — Now on Linux & Desktop!**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-blue.svg)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)

---

## 🌟 Overview

ArchiveTune is widely loved on Android for its beautiful **Material You / Material 3** design, synced lyrics, and seamless combination of local music library with YouTube Music streaming.

This repository resolves upstream ArchiveTune issues:
* **[#584: Linux version (flatpak/appimage)](https://github.com/rukamori/ArchiveTune/issues/584)**
* **[#900: Desktop/Web App - Archive Tune](https://github.com/rukamori/ArchiveTune/issues/900)**
* **[#1360: PC version of the app](https://github.com/rukamori/ArchiveTune/issues/1360)**

It provides a full native desktop application built with **Electron + React + TypeScript + Tailwind CSS**, powered by **`mpv`** and **`yt-dlp`** on Linux.

---

## ✨ Features

| Feature | Description |
|---|---|
| **🎨 Material You Dynamic Theming** | Full M3 dark, light, and AMOLED pure black themes with customizable seed accent color palettes. |
| **🎵 YouTube Music Streaming** | Instant search, trending music, top charts, and streaming powered by `yt-dlp` with gapless audio. |
| **💚 Spotify Connect Integration** | Import & play Spotify Liked Songs and Playlists resolved via high-fidelity streams. |
| **📁 Local Music Library** | Fast local directory scanning for MP3, FLAC, WAV, OGG, M4A, OPUS with ID3/tag parsing. |
| **🎤 Synced Waterfall Lyrics** | Synchronized line-by-line LRC lyrics with auto-scrolling, click-to-seek, lyrics sync offset slider (-5s to +5s), and font size toggles. |
| **⏰ Sleep Timer** | Configurable sleep timer (15m, 30m, 45m, 60m, or end-of-track) with live badge display. |
| **⚡ Playback Speed & Normalization** | 0.5x to 2.0x playback speed and Dynamic Audio Normalization (`dynaudnorm`) for consistent loudness. |
| **🎚️ Audio Crossfade** | 0 to 20-second seamless track transitions. |
| **💾 Offline Downloader** | One-click audio track extraction to `~/Music/` in 320kbps MP3 / Opus with embedded metadata. |
| **📻 Last.fm Scrobbler** | Audioscrobbler 2.0 integration with live Now Playing updates and scrobbling thresholds. |
| **🎛️ mpv Audio Engine** | Low-latency JSON IPC socket audio engine with gapless playback, volume scaling, and seek controls. |
| **📋 Queue & Playback Modes** | Full queue reordering (move up/down), item removal, shuffle with undo, and persistent mini-player. |

---

## 🚀 Quick Start (Linux)

### 1. Prerequisites

Ensure you have `mpv` and `yt-dlp` installed on your system:

#### Arch Linux / EndeavourOS / Omarchy:
```bash
sudo pacman -S mpv yt-dlp nodejs npm
```

#### Ubuntu / Debian:
```bash
sudo apt update && sudo apt install -y mpv yt-dlp nodejs npm
```

#### Fedora:
```bash
sudo dnf install -y mpv yt-dlp nodejs npm
```

---

### 2. Installation & Run

```bash
# Clone the repository
git clone https://github.com/hari45wavin/archivetune-linux.git
cd archivetune-linux

# Install dependencies
npm install

# Run in development mode
npm run dev
```

---

### 3. Build & Package (AppImage / .deb / .rpm)

```bash
# Typecheck & build distribution bundles
npm run dist:linux
```
The output package (`ArchiveTune-1.0.0.AppImage` / `.deb`) will be located in the `release/` directory.

---

## 🛠️ Architecture

```
archivetune-linux/
├── src/
│   ├── main/                  # Electron Main Process (Node.js)
│   │   ├── index.ts           # Window lifecycle, IPC registration
│   │   ├── player.ts          # mpv IPC socket engine (--idle, gapless)
│   │   ├── ytmusic.ts         # yt-dlp YouTube Music resolver & search
│   │   ├── library.ts         # Local music directory recursive scanner
│   │   ├── lyrics.ts          # LRCLib synced lyrics fetcher & LRC parser
│   │   ├── scrobble.ts        # Last.fm API 2.0 MD5 auth & scrobble
│   │   └── preload.ts         # Secure contextBridge API for renderer
│   │
│   └── renderer/              # Electron Renderer Process (React + Vite)
│       ├── components/        # TitleBar, Sidebar, MiniPlayer, NowPlayingOverlay, TrackRow
│       ├── pages/             # HomePage, SearchPage, LibraryPage, SettingsPage
│       ├── store/             # Zustand player, UI, and library stores
│       ├── lib/               # usePlayer React hook
│       └── styles/            # globals.css with Material You CSS variables
│
├── assets/                    # App icons & branding resources
├── package.json               # Scripts & dependencies
├── vite.config.ts             # Vite bundler configuration
└── tsconfig.json              # TypeScript configuration
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 💖 Acknowledgments

* [rukamori/ArchiveTune](https://github.com/rukamori/ArchiveTune) for the original Android design and inspiration.
* [mpv](https://mpv.io/) and [yt-dlp](https://github.com/yt-dlp/yt-dlp) for robust audio playback and media resolution.

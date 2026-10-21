import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose a safe API to the renderer via contextBridge.
 * All IPC calls are wrapped here so renderer never needs nodeIntegration.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Player
  player: {
    play: (url: string, meta: object) => ipcRenderer.invoke('player:play', url, meta),
    pause: () => ipcRenderer.invoke('player:pause'),
    resume: () => ipcRenderer.invoke('player:resume'),
    stop: () => ipcRenderer.invoke('player:stop'),
    seek: (seconds: number) => ipcRenderer.invoke('player:seek', seconds),
    setVolume: (vol: number) => ipcRenderer.invoke('player:setVolume', vol),
    setSpeed: (speed: number) => ipcRenderer.invoke('player:setSpeed', speed),
    setNormalization: (enabled: boolean) => ipcRenderer.invoke('player:setNormalization', enabled),
    downloadTrack: (track: object) => ipcRenderer.invoke('player:downloadTrack', track),
    getStatus: () => ipcRenderer.invoke('player:getStatus'),
    onProgress: (cb: (info: object) => void) => {
      const handler = (_e: any, info: any) => cb(info);
      ipcRenderer.on('player:progress', handler);
      return () => ipcRenderer.removeListener('player:progress', handler);
    },
    onEnded: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('player:ended', handler);
      return () => ipcRenderer.removeListener('player:ended', handler);
    },
  },

  // YouTube Music Live
  ytmusic: {
    search: (query: string) => ipcRenderer.invoke('ytmusic:search', query),
    getStreamUrl: (videoId: string) => ipcRenderer.invoke('ytmusic:getStreamUrl', videoId),
    getHome: () => ipcRenderer.invoke('ytmusic:getHome'),
    getCategory: (category: string, forceRefresh = false) =>
      ipcRenderer.invoke('ytmusic:getCategory', category, forceRefresh),
    getArtist: (artistId: string) => ipcRenderer.invoke('ytmusic:getArtist', artistId),
    getAlbum: (albumId: string) => ipcRenderer.invoke('ytmusic:getAlbum', albumId),
    getPlaylist: (playlistId: string) => ipcRenderer.invoke('ytmusic:getPlaylist', playlistId),
    getSuggested: (videoId: string) => ipcRenderer.invoke('ytmusic:getSuggested', videoId),
  },

  // Spotify Integration (matching ArchiveTune SpotifyCore)
  spotify: {
    getStatus: () => ipcRenderer.invoke('spotify:getStatus'),
    login: () => ipcRenderer.invoke('spotify:login'),
    connectManual: (spDc: string) => ipcRenderer.invoke('spotify:connectManual', spDc),
    disconnect: () => ipcRenderer.invoke('spotify:disconnect'),
    getLikedSongs: (limit?: number, offset?: number) => ipcRenderer.invoke('spotify:getLikedSongs', limit, offset),
    getPlaylists: (limit?: number) => ipcRenderer.invoke('spotify:getPlaylists', limit),
    getPlaylistTracks: (playlistId: string) => ipcRenderer.invoke('spotify:getPlaylistTracks', playlistId),
    resolveTrack: (track: { title: string; artist: string }) => ipcRenderer.invoke('spotify:resolveTrack', track),
  },

  // Local Library
  library: {
    scan: (dirPath: string) => ipcRenderer.invoke('library:scan', dirPath),
    addDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    addFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    getMetadata: (filePath: string) => ipcRenderer.invoke('library:getMetadata', filePath),
  },

  // Lyrics
  lyrics: {
    get: (title: string, artist: string, duration: number) =>
      ipcRenderer.invoke('lyrics:get', title, artist, duration),
  },

  // Scrobbling
  scrobble: {
    configure: (apiKey: string, apiSecret: string, sessionKey: string) =>
      ipcRenderer.invoke('scrobble:configure', apiKey, apiSecret, sessionKey),
    updateNowPlaying: (track: object) => ipcRenderer.invoke('scrobble:nowPlaying', track),
    scrobble: (track: object) => ipcRenderer.invoke('scrobble:scrobble', track),
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
});

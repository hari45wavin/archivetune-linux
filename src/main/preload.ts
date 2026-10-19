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
    getStatus: () => ipcRenderer.invoke('player:getStatus'),
    onProgress: (cb: (info: object) => void) => {
      ipcRenderer.on('player:progress', (_e, info) => cb(info));
      return () => ipcRenderer.removeAllListeners('player:progress');
    },
    onEnded: (cb: () => void) => {
      ipcRenderer.on('player:ended', () => cb());
      return () => ipcRenderer.removeAllListeners('player:ended');
    },
  },

  // YouTube Music
  ytmusic: {
    search: (query: string) => ipcRenderer.invoke('ytmusic:search', query),
    getStreamUrl: (videoId: string) => ipcRenderer.invoke('ytmusic:getStreamUrl', videoId),
    getHome: () => ipcRenderer.invoke('ytmusic:getHome'),
    getArtist: (artistId: string) => ipcRenderer.invoke('ytmusic:getArtist', artistId),
    getAlbum: (albumId: string) => ipcRenderer.invoke('ytmusic:getAlbum', albumId),
    getPlaylist: (playlistId: string) => ipcRenderer.invoke('ytmusic:getPlaylist', playlistId),
    getSuggested: (videoId: string) => ipcRenderer.invoke('ytmusic:getSuggested', videoId),
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

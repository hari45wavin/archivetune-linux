import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  return (
    <div className="titlebar-drag flex items-center h-10 px-4 bg-surface-container select-none shrink-0">
      {/* App name */}
      <span className="text-sm font-medium text-on-surface-variant tracking-wide">
        🌸 ArchiveTune
      </span>

      <div className="flex-1" />

      {/* Window controls (no-drag zone) */}
      <div className="titlebar-no-drag flex items-center gap-1">
        <button
          onClick={() => window.electronAPI?.minimize()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.electronAPI?.maximize()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          aria-label="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.electronAPI?.close()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error hover:text-on-error transition-colors text-on-surface-variant"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

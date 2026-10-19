import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Library, Settings, Music2 } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/home' },
  { icon: Search, label: 'Search', path: '/search' },
  { icon: Library, label: 'Library', path: '/library' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="w-56 shrink-0 bg-surface-container flex flex-col py-4 gap-1 border-r border-outline-variant">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-3 mb-2">
        <Music2 size={22} className="text-primary" />
        <span className="font-semibold text-on-surface tracking-tight">ArchiveTune</span>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`
              flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium
              transition-colors duration-150
              ${active
                ? 'bg-secondary-container text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container-high'
              }
            `}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </button>
        );
      })}
    </aside>
  );
}

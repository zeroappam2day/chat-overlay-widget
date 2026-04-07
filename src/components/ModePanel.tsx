import { useEffect, useState } from 'react';
import { useModeStore } from '../store/modeStore';
import { Tooltip } from './Tooltip';

/**
 * ModePanel — two mutually exclusive mode activation buttons as icon toggles.
 * Rendered inside AppHeader center area.
 */
export function ModePanel() {
  const activeMode = useModeStore((s) => s.activeMode);
  const activate = useModeStore((s) => s.activate);
  const deactivate = useModeStore((s) => s.deactivate);

  // Keyboard shortcuts: Alt+Shift+W (Walk Me Through), Alt+Shift+M (Work With Me)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) return;
      if (e.code === 'KeyW') {
        e.preventDefault();
        if (activeMode === 'walkMeThrough') {
          deactivate();
        } else if (activeMode === null) {
          activate('walkMeThrough');
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        if (activeMode === 'workWithMe') {
          deactivate();
        } else if (activeMode === null) {
          activate('workWithMe');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeMode, activate, deactivate]);

  return (
    <div className="flex items-center bg-[#21262d]/50 border border-[#30363d] rounded-md p-0.5">
      <Tooltip text="Walk Me Through (Alt+Shift+W)">
        <button
          onClick={() => activeMode === 'walkMeThrough' ? deactivate() : activate('walkMeThrough')}
          disabled={activeMode === 'workWithMe'}
          className={`p-1.5 rounded transition-all ${
            activeMode === 'walkMeThrough'
              ? 'bg-[#161b22] text-[#3fb950] shadow-sm border border-[#3fb950]/30 drop-shadow-[0_0_8px_rgba(63,185,80,0.3)]'
              : activeMode === 'workWithMe'
              ? 'text-[#484f58] cursor-not-allowed'
              : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
          }`}
          aria-label="Walk Me Through mode"
        >
          {/* Walking person icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="2.5" r="1.5" />
            <path d="M6 5h4l1.5 3.5-1.4.6L9 7H7l-1 2.5 2 1.5v4h-1.5v-3.5L4.5 10l1-3.5L6 5z" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip text="Work With Me (Alt+Shift+M)">
        <button
          onClick={() => activeMode === 'workWithMe' ? deactivate() : activate('workWithMe')}
          disabled={activeMode === 'walkMeThrough'}
          className={`p-1.5 rounded transition-all ${
            activeMode === 'workWithMe'
              ? 'bg-[#161b22] text-[#58a6ff] shadow-sm border border-[#58a6ff]/30 drop-shadow-[0_0_8px_rgba(88,166,255,0.3)]'
              : activeMode === 'walkMeThrough'
              ? 'text-[#484f58] cursor-not-allowed'
              : 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
          }`}
          aria-label="Work With Me mode"
        >
          {/* Collaboration/users icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3.5" r="2" />
            <circle cx="11" cy="3.5" r="2" />
            <path d="M1 10c0-2 1.8-3.5 4-3.5.7 0 1.4.2 2 .5A4.5 4.5 0 005 10v1H1v-1zm14 0v1h-4v-1c0-1.2-.4-2.3-1-3a4 4 0 014 3z" />
            <path d="M8 7.5c1.7 0 3 1.3 3 3V12H5v-1.5c0-1.7 1.3-3 3-3z" fillOpacity="0.6" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * ModeStatusBar — renders when a mode is active.
 * Shows pulsing dot, mode name, elapsed time, and Stop button.
 */
export function ModeStatusBar() {
  const activeMode = useModeStore((s) => s.activeMode);
  const activatedAt = useModeStore((s) => s.activatedAt);
  const deactivate = useModeStore((s) => s.deactivate);
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!activatedAt) return;
    const update = () => {
      const diff = Math.floor((Date.now() - activatedAt) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activatedAt]);

  if (activeMode === null) return null;

  const isWalk = activeMode === 'walkMeThrough';
  const accentColor = isWalk ? '#3fb950' : '#58a6ff';
  const label = isWalk ? 'Walk Me Through' : 'Work With Me';

  return (
    <div
      className="flex items-center h-6 px-3 border-b border-[#30363d] text-xs shrink-0 select-none"
      style={{ background: `linear-gradient(to right, ${accentColor}08, transparent)` }}
    >
      {/* Pulsing dot */}
      <div className="relative w-2 h-2 mr-2">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-60"
          style={{ backgroundColor: accentColor }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      </div>
      <span className="font-medium text-[#e6edf3] mr-3">{label}</span>
      <span className="text-[#8b949e]">{elapsed}</span>
      <div className="flex-1" />
      <Tooltip text="Stop active mode">
        <button
          onClick={() => deactivate()}
          className="text-[#f85149] hover:text-[#ff7b72] font-medium transition-colors text-[11px]"
        >
          Stop
        </button>
      </Tooltip>
    </div>
  );
}

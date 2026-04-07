import { useEffect } from 'react';
import { useThemeStore, clearTheme } from '../store/themeStore';
import { THEME_PRESETS, applyTheme } from '../lib/themes';
import { useFeatureFlagStore } from '../store/featureFlagStore';

/**
 * Theme selector rendered inside FeatureFlagPanel slide-out.
 * Shows theme buttons with color preview accent dots.
 * Gated by themePresets feature flag.
 */
export function ThemeSelector() {
  const themePresetsEnabled = useFeatureFlagStore((s) => s.themePresets);
  const { activeTheme, setTheme } = useThemeStore();

  useEffect(() => {
    if (themePresetsEnabled && activeTheme !== 'default') {
      applyTheme(activeTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!themePresetsEnabled) {
      clearTheme();
    }
  }, [themePresetsEnabled]);

  if (!themePresetsEnabled) {
    return null;
  }

  return (
    <div className="border-t border-[#30363d]/50 px-4 py-3 shrink-0">
      <p className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Theme</p>
      <div className="flex flex-col gap-1">
        {THEME_PRESETS.map((preset) => {
          const isActive = activeTheme === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setTheme(preset.id)}
              className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded transition-all ${
                isActive
                  ? 'bg-[#58a6ff]/10 border border-[#58a6ff]/30'
                  : 'border border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <span
                className="flex-shrink-0 w-3 h-3 rounded-full border border-white/10"
                style={{ backgroundColor: preset.vars['--co-accent'] }}
              />
              <span className="flex flex-col min-w-0 text-left">
                <span className="text-[11px] text-[#e6edf3] leading-tight">{preset.label}</span>
                <span className="text-[10px] text-[#8b949e] leading-tight">{preset.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

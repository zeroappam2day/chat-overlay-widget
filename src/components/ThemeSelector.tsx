import { useEffect } from 'react';
import { useThemeStore, clearTheme } from '../store/themeStore';
import { THEME_PRESETS, applyTheme } from '../lib/themes';
import { useFeatureFlagStore } from '../store/featureFlagStore';

/**
 * Theme selector rendered inside FeatureFlagPanel dropdown.
 * Shows 4 theme buttons with color preview accent dots.
 * Reads/writes via useThemeStore.
 *
 * Gated by themePresets feature flag — returns null when OFF.
 */
export function ThemeSelector() {
  const themePresetsEnabled = useFeatureFlagStore((s) => s.themePresets);
  const { activeTheme, setTheme } = useThemeStore();

  // Restore saved theme on mount if non-default
  useEffect(() => {
    if (themePresetsEnabled && activeTheme !== 'default') {
      applyTheme(activeTheme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear theme when flag is toggled OFF
  useEffect(() => {
    if (!themePresetsEnabled) {
      clearTheme();
    }
  }, [themePresetsEnabled]);

  if (!themePresetsEnabled) {
    return null;
  }

  return (
    <div className="border-t border-[#404040] px-3 py-2">
      <p className="text-[10px] text-gray-500 mb-1.5">Theme</p>
      <div className="flex flex-col gap-1">
        {THEME_PRESETS.map((preset) => {
          const isActive = activeTheme === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setTheme(preset.id)}
              className={`flex items-center gap-2 w-full px-2 py-1 rounded text-left transition-colors ${
                isActive
                  ? 'bg-[#333] border border-[#007acc]'
                  : 'border border-transparent hover:bg-[#333]'
              }`}
            >
              {/* Accent color preview dot */}
              <span
                className="flex-shrink-0 w-3 h-3 rounded-full"
                style={{ backgroundColor: preset.vars['--co-accent'] }}
              />
              <span className="flex flex-col min-w-0">
                <span className="text-xs text-gray-300 leading-tight">{preset.label}</span>
                <span className="text-[10px] text-gray-500 leading-tight">{preset.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

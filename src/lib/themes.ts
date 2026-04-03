/**
 * Theme preset system.
 * Adapted from parallel-code/src/lib/look.ts
 *
 * Each preset defines CSS custom properties applied to :root.
 * Tailwind classes are NOT changed. Themes override only custom properties
 * that are referenced by NEW inline styles in V2 components.
 *
 * Existing components use hardcoded Tailwind classes (bg-[#1e1e1e], etc.)
 * and are NOT affected. Themes apply to V2 components that use var(--co-*).
 * Over time, existing hardcoded colors can be migrated to CSS vars in future
 * phases, but this phase does NOT touch existing components.
 */

export type ThemeId = 'default' | 'classic' | 'midnight' | 'ember';

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  vars: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Graphite',
    description: 'Default dark theme',
    vars: {
      '--co-bg-primary': '#1e1e1e',
      '--co-bg-secondary': '#252525',
      '--co-bg-tertiary': '#2d2d2d',
      '--co-bg-hover': '#333333',
      '--co-border': '#404040',
      '--co-text-primary': '#d4d4d4',
      '--co-text-secondary': '#a0a0a0',
      '--co-text-muted': '#666666',
      '--co-accent': '#007acc',
      '--co-accent-hover': '#1a8ad4',
      '--co-success': '#4ec9b0',
      '--co-warning': '#dcdcaa',
      '--co-error': '#f44747',
      '--co-diff-add-bg': '#1e3a1e',
      '--co-diff-remove-bg': '#3a1e1e',
      '--co-diff-add-text': '#86efac',
      '--co-diff-remove-text': '#fca5a5',
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'High-contrast dark',
    vars: {
      '--co-bg-primary': '#0d1117',
      '--co-bg-secondary': '#161b22',
      '--co-bg-tertiary': '#21262d',
      '--co-bg-hover': '#30363d',
      '--co-border': '#30363d',
      '--co-text-primary': '#e6edf3',
      '--co-text-secondary': '#8b949e',
      '--co-text-muted': '#484f58',
      '--co-accent': '#58a6ff',
      '--co-accent-hover': '#79c0ff',
      '--co-success': '#3fb950',
      '--co-warning': '#d29922',
      '--co-error': '#f85149',
      '--co-diff-add-bg': '#0d2818',
      '--co-diff-remove-bg': '#3d1216',
      '--co-diff-add-text': '#7ee787',
      '--co-diff-remove-text': '#ffa198',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep blue tones',
    vars: {
      '--co-bg-primary': '#0f0f23',
      '--co-bg-secondary': '#151530',
      '--co-bg-tertiary': '#1a1a3e',
      '--co-bg-hover': '#25254d',
      '--co-border': '#2a2a5c',
      '--co-text-primary': '#ccccff',
      '--co-text-secondary': '#9999cc',
      '--co-text-muted': '#555577',
      '--co-accent': '#9999ff',
      '--co-accent-hover': '#bbbbff',
      '--co-success': '#99ff99',
      '--co-warning': '#ffcc66',
      '--co-error': '#ff6666',
      '--co-diff-add-bg': '#0f2a0f',
      '--co-diff-remove-bg': '#2a0f0f',
      '--co-diff-add-text': '#aaffaa',
      '--co-diff-remove-text': '#ffaaaa',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warm amber tones',
    vars: {
      '--co-bg-primary': '#1a1410',
      '--co-bg-secondary': '#221c16',
      '--co-bg-tertiary': '#2a221a',
      '--co-bg-hover': '#352a20',
      '--co-border': '#4a3a2a',
      '--co-text-primary': '#e8d5b5',
      '--co-text-secondary': '#b89a70',
      '--co-text-muted': '#6a5540',
      '--co-accent': '#e89050',
      '--co-accent-hover': '#f0a060',
      '--co-success': '#80c070',
      '--co-warning': '#e8c040',
      '--co-error': '#e06050',
      '--co-diff-add-bg': '#1a2a10',
      '--co-diff-remove-bg': '#2a1a10',
      '--co-diff-add-text': '#a0d890',
      '--co-diff-remove-text': '#e8a090',
    },
  },
];

/** Apply a theme by setting CSS custom properties on :root */
export function applyTheme(themeId: ThemeId): void {
  const preset = THEME_PRESETS.find(t => t.id === themeId);
  if (!preset) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', themeId);
}

/** Remove all theme CSS custom properties from :root */
export function clearTheme(): void {
  const root = document.documentElement;
  // Remove all --co-* properties
  for (const preset of THEME_PRESETS) {
    for (const key of Object.keys(preset.vars)) {
      root.style.removeProperty(key);
    }
  }
  root.removeAttribute('data-theme');
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_PRESETS.some(t => t.id === value);
}

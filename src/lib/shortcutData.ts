// MAINTENANCE: Update this list whenever shortcuts are added or removed from useShortcuts.ts or useTerminal.ts

export interface ShortcutEntry {
  label: string;       // Human-friendly action name
  keys: string;        // Display string like "Ctrl+/" or "Alt+Left"
}

export interface ShortcutGroup {
  title: string;       // Task-oriented group header per D-07
  shortcuts: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Move Between Panes',
    shortcuts: [
      { label: 'Previous pane', keys: 'Alt + Left' },
      { label: 'Next pane', keys: 'Alt + Right' },
      { label: 'Jump to pane 1', keys: 'Alt + 1' },
      { label: 'Jump to pane 2', keys: 'Alt + 2' },
      { label: 'Jump to pane 3', keys: 'Alt + 3' },
      { label: 'Jump to pane 4', keys: 'Alt + 4' },
    ],
  },
  {
    title: 'Toggle Panels',
    shortcuts: [
      { label: 'Plan panel', keys: 'Ctrl + P' },
      { label: 'Prompt history', keys: 'Ctrl + H' },
      { label: 'Bookmarks', keys: 'Ctrl + B' },
      { label: 'Request diff', keys: 'Ctrl + Shift + D' },
      { label: 'Annotation overlay', keys: 'Alt + Shift + X' },
    ],
  },
  {
    title: 'Terminal',
    shortcuts: [
      { label: 'Search in terminal', keys: 'Ctrl + F' },
      { label: 'Copy selection', keys: 'Ctrl + Alt + C' },
      { label: 'Paste', keys: 'Ctrl + Shift + V' },
    ],
  },
  {
    title: 'Zoom',
    shortcuts: [
      { label: 'Reset zoom', keys: 'Ctrl + 0' },
      { label: 'Zoom in', keys: 'Ctrl + =' },
      { label: 'Zoom out', keys: 'Ctrl + -' },
    ],
  },
];

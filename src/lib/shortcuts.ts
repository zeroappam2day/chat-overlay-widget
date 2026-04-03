/**
 * Global keyboard shortcut system.
 * Phase 8: Keyboard Navigation System.
 *
 * Adapted from parallel-code/src/lib/shortcuts.ts
 *
 * Features:
 *   - Register/unregister pattern with cleanup functions
 *   - Context-aware suppression (input/textarea/select unless global=true)
 *   - Dialog-safe shortcuts that fire even when dialog/overlay is open
 *   - Case-insensitive key matching with exact modifier match
 */

export interface Shortcut {
  /** Key value (e.g. 'f', 'ArrowLeft', '1') — matched case-insensitively */
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** If true, fires even when an INPUT/TEXTAREA/SELECT is focused */
  global?: boolean;
  /** If true, fires even when a dialog overlay (.dialog-overlay) exists */
  dialogSafe?: boolean;
  handler: (e: KeyboardEvent) => void;
}

const shortcuts: Set<Shortcut> = new Set();
let listenerAttached = false;

function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  if (e.key.toLowerCase() !== s.key.toLowerCase()) return false;
  if (!!s.ctrl !== e.ctrlKey) return false;
  if (!!s.alt !== e.altKey) return false;
  if (!!s.shift !== e.shiftKey) return false;
  return true;
}

function handleKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const tagName = target?.tagName;
  const isInputFocused =
    tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  const hasDialog = document.querySelector('.dialog-overlay') !== null;

  for (const s of shortcuts) {
    if (!matchesShortcut(e, s)) continue;
    if (isInputFocused && !s.global) continue;
    if (hasDialog && !s.dialogSafe) continue;
    e.preventDefault();
    s.handler(e);
    return; // first match wins
  }
}

/**
 * Register a keyboard shortcut. Returns an unregister function.
 */
export function registerShortcut(shortcut: Shortcut): () => void {
  shortcuts.add(shortcut);
  return () => {
    shortcuts.delete(shortcut);
  };
}

/**
 * Attach the global keydown listener. Returns a cleanup function.
 * Safe to call multiple times — only one listener is ever attached.
 */
export function initShortcutListener(): () => void {
  if (!listenerAttached) {
    document.addEventListener('keydown', handleKeydown, { capture: true });
    listenerAttached = true;
  }
  return () => {
    document.removeEventListener('keydown', handleKeydown, { capture: true });
    listenerAttached = false;
    shortcuts.clear();
  };
}

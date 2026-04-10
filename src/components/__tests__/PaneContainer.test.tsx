// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// --- Mocks (before component imports) ---

vi.mock('../hooks/useShortcuts', () => ({
  useShortcuts: vi.fn(),
}));
vi.mock('../hooks/usePaneDimming', () => ({
  usePaneDimming: vi.fn(),
}));
vi.mock('../hooks/usePersistence', () => ({
  usePersistence: vi.fn(),
}));
vi.mock('../hooks/useZoom', () => ({
  useZoom: vi.fn(),
}));
vi.mock('@tauri-apps/api/window', () => ({
  appWindow: { onFileDropEvent: vi.fn().mockResolvedValue(vi.fn()) },
}));
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, ...props }: any) => <div data-testid="panel-group" {...props}>{children}</div>,
  Panel: ({ children, ...props }: any) => <div data-testid="panel" {...props}>{children}</div>,
  Separator: (props: any) => <div data-testid="separator" {...props} />,
}));
vi.mock('../TerminalPane', () => ({
  TerminalPane: ({ paneId }: { paneId: string }) => <div data-testid={`terminal-${paneId}`} />,
}));
vi.mock('../SafePane', () => ({
  SafePane: ({ children }: { children: React.ReactNode }) => <div data-testid="safe-pane">{children}</div>,
}));
vi.mock('../AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));
vi.mock('../AgentSidebar', () => ({
  AgentSidebar: () => <div data-testid="agent-sidebar" />,
}));
vi.mock('../ModePanel', () => ({
  ModeStatusBar: () => null,
}));
vi.mock('../ShortcutHelpOverlay', () => ({
  ShortcutHelpOverlay: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="shortcut-overlay" /> : null,
}));

// Stub ResizeObserver
globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

import { PaneContainer } from '../PaneContainer';
import { usePaneStore } from '../../store/paneStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PaneContainer', () => {
  it('renders core layout elements', () => {
    usePaneStore.setState({
      layout: { type: 'pane', id: 'pane-1' },
      activePaneId: 'pane-1',
    });
    render(<PaneContainer />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('agent-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-pane-1')).toBeInTheDocument();
  });

  it('ShortcutHelpOverlay hidden by default', () => {
    usePaneStore.setState({
      layout: { type: 'pane', id: 'pane-1' },
      activePaneId: 'pane-1',
    });
    render(<PaneContainer />);
    expect(screen.queryByTestId('shortcut-overlay')).not.toBeInTheDocument();
  });
});

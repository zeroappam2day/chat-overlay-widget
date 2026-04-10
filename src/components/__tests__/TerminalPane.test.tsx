// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// --- Mocks (before component imports) ---

// Mock xterm.js to prevent canvas/matchMedia errors in jsdom
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    open = vi.fn();
    dispose = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onResize = vi.fn().mockReturnValue({ dispose: vi.fn() });
    write = vi.fn();
    loadAddon = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    cols = 80;
    rows = 24;
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon { fit = vi.fn(); dispose = vi.fn(); }
  return { FitAddon: MockFitAddon };
});

vi.mock('@xterm/addon-search', () => {
  class MockSearchAddon { dispose = vi.fn(); findNext = vi.fn(); findPrevious = vi.fn(); }
  return { SearchAddon: MockSearchAddon };
});

vi.mock('@xterm/addon-web-links', () => {
  class MockWebLinksAddon { dispose = vi.fn(); }
  return { WebLinksAddon: MockWebLinksAddon };
});

// Mock Tauri IPC to prevent __TAURI_IPC__ errors
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('../../hooks/useTerminal', () => ({
  useTerminal: () => ({
    containerRef: { current: null },
    writeToTerminal: vi.fn(),
    getTerminalDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
    searchAddonRef: { current: null },
  }),
}));

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    state: 'connecting',
    sendMessage: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSessionHistory', () => ({
  useSessionHistory: () => ({
    sessions: [],
    replaySessionId: null,
    replayChunks: [],
    replayComplete: false,
    fetchSessions: vi.fn(),
    startReplay: vi.fn(),
    closeReplay: vi.fn(),
    handleHistoryMessage: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFlagSync', () => ({
  useFlagSync: vi.fn(),
}));

vi.mock('../../store/paneStore', () => ({
  usePaneStore: (selector: (s: any) => any) => selector({
    activePaneId: 'test-1',
    setActivePane: vi.fn(),
    splitPane: vi.fn(),
    closePane: vi.fn(),
    getPaneCount: () => 1,
  }),
}));

vi.mock('../../store/agentEventStore', () => ({
  useAgentEventStore: { getState: () => ({ pushEvent: vi.fn() }) },
}));

vi.mock('../../store/pmChatStore', () => ({
  usePmChatStore: { getState: () => ({ appendToken: vi.fn(), finalizeResponse: vi.fn(), setStreaming: vi.fn(), setHealth: vi.fn(), setWsSend: vi.fn() }), subscribe: () => vi.fn() },
}));

vi.mock('../../store/annotationBridgeStore', () => ({
  useAnnotationBridgeStore: { getState: () => ({ setAnnotations: vi.fn(), setWalkthroughStep: vi.fn() }) },
}));

vi.mock('../../store/planStore', () => ({
  usePlanStore: { getState: () => ({ setContent: vi.fn() }) },
}));

vi.mock('../../store/diffStore', () => ({
  useDiffStore: { getState: () => ({ setDiffs: vi.fn() }) },
}));

vi.mock('../../store/featureFlagStore', () => ({
  useFeatureFlagStore: {
    getState: () => ({ completionStats: false, exitNotifications: false, diffViewer: false, promptHistory: false }),
    subscribe: () => vi.fn(),
  },
}));

vi.mock('../../store/completionStore', () => ({
  useCompletionStore: { getState: () => ({ recordCompleted: vi.fn() }) },
}));

vi.mock('../../store/promptHistoryStore', () => ({
  usePromptHistoryStore: { getState: () => ({ addEntry: vi.fn() }) },
}));

vi.mock('../../store/modeStore', () => ({
  useModeStore: { getState: () => ({ handleModeStatus: vi.fn(), handleCrashRecovery: vi.fn(), setSendMessage: vi.fn() }) },
}));

vi.mock('../../lib/diffParser', () => ({
  parseUnifiedDiff: vi.fn().mockReturnValue([]),
}));

vi.mock('../../lib/exitNotifier', () => {
  class MockExitNotifier {
    enabled = false;
    notify = vi.fn();
    destroy = vi.fn();
  }
  return { ExitNotifier: MockExitNotifier };
});

vi.mock('../TerminalHeader', () => ({
  TerminalHeader: () => <div data-testid="terminal-header" />,
}));

vi.mock('../SearchOverlay', () => ({
  SearchOverlay: () => null,
}));

vi.mock('../ChatInputBar', () => ({
  ChatInputBar: () => <div data-testid="chat-input-bar" />,
}));

vi.mock('../HistorySidebar', () => ({
  HistorySidebar: () => null,
}));

vi.mock('../HistoryViewer', () => ({
  HistoryViewer: () => null,
}));

vi.mock('../WindowPicker', () => ({
  WindowPicker: () => null,
}));

vi.mock('../EnhancedDiffPanel', () => ({
  EnhancedDiffPanel: () => null,
}));

vi.mock('../BookmarkBar', () => ({
  BookmarkBar: () => null,
}));

vi.mock('../PromptHistoryPanel', () => ({
  PromptHistoryPanel: () => null,
}));

vi.mock('../GitHubUrlBadge', () => ({
  GitHubUrlBadge: () => null,
}));

vi.mock('../terminalMessageDispatcher', () => ({
  dispatchServerMessage: vi.fn(),
}));

vi.mock('../../utils/formatCaptureBlock', () => ({
  formatCaptureBlock: vi.fn().mockReturnValue(''),
}));

// Stub ResizeObserver
globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

import { TerminalPane } from '../TerminalPane';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TerminalPane', () => {
  it('renders without throwing (shallow smoke test)', () => {
    const { container } = render(<TerminalPane paneId="test-1" />);
    expect(container.firstChild).toBeTruthy();
  });
});

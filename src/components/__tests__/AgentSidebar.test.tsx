// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentSidebar } from '../AgentSidebar';
import { useAgentEventStore } from '../../store/agentEventStore';
import type { AgentEvent } from '../../protocol';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useAgentEventStore.setState({ events: [], collapsed: false });
});

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    tool: 'claude-code',
    type: 'PreToolUse',
    timestamp: new Date().toISOString(),
    sessionId: 'test-session-1',
    payload: {},
    ...overrides,
  };
}

// ============================================================
// Test 1: Empty state
// ============================================================
describe('AgentSidebar: empty state', () => {
  it('renders "No agent events" when store has no events', () => {
    render(<AgentSidebar />);
    expect(screen.getByText('No agent events')).toBeInTheDocument();
  });
});

// ============================================================
// Test 2: Event rendering
// ============================================================
describe('AgentSidebar: event rendering', () => {
  it('renders tool name and file path for each event in the store', () => {
    useAgentEventStore.setState({
      events: [
        makeEvent({ tool: 'claude-code', toolName: 'Read', filePath: '/foo.ts', type: 'PreToolUse' }),
        makeEvent({ tool: 'windsurf', toolName: 'pre_write_code', type: 'pre_write_code' }),
      ],
      collapsed: false,
    });
    render(<AgentSidebar />);
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('pre_write_code')).toBeInTheDocument();
  });
});

// ============================================================
// Test 3: Status dots
// ============================================================
describe('AgentSidebar: status dots', () => {
  it('renders green status dot (bg-green-500) for event with status="complete"', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: 'complete' })],
      collapsed: false,
    });
    const { container } = render(<AgentSidebar />);
    const dot = container.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders yellow status dot (bg-yellow-500) for event with status="running"', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: 'running' })],
      collapsed: false,
    });
    const { container } = render(<AgentSidebar />);
    const dot = container.querySelector('.bg-yellow-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders gray status dot (bg-gray-500) for event with no status', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: undefined })],
      collapsed: false,
    });
    const { container } = render(<AgentSidebar />);
    const dot = container.querySelector('.bg-gray-500');
    expect(dot).toBeInTheDocument();
  });
});

// ============================================================
// Test 4: Collapse/expand preserves events
// ============================================================
describe('AgentSidebar: collapse and expand', () => {
  it('preserves store events after toggling collapsed twice (collapse then expand)', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ toolName: 'MyTool' })],
      collapsed: false,
    });
    render(<AgentSidebar />);

    // Collapse
    const collapseBtn = screen.getByRole('button', { name: /collapse agent sidebar/i });
    fireEvent.click(collapseBtn);

    // Expand (sidebar now shows the collapsed strip with expand button)
    const expandBtn = screen.getByRole('button', { name: /expand agent sidebar/i });
    fireEvent.click(expandBtn);

    // Events should still be visible
    expect(screen.getByText('MyTool')).toBeInTheDocument();
  });

  it('after collapse, event list is not visible', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ toolName: 'HiddenTool' })],
      collapsed: false,
    });
    render(<AgentSidebar />);

    const collapseBtn = screen.getByRole('button', { name: /collapse agent sidebar/i });
    fireEvent.click(collapseBtn);

    expect(screen.queryByText('HiddenTool')).not.toBeInTheDocument();
  });
});

// ============================================================
// Test 5: File path display
// ============================================================
describe('AgentSidebar: file path display', () => {
  it('renders file path when event has filePath set', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ filePath: '/src/main.ts' })],
      collapsed: false,
    });
    render(<AgentSidebar />);
    // The truncateFilePath function may shorten long paths — /src/main.ts is short enough to show fully
    expect(screen.getByText('/src/main.ts')).toBeInTheDocument();
  });
});

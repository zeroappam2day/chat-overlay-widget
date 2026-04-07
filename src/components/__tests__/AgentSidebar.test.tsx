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
  useAgentEventStore.setState({ events: [], collapsed: false, activeTab: 'agent' });
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
  it('renders green status dot for event with status="complete"', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: 'complete' })],
      collapsed: false,
      activeTab: 'agent',
    });
    render(<AgentSidebar />);
    // Portal renders into document.body; Tailwind arbitrary classes need unescaped selector
    const dot = document.body.querySelector('[class*="bg-[#3fb950]"]');
    expect(dot).toBeInTheDocument();
  });

  it('renders yellow status dot for event with status="running"', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: 'running' })],
      collapsed: false,
      activeTab: 'agent',
    });
    render(<AgentSidebar />);
    const dot = document.body.querySelector('[class*="bg-[#d29922]"]');
    expect(dot).toBeInTheDocument();
  });

  it('renders gray status dot for event with no status', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ status: undefined })],
      collapsed: false,
      activeTab: 'agent',
    });
    render(<AgentSidebar />);
    const dot = document.body.querySelector('[class*="bg-[#484f58]"]');
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
      activeTab: 'agent',
    });
    render(<AgentSidebar />);

    // Collapse
    const collapseBtn = screen.getByRole('button', { name: /collapse agent sidebar/i });
    fireEvent.click(collapseBtn);

    // Expand by clicking the agent activity tab icon
    const expandBtn = screen.getByRole('button', { name: /open agent activity tab/i });
    fireEvent.click(expandBtn);

    // Events should still be visible
    expect(screen.getByText('MyTool')).toBeInTheDocument();
  });

  it('after collapse, event list is not visible', () => {
    useAgentEventStore.setState({
      events: [makeEvent({ toolName: 'HiddenTool' })],
      collapsed: false,
      activeTab: 'agent',
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

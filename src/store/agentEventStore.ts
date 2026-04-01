import { create } from 'zustand';
import type { AgentEvent } from '../protocol';

interface AgentEventStore {
  events: AgentEvent[];
  collapsed: boolean;
  pushEvent: (e: AgentEvent) => void;
  toggleCollapsed: () => void;
}

export const useAgentEventStore = create<AgentEventStore>((set) => ({
  events: [],
  collapsed: false,
  pushEvent: (e) => set((s) => ({ events: [...s.events, e] })),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
}));

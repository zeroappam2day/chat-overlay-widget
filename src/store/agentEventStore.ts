import { create } from 'zustand';
import type { AgentEvent } from '../protocol';

interface AgentEventStore {
  events: AgentEvent[];
  collapsed: boolean;
  activeTab: 'agent' | 'pm-chat';
  pushEvent: (e: AgentEvent) => void;
  toggleCollapsed: () => void;
  setActiveTab: (tab: 'agent' | 'pm-chat') => void;
}

export const useAgentEventStore = create<AgentEventStore>((set) => ({
  events: [],
  collapsed: true,
  activeTab: 'agent',
  pushEvent: (e) => set((s) => ({ events: [...s.events, e] })),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setActiveTab: (tab) => set({ activeTab: tab, collapsed: false }),
}));

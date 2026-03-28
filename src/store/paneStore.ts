import { create } from 'zustand';

// --- Types ---

export type PaneNode = { type: 'pane'; id: string };
export type SplitNode = {
  type: 'split';
  id: string;               // unique ID for PanelGroup key stability
  direction: 'h' | 'v';
  children: LayoutNode[];
  sizes: number[];           // percentage array, same length as children
};
export type LayoutNode = PaneNode | SplitNode;

// --- Store Interface ---

interface PaneStore {
  layout: LayoutNode;
  activePaneId: string;
  splitPane: (paneId: string, direction: 'h' | 'v') => void;
  closePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  setSizes: (splitId: string, sizes: number[]) => void;
  getPaneCount: () => number;
}

// --- Internal helpers (not exported) ---

function splitInTree(node: LayoutNode, paneId: string, direction: 'h' | 'v'): LayoutNode {
  if (node.type === 'pane') {
    if (node.id === paneId) {
      const newPaneId = `pane-${Date.now()}`;
      const splitId = `split-${Date.now()}`;
      const splitNode: SplitNode = {
        type: 'split',
        id: splitId,
        direction,
        children: [node, { type: 'pane', id: newPaneId }],
        sizes: [50, 50],
      };
      return splitNode;
    }
    return node;
  }
  // SplitNode — recurse into children
  const newChildren = node.children.map((child) => splitInTree(child, paneId, direction));
  return { ...node, children: newChildren };
}

function removeFromTree(node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.type === 'pane') {
    if (node.id === paneId) {
      return null; // signal removal
    }
    return node;
  }
  // SplitNode — recurse into children
  const newChildren: LayoutNode[] = [];
  for (const child of node.children) {
    const result = removeFromTree(child, paneId);
    if (result !== null) {
      newChildren.push(result);
    }
  }
  if (newChildren.length === 1) {
    // Collapse: replace SplitNode with its sole remaining child
    return newChildren[0];
  }
  // Recalculate sizes proportionally
  const removedCount = node.children.length - newChildren.length;
  const newSizes = removedCount > 0
    ? newChildren.map(() => 100 / newChildren.length)
    : node.sizes;
  return { ...node, children: newChildren, sizes: newSizes };
}

function updateSizes(node: LayoutNode, splitId: string, sizes: number[]): LayoutNode {
  if (node.type === 'pane') {
    return node;
  }
  if (node.id === splitId) {
    return { ...node, sizes };
  }
  const newChildren = node.children.map((child) => updateSizes(child, splitId, sizes));
  return { ...node, children: newChildren };
}

function countPanes(node: LayoutNode): number {
  if (node.type === 'pane') {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countPanes(child), 0);
}

function getAllPaneIds(node: LayoutNode): string[] {
  if (node.type === 'pane') {
    return [node.id];
  }
  return node.children.flatMap((child) => getAllPaneIds(child));
}

// --- Store ---

export const usePaneStore = create<PaneStore>((set, get) => ({
  layout: { type: 'pane', id: 'pane-1' },
  activePaneId: 'pane-1',

  splitPane: (paneId, direction) => {
    const state = get();
    if (countPanes(state.layout) >= 4) {
      return; // soft cap — 4 pane maximum (per research open question 1)
    }
    const newLayout = splitInTree(state.layout, paneId, direction);
    set({ layout: newLayout });
  },

  closePane: (paneId) => {
    const state = get();
    if (countPanes(state.layout) <= 1) {
      return; // cannot remove last pane (per D-11)
    }
    const result = removeFromTree(state.layout, paneId);
    if (result === null) {
      return; // shouldn't happen since we checked count > 1
    }
    const newLayout = result;
    const newActivePaneId =
      state.activePaneId === paneId
        ? (getAllPaneIds(newLayout)[0] ?? state.activePaneId)
        : state.activePaneId;
    set({ layout: newLayout, activePaneId: newActivePaneId });
  },

  setActivePane: (paneId) => {
    set({ activePaneId: paneId });
  },

  setSizes: (splitId, sizes) => {
    const state = get();
    const newLayout = updateSizes(state.layout, splitId, sizes);
    set({ layout: newLayout });
  },

  getPaneCount: () => {
    return countPanes(get().layout);
  },
}));

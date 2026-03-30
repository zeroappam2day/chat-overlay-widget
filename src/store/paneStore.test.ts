import { describe, it, expect, beforeEach } from 'vitest';
import { splitInTree, getAllPaneIds, usePaneStore } from './paneStore';
import type { LayoutNode, SplitNode } from './paneStore';

const initialLayout: LayoutNode = { type: 'pane', id: 'pane-1' };

beforeEach(() => {
  usePaneStore.setState({ layout: initialLayout, activePaneId: 'pane-1' });
});

describe('splitInTree', () => {
  it('preserves original pane ID in children[0]', () => {
    const result = splitInTree({ type: 'pane', id: 'pane-1' }, 'pane-1', 'h');
    expect(result.type).toBe('split');
    const split = result as SplitNode;
    expect(split.children[0].id).toBe('pane-1');
  });

  it('creates new pane with unique ID in children[1]', () => {
    const result = splitInTree({ type: 'pane', id: 'pane-1' }, 'pane-1', 'h') as SplitNode;
    expect(result.children[1].type).toBe('pane');
    expect(result.children[1].id).not.toBe('pane-1');
  });
});

describe('splitPane (store action)', () => {
  it('does not change activePaneId after split (D-09)', () => {
    usePaneStore.getState().splitPane('pane-1', 'h');
    expect(usePaneStore.getState().activePaneId).toBe('pane-1');
  });

  it('respects 4-pane cap — splitting when count >= 4 returns same layout', () => {
    // Build a layout with 4 panes via 3 splits
    usePaneStore.getState().splitPane('pane-1', 'h'); // 2 panes
    const layout2 = usePaneStore.getState().layout as SplitNode;
    const pane2Id = layout2.children[1].id;

    usePaneStore.getState().splitPane(pane2Id, 'v'); // 3 panes
    const layout3 = usePaneStore.getState().layout;
    const ids3 = getAllPaneIds(layout3);
    const pane3Id = ids3[ids3.length - 1]; // last newly created pane

    usePaneStore.getState().splitPane(pane3Id, 'h'); // 4 panes
    const layout4 = usePaneStore.getState().layout;
    const ids4 = getAllPaneIds(layout4);
    expect(ids4.length).toBe(4);

    // Now attempt a 5th split — should be rejected
    const pane4Id = ids4[ids4.length - 1];
    usePaneStore.getState().splitPane(pane4Id, 'h');
    const layoutAfter = usePaneStore.getState().layout;
    expect(getAllPaneIds(layoutAfter).length).toBe(4);
  });
});

describe('setSizes', () => {
  it('updates the correct SplitNode sizes array', () => {
    usePaneStore.getState().splitPane('pane-1', 'h');
    const layout = usePaneStore.getState().layout as SplitNode;
    const splitId = layout.id;

    usePaneStore.getState().setSizes(splitId, [30, 70]);
    const updatedLayout = usePaneStore.getState().layout as SplitNode;
    expect(updatedLayout.sizes).toEqual([30, 70]);
  });
});

describe('getAllPaneIds', () => {
  it('returns all pane IDs from a nested split tree', () => {
    // Build a tree with 3 panes
    usePaneStore.getState().splitPane('pane-1', 'h'); // 2 panes
    const layout2 = usePaneStore.getState().layout as SplitNode;
    const pane2Id = layout2.children[1].id;

    usePaneStore.getState().splitPane(pane2Id, 'v'); // 3 panes
    const layout3 = usePaneStore.getState().layout;
    const ids = getAllPaneIds(layout3);

    expect(ids.length).toBe(3);
    expect(ids).toContain('pane-1');
    expect(ids).toContain(pane2Id);
  });
});

describe('closePane', () => {
  it('collapses single-child SplitNode back to a pane', () => {
    usePaneStore.getState().splitPane('pane-1', 'h');
    const layout = usePaneStore.getState().layout as SplitNode;
    const newPaneId = layout.children[1].id;

    usePaneStore.getState().closePane(newPaneId);
    const collapsed = usePaneStore.getState().layout;
    expect(collapsed.type).toBe('pane');
    expect(collapsed.id).toBe('pane-1');
  });
});

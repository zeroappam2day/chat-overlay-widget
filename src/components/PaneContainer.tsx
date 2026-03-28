import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { usePaneStore } from '../store/paneStore';
import type { LayoutNode, SplitNode } from '../store/paneStore';
import { TerminalPane } from './TerminalPane';

function renderLayout(node: LayoutNode): React.ReactNode {
  if (node.type === 'pane') {
    return <TerminalPane key={node.id} paneId={node.id} />;
  }

  // SplitNode — render a Group with resize handles (Separator) between panels
  const splitNode = node as SplitNode;
  const orientation = splitNode.direction === 'h' ? 'horizontal' : 'vertical';

  return (
    <Group
      key={splitNode.id}
      orientation={orientation}
      style={{ flex: 1, overflow: 'hidden' }}
    >
      {splitNode.children.map((child, i) => (
        <React.Fragment key={child.id}>
          <Panel
            defaultSize={splitNode.sizes[i] ?? 100 / splitNode.children.length}
            minSize={15}
          >
            {renderLayout(child)}
          </Panel>
          {i < splitNode.children.length - 1 && (
            <Separator
              className={
                splitNode.direction === 'h'
                  ? 'w-1 bg-[#404040] hover:bg-[#007acc] transition-colors cursor-col-resize'
                  : 'h-1 bg-[#404040] hover:bg-[#007acc] transition-colors cursor-row-resize'
              }
            />
          )}
        </React.Fragment>
      ))}
    </Group>
  );
}

export function PaneContainer() {
  const layout = usePaneStore(state => state.layout);

  return (
    <div className="flex h-screen bg-[#1e1e1e]">
      {renderLayout(layout)}
    </div>
  );
}

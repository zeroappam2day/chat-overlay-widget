import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { appWindow } from '@tauri-apps/api/window';
import { usePaneStore } from '../store/paneStore';
import type { LayoutNode, SplitNode } from '../store/paneStore';
import { TerminalPane } from './TerminalPane';

function renderLayout(
  node: LayoutNode,
  forceVertical: boolean,
  activePaneId: string,
  droppedImagePath: string | null,
  clearDroppedPath: () => void,
): React.ReactNode {
  if (node.type === 'pane') {
    return (
      <TerminalPane
        key={node.id}
        paneId={node.id}
        droppedImagePath={activePaneId === node.id ? droppedImagePath : null}
        onDroppedPathConsumed={clearDroppedPath}
      />
    );
  }

  // SplitNode — render a Group with resize handles (Separator) between panels
  const splitNode = node as SplitNode;
  const orientation = forceVertical ? 'vertical' : (splitNode.direction === 'h' ? 'horizontal' : 'vertical');

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
            {renderLayout(child, forceVertical, activePaneId, droppedImagePath, clearDroppedPath)}
          </Panel>
          {i < splitNode.children.length - 1 && (
            <Separator
              className={
                orientation === 'horizontal'
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
  const activePaneId = usePaneStore(state => state.activePaneId);

  // SCRN-01: dropped image path state for file-drop
  const [droppedImagePath, setDroppedImagePath] = useState<string | null>(null);
  const clearDroppedPath = useCallback(() => setDroppedImagePath(null), []);

  // WIN-02: adaptive layout — narrow window stacks panes vertically
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tauri file-drop listener (SCRN-01)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.onFileDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const imagePaths = event.payload.paths.filter(p =>
          /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(p)
        );
        if (imagePaths.length > 0) {
          setDroppedImagePath(imagePaths[0]);
        }
      }
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // ResizeObserver for adaptive layout (WIN-02)
  useEffect(() => {
    const el = containerRef.current ?? document.documentElement;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      setIsNarrow(width < 600);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]" ref={containerRef}>
      <div className="flex-1 min-h-0">
        {renderLayout(layout, isNarrow, activePaneId, droppedImagePath, clearDroppedPath)}
      </div>
    </div>
  );
}

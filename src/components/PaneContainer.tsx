import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { Layout } from 'react-resizable-panels';
import { appWindow } from '@tauri-apps/api/window';
import { usePaneStore, getAllPaneIds } from '../store/paneStore';
import type { LayoutNode, SplitNode } from '../store/paneStore';
import { TerminalPane } from './TerminalPane';
import { AppHeader } from './AppHeader';
import { AgentSidebar } from './AgentSidebar';
import { useShortcuts } from '../hooks/useShortcuts';

// --- usePanelRects ---
// Tracks each Panel placeholder div's bounding rect relative to the layout container.
// TerminalPane wrappers use these rects for absolute positioning.

function usePanelRects(layoutContainerRef: React.RefObject<HTMLDivElement>) {
  const [rects, setRects] = useState<Map<string, DOMRect>>(new Map());
  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const containerRect = layoutContainerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const newRects = new Map<string, DOMRect>();
      panelRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        // Make positions relative to container
        newRects.set(
          id,
          new DOMRect(
            r.left - containerRect.left,
            r.top - containerRect.top,
            r.width,
            r.height,
          ),
        );
      });
      setRects(newRects);
    });
    observerRef.current = observer;
    // Observe all already-registered panels (handles effect re-run)
    panelRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [layoutContainerRef]);

  const registerPanel = useCallback((paneId: string, el: HTMLDivElement | null) => {
    if (el) {
      panelRefs.current.set(paneId, el);
      observerRef.current?.observe(el);
    } else {
      const old = panelRefs.current.get(paneId);
      if (old) observerRef.current?.unobserve(old);
      panelRefs.current.delete(paneId);
    }
  }, []);

  return { rects, registerPanel };
}

// --- renderLayoutPanels ---
// Renders the react-resizable-panels Group/Panel/Separator tree as empty sizing placeholders.
// TerminalPane components are NOT rendered here — they live in the flat terminal layer.

function renderLayoutPanels(
  node: LayoutNode,
  forceVertical: boolean,
  registerPanel: (paneId: string, el: HTMLDivElement | null) => void,
  setSizes: (splitId: string, sizes: number[]) => void,
): React.ReactNode {
  if (node.type === 'pane') {
    // Leaf panel: placeholder div tracked by ResizeObserver for rect measurement
    return (
      <div
        ref={(el) => registerPanel(node.id, el)}
        className="h-full w-full"
      />
    );
  }

  const splitNode = node as SplitNode;
  const orientation = forceVertical
    ? 'vertical'
    : splitNode.direction === 'h'
    ? 'horizontal'
    : 'vertical';

  // Build a stable ordered list of leaf pane IDs for this split level
  // (needed to convert the Layout map back to an ordered sizes array)
  const childIds = splitNode.children.map((c) => c.id);

  return (
    <Group
      key={splitNode.id}
      orientation={orientation}
      style={{ flex: 1, overflow: 'hidden' }}
      onLayoutChanged={(layoutMap: Layout) => {
        // v4 Layout is { [panelId]: percentage }. Convert to ordered array.
        const newSizes = childIds.map((id) => layoutMap[id] ?? 50);
        const currentSizes = splitNode.sizes;
        // Size-change guard: only persist when sizes actually changed (>0.5% threshold).
        // Prevents initial-mount onLayoutChanged from overwriting stored non-50/50 proportions.
        const changed = newSizes.some((s, i) => Math.abs(s - (currentSizes[i] ?? 50)) > 0.5);
        if (changed) setSizes(splitNode.id, newSizes);
      }}
    >
      {splitNode.children.map((child, i) => (
        <React.Fragment key={child.id}>
          <Panel
            id={child.id}
            defaultSize={splitNode.sizes[i] ?? 100 / splitNode.children.length}
            minSize={15}
          >
            {renderLayoutPanels(child, forceVertical, registerPanel, setSizes)}
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
  useShortcuts(); // Phase 8: global keyboard shortcuts

  const layout = usePaneStore((state) => state.layout);
  const activePaneId = usePaneStore((state) => state.activePaneId);
  const setSizes = usePaneStore((state) => state.setSizes);

  // SCRN-01: dropped image path state for file-drop
  const [droppedImagePath, setDroppedImagePath] = useState<string | null>(null);
  const clearDroppedPath = useCallback(() => setDroppedImagePath(null), []);

  // WIN-02: adaptive layout — narrow window stacks panes vertically
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 600);

  // outerRef: the full flex-col container (used by isNarrow ResizeObserver)
  const outerRef = useRef<HTMLDivElement>(null);
  // layoutContainerRef: the relative flex-1 div — panel rects are computed relative to this
  const layoutContainerRef = useRef<HTMLDivElement>(null);

  const { rects, registerPanel } = usePanelRects(layoutContainerRef);

  // Flat list of all pane IDs from the current layout tree
  const allPaneIds = getAllPaneIds(layout);

  // Tauri file-drop listener (SCRN-01)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.onFileDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const imagePaths = event.payload.paths.filter((p) =>
          /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(p),
        );
        if (imagePaths.length > 0) {
          setDroppedImagePath(imagePaths[0]);
        }
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // ResizeObserver for adaptive layout (WIN-02)
  useEffect(() => {
    const el = outerRef.current ?? document.documentElement;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setIsNarrow(width < 600);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]" ref={outerRef}>
      <AppHeader />
      <div className="flex flex-row flex-1 min-h-0">
        <AgentSidebar />
        <div className="relative flex-1 min-h-0" ref={layoutContainerRef}>
          {/* Layout layer — react-resizable-panels sizing placeholders only, no TerminalPane */}
          <div className="absolute inset-0">
            {renderLayoutPanels(layout, isNarrow, registerPanel, setSizes)}
          </div>
          {/* Terminal layer — flat stable tree position, absolutely positioned to match panel rects */}
          {allPaneIds.map((paneId) => (
            <div
              key={paneId}
              className="absolute"
              style={{
                top: rects.get(paneId)?.top ?? 0,
                left: rects.get(paneId)?.left ?? 0,
                width: rects.get(paneId)?.width ?? 0,
                height: rects.get(paneId)?.height ?? 0,
                // Hide until panel rect is measured to prevent flash of zero-size terminal
                visibility: rects.has(paneId) ? 'visible' : 'hidden',
              }}
            >
              <TerminalPane
                paneId={paneId}
                droppedImagePath={activePaneId === paneId ? droppedImagePath : null}
                onDroppedPathConsumed={clearDroppedPath}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

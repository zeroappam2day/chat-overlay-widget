import { useState, useRef, useCallback, useEffect, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: ReactElement;
  position?: 'bottom' | 'top' | 'left' | 'right';
  delay?: number;
}

/**
 * Tooltip — hover label for icon buttons.
 *
 * Uses React.cloneElement to inject onMouseEnter/onMouseLeave directly
 * onto the child element instead of wrapping it in a <div>. This is
 * required because Tauri v1's data-tauri-drag-region swallows mouse
 * events on non-interactive wrapper elements (plain divs), preventing
 * both tooltips and click handlers from firing.
 *
 * Also injects a native `title` attribute as a universal fallback —
 * WebView2 always renders native tooltips even inside drag regions.
 *
 * The tooltip label renders via a portal to document.body so it is
 * never clipped by parent overflow:hidden containers.
 */
export function Tooltip({ text, children, position = 'bottom', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        let top: number;
        let left: number;

        switch (position) {
          case 'top':
            top = rect.top - 4;
            left = rect.left + rect.width / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2;
            left = rect.left - 4;
            break;
          case 'right':
            top = rect.top + rect.height / 2;
            left = rect.right + 4;
            break;
          case 'bottom':
          default:
            top = rect.bottom + 4;
            left = rect.left + rect.width / 2;
            break;
        }

        setCoords({ top, left });
      }
      setVisible(true);
    }, delay);
  }, [delay, position]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const positionStyles: Record<string, React.CSSProperties> = {
    bottom: { top: coords.top, left: coords.left, transform: 'translateX(-50%)' },
    top: { top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' },
    left: { top: coords.top, left: coords.left, transform: 'translate(-100%, -50%)' },
    right: { top: coords.top, left: coords.left, transform: 'translateY(-50%)' },
  };

  // Clone child to inject mouse handlers, ref, and native title fallback
  const child = children as ReactElement<any>;
  const cloned = (() => {
    const existingRef = (child as any).ref;
    return (
      <child.type
        {...child.props}
        key={child.key}
        title={child.props.title ?? text}
        onMouseEnter={(e: React.MouseEvent) => {
          child.props.onMouseEnter?.(e);
          show();
        }}
        onMouseLeave={(e: React.MouseEvent) => {
          child.props.onMouseLeave?.(e);
          hide();
        }}
        ref={(node: HTMLElement | null) => {
          anchorRef.current = node;
          if (typeof existingRef === 'function') existingRef(node);
          else if (existingRef) existingRef.current = node;
        }}
      />
    );
  })();

  const tooltip = visible
    ? createPortal(
        <span
          className="fixed z-[9999] whitespace-nowrap px-2 py-1 rounded text-[11px] font-medium text-white bg-[#21262d] border border-[#30363d] shadow-lg pointer-events-none animate-fade-in"
          style={positionStyles[position]}
        >
          {text}
        </span>,
        document.body,
      )
    : null;

  return (
    <>
      {cloned}
      {tooltip}
    </>
  );
}

import { useState, useRef, useCallback } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'bottom' | 'top' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ text, children, position = 'bottom', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const positionClasses: Record<string, string> = {
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <span
          className={`absolute ${positionClasses[position]} z-[9999] whitespace-nowrap px-2 py-1 rounded text-[11px] font-medium text-white bg-[#21262d] border border-[#30363d] shadow-lg pointer-events-none animate-fade-in`}
        >
          {text}
        </span>
      )}
    </div>
  );
}

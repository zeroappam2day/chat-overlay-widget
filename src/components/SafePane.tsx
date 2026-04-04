import { type ReactNode } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { PaneErrorBoundary } from './PaneErrorBoundary';

interface SafePaneProps {
  paneId: string;
  children: ReactNode;
}

export function SafePane({ paneId, children }: SafePaneProps) {
  const enabled = useFeatureFlagStore((s) => s.errorBoundaries);
  if (!enabled) return <>{children}</>;
  return <PaneErrorBoundary paneId={paneId}>{children}</PaneErrorBoundary>;
}

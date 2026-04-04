import { useCompletionStore } from '../store/completionStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';

export function CompletionBadge() {
  const enabled = useFeatureFlagStore((s) => s.completionStats);
  const todayCount = useCompletionStore((s) =>
    s.todayDate === new Date().toISOString().slice(0, 10) ? s.todayCount : 0
  );
  const totalCompleted = useCompletionStore((s) => s.totalCompleted);

  if (!enabled || todayCount === 0) return null;

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-green-400"
      title={`${totalCompleted} total completed sessions`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25z" />
      </svg>
      <span>{todayCount} today</span>
    </div>
  );
}

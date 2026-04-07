import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface StepInfo {
  stepId: string;
  title: string;
  instruction: string;
  currentStep: number;
  totalSteps: number;
}

export const WalkthroughPanel: React.FC = () => {
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);

  useEffect(() => {
    const unlistenStep = listen<StepInfo | null>('update-walkthrough-step', (event) => {
      setStepInfo(event.payload);
    });
    return () => { unlistenStep.then(f => f()); };
  }, []);

  if (!stepInfo) return null;

  return (
    <div
      className="fixed bottom-5 right-5 w-[350px] glass-panel-heavy rounded-xl z-[9999] overflow-hidden animate-scale-in"
      style={{
        border: '1px solid rgba(88, 166, 255, 0.2)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(88, 166, 255, 0.1)',
        pointerEvents: 'auto',
      }}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-[#30363d]">
        <div
          className="h-full bg-gradient-to-r from-[#58a6ff] to-[#d2a8ff] transition-all duration-500"
          style={{ width: `${(stepInfo.currentStep / stepInfo.totalSteps) * 100}%` }}
        />
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-semibold text-[#58a6ff] uppercase tracking-wider font-mono">
            Step {stepInfo.currentStep} of {stepInfo.totalSteps}
          </span>
        </div>
        <div className="text-[14px] font-semibold text-[#e6edf3] mb-1.5">
          {stepInfo.title}
        </div>
        <div className="text-[13px] text-[#8b949e] leading-relaxed">
          {stepInfo.instruction}
        </div>
      </div>
    </div>
  );
};

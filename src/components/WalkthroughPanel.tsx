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
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 350,
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      borderRadius: 8,
      padding: 16,
      fontFamily: 'system-ui, sans-serif',
      pointerEvents: 'auto',
      zIndex: 9999,
      border: '1px solid rgba(255, 62, 0, 0.5)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#ff3e00', fontWeight: 'bold' }}>
          STEP {stepInfo.currentStep} OF {stepInfo.totalSteps}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>
        {stepInfo.title}
      </div>
      <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.4 }}>
        {stepInfo.instruction}
      </div>
    </div>
  );
};

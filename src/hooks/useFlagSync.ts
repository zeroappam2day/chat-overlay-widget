import { useEffect, useRef } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import type { ClientMessage } from '../protocol';

/**
 * Syncs frontend feature flags to the sidecar via 'set-flags' WebSocket message.
 * Call once per TerminalPane, passing its sendMessage function.
 * Sends current flags on mount and whenever they change.
 */
export function useFlagSync(sendMessage: (msg: ClientMessage) => void, connected: boolean): void {
  const outputBatching = useFeatureFlagStore(s => s.outputBatching);
  const terminalWriteMcp = useFeatureFlagStore(s => s.terminalWriteMcp);
  const conditionalAdvance = useFeatureFlagStore(s => s.conditionalAdvance);
  const multiPty = useFeatureFlagStore(s => s.multiPty);
  const uiAccessibility = useFeatureFlagStore(s => s.uiAccessibility);
  const osInputSimulation = useFeatureFlagStore(s => s.osInputSimulation);
  const consentGate = useFeatureFlagStore(s => s.consentGate);
  const sentRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      sentRef.current = false;
      return;
    }
    sendMessage({ type: 'set-flags', flags: { outputBatching, terminalWriteMcp, conditionalAdvance, multiPty, uiAccessibility, osInputSimulation, consentGate } });
    sentRef.current = true;
  }, [outputBatching, terminalWriteMcp, conditionalAdvance, multiPty, uiAccessibility, osInputSimulation, consentGate, connected, sendMessage]);
}

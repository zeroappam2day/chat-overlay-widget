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
  const screenshotVerification = useFeatureFlagStore(s => s.screenshotVerification);
  const sentRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      sentRef.current = false;
      return;
    }
    sendMessage({ type: 'set-flags', flags: { outputBatching, terminalWriteMcp, conditionalAdvance, screenshotVerification } });
    sentRef.current = true;
  }, [outputBatching, terminalWriteMcp, conditionalAdvance, screenshotVerification, connected, sendMessage]);
}

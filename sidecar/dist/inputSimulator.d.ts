/**
 * inputSimulator.ts — Agent Runtime Phase 5
 *
 * Win32 SendInput wrapper via PowerShell P/Invoke.
 * Simulates mouse clicks, keyboard input, key combos, and drag operations.
 * Each action is a separate PowerShell invocation (isolated, no state leakage).
 *
 * Uses the same P/Invoke pattern as windowEnumerator.ts and windowCapture.ts.
 */
export interface InputResult {
    ok: boolean;
    error?: string;
}
export declare function simulateClick(x: number, y: number, button?: 'left' | 'right'): InputResult;
export declare function simulateType(text: string): InputResult;
export declare function simulateKeyCombo(keys: string[]): InputResult;
export declare function simulateDrag(fromX: number, fromY: number, toX: number, toY: number): InputResult;

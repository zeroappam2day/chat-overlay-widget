/**
 * screenshotSelf.ts
 *
 * Self-capture module: discovers the app's own HWND, captures via PrintWindow,
 * and optionally blacks out pixel rows containing secrets using sharp.
 *
 * D-01: Reuses captureWindowByHwnd() from windowCapture.ts
 * D-02: Self-discovery via title match "Chat Overlay"
 * D-04: Full-line blackout for any line containing a secret
 * D-07: Uses sharp for PNG compositing
 */

import sharp from 'sharp';
import * as fs from 'node:fs';
import { listWindows } from './windowEnumerator.js';
import { captureWindowByHwnd, type CaptureWithMetadataResult } from './windowCapture.js';
import { detectSecrets } from './secretScrubber.js';
import type { TerminalBuffer } from './terminalBuffer.js';

// Hardcoded terminal metrics (D-06)
export const TERMINAL_TOP_OFFSET = 48; // AppHeader 32px + TerminalHeader 16px
export const LINE_HEIGHT = 17;         // xterm.js default line height

/**
 * Discover the app's own HWND and capture it via PrintWindow.
 * Returns CaptureWithMetadataResult (same type as captureWindowByHwnd).
 */
export function captureSelf(): CaptureWithMetadataResult {
  const windows = listWindows();
  const match = windows.find(w => w.title.includes('Chat Overlay'));
  if (!match) {
    return { ok: false, error: 'SELF_NOT_FOUND' };
  }
  return captureWindowByHwnd(match.hwnd, match.pid, match.title);
}

/**
 * Black out pixel rows for lines containing secrets.
 * If secretLineNumbers is empty, returns the original PNG buffer unchanged.
 */
export async function blurSecretLines(
  pngPath: string,
  secretLineNumbers: number[],
  opts?: { lineHeight?: number; topOffset?: number }
): Promise<Buffer> {
  const lineHeight = opts?.lineHeight ?? LINE_HEIGHT;
  const topOffset = opts?.topOffset ?? TERMINAL_TOP_OFFSET;

  if (secretLineNumbers.length === 0) {
    return sharp(pngPath).png().toBuffer();
  }

  const metadata = await sharp(pngPath).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const uniqueLines = Array.from(new Set(secretLineNumbers));
  const rects = uniqueLines
    .map(ln => {
      const y = topOffset + ln * lineHeight;
      if (y + lineHeight > height) return '';
      return `<rect x="0" y="${y}" width="${width}" height="${lineHeight}" fill="black"/>`;
    })
    .filter(Boolean)
    .join('');

  const svg = `<svg width="${width}" height="${height}">${rects}</svg>`;

  return sharp(pngPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * High-level self-capture with optional secret-line blurring.
 * blur=true: detect secrets in terminal text and black out those pixel rows.
 * blur=false: return raw unblurred PNG.
 */
export async function captureSelfScreenshot(
  terminalBuffer: TerminalBuffer,
  blur: boolean,
  opts?: { lineHeight?: number; topOffset?: number }
): Promise<
  | { ok: true; buffer: Buffer; blurred: boolean; width: number; height: number }
  | { ok: false; error: string }
> {
  const captureResult = captureSelf();
  if (!captureResult.ok) {
    return { ok: false as const, error: captureResult.error };
  }

  const { path: pngPath, captureSize } = captureResult.data;

  try {
    if (!blur) {
      const buffer = await sharp(pngPath).png().toBuffer();
      return { ok: true, buffer, blurred: false, width: captureSize.w, height: captureSize.h };
    }

    // Get terminal text and detect secrets
    const snapshot = terminalBuffer.getLines(0); // 0 = all lines
    const text = snapshot.lines.join('\n');
    const matches = detectSecrets(text);
    const uniqueLineNumbers = Array.from(new Set(matches.map(m => m.line)));

    const buffer = await blurSecretLines(pngPath, uniqueLineNumbers, opts);
    return { ok: true, buffer, blurred: true, width: captureSize.w, height: captureSize.h };
  } finally {
    // Clean up temp PNG file
    fs.promises.unlink(pngPath).catch(() => {});
  }
}

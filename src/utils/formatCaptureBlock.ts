import { quotePathForShell } from './shellQuote';

export interface CaptureBlockInput {
  path: string;
  title: string;
  bounds: { x: number; y: number; w: number; h: number };
  captureSize: { w: number; h: number };
  dpiScale: number;
  shell: string | null;
}

export function formatCaptureBlock(input: CaptureBlockInput): string {
  const quotedPath = quotePathForShell(input.path, input.shell);
  return [
    quotedPath,
    `# window: ${input.title}`,
    `# bounds: x=${input.bounds.x} y=${input.bounds.y} w=${input.bounds.w} h=${input.bounds.h} (physical pixels)`,
    `# capture_size: ${input.captureSize.w}x${input.captureSize.h}`,
    `# dpi_scale: ${input.dpiScale.toFixed(4)}`,
    `# coordinate_origin: top-left, units: physical pixels`,
  ].join('\n');
}

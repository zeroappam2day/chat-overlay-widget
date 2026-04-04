/**
 * screenshotVerifier.ts — EAC-7: Screenshot-Based Step Verification
 *
 * Provides three verification strategies for walkthrough steps:
 * 1. Pixel Sampling — check specific regions for expected colors/brightness
 * 2. Screenshot Diff — compare current screenshot to a reference image
 * 3. Content Capture — crop and return a screenshot buffer for LLM vision analysis
 */

import sharp from 'sharp';

export interface PixelRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  expectedColor?: string;   // hex e.g. '#ff0000'
  minBrightness?: number;   // 0-255
}

export interface PixelSampleResult {
  region: PixelRegion;
  passed: boolean;
  actualColor?: string;
}

export interface PixelSampleResponse {
  passed: boolean;
  results: PixelSampleResult[];
}

export interface ScreenshotDiffResponse {
  passed: boolean;
  diffPercentage: number;
}

export interface CaptureForVerificationResponse {
  screenshot: Buffer;
  width: number;
  height: number;
}

/**
 * Parse a hex color string (#RRGGBB) into {r, g, b}.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Convert RGB to hex string.
 */
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate perceived brightness from RGB (ITU-R BT.601).
 */
function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export class ScreenshotVerifier {
  private screenshotFn: () => Promise<Buffer>;

  constructor(opts: { screenshotFn: () => Promise<Buffer> }) {
    this.screenshotFn = opts.screenshotFn;
  }

  /**
   * Strategy 1: Pixel Sampling.
   * Samples the average color of each region and checks against expected color
   * (with tolerance +-15) and/or brightness threshold.
   */
  async verifyPixelSample(opts: {
    regions: PixelRegion[];
  }): Promise<PixelSampleResponse> {
    const screenshot = await this.screenshotFn();
    const results: PixelSampleResult[] = [];

    for (const region of opts.regions) {
      const cropped = sharp(screenshot).extract({
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
      });

      // Resize to 1x1 to get average color
      const { data, info } = await cropped
        .resize(1, 1, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const r = data[0];
      const g = data[1];
      const b = data[2];
      const actualColor = toHex(r, g, b);

      let passed = true;

      // Check expected color with tolerance +-15
      if (region.expectedColor) {
        const expected = parseHex(region.expectedColor);
        const tolerance = 15;
        if (
          Math.abs(r - expected.r) > tolerance ||
          Math.abs(g - expected.g) > tolerance ||
          Math.abs(b - expected.b) > tolerance
        ) {
          passed = false;
        }
      }

      // Check brightness threshold
      if (region.minBrightness !== undefined) {
        const br = brightness(r, g, b);
        if (br < region.minBrightness) {
          passed = false;
        }
      }

      results.push({ region, passed, actualColor });
    }

    return {
      passed: results.every(r => r.passed),
      results,
    };
  }

  /**
   * Strategy 2: Screenshot Diff.
   * Compares current screenshot to a reference, returning the percentage of
   * differing pixels. Optionally masks specified regions before comparison.
   */
  async verifyScreenshotDiff(opts: {
    referenceScreenshot: Buffer;
    diffThreshold: number;
    maskRegions?: Array<{ x: number; y: number; w: number; h: number }>;
  }): Promise<ScreenshotDiffResponse> {
    const screenshot = await this.screenshotFn();

    // Get dimensions from reference
    const refMeta = await sharp(opts.referenceScreenshot).metadata();
    const width = refMeta.width!;
    const height = refMeta.height!;

    // Resize current screenshot to match reference dimensions
    let currentPipeline = sharp(screenshot).resize(width, height, { fit: 'fill' });
    let referencePipeline = sharp(opts.referenceScreenshot);

    // Apply masks (black out regions) if specified
    if (opts.maskRegions && opts.maskRegions.length > 0) {
      const rects = opts.maskRegions
        .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`)
        .join('');
      const maskSvg = Buffer.from(`<svg width="${width}" height="${height}">${rects}</svg>`);

      const currentBuf = await currentPipeline.png().toBuffer();
      currentPipeline = sharp(currentBuf).composite([{ input: maskSvg, top: 0, left: 0 }]);

      const refBuf = await referencePipeline.png().toBuffer();
      referencePipeline = sharp(refBuf).composite([{ input: maskSvg, top: 0, left: 0 }]);
    }

    // Get raw pixel data from both
    const currentRaw = await currentPipeline.raw().toBuffer();
    const referenceRaw = await referencePipeline.raw().toBuffer();

    // Compare pixel by pixel (RGB channels)
    const pixelCount = width * height;
    let diffPixels = 0;
    const channels = 3; // RGB

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * channels;
      // If any channel differs by more than 15, count as different pixel
      const rDiff = Math.abs(currentRaw[offset] - referenceRaw[offset]);
      const gDiff = Math.abs(currentRaw[offset + 1] - referenceRaw[offset + 1]);
      const bDiff = Math.abs(currentRaw[offset + 2] - referenceRaw[offset + 2]);
      if (rDiff > 15 || gDiff > 15 || bDiff > 15) {
        diffPixels++;
      }
    }

    const diffPercentage = diffPixels / pixelCount;

    return {
      passed: diffPercentage <= opts.diffThreshold,
      diffPercentage,
    };
  }

  /**
   * Strategy 3: Content Capture.
   * Captures (and optionally crops) a screenshot for LLM vision analysis.
   */
  async captureForVerification(opts?: {
    cropRegion?: { x: number; y: number; w: number; h: number };
  }): Promise<CaptureForVerificationResponse> {
    const screenshot = await this.screenshotFn();

    if (opts?.cropRegion) {
      const { x, y, w, h } = opts.cropRegion;
      const cropped = await sharp(screenshot)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toBuffer();
      return { screenshot: cropped, width: w, height: h };
    }

    const meta = await sharp(screenshot).metadata();
    return {
      screenshot,
      width: meta.width!,
      height: meta.height!,
    };
  }
}

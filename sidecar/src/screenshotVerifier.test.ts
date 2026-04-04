import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { ScreenshotVerifier } from './screenshotVerifier.js';
import { AdvanceWhenSchema } from './walkthroughEngine.js';

/**
 * Create a solid-color test image as a PNG buffer.
 */
async function makeImage(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  }).png().toBuffer();
}

/**
 * Create a test image with a colored rectangle drawn at a specific position.
 */
async function makeImageWithRect(
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  rect: { x: number; y: number; w: number; h: number; color: string }
): Promise<Buffer> {
  const svg = `<svg width="${width}" height="${height}">
    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${rect.color}"/>
  </svg>`;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

describe('ScreenshotVerifier', () => {
  describe('Pixel Sampling', () => {
    it('region matches expected color — passes', async () => {
      const img = await makeImage(100, 100, { r: 255, g: 0, b: 0 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.verifyPixelSample({
        regions: [{ x: 10, y: 10, w: 20, h: 20, expectedColor: '#ff0000' }],
      });

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].passed).toBe(true);
    });

    it('color mismatch — fails', async () => {
      const img = await makeImage(100, 100, { r: 0, g: 0, b: 255 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.verifyPixelSample({
        regions: [{ x: 10, y: 10, w: 20, h: 20, expectedColor: '#ff0000' }],
      });

      expect(result.passed).toBe(false);
      expect(result.results[0].passed).toBe(false);
      // Actual color should be blue-ish
      expect(result.results[0].actualColor).toBeDefined();
    });

    it('brightness threshold check — passes when bright enough', async () => {
      const img = await makeImage(100, 100, { r: 200, g: 200, b: 200 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.verifyPixelSample({
        regions: [{ x: 0, y: 0, w: 50, h: 50, minBrightness: 100 }],
      });

      expect(result.passed).toBe(true);
    });

    it('brightness threshold check — fails when too dark', async () => {
      const img = await makeImage(100, 100, { r: 10, g: 10, b: 10 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.verifyPixelSample({
        regions: [{ x: 0, y: 0, w: 50, h: 50, minBrightness: 100 }],
      });

      expect(result.passed).toBe(false);
      expect(result.results[0].passed).toBe(false);
    });
  });

  describe('Screenshot Diff', () => {
    it('identical images — below threshold, passes', async () => {
      const img = await makeImage(100, 100, { r: 128, g: 128, b: 128 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.verifyScreenshotDiff({
        referenceScreenshot: img,
        diffThreshold: 0.05,
      });

      expect(result.passed).toBe(true);
      expect(result.diffPercentage).toBe(0);
    });

    it('different images — above threshold, fails', async () => {
      const img1 = await makeImage(100, 100, { r: 255, g: 0, b: 0 });
      const img2 = await makeImage(100, 100, { r: 0, g: 0, b: 255 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img1 });

      const result = await verifier.verifyScreenshotDiff({
        referenceScreenshot: img2,
        diffThreshold: 0.05,
      });

      expect(result.passed).toBe(false);
      expect(result.diffPercentage).toBeGreaterThan(0.05);
    });

    it('masked regions excluded from diff', async () => {
      // Create two images that differ only in a specific region
      const bg = { r: 128, g: 128, b: 128 };
      const img1 = await makeImageWithRect(100, 100, bg, {
        x: 10, y: 10, w: 30, h: 30, color: '#ff0000',
      });
      const img2 = await makeImageWithRect(100, 100, bg, {
        x: 10, y: 10, w: 30, h: 30, color: '#0000ff',
      });

      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img1 });

      // Without mask — should fail (images differ in the rect region)
      const resultNoMask = await verifier.verifyScreenshotDiff({
        referenceScreenshot: img2,
        diffThreshold: 0.01,
      });
      expect(resultNoMask.passed).toBe(false);

      // With mask over the differing region — should pass
      const resultMasked = await verifier.verifyScreenshotDiff({
        referenceScreenshot: img2,
        diffThreshold: 0.01,
        maskRegions: [{ x: 10, y: 10, w: 30, h: 30 }],
      });
      expect(resultMasked.passed).toBe(true);
    });
  });

  describe('Content Capture', () => {
    it('returns full screenshot with dimensions', async () => {
      const img = await makeImage(200, 150, { r: 100, g: 100, b: 100 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.captureForVerification();

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
      expect(Buffer.isBuffer(result.screenshot)).toBe(true);
    });

    it('returns cropped buffer with correct dimensions', async () => {
      const img = await makeImage(200, 150, { r: 100, g: 100, b: 100 });
      const verifier = new ScreenshotVerifier({ screenshotFn: async () => img });

      const result = await verifier.captureForVerification({
        cropRegion: { x: 10, y: 10, w: 50, h: 40 },
      });

      expect(result.width).toBe(50);
      expect(result.height).toBe(40);
      expect(Buffer.isBuffer(result.screenshot)).toBe(true);

      // Verify the cropped image actually has the right dimensions
      const meta = await sharp(result.screenshot).metadata();
      expect(meta.width).toBe(50);
      expect(meta.height).toBe(40);
    });
  });

  describe('AdvanceWhenSchema backward compatibility', () => {
    it('terminal-match still valid', () => {
      const result = AdvanceWhenSchema.safeParse({
        type: 'terminal-match',
        pattern: 'Build completed',
      });
      expect(result.success).toBe(true);
    });

    it('pixel-sample valid', () => {
      const result = AdvanceWhenSchema.safeParse({
        type: 'pixel-sample',
        regions: [{ x: 0, y: 0, w: 10, h: 10, expectedColor: '#ff0000' }],
      });
      expect(result.success).toBe(true);
    });

    it('screenshot-diff valid', () => {
      const result = AdvanceWhenSchema.safeParse({
        type: 'screenshot-diff',
        diffThreshold: 0.05,
      });
      expect(result.success).toBe(true);
    });

    it('manual valid', () => {
      const result = AdvanceWhenSchema.safeParse({
        type: 'manual',
      });
      expect(result.success).toBe(true);
    });

    it('undefined is valid (optional)', () => {
      const result = AdvanceWhenSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('unknown type is rejected', () => {
      const result = AdvanceWhenSchema.safeParse({
        type: 'unknown-type',
      });
      expect(result.success).toBe(false);
    });
  });
});

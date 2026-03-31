import { describe, it, expect } from 'vitest';
import { formatCaptureBlock, CaptureBlockInput } from './formatCaptureBlock';

const baseInput: CaptureBlockInput = {
  path: 'C:\\Users\\user\\AppData\\Local\\Temp\\capture-abc123.png',
  title: 'Chrome',
  bounds: { x: 100, y: 200, w: 1280, h: 720 },
  captureSize: { w: 1280, h: 720 },
  dpiScale: 1.25,
  shell: 'powershell.exe',
};

describe('formatCaptureBlock', () => {
  it('Test 1: PowerShell shell — path is single-quoted, correct comment lines', () => {
    const result = formatCaptureBlock(baseInput);
    const lines = result.split('\n');
    expect(lines[0]).toBe("'C:\\Users\\user\\AppData\\Local\\Temp\\capture-abc123.png'");
    expect(lines[1]).toBe('# window: Chrome');
    expect(lines[2]).toBe('# bounds: x=100 y=200 w=1280 h=720 (physical pixels)');
    expect(lines[3]).toBe('# capture_size: 1280x720');
    expect(lines[4]).toBe('# dpi_scale: 1.2500');
    expect(lines[5]).toBe('# coordinate_origin: top-left, units: physical pixels');
  });

  it('Test 2: cmd.exe shell — path is double-quoted', () => {
    const result = formatCaptureBlock({ ...baseInput, shell: 'cmd.exe' });
    const lines = result.split('\n');
    expect(lines[0]).toBe('"C:\\Users\\user\\AppData\\Local\\Temp\\capture-abc123.png"');
  });

  it('Test 3: bash.exe shell — path uses forward-slash /c/ prefix with single quotes', () => {
    const result = formatCaptureBlock({ ...baseInput, shell: 'bash.exe' });
    const lines = result.split('\n');
    expect(lines[0]).toBe("'/c/Users/user/AppData/Local/Temp/capture-abc123.png'");
  });

  it('Test 4: null shell — path is unquoted raw', () => {
    const result = formatCaptureBlock({ ...baseInput, shell: null });
    const lines = result.split('\n');
    expect(lines[0]).toBe('C:\\Users\\user\\AppData\\Local\\Temp\\capture-abc123.png');
  });

  it('Test 5: dpiScale 1.0 formats as 1.0000 (toFixed(4))', () => {
    const result = formatCaptureBlock({ ...baseInput, dpiScale: 1.0 });
    expect(result).toContain('# dpi_scale: 1.0000');
  });

  it('Test 6: Title with special characters passes through unescaped', () => {
    const result = formatCaptureBlock({ ...baseInput, title: 'My "Special" App & <More>' });
    expect(result).toContain('# window: My "Special" App & <More>');
  });

  it('Test 7: Block has exactly 6 lines', () => {
    const result = formatCaptureBlock(baseInput);
    const lines = result.split('\n');
    expect(lines).toHaveLength(6);
  });
});

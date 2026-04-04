import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

function makeOkResult(stdout: string) {
  return { stdout, stderr: '', status: 0, error: undefined };
}

describe('enhancedAccessibility', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import('./enhancedAccessibility.js');
    mod.resetCache();
  });

  it('searchElements by name finds matching elements', async () => {
    const elements = [
      { name: 'Save', automationId: 'btn-save', className: 'Button', controlType: 'ControlType.Button', boundingRect: { x: 10, y: 20, width: 80, height: 30 }, path: ['Window', 'Save'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(elements)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'Save', searchProperty: 'name' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Save');
    expect(result[0].automationId).toBe('btn-save');
  });

  it('searchElements by automationId finds matching elements', async () => {
    const elements = [
      { name: 'OK', automationId: 'dlg-ok', className: 'Button', controlType: 'ControlType.Button', boundingRect: { x: 50, y: 100, width: 60, height: 25 }, path: ['Dialog', 'OK'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(elements)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'dlg-ok', searchProperty: 'automationId' });
    expect(result).toHaveLength(1);
    expect(result[0].automationId).toBe('dlg-ok');
  });

  it('searchElements by className finds matching elements', async () => {
    const elements = [
      { name: 'Input', automationId: 'txt-1', className: 'TextBox', controlType: 'ControlType.Edit', boundingRect: { x: 0, y: 0, width: 200, height: 30 }, path: ['Form', 'Input'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(elements)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'TextBox', searchProperty: 'className' });
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('TextBox');
  });

  it('deeper traversal (maxDepth 8) finds nested elements', async () => {
    const nested = [
      { name: 'DeepChild', automationId: 'deep', className: 'Label', controlType: 'ControlType.Text', boundingRect: { x: 5, y: 5, width: 50, height: 15 }, path: ['Root', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'DeepChild'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(nested)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'DeepChild', searchProperty: 'name', maxDepth: 8 });
    expect(result).toHaveLength(1);
    expect(result[0].path.length).toBeGreaterThan(1);
  });

  it('maxResults limits output', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      name: `Item${i}`, automationId: `id-${i}`, className: 'ListItem', controlType: 'ControlType.ListItem',
      boundingRect: { x: 0, y: i * 20, width: 100, height: 20 }, path: [`Item${i}`],
    }));
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(many.slice(0, 3))) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'Item', searchProperty: 'name', maxResults: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('invokeElement activates element via InvokePattern', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('{"ok":true}') as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.invokeElement({ hwnd: 12345, automationId: 'btn-save' });
    expect(result.ok).toBe(true);
  });

  it('setElementValue sets text via ValuePattern', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('{"ok":true}') as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.setElementValue({ hwnd: 12345, automationId: 'txt-1', value: 'Hello World' });
    expect(result.ok).toBe(true);
  });

  it('getElementPatterns returns supported patterns list', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('{"patterns":["InvokePatternIdentifiers.Pattern","ValuePatternIdentifiers.Pattern"]}') as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.getElementPatterns({ hwnd: 12345, automationId: 'btn-save' });
    expect(result.patterns).toContain('InvokePatternIdentifiers.Pattern');
    expect(result.patterns).toContain('ValuePatternIdentifiers.Pattern');
  });

  it('error handling for missing elements returns ok: false', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('{"ok":false,"error":"Element not found"}') as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.invokeElement({ hwnd: 12345, name: 'NonExistent' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Element not found');
  });

  it('cache behavior: second call within 2s reuses cache', async () => {
    const elements = [
      { name: 'CachedBtn', automationId: 'cached', className: 'Button', controlType: 'ControlType.Button', boundingRect: { x: 0, y: 0, width: 50, height: 25 }, path: ['CachedBtn'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(elements)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    await mod.searchElements({ hwnd: 99999, searchText: 'CachedBtn', searchProperty: 'name' });
    await mod.searchElements({ hwnd: 99999, searchText: 'CachedBtn', searchProperty: 'name' });
    // spawnSync called once for search (cache hit on second call)
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });

  it('cache expires after 2 seconds', async () => {
    const elements = [
      { name: 'Btn', automationId: 'b', className: 'Button', controlType: 'ControlType.Button', boundingRect: { x: 0, y: 0, width: 50, height: 25 }, path: ['Btn'] },
    ];
    mockSpawnSync.mockReturnValue(makeOkResult(JSON.stringify(elements)) as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    await mod.searchElements({ hwnd: 99999, searchText: 'Btn', searchProperty: 'name' });
    spy.mockReturnValue(now + 3000); // 3 seconds later
    await mod.searchElements({ hwnd: 99999, searchText: 'Btn', searchProperty: 'name' });
    expect(mockSpawnSync).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('searchElements returns empty array for empty PowerShell output', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('') as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    const result = await mod.searchElements({ hwnd: 12345, searchText: 'Nothing', searchProperty: 'name' });
    expect(result).toEqual([]);
  });

  it('searchElements throws when PowerShell exits non-zero', async () => {
    mockSpawnSync.mockReturnValue({ stdout: '', stderr: 'error occurred', status: 1, error: undefined } as ReturnType<typeof spawnSync>);
    const mod = await import('./enhancedAccessibility.js');
    await expect(mod.searchElements({ hwnd: 12345, searchText: 'Test', searchProperty: 'name' })).rejects.toThrow('PowerShell exited');
  });
});

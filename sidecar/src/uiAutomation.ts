/**
 * Agent Runtime Phase 4: UI Accessibility Tree Discovery
 * Win32 UI Automation via PowerShell [System.Windows.Automation] namespace.
 * Same P/Invoke pattern as windowEnumerator.ts and windowCapture.ts.
 */

import { spawnSync } from 'node:child_process';

export interface UiElement {
  name: string;
  role: string;
  boundingRect: { x: number; y: number; w: number; h: number };
  automationId: string;
  isEnabled: boolean;
  isOffscreen: boolean;
  children: UiElement[];
}

let cache: { data: UiElement[]; ts: number; key: string } | null = null;
const CACHE_TTL_MS = 3_000;

export function resetUiCache(): void {
  cache = null;
}

/**
 * PowerShell script that loads UIAutomation assemblies and walks the control tree.
 * Parameters injected: $hwnd (IntPtr), $maxDepth (int), $roleFilterCsv (string or empty).
 */
function buildScript(hwnd: number, maxDepth: number, roleFilter?: string[]): string {
  const roleFilterCsv = roleFilter && roleFilter.length > 0 ? roleFilter.join(',') : '';
  return `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$hwnd = [IntPtr]::new(${hwnd})
$maxDepth = ${maxDepth}
$roleFilterCsv = '${roleFilterCsv}'
$roleFilter = if ($roleFilterCsv -ne '') { $roleFilterCsv -split ',' } else { @() }

function Walk-Element {
    param(
        [System.Windows.Automation.AutomationElement]$Element,
        [int]$Depth
    )
    if ($null -eq $Element) { return $null }

    $name = ''
    $role = ''
    $automationId = ''
    $isEnabled = $true
    $isOffscreen = $false
    $rect = @{ x = 0; y = 0; w = 0; h = 0 }

    try { $name = $Element.Current.Name } catch {}
    try { $role = $Element.Current.ControlType.ProgrammaticName -replace 'ControlType\\.', '' } catch {}
    try { $automationId = $Element.Current.AutomationId } catch {}
    try { $isEnabled = $Element.Current.IsEnabled } catch {}
    try { $isOffscreen = $Element.Current.IsOffscreen } catch {}
    try {
        $br = $Element.Current.BoundingRectangle
        if (-not [System.Windows.Rect]::Empty.Equals($br)) {
            $rect = @{
                x = [int][Math]::Round($br.X)
                y = [int][Math]::Round($br.Y)
                w = [int][Math]::Round($br.Width)
                h = [int][Math]::Round($br.Height)
            }
        }
    } catch {}

    # Apply role filter
    if ($roleFilter.Count -gt 0 -and $role -ne '' -and $roleFilter -notcontains $role) {
        # Still recurse children — a filtered-out container may hold matching children
        if ($Depth -lt $maxDepth) {
            $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
            $child = $walker.GetFirstChild($Element)
            $results = @()
            while ($null -ne $child) {
                $childResult = Walk-Element -Element $child -Depth ($Depth + 1)
                if ($null -ne $childResult) {
                    if ($childResult -is [System.Collections.IEnumerable] -and $childResult -isnot [hashtable]) {
                        $results += $childResult
                    } else {
                        $results += $childResult
                    }
                }
                $child = $walker.GetNextSibling($child)
            }
            if ($results.Count -gt 0) { return $results }
            return $null
        }
        return $null
    }

    $children = @()
    if ($Depth -lt $maxDepth) {
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $child = $walker.GetFirstChild($Element)
        while ($null -ne $child) {
            $childResult = Walk-Element -Element $child -Depth ($Depth + 1)
            if ($null -ne $childResult) {
                if ($childResult -is [System.Collections.IEnumerable] -and $childResult -isnot [hashtable]) {
                    $children += $childResult
                } else {
                    $children += $childResult
                }
            }
            $child = $walker.GetNextSibling($child)
        }
    }

    return @{
        name = if ($null -eq $name) { '' } else { $name }
        role = if ($null -eq $role) { '' } else { $role }
        boundingRect = $rect
        automationId = if ($null -eq $automationId) { '' } else { $automationId }
        isEnabled = [bool]$isEnabled
        isOffscreen = [bool]$isOffscreen
        children = $children
    }
}

try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    if ($null -eq $root) {
        Write-Output '{"error":"Window handle not found"}'
        exit 0
    }
    $result = Walk-Element -Element $root -Depth 0
    if ($null -eq $result) {
        Write-Output '[]'
    } elseif ($result -is [System.Collections.IEnumerable] -and $result -isnot [hashtable]) {
        $result | ConvertTo-Json -Compress -Depth 10
    } else {
        @($result) | ConvertTo-Json -Compress -Depth 10
    }
} catch {
    Write-Output ('{"error":"' + ($_.Exception.Message -replace '"', '\\"') + '"}')
}
`;
}

export interface GetUiElementsOpts {
  maxDepth?: number;
  roleFilter?: string[];
}

export function getUiElements(hwnd: number, opts?: GetUiElementsOpts): UiElement[] {
  const maxDepth = Math.min(5, Math.max(1, opts?.maxDepth ?? 3));
  const roleFilter = opts?.roleFilter;

  // Cache key includes hwnd + maxDepth + roleFilter
  const cacheKey = `${hwnd}:${maxDepth}:${(roleFilter ?? []).join(',')}`;
  if (cache && cache.key === cacheKey && (Date.now() - cache.ts) < CACHE_TTL_MS) {
    console.log('[sidecar] ui-elements: cache hit');
    return cache.data;
  }

  console.log(`[sidecar] ui-elements: cache miss — spawning powershell (hwnd=${hwnd}, depth=${maxDepth})`);
  const script = buildScript(hwnd, maxDepth, roleFilter);

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', timeout: 15_000 }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`PowerShell exited ${result.status}: ${result.stderr}`);
  }

  const raw = result.stdout.trim();
  if (!raw || raw === 'null') return [];

  const parsed = JSON.parse(raw);

  // Check for error response
  if (parsed && typeof parsed === 'object' && 'error' in parsed && !Array.isArray(parsed)) {
    throw new Error(parsed.error as string);
  }

  const data = (Array.isArray(parsed) ? parsed : [parsed]) as UiElement[];
  cache = { data, ts: Date.now(), key: cacheKey };
  return data;
}

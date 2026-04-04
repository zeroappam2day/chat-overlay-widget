/**
 * EAC-8: Enhanced Accessibility Bridge
 *
 * Deeper UI Automation tree traversal, pattern-based element search,
 * and native Invoke/SetValue patterns via PowerShell System.Windows.Automation.
 */

import { spawnSync } from 'node:child_process';

export interface UIElement {
  name: string;
  automationId: string;
  className: string;
  controlType: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  path: string[];
}

// ─── Cache ──────────────────────────────────────────────────────────────────

let searchCache: { key: string; data: UIElement[]; ts: number } | null = null;
const CACHE_TTL_MS = 2_000;

export function resetCache(): void {
  treeCache = null;
}

// ─── PowerShell runner ──────────────────────────────────────────────────────

function runPs(script: string): string {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf-8',
    timeout: 15_000,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`PowerShell spawn error: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`PowerShell exited with code ${result.status}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

// ─── Search Elements ────────────────────────────────────────────────────────

const SEARCH_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$hwnd = [IntPtr]::new($HWND_VAL)
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$searchText = "$SEARCH_TEXT_VAL"
$searchProp = "$SEARCH_PROP_VAL"
$maxResults = $MAX_RESULTS_VAL
$maxDepth = $MAX_DEPTH_VAL

$results = New-Object System.Collections.ArrayList
$queue = New-Object System.Collections.Queue
$queue.Enqueue(@{ Element = $root; Depth = 0; Path = @() })

while ($queue.Count -gt 0 -and $results.Count -lt $maxResults) {
    $item = $queue.Dequeue()
    $el = $item.Element
    $depth = $item.Depth
    $path = $item.Path

    try {
        $name = $el.Current.Name
        $aId = $el.Current.AutomationId
        $cls = $el.Current.ClassName
        $ct = $el.Current.ControlType.ProgrammaticName

        $match = $false
        if ($searchProp -eq 'name' -and $name -like "*$searchText*") { $match = $true }
        elseif ($searchProp -eq 'automationId' -and $aId -like "*$searchText*") { $match = $true }
        elseif ($searchProp -eq 'className' -and $cls -like "*$searchText*") { $match = $true }

        if ($match) {
            $rect = $el.Current.BoundingRectangle
            $results.Add(@{
                name = $name
                automationId = $aId
                className = $cls
                controlType = $ct
                boundingRect = @{ x = [int]$rect.X; y = [int]$rect.Y; width = [int]$rect.Width; height = [int]$rect.Height }
                path = $path + @($name)
            }) | Out-Null
        }

        if ($depth -lt $maxDepth) {
            $children = $el.FindAll([System.Windows.Automation.TreeScope]::Children,
                [System.Windows.Automation.Condition]::TrueCondition)
            foreach ($child in $children) {
                $queue.Enqueue(@{ Element = $child; Depth = $depth + 1; Path = $path + @($name) })
            }
        }
    } catch { }
}

$results | ConvertTo-Json -Depth 5 -Compress
`;

export interface SearchElementsOpts {
  hwnd?: number;
  title?: string;
  searchText: string;
  searchProperty: 'name' | 'automationId' | 'className';
  maxResults?: number;
  maxDepth?: number;
}

function resolveHwnd(hwnd?: number, title?: string): number {
  if (hwnd) return hwnd;
  if (title) {
    const findScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class HwndFinder {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@
[HwndFinder]::FindWindow($null, '${title.replace(/'/g, "''")}').ToInt64()
`;
    const out = runPs(findScript);
    const val = parseInt(out, 10);
    if (!val || val === 0) throw new Error(`Window not found: "${title}"`);
    return val;
  }
  throw new Error('Either hwnd or title is required');
}

export async function searchElements(opts: SearchElementsOpts): Promise<UIElement[]> {
  const hwnd = resolveHwnd(opts.hwnd, opts.title);
  const maxResults = opts.maxResults ?? 10;
  const maxDepth = opts.maxDepth ?? 8;

  // Check cache
  const now = Date.now();
  if (treeCache && treeCache.hwnd === hwnd && (now - treeCache.ts) < CACHE_TTL_MS) {
    // Filter cached results
    return filterElements(treeCache.data, opts.searchText, opts.searchProperty).slice(0, maxResults);
  }

  const script = SEARCH_SCRIPT
    .replace('$HWND_VAL', String(hwnd))
    .replace('$SEARCH_TEXT_VAL', opts.searchText.replace(/"/g, '`"'))
    .replace('$SEARCH_PROP_VAL', opts.searchProperty)
    .replace('$MAX_RESULTS_VAL', String(maxResults))
    .replace('$MAX_DEPTH_VAL', String(maxDepth));

  const raw = runPs(script);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const elements: UIElement[] = (Array.isArray(parsed) ? parsed : [parsed]).map((el: Record<string, unknown>) => ({
    name: String(el.name ?? ''),
    automationId: String(el.automationId ?? ''),
    className: String(el.className ?? ''),
    controlType: String(el.controlType ?? ''),
    boundingRect: el.boundingRect as UIElement['boundingRect'] ?? { x: 0, y: 0, width: 0, height: 0 },
    path: Array.isArray(el.path) ? el.path.map(String) : [],
  }));

  // Cache the results
  treeCache = { hwnd, data: elements, ts: now };

  return elements;
}

function filterElements(elements: UIElement[], searchText: string, prop: 'name' | 'automationId' | 'className'): UIElement[] {
  const lower = searchText.toLowerCase();
  return elements.filter(el => {
    const value = prop === 'name' ? el.name : prop === 'automationId' ? el.automationId : el.className;
    return value.toLowerCase().includes(lower);
  });
}

// ─── Invoke Element ─────────────────────────────────────────────────────────

export interface InvokeElementOpts {
  hwnd: number;
  automationId?: string;
  name?: string;
  role?: string;
}

const INVOKE_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$hwnd = [IntPtr]::new($HWND_VAL)
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)

$CONDITION_BLOCK

$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($el -eq $null) {
    @{ ok = $false; error = "Element not found" } | ConvertTo-Json -Compress
    exit
}

try {
    $pattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $pattern.Invoke()
    @{ ok = $true } | ConvertTo-Json -Compress
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`;

function buildCondition(opts: { automationId?: string; name?: string; role?: string }): string {
  const conditions: string[] = [];
  if (opts.automationId) {
    conditions.push(`New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '${opts.automationId.replace(/'/g, "''")}')`);
  }
  if (opts.name) {
    conditions.push(`New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '${opts.name.replace(/'/g, "''")}')`);
  }
  if (conditions.length === 0) throw new Error('automationId or name is required');
  if (conditions.length === 1) return `$condition = ${conditions[0]}`;
  return `$condition = New-Object System.Windows.Automation.AndCondition(${conditions.join(', ')})`;
}

export async function invokeElement(opts: InvokeElementOpts): Promise<{ ok: boolean; error?: string }> {
  const conditionBlock = buildCondition(opts);
  const script = INVOKE_SCRIPT
    .replace('$HWND_VAL', String(opts.hwnd))
    .replace('$CONDITION_BLOCK', conditionBlock);

  const raw = runPs(script);
  try {
    return JSON.parse(raw) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Failed to parse response' };
  }
}

// ─── Set Element Value ──────────────────────────────────────────────────────

export interface SetElementValueOpts {
  hwnd: number;
  automationId?: string;
  name?: string;
  value: string;
}

const SET_VALUE_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$hwnd = [IntPtr]::new($HWND_VAL)
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)

$CONDITION_BLOCK

$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($el -eq $null) {
    @{ ok = $false; error = "Element not found" } | ConvertTo-Json -Compress
    exit
}

try {
    $pattern = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $pattern.SetValue("$VALUE_VAL")
    @{ ok = $true } | ConvertTo-Json -Compress
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`;

export async function setElementValue(opts: SetElementValueOpts): Promise<{ ok: boolean; error?: string }> {
  const conditionBlock = buildCondition(opts);
  const script = SET_VALUE_SCRIPT
    .replace('$HWND_VAL', String(opts.hwnd))
    .replace('$CONDITION_BLOCK', conditionBlock)
    .replace('$VALUE_VAL', opts.value.replace(/"/g, '`"'));

  const raw = runPs(script);
  try {
    return JSON.parse(raw) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Failed to parse response' };
  }
}

// ─── Get Element Patterns ───────────────────────────────────────────────────

export interface GetElementPatternsOpts {
  hwnd: number;
  automationId?: string;
  name?: string;
}

const GET_PATTERNS_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$hwnd = [IntPtr]::new($HWND_VAL)
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)

$CONDITION_BLOCK

$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($el -eq $null) {
    @{ patterns = @() } | ConvertTo-Json -Compress
    exit
}

$supported = $el.GetSupportedPatterns()
$names = $supported | ForEach-Object { $_.ProgrammaticName }
@{ patterns = @($names) } | ConvertTo-Json -Compress
`;

export async function getElementPatterns(opts: GetElementPatternsOpts): Promise<{ patterns: string[] }> {
  const conditionBlock = buildCondition(opts);
  const script = GET_PATTERNS_SCRIPT
    .replace('$HWND_VAL', String(opts.hwnd))
    .replace('$CONDITION_BLOCK', conditionBlock);

  const raw = runPs(script);
  try {
    const result = JSON.parse(raw) as { patterns: string[] };
    return { patterns: Array.isArray(result.patterns) ? result.patterns.map(String) : [] };
  } catch {
    return { patterns: [] };
  }
}

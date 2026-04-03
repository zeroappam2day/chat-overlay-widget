# Implementation Plan: Windows Screen Annotation Overlay

This document outlines the deterministic, brownfield solution for adding a transparent, click-through annotation overlay to the `214_Chat_overlay_widget` project.

## 1. Project Context Summary
- **Primary Tech:** Tauri v1 (Rust), React (TS), Vite, TailwindCSS.
- **Sidecar:** Node.js process using `caxa`, `node-pty`, and `sharp`.
- **Operating System:** Windows 11.
- **Goal:** Enable the LLM to "draw and write" annotations (boxes/text) over any active Windows application in real-time.

---

## 2. Component Manifest

### A. Overlay Entry Point (`overlay.html`)
Create this in the project root. It provides the transparent DOM layer.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Annotation Overlay</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent !important;
        pointer-events: none; /* Ghost mode by default */
      }
      #root { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/overlay_main.tsx"></script>
  </body>
</html>
```

### B. React Annotation Layer (`src/components/Overlay.tsx`)
Deterministic SVG-based drawing engine researched via Context7.

```tsx
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface Annotation {
  id: string;
  type: 'box' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
}

export const Overlay: React.FC = () => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    // Listen for 'update-annotations' events from the Rust/Sidecar logic
    const unlisten = listen<Annotation[]>('update-annotations', (event) => {
      setAnnotations(event.payload);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  return (
    <svg width="100%" height="100%" style={{ pointerEvents: 'none' }}>
      {annotations.map((ann) => (
        <g key={ann.id}>
          {ann.type === 'box' && (
            <rect
              x={ann.x}
              y={ann.y}
              width={ann.width}
              height={ann.height}
              fill="none"
              stroke="#ff3e00"
              strokeWidth="3"
              strokeDasharray="5,5"
            />
          )}
          {ann.label && (
            <text
              x={ann.x}
              y={ann.y - 10}
              fill="#ff3e00"
              fontSize="16"
              fontWeight="bold"
              style={{ filter: 'drop-shadow(0px 0px 2px black)' }}
            >
              {ann.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};
```

### C. Overlay Entry Point (`src/overlay_main.tsx`)
The React mount point for the overlay window.

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Overlay } from './components/Overlay';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>
);
```

### D. Spatial Awareness Module (`sidecar/spatial_engine.js`)
Read-only module to fetch the coordinates of the focused window.

```javascript
const { exec } = require('child_process');

function getActiveWindowRect() {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public struct RECT { public int Left, Top, Right, Bottom; }
      public class WindowUtils {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
      }
"@
    $rect = New-Object RECT
    $handle = [WindowUtils]::GetForegroundWindow()
    if ([WindowUtils]::GetWindowRect($handle, [ref]$rect)) {
      $rect | ConvertTo-Json
    }
  `;

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout) => {
      if (error) reject(error);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

module.exports = { getActiveWindowRect };
```

---

## 3. Integration Steps

### Step 1: Update `tauri.conf.json`
Add the secondary window to the `windows` array.
```json
{
  "label": "annotation-overlay",
  "url": "overlay.html",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "fullscreen": true,
  "visible": false
}
```

### Step 2: Implement Toggle Logic (Zustand)
In your `store.ts`, add the toggle functionality:
```typescript
import { WebviewWindow } from '@tauri-apps/api/window';

// Inside store definition:
toggleOverlay: async () => {
  const overlay = WebviewWindow.getByLabel('annotation-overlay');
  if (overlay) {
    const isVisible = await overlay.isVisible();
    if (isVisible) {
      await overlay.hide();
    } else {
      await overlay.show();
      await overlay.setIgnoreCursorEvents(true); // Ensure click-through is default
    }
  }
}
```

### Step 3: Safety Kill-Switch (Rust)
In `src-tauri/src/main.rs`, register a global shortcut to force-disable the overlay if it gets stuck.
```rust
use tauri::{GlobalShortcutManager, Manager};

// In setup block:
let app_handle = app.handle();
app.global_shortcut_manager().register("Alt+Shift+X", move || {
    if let Some(win) = app_handle.get_window("annotation-overlay") {
        win.hide().unwrap();
        win.set_ignore_cursor_events(true).unwrap();
    }
}).unwrap();
```

---

## 4. Adversarial Review & Safety Gates
1. **Z-Order Preservation:** The overlay uses `alwaysOnTop: true` and Win32 `HWND_TOPMOST` logic via Tauri to stay above target apps.
2. **Performance:** SVG is GPU-accelerated in the webview; zero impact on sidecar terminal (`node-pty`) performance.
3. **Privacy:** `getActiveWindowRect` is read-only. It does not scrape pixels (unlike `sharp`), making it low-risk for anti-virus flags.
4. **Usability:** `setIgnoreCursorEvents(true)` ensures the user's primary workflow is never blocked by the "ghost" window.

# Annotation System — User Guide

## Quick Start

1. Open the app with `start.bat`
2. In the header bar, click the **gear icon** (Feature Flags)
3. Turn on **Annotation Overlay**
4. Click the **pen icon** in the header bar (or press **Alt+Shift+X**)
5. The transparent overlay window is now active — annotations will appear on top of your screen

---

## Feature Flags

Two flags control the annotation system. Both are **off by default**.

| Flag | What it does |
|------|-------------|
| **Annotation Overlay** | Enables the overlay window, annotation rendering, and all annotation features |
| **Guided Walkthrough Panel** | Shows the floating step-info panel during walkthroughs (requires Annotation Overlay to also be on) |

Toggle them in the Feature Flags dropdown (gear icon in the header bar).

---

## Showing / Hiding the Overlay

- **Pen icon** in the header bar — click to toggle
- **Alt+Shift+X** — keyboard shortcut to toggle (only works when Annotation Overlay flag is on)

When hidden, annotations are not visible but the system still accepts them. Show the overlay to see them.

---

## Drawing Annotations

Any LLM agent connected via MCP can draw annotations using the `send_annotation` tool.

You can also test manually with curl. Find your port and token in `%APPDATA%\chat-overlay-widget\api.json`, then:

```bash
# Draw a red box with a label
curl -X POST http://127.0.0.1:<PORT>/annotations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action":"set","annotations":[{"id":"demo","type":"box","x":100,"y":200,"width":300,"height":60,"label":"Look here!"}]}'

# Clear everything
curl -X POST http://127.0.0.1:<PORT>/annotations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action":"clear-all"}'
```

### Annotation types

| Type | What it looks like |
|------|-------------------|
| **box** | Dashed rectangle outline |
| **highlight** | Semi-transparent filled rectangle |
| **arrow** | Line with arrowhead (from x,y to x+width, y+height) |
| **text** | Standalone text with drop-shadow |

### Annotation properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | yes | Unique identifier (used for updates and clearing) |
| `type` | yes | box, arrow, text, or highlight |
| `x` | yes | X position in pixels from left edge |
| `y` | yes | Y position in pixels from top edge |
| `width` | no | Width in pixels (used by box, highlight, arrow) |
| `height` | no | Height in pixels (used by box, highlight, arrow) |
| `label` | no | Text label displayed near the annotation |
| `color` | no | Hex color like `#ff3e00` (default: red-orange) |
| `ttl` | no | Auto-expire after N seconds (0 = stay forever) |
| `group` | no | Group name for batch clearing |

### Actions

| Action | What it does |
|--------|-------------|
| `set` | Replace all annotations with the ones you provide |
| `merge` | Add new annotations, update existing ones by id |
| `clear` | Remove specific annotations by id |
| `clear-group` | Remove all annotations sharing a group name |
| `clear-all` | Remove every annotation |

---

## Guided Walkthroughs

A walkthrough is a sequence of steps. Each step has a title, instruction, and annotations that highlight what to do on screen.

### Starting a walkthrough (via MCP or curl)

```bash
curl -X POST http://127.0.0.1:<PORT>/walkthrough/start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-guide",
    "title": "Getting Started",
    "steps": [
      {
        "stepId": "step1",
        "title": "Open the terminal",
        "instruction": "Click the terminal area at the bottom of the screen",
        "annotations": [
          {"id":"s1","type":"box","x":0,"y":600,"width":1200,"height":50,"label":"Click here"}
        ]
      },
      {
        "stepId": "step2",
        "title": "Run a command",
        "instruction": "Type hello and press Enter",
        "annotations": [
          {"id":"s2","type":"text","x":100,"y":630,"label":"Type: hello"}
        ]
      }
    ]
  }'
```

When a walkthrough starts:
- Step 1 annotations appear on the overlay
- If the **Guided Walkthrough Panel** flag is on, a dark panel appears in the bottom-right showing "STEP 1 OF 2", the title, and the instruction

### Advancing to the next step

```bash
curl -X POST http://127.0.0.1:<PORT>/walkthrough/advance \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

The previous step's annotations are replaced with the next step's annotations. The panel updates. After the last step, the walkthrough ends and all annotations are cleared.

### Stopping a walkthrough early

```bash
curl -X POST http://127.0.0.1:<PORT>/walkthrough/stop \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Clears all annotations and hides the step panel immediately.

---

## MCP Tools (for LLM agents)

When an LLM agent is connected via MCP, these tools are available:

| Tool | What it does |
|------|-------------|
| `send_annotation` | Draw, update, or clear annotations on the overlay |
| `start_guided_walkthrough` | Start a multi-step walkthrough |
| `advance_walkthrough` | Move to the next step |
| `stop_walkthrough` | Stop the walkthrough and clear annotations |

These work with any MCP-compatible agent (Claude Code, Cursor, Windsurf, etc.).

---

## Troubleshooting

**Annotations don't appear**
- Is the **Annotation Overlay** flag turned on?
- Did you click the pen icon (or press Alt+Shift+X) to show the overlay?

**Step panel doesn't appear during walkthrough**
- Is the **Guided Walkthrough Panel** flag turned on?

**Alt+Shift+X doesn't work**
- Is the **Annotation Overlay** flag turned on?
- Is the **Keyboard Navigation** flag turned on?
- Is the app window focused?

**Annotations appear in the wrong position**
- Coordinates are in screen pixels from the top-left corner
- Check your display scaling (DPI) — coordinates are in logical pixels

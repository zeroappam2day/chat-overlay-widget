# Chat Overlay & Annotation System: Developer & User Guide

This document explains how the Chat Overlay Widget and the `chat-overlay` Gemini CLI skill work together to provide real-time, step-by-step guidance through terminal monitoring and screen annotations.

## 1. System Overview

The system consists of three main layers:
1.  **Frontend (Tauri/React):** A transparent, click-through window that renders SVG annotations (boxes, text) and a terminal emulator.
2.  **Sidecar (Node.js):** A local HTTP/WebSocket server that bridges the agent and the UI. It captures screenshots, reads terminal buffers, and broadcasts events.
3.  **Agent Skill (`chat-overlay`):** A Gemini CLI skill containing a Python agent that communicates with the sidecar to "see" and "draw."

---

## 2. The Interaction Flow

When a user asks for guidance (e.g., *"Help me use the terminal to deploy this app"*), the following flow occurs:

1.  **Observation:** The Agent calls the skill's `terminal` or `screenshot` command.
    *   *Agent -> Sidecar (GET /terminal-state) -> UI Buffer.*
2.  **Analysis:** The Agent identifies the next step (e.g., "Click the 'Login' button").
3.  **Annotation:** The Agent calls the skill's `annotate` command with JSON coordinates.
    *   *Agent -> Sidecar (POST /hook-event) -> WebSocket Broadcast.*
4.  **Rendering:** The Frontend receives the event and updates the SVG layer.
    *   *WebSocket -> React State -> SVG Render on Transparent Overlay.*
5.  **Execution:** The user sees the red box/label on their screen and performs the action.
6.  **Verification:** The Agent takes a new screenshot to confirm the state change.

---

## 3. Key Files & Components

| File Path | Purpose |
| :--- | :--- |
| `src/components/Overlay.tsx` | React component that listens for `update-annotations` and renders the SVG layer. |
| `sidecar/src/server.ts` | The HTTP server handling `/screenshot`, `/terminal-state`, and `/hook-event`. |
| `sidecar/src/agentEvent.ts` | Normalizes incoming agent actions into a standard event format. |
| `scripts/agent.py` | The codified logic within the Gemini skill that performs the HTTP requests. |
| `SKILL.md` | The high-level instructions that tell Gemini CLI when and how to use the agent script. |

---

## 4. Usage Commands

### For the Agent (via Skill)
The agent uses these internal commands to guide you:

*   **Read Terminal:** `python agent.py terminal --lines 50`
*   **Capture Screen:** `python agent.py screenshot`
*   **Draw Annotation:** 
    ```powershell
    python agent.py annotate --json '[{"id":"step1","type":"box","x":100,"y":150,"width":200,"height":50,"label":"NEXT STEP: Run npm install"}]'
    ```

### For the User
*   **Toggle Overlay:** Use the Pen icon in the App Header or the global shortcut `Alt+Shift+X`.
*   **Reload Skills:** If the agent isn't drawing, run `/skills reload` in the Gemini CLI.

---

## 5. Patterns & Rules

### Annotation Schema
Annotations sent to the `annotate` command must follow this JSON structure:
```json
{
  "id": "unique-string",
  "type": "box",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "label": "Text to display"
}
```

### Safety Rules
*   **Secret Scrubbing:** The system performs best-effort scrubbing of API keys and passwords in terminal output before the agent sees them.
*   **Privacy Blur:** Screenshots are automatically blurred in sensitive areas to prevent the agent from reading unrelated private data.

---

## 6. Limitations & Known Issues

1.  **Coordinate Mapping:** Annotations are currently relative to the Overlay window. If the target application moves, the annotation might become misaligned until the agent refreshes the state.
2.  **Click-Through:** The annotation layer is "ghost" (click-through) by default. You cannot interact with the boxes themselves; they are visual guides only.
3.  **App Focus:** The agent can only "see" what is inside the Chat Overlay Widget or the active window it captures. It cannot see your entire desktop unless specifically configured.

---

## 7. Troubleshooting
*   **"Discovery file not found":** Ensure the Chat Overlay Widget app is running.
*   **Annotations not appearing:** Check if the Overlay is hidden (Alt+Shift+X).
*   **Agent says "Unauthorized":** The auth token in `api.port` may have changed; restart the sidecar.
